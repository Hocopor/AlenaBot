import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { telegramBotService } from "./src/bot";
import { sessionManager } from "./src/botSession";
import { botConfig } from "./src/botConfig";

// Инициализируем переменные окружения из .env файла
dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Хранилище сессий администратора в памяти сервера (Токен -> { username, expires })
  const activeSessions = new Map<string, { username: string; expires: number }>();

  // Загружаем конфиг безопасности из переменных окружения
  const adminUsername = process.env.ADMIN_USERNAME || "admin";
  const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
  const adminPasswordSalt = process.env.ADMIN_PASSWORD_SALT || "alena_default_salt";
  let adminPlaintextPassword = process.env.ADMIN_PASSWORD;

  // Если в .env нет ни хэша, ни пароля, автоматически генерируем безопасный временный пароль
  if (!adminPlaintextPassword && !adminPasswordHash) {
    adminPlaintextPassword = crypto.randomBytes(6).toString("hex"); // 12 случайных символов
    console.log(`\n=============================================================`);
    console.log(`⚠️  БЕЗОПАСНОСТЬ: Административный пароль не задан в .env!`);
    console.log(`🔑 ВРЕМЕННЫЙ ПАРОЛЬ ДЛЯ ВХОДА: ${adminPlaintextPassword}`);
    console.log(`👤 ИМЯ ПОЛЬЗОВАТЕЛЯ: ${adminUsername}`);
    console.log(`💡 Пожалуйста, скопируйте этот пароль для входа в админку!`);
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

  // Логгирование входящих HTTP запросов
  app.use((req, res, next) => {
    if (!req.path.startsWith("/api/bot-logs")) {
      console.log(`[HTTP] ${req.method} ${req.path}`);
    }
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
