import express from "express";
import path from "path";
import fileUpload from "express-fileupload";
import fs from "fs";
import crypto from "crypto";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { telegramBotService } from "./src/bot";
import { sessionManager } from "./src/botSession";
import { botConfig } from "./src/botConfig";
import { scenarioManager } from "./src/scenarioManager";

// Инициализируем переменные окружения из .env файла
dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Хранилище сессий администратора в памяти сервера (Токен -> { username, expires })
  const activeSessions = new Map<string, { username: string; expires: number }>();

  // Загружаем конфиг безопасности из переменных окружения или admin-auth.json
  const AUTH_FILE = path.join(process.cwd(), "admin-auth.json");
  let adminUsername = process.env.ADMIN_USERNAME || "admin";
  let adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
  let adminPasswordSalt = process.env.ADMIN_PASSWORD_SALT || "alena_default_salt";
  let adminPlaintextPassword = process.env.ADMIN_PASSWORD;

  if (fs.existsSync(AUTH_FILE)) {
    try {
      const authData = JSON.parse(fs.readFileSync(AUTH_FILE, "utf-8"));
      if (authData.username) adminUsername = authData.username;
      if (authData.passwordHash) adminPasswordHash = authData.passwordHash;
      if (authData.passwordSalt) adminPasswordSalt = authData.passwordSalt;
      adminPlaintextPassword = undefined;
      console.log("[Auth] Loaded persistent admin settings from admin-auth.json");
    } catch (e) {
      console.error("[Auth] Error reading admin-auth.json:", e);
    }
  }

  // Если в .env или admin-auth.json нет ни хэша, ни пароля, автоматически устанавливаем удобный пароль "admin" для тестирования
  if (!adminPlaintextPassword && !adminPasswordHash) {
    adminPlaintextPassword = "admin"; // По умолчанию "admin"
    console.log(`\n=============================================================`);
    console.log(`⚠️  БЕЗОПАСНОСТЬ: Административный пароль не задан!`);
    console.log(`🔑 ПАРОЛЬ ДЛЯ ВХОДА ПО УМОЛЧАНИЮ: ${adminPlaintextPassword}`);
    console.log(`👤 ИМЯ ПОЛЬЗОВАТЕЛЯ: ${adminUsername}`);
    console.log(`💡 Вы можете сменить это имя и пароль в панели настроек.`);
    console.log(`=============================================================\n`);
  }

  // Функция для безопасного хэширования
  function hashPassword(password: string, salt: string): string {
    return crypto.createHmac("sha256", salt).update(password).digest("hex");
  }

  // Middleware для проверки авторизации на всех закрытых роутах
  function checkAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Access denied. Auth token required." });
    }
    const token = authHeader.substring(7);
    const session = activeSessions.get(token);
    
    if (!session || session.expires < Date.now()) {
      if (session) activeSessions.delete(token);
      return res.status(401).json({ error: "Your session has expired. Please log in again." });
    }
    
    next();
  }

  // Telegram API отправляет обновления в формате JSON, поэтому нам обязательно нужен парсер
  app.use(express.json());

  // Разрешаем загрузку файлов во временную папку
  app.use(fileUpload({
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    useTempFiles: true,
    tempFileDir: "/tmp/"
  }));

  // Раздача статических медиафайлов/документов, загруженных админами
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  // Логгирование входящих HTTP запросов (только ошибки >= 400)
  app.use((req, res, next) => {
    res.on("finish", () => {
      if (res.statusCode >= 400) {
        console.error(`[HTTP ${res.statusCode}] ${req.method} ${req.path}`);
      }
    });
    next();
  });

  // Эндпоинты для вебхуков Telegram
  app.post("/api/telegram-webhook", (req, res) => {
    try {
      telegramBotService.handleWebhookUpdate(req.body);
      res.status(200).send("OK");
    } catch (err) {
      console.error("[Webhook Error] Failure handling update:", err);
      res.status(500).send("Database or processing failure.");
    }
  });

  // API: Здоровье сервера
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // API: Загрузка файлов и аудио для блоков конструктора сценариев (Защищено)
  app.post("/api/upload", checkAuth, (req: any, res) => {
    try {
      if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).json({ error: "Файл не передан." });
      }

      const fileKey = Object.keys(req.files)[0];
      const uploadedFile = req.files[fileKey];
      const file = Array.isArray(uploadedFile) ? uploadedFile[0] : uploadedFile;

      const uploadDir = path.join(process.cwd(), "uploads");
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      // Генерация уникального случайного имени
      const rawExt = path.extname(file.name);
      const randomName = crypto.randomBytes(16).toString("hex") + rawExt;
      const destPath = path.join(uploadDir, randomName);

      file.mv(destPath, (err: any) => {
        if (err) {
          console.error("[Upload] Error moving file to destination:", err);
          return res.status(500).json({ error: "Не удалось сохранить файл на сервере." });
        }

        res.json({
          success: true,
          url: `/uploads/${randomName}`,
          name: file.name
        });
      });
    } catch (e: any) {
      console.error("[Upload] Exception during file upload:", e);
      res.status(500).json({ error: e.message || "Ошибка обработки загрузки файла." });
    }
  });

  // API: Авторизация (Login - возвращает временный токен сессии)
  app.post("/api/login", (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    if (username !== adminUsername) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    let isMatch = false;

    if (adminPasswordHash) {
      // Сверяем хэшированный пароль
      const inputHash = hashPassword(password, adminPasswordSalt);
      try {
        isMatch = crypto.timingSafeEqual(Buffer.from(inputHash), Buffer.from(adminPasswordHash));
      } catch (e) {
        isMatch = (inputHash === adminPasswordHash);
      }
    } else if (adminPlaintextPassword) {
      // Сверяем plain-text пароль из .env
      try {
        isMatch = crypto.timingSafeEqual(Buffer.from(password), Buffer.from(adminPlaintextPassword));
      } catch (e) {
        isMatch = (password === adminPlaintextPassword);
      }
    }

    if (isMatch) {
      // Генерируем случайный токен сессии
      const token = crypto.randomBytes(32).toString("hex");
      // Сессия действительна 24 часа
      activeSessions.set(token, {
        username,
        expires: Date.now() + 24 * 60 * 60 * 1000
      });
      res.json({ success: true, token, username });
    } else {
      res.status(401).json({ error: "Invalid username or password" });
    }
  });

  // API эндпоинт для генерации безопасных хэшей (доступен только авторизованным пользователям)
  app.post("/api/generate-hash", checkAuth, (req, res) => {
    const { password, salt } = req.body;
    if (!password) {
      return res.status(400).json({ error: "Password field is required to hash." });
    }
    const finalSalt = salt || crypto.randomBytes(16).toString("hex");
    const hash = hashPassword(password, finalSalt);
    res.json({
      salt: finalSalt,
      hash: hash,
      instructions: `Добавьте следующие строчки в ваш файл .env на сервере:\nADMIN_PASSWORD_HASH="${hash}"\nADMIN_PASSWORD_SALT="${finalSalt}"\nПосле этого удалите исходную строчку ADMIN_PASSWORD!`
    });
  });

  // API: Статус и конфигурация бота (Защищено)
  app.get("/api/bot-status", checkAuth, (req, res) => {
    try {
      const status = telegramBotService.getStatus();
      const sessions = sessionManager.getAllSessions();
      
      res.json({
        ...status,
        sessionCount: sessions.length,
        sessionsList: sessions.map(s => ({
          userId: s.userId,
          username: s.username,
          firstName: s.firstName,
          lastName: s.lastName,
          startedAt: s.startedAt,
          step1ChoiceId: s.step1ChoiceId,
          step2ChoiceId: s.step2ChoiceId,
          menuUnlocked: s.menuUnlocked
        })),
        config: {
          telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ? `${process.env.TELEGRAM_BOT_TOKEN.substring(0, 10)}...` : "NOT_SET",
          appUrl: process.env.APP_URL || "NOT_SET"
        }
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Failed to load bot status" });
    }
  });

  // API: Получить текущий живой сценарий
  app.get("/api/scenario", checkAuth, (req, res) => {
    try {
      const config = scenarioManager.loadConfig();
      res.json(config);
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Failed to load live scenario" });
    }
  });

  // API: Получить черновик сценария
  app.get("/api/scenario/draft", checkAuth, (req, res) => {
    try {
      const draft = scenarioManager.loadDraft();
      if (draft) {
        res.json({ draft, hasDraft: true });
      } else {
        const config = scenarioManager.loadConfig();
        res.json({ draft: config, hasDraft: false });
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Failed to load scenario draft" });
    }
  });

  // API: Сохранить черновик сценария
  app.post("/api/scenario/draft", checkAuth, (req, res) => {
    try {
      scenarioManager.saveDraft(req.body);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Failed to save scenario draft" });
    }
  });

  // API: Сбросить/Удалить черновик
  app.delete("/api/scenario/draft", checkAuth, (req, res) => {
    try {
      scenarioManager.deleteDraft();
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Failed to discard draft" });
    }
  });

  // API: Опубликовать (деплоить) сценарий на боевой
  app.post("/api/scenario/deploy", checkAuth, async (req, res) => {
    try {
      const draft = scenarioManager.loadDraft();
      if (!draft) {
        return res.status(400).json({ error: "Черновик для публикации не найден." });
      }

      // Валидируем
      const validation = scenarioManager.validateConfig(draft);
      if (!validation.isValid) {
        return res.status(400).json({ error: "Невозможно опубликовать невалидный сценарий", errors: validation.errors });
      }

      // Сохраняем как рабочий конфиг
      scenarioManager.saveConfig(draft);

      // Синхронизируем с конфигурацией для совместимости
      if (draft.telegramBotToken) {
        process.env.TELEGRAM_BOT_TOKEN = draft.telegramBotToken;
      }
      if (draft.contactLink) {
        botConfig.contactLink = draft.contactLink;
      }

      // Перезапускаем бота программно! Бот горячо перезапустится на лету
      console.log("[Deploy] Activating new dynamic scenario config and reloading telegramBotService...");
      const restartResult = await telegramBotService.start();

      // Удаляем черновик после успешного деплоя
      scenarioManager.deleteDraft();

      res.json({ success: true, botRestart: restartResult });
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Failed to deploy scenario config" });
    }
  });

  // API: Импорт сценария из файла (Загрузить и сразу сделать боевым)
  app.post("/api/scenario/import", checkAuth, async (req, res) => {
    try {
      const newConfig = req.body;
      if (!newConfig || !newConfig.blocks || !newConfig.menu) {
        return res.status(400).json({ error: "Некорректный формат файла сценария." });
      }

      // Валидируем
      const validation = scenarioManager.validateConfig(newConfig);
      if (!validation.isValid) {
        return res.status(400).json({ error: "Файл содержит логические ошибки и не может быть применен.", errors: validation.errors });
      }

      // Сохраняем как рабочий конфиг
      scenarioManager.saveConfig(newConfig);

      // Синхронизируем с конфигурацией для совместимости
      if (newConfig.telegramBotToken) {
        process.env.TELEGRAM_BOT_TOKEN = newConfig.telegramBotToken;
      }
      if (newConfig.contactLink) {
        botConfig.contactLink = newConfig.contactLink;
      }

      // Перезапускаем бота
      console.log("[Import] Activating imported scenario config and reloading telegramBotService...");
      const restartResult = await telegramBotService.start();

      // Удаляем черновик, чтобы он не конфликтовал с новыми данными
      scenarioManager.deleteDraft();

      res.json({ success: true, botRestart: restartResult });
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Failed to import scenario config" });
    }
  });

  // API: Валидация сценария перед отправкой
  app.post("/api/scenario/validate", checkAuth, (req, res) => {
    try {
      const validation = scenarioManager.validateConfig(req.body);
      res.json(validation);
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Failed to validate scenario schema" });
    }
  });

  // API: Список ошибок логирования сценариев
  app.get("/api/error-logs", checkAuth, (req, res) => {
    try {
      res.json({ errors: scenarioManager.getErrorLogs() });
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Failed to load error logs" });
    }
  });

  // API: Смена глобальных настроек (пароли, контакты и т.д.)
  app.post("/api/settings", checkAuth, async (req, res) => {
    try {
      const { newPassword, contactLink, telegramBotToken } = req.body;
      const currentLive = scenarioManager.loadConfig();
      let botTokenChanged = false;

      if (contactLink) {
        currentLive.contactLink = contactLink;
        botConfig.contactLink = contactLink;
      }
      if (telegramBotToken) {
        if (currentLive.telegramBotToken !== telegramBotToken) {
          botTokenChanged = true;
        }
        currentLive.telegramBotToken = telegramBotToken;
        process.env.TELEGRAM_BOT_TOKEN = telegramBotToken;
      }

      scenarioManager.saveConfig(currentLive);

      // Смена пароля администратора
      if (newPassword) {
        const salt = crypto.randomBytes(16).toString("hex");
        const hash = hashPassword(newPassword, salt);

        // Пишем новые значения в персистентный файл авторизации (не триггерит перезапуск dev-сервера)
        try {
          const authData = {
            username: adminUsername,
            passwordHash: hash,
            passwordSalt: salt
          };
          fs.writeFileSync(AUTH_FILE, JSON.stringify(authData, null, 2), "utf-8");

          // Обновляем текущие переменные в памяти сервера
          adminPasswordHash = hash;
          adminPasswordSalt = salt;
          adminPlaintextPassword = undefined;
          console.log("[Settings] Password hash successfully saved to admin-auth.json.");
        } catch (authErr) {
          console.error("Failed to write password hash to admin-auth.json: ", authErr);
        }
      }

      // Если обновился токен, автоматически перезапускаем бота на новом токене на лету!
      if (botTokenChanged && telegramBotToken) {
        console.log("[Settings] Telegram Bot Token changed! Relaunching telegramBotService...");
        const reloadRes = await telegramBotService.start();
        console.log(`[Settings] Bot relaunch completed. Success: ${reloadRes.success}, Mode: ${reloadRes.mode}`);
      }

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Failed to update settings" });
    }
  });

  // API: Логи бота (Защищено)
  app.get("/api/bot-logs", checkAuth, (req, res) => {
    res.json({ logs: telegramBotService.getLogs() });
  });

  // API: Перезапуск и установка новых настроек (Защищено)
  app.post("/api/bot-restart", checkAuth, async (req, res) => {
    const { token, appUrl } = req.body;
    
    if (token) {
      process.env.TELEGRAM_BOT_TOKEN = token;
    }
    if (appUrl) {
      process.env.APP_URL = appUrl;
    }

    // Попробуем прописать их и в .env файле
    try {
      const envPath = path.join(process.cwd(), ".env");
      let envContent = "";
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, "utf-8");
      }
      
      const lines = envContent.split("\n");
      const updatedLines = [];
      let tokenFound = false;
      let urlFound = false;

      for (let line of lines) {
        if (line.trim().startsWith("TELEGRAM_BOT_TOKEN")) {
          updatedLines.push(`TELEGRAM_BOT_TOKEN="${token || process.env.TELEGRAM_BOT_TOKEN || ''}"`);
          tokenFound = true;
        } else if (line.trim().startsWith("APP_URL")) {
          updatedLines.push(`APP_URL="${appUrl || process.env.APP_URL || ''}"`);
          urlFound = true;
        } else {
          updatedLines.push(line);
        }
      }

      if (!tokenFound) {
        updatedLines.push(`TELEGRAM_BOT_TOKEN="${token || process.env.TELEGRAM_BOT_TOKEN || ''}"`);
      }
      if (!urlFound) {
        updatedLines.push(`APP_URL="${appUrl || process.env.APP_URL || ''}"`);
      }

      fs.writeFileSync(envPath, updatedLines.join("\n"), "utf-8");
    } catch (envErr) {
      console.error("Failed to write inline env config update:", envErr);
    }

    console.log("[Setup] Restarting Telegram Bot Service standard routing...");
    const result = await telegramBotService.start();
    res.json({ success: true, ...result });
  });

  // Настройка Vite для Front-End сборки / рендеринга
  if (process.env.NODE_ENV !== "production") {
    console.log("[Vite] Integrating dev server middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("[Vite] Mounting static server (production mode)...");
    const distPath = path.join(process.cwd(), "dist");
    
    // Проверим, существует ли папка dist, если нет, создадим пустое заглушечное уведомление
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    } else {
      app.get("*", (req, res) => {
        res.send("Admin dashboard UI is building. Please refresh in a moment!");
      });
    }
  }

  // Запуск бота при старте приложения
  console.log("[Bot] Initiating Telegram bot handler service...");
  const botInitResult = await telegramBotService.start();
  console.log(`[Bot] Initialized. Success: ${botInitResult.success}, Mode: ${botInitResult.mode}`);

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`\n=============================================================`);
    console.log(`🚀 Psychological Telegram Support Bot Server is running!`);
    console.log(`🌐 Server available at: http://0.0.0.0:${PORT}`);
    console.log(`📁 File persistence sessions configured.`);
    console.log(`=============================================================\n`);
  });
}

// Запускаем сервер
startServer().catch((err) => {
  console.error("CRITICAL PORT CRASH DURING SERVER INITIALIZATION:", err);
});
