import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { telegramBotService } from "./src/bot";
import { sessionManager } from "./src/botSession";
import { botConfig } from "./src/botConfig";

async function startServer() {
  const app = express();
  const PORT = 3000;

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

  // API: Статус и конфигурация бота
  app.get("/api/bot-status", (req, res) => {
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

  // API: Логи бота
  app.get("/api/bot-logs", (req, res) => {
    res.json({ logs: telegramBotService.getLogs() });
  });

  // API: Перезапуск и установка новых настроек
  app.post("/api/bot-restart", async (req, res) => {
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
