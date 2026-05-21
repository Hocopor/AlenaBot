import { Bot, InlineKeyboard, Keyboard, Context, InputFile } from "grammy";
import fs from "fs";
import path from "path";
import { botConfig } from "./botConfig";
import { sessionManager, UserSession } from "./botSession";
import { scenarioManager, ScenarioBlock } from "./scenarioManager";

export class TelegramBotService {
  private bot: Bot | null = null;
  private isPollingActive = false;
  private isWebhookWorking = false;
  private logMessages: string[] = [];

  constructor() {
    this.addLog("Bot Service initialized.");
  }

  private addLog(msg: string) {
    const time = new Date().toISOString().replace("T", " ").substring(0, 19);
    const entry = `[${time}] ${msg}`;
    
    // Пишем в консоль только критические ошибки и предупреждения для минимизации логов
    const lower = msg.toLowerCase();
    if (lower.includes("error") || lower.includes("failed") || lower.includes("critical") || lower.includes("crash")) {
      console.error(entry);
    }
    
    this.logMessages.push(entry);
    if (this.logMessages.length > 100) {
      this.logMessages.shift();
    }
  }

  public getLogs(): string[] {
    return this.logMessages;
  }

  public getStatus() {
    return {
      initialized: this.bot !== null,
      isPollingActive: this.isPollingActive,
      isWebhookWorking: this.isWebhookWorking,
      hasToken: !!process.env.TELEGRAM_BOT_TOKEN,
      appUrl: process.env.APP_URL || "not configured",
      totalSessions: sessionManager.getAllSessions().length
    };
  }

  /**
   * Инициализация и запуск бота
   */
  public async start(): Promise<{ success: boolean; mode: "webhook" | "polling" | "failed"; error?: string }> {
    if (this.bot) {
      try {
        await this.bot.stop();
        this.addLog("Previous bot instance stopped successfully.");
      } catch (e: any) {
        this.addLog(`Note: previous bot stop returned: ${e.message || e}`);
      }
      this.bot = null;
      this.isPollingActive = false;
      this.isWebhookWorking = false;
    }

    const token = scenarioManager.loadConfig().telegramBotToken || process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      this.addLog("CRITICAL ERROR: TELEGRAM_BOT_TOKEN is missing! Provide it in settings or .env");
      return { success: false, mode: "failed", error: "Missing TELEGRAM_BOT_TOKEN" };
    }

    try {
      this.bot = new Bot(token);
      await this.bot.init(); // Инициализируем botInfo внутри grammY, чтобы вебхуки работали без ошибок
      this.setupHandlers();
      this.addLog("Bot handlers configured successfully.");

      const botInfo = this.bot.botInfo;
      this.addLog(`Access verified. Bot username is @${botInfo.username}`);

      // Автоматическая первоначальная настройка описания и команд бота в Telegram
      try {
        await this.bot.api.setMyDescription(botConfig.texts.welcomePreStart);
        this.addLog("Bot welcome description (setMyDescription) registered in Telegram successfully.");
      } catch (descErr: any) {
        this.addLog(`Could not register welcome description: ${descErr.message || descErr}`);
      }

      try {
        await this.bot.api.setMyShortDescription("Психологический бот Алёны. Помогу мягко распутать то, что внутри копилось. Без завышенных требований.");
        this.addLog("Bot short description registered in Telegram successfully.");
      } catch (sDescErr: any) {
        this.addLog(`Could not register short description: ${sDescErr.message || sDescErr}`);
      }

      try {
        await this.bot.api.setMyCommands([
          { command: "start", description: "Запустить / Перезапустить квест-бота" },
          { command: "menu", description: "Вернуться в главное меню инструментов" }
        ]);
        this.addLog("Bot menu commands registered in Telegram successfully.");
      } catch (cmdErr: any) {
        this.addLog(`Could not register menu commands: ${cmdErr.message || cmdErr}`);
      }

      let appUrl = process.env.APP_URL;
      
      if (appUrl) {
        // Если указан хост без протокола, форсируем https схему
        if (!appUrl.startsWith("http://") && !appUrl.startsWith("https://")) {
          appUrl = "https://" + appUrl;
        } else if (appUrl.startsWith("http://")) {
          appUrl = appUrl.replace("http://", "https://");
        }
        
        const webhookUrl = `${appUrl.replace(/\/$/, "")}/api/telegram-webhook`;
        this.addLog(`Attempting to set webhook to: ${webhookUrl}`);
        
        try {
          // Устанавливаем вебхук с флагом drop_pending_updates, чтобы не обрабатывать старые накопившиеся сообщения
          await this.bot.api.setWebhook(webhookUrl, {
            drop_pending_updates: true
          });
          this.isWebhookWorking = true;
          this.isPollingActive = false;
          this.addLog(`Webhook set successfully onto ${webhookUrl}!`);
          return { success: true, mode: "webhook" };
        } catch (webhookErr: any) {
          this.addLog(`Webhook installation failed! Error: ${webhookErr.message || webhookErr}. Falling back to Long Polling...`);
        }
      } else {
        this.addLog("APP_URL environment variable is not configured. Falling back to Long Polling mode...");
      }

      // Если вебхуки не работают или домен не настроен, запускаем Polling
      await this.startPolling();
      return { success: true, mode: "polling" };

    } catch (err: any) {
      const errMsg = err.message || JSON.stringify(err);
      this.addLog(`Bot startup failed with error: ${errMsg}`);
      return { success: false, mode: "failed", error: errMsg };
    }
  }

  /**
   * Запуск Long Polling
   */
  private async startPolling() {
    if (!this.bot) return;
    
    // Предварительно удаляем вебхук, чтобы разрешить polling
    try {
      await this.bot.api.deleteWebhook({ drop_pending_updates: true });
      this.addLog("Webhook deleted to enable long polling.");
    } catch (e) {
      this.addLog(`Error deleting webhook: ${e}`);
    }

    this.bot.start({
      onStart: (info) => {
        this.isPollingActive = true;
        this.isWebhookWorking = false;
        this.addLog(`Telegraf/grammy bot started in POLLING MODE (@${info.username})`);
      }
    }).catch((err) => {
      this.isPollingActive = false;
      this.addLog(`Polling loop crashed: ${err.message || err}`);
    });
  }

  /**
   * Обработка входящих запросов вебхука (проксируется из Express)
   */
  public handleWebhookUpdate(update: any) {
    if (this.bot) {
      this.bot.handleUpdate(update).catch((err) => {
        this.addLog(`Error processing update via webhook: ${err.message || err}`);
      });
    }
  }

  /**
   * Формирование клавиатуры Шага 1 (Инлайн)
   */
  private makeStep1Keyboard(selectedId?: string): InlineKeyboard {
    const keyboard = new InlineKeyboard();
    botConfig.step1Buttons.forEach((btn) => {
      const isSelected = btn.id === selectedId;
      const text = isSelected ? `✅ ${btn.text}` : btn.text;
      // Если выбор уже сделан, мы можем сделать кнопки неактивными или просто оставить callback
      keyboard.text(text, btn.id).row();
    });
    return keyboard;
  }

  /**
   * Формирование клавиатуры Шага 2 (Инлайн)
   */
  private makeStep2Keyboard(selectedId?: string): InlineKeyboard {
    const keyboard = new InlineKeyboard();
    botConfig.step2Buttons.forEach((btn) => {
      const isSelected = btn.id === selectedId;
      const text = isSelected ? `✅ ${btn.text}` : btn.text;
      keyboard.text(text, btn.id).row();
    });
    return keyboard;
  }

  /**
   * Клавиатура главного меню (Инлайн)
   */
  private makeMainMenuKeyboard(): InlineKeyboard {
    const keyboard = new InlineKeyboard();
    const config = scenarioManager.loadConfig();
    if (config && config.menu) {
      config.menu.forEach((btn) => {
        // Пропускаем системные кнопки старта/возрата, если они есть в массиве меню (они обрабатываются отдельно)
        if (btn.text.toLowerCase() === "старт" || btn.text.toLowerCase() === "вернуться в меню") return;
        keyboard.text(btn.text, `menu_btn_${btn.id}`).row();
      });
    }
    return keyboard;
  }

  /**
   * Нижнее меню (Reply Keyboard)
   */
  private makeReplyKeyboard(menuUnlocked: boolean): Keyboard {
    const kb = new Keyboard();
    kb.text("Старт");
    if (menuUnlocked) {
      kb.text("Вернуться в меню");
    }
    return kb.resized().oneTime();
  }

  /**
   * Запуск выполнения сценария по блокам
   */
  public async executeBlock(ctx: any, blockId: string | null | undefined, userId: number, isStartBlock: boolean = false) {
    if (!blockId) return;

    try {
      const config = scenarioManager.loadConfig();
      const block = config.blocks[blockId];
      if (!block) {
        console.warn(`[Bot] Requested block not found: ${blockId}`);
        return;
      }

      const session = sessionManager.getSession(userId);
      const sessionStart = session.lastStartTimestamp;

      // Инициализируем и записываем историю переходов (для кнопки Назад)
      if (!session.historyBlocks) {
        session.historyBlocks = [];
      }
      const history = [...session.historyBlocks];
      if (block.type !== "pause" && !history.includes(blockId) && block.type !== "wait_button") {
        history.push(blockId);
        sessionManager.updateSession(userId, { historyBlocks: history });
      }

      this.addLog(`Executing block ID: ${blockId} (${block.type}) for User ID: ${userId}`);

      switch (block.type) {
        case "text": {
          if (block.isMenuUnlock) {
            sessionManager.updateSession(userId, { menuUnlocked: true });
          }

          const hasButtonsFollowing = block.nextBlockId && config.blocks[block.nextBlockId] && config.blocks[block.nextBlockId].type === "button";
          
          if (hasButtonsFollowing) {
            // Группируем кнопки, идущие сразу за текстом
            const buttonsGroup: ScenarioBlock[] = [];
            let currentInChain: ScenarioBlock | null = config.blocks[block.nextBlockId!];
            while (currentInChain && currentInChain.type === "button") {
              buttonsGroup.push(currentInChain);
              currentInChain = currentInChain.nextBlockId ? config.blocks[currentInChain.nextBlockId] : null;
            }

            const btnKb = new InlineKeyboard();
            buttonsGroup.forEach((btn) => {
              const customText = btn.text || '';
              const isChecked = session.checkedButtons?.includes(btn.id);
              const label = btn.url ? customText : (btn.rightBlockId ? customText : (isChecked ? `✅ ${customText}` : customText));
              
              if (btn.url) {
                btnKb.url(label, btn.url).row();
              } else {
                btnKb.text(label, `blk_btn_${btn.id}`).row();
              }
            });

            await ctx.reply(block.text, { 
              parse_mode: "HTML", 
              reply_markup: btnKb 
            });
          } else {
            const extraOpts: any = { parse_mode: "HTML" };
            // При разблокировке меню или на старте - обновляем Reply клавиатуру
            if (isStartBlock || block.isMenuUnlock) {
              extraOpts.reply_markup = this.makeReplyKeyboard(session.menuUnlocked || block.isMenuUnlock || false);
            }
            
            await ctx.reply(block.text, extraOpts);
            
            if (block.nextBlockId) {
              await this.executeBlock(ctx, block.nextBlockId, userId);
            }
          }
          break;
        }
        case "file": {
          if (block.url) {
            try {
              if (block.url.startsWith("http://") || block.url.startsWith("https://")) {
                await ctx.replyWithDocument(block.url);
              } else {
                let localPath = block.url;
                if (localPath.startsWith("/")) localPath = localPath.substring(1);
                const fullPath = path.join(process.cwd(), localPath);
                if (fs.existsSync(fullPath)) {
                  await ctx.replyWithDocument(new InputFile(fullPath));
                } else {
                  await ctx.reply(`[Файл не найден: ${block.url}]`);
                }
              }
            } catch (err: any) {
              await ctx.reply(`[Ошибка отправки файла]`);
            }
          }
          if (block.nextBlockId) await this.executeBlock(ctx, block.nextBlockId, userId);
          break;
        }
        case "audio": {
          if (block.url) {
            try {
              if (block.url.startsWith("http://") || block.url.startsWith("https://")) {
                await ctx.replyWithAudio(block.url);
              } else {
                let localPath = block.url;
                if (localPath.startsWith("/")) localPath = localPath.substring(1);
                const fullPath = path.join(process.cwd(), localPath);
                if (fs.existsSync(fullPath)) {
                  await ctx.replyWithAudio(new InputFile(fullPath));
                } else {
                  await ctx.reply(`[Аудио не найдено: ${block.url}]`);
                }
              }
            } catch (err: any) {
              await ctx.reply(`[Ошибка отправки аудио]`);
            }
          }
          if (block.nextBlockId) await this.executeBlock(ctx, block.nextBlockId, userId);
          break;
        }
        case "link": {
          const linkKb = new InlineKeyboard().url(block.text || "Открыть", block.url || "");
          await ctx.reply(block.text || "Ссылка:", { reply_markup: linkKb });
          if (block.nextBlockId) await this.executeBlock(ctx, block.nextBlockId, userId);
          break;
        }
        case "menu": {
          sessionManager.updateSession(userId, { menuUnlocked: true });
          const messageText = block.text || "Сделай свой выбор ⬇️";
          const attachedIds = block.menuAttachedBlocks || [];

          let replyMarkup;
          if (attachedIds.length > 0) {
            const btnKb = new InlineKeyboard();
            attachedIds.forEach((id) => {
              const b = config.blocks[id];
              if (b) {
                const isChecked = session.checkedButtons?.includes(b.id);
                const label = b.url ? b.text : (b.rightBlockId ? b.text : (isChecked ? `✅ ${b.text}` : b.text));
                if (b.url) btnKb.url(label || "Link", b.url).row();
                else btnKb.text(label || "Button", `blk_btn_${b.id}`).row();
              }
            });
            replyMarkup = btnKb;
          } else {
            replyMarkup = this.makeMainMenuKeyboard();
          }

          await ctx.reply(messageText, { parse_mode: "HTML", reply_markup: replyMarkup });
          break;
        }
        case "back": {
          const curHistory = session.historyBlocks || [];
          if (curHistory.length > 1) {
            const historyCopy = [...curHistory];
            historyCopy.pop(); // Текущий
            const prevId = historyCopy.pop(); // Предыдущий
            sessionManager.updateSession(userId, { historyBlocks: historyCopy });
            if (prevId) await this.executeBlock(ctx, prevId, userId);
            else await this.handleReturnToMenu(ctx);
          } else {
            await this.handleReturnToMenu(ctx);
          }
          break;
        }
        case "pause": {
          const seconds = block.seconds || 5;
          setTimeout(async () => {
            try {
              const freshSession = sessionManager.getSession(userId);
              if (freshSession.lastStartTimestamp === sessionStart) {
                await this.executeBlock(ctx, block.nextBlockId, userId);
              }
            } catch (err) {}
          }, seconds * 1000);
          break;
        }
        case "wait_button": {
          if (block.nextBlockId) {
            await this.executeBlock(ctx, block.nextBlockId, userId);
          }
          break;
        }
        case "button": {
          // Если вызван напрямую — показываем как группу
          const buttonsGroup: ScenarioBlock[] = [];
          let current: ScenarioBlock | null = block;
          while (current && current.type === "button") {
            buttonsGroup.push(current);
            current = current.nextBlockId ? config.blocks[current.nextBlockId] : null;
          }
          const btnKb = new InlineKeyboard();
          buttonsGroup.forEach(btn => {
            const isChecked = session.checkedButtons?.includes(btn.id);
            const label = btn.url ? btn.text : (btn.rightBlockId ? btn.text : (isChecked ? `✅ ${btn.text}` : btn.text));
            if (btn.url) btnKb.url(label || "", btn.url).row();
            else btnKb.text(label || "", `blk_btn_${btn.id}`).row();
          });
          await ctx.reply("Выберите:", { reply_markup: btnKb });
          break;
        }
      }
    } catch (e: any) {
      console.error(`[executeBlock] Error:`, e);
    }
  }

  /**
   * Настройка обработчиков бота
   */
  private setupHandlers() {
    if (!this.bot) return;

    this.bot.command("start", (ctx) => this.handleStart(ctx));
    this.bot.hears("Старт", (ctx) => this.handleStart(ctx));
    this.bot.command("menu", (ctx) => this.handleReturnToMenu(ctx));
    this.bot.hears("Вернуться в меню", (ctx) => this.handleReturnToMenu(ctx));

    this.bot.on("callback_query:data", async (ctx) => {
      const data = ctx.callbackQuery.data;
      const userId = ctx.from.id;
      const session = sessionManager.getSession(userId);
      const config = scenarioManager.loadConfig();

      if (data.startsWith("blk_btn_")) {
        const btnId = data.substring(8);
        const btn = config.blocks[btnId];
        if (!btn) return await ctx.answerCallbackQuery();

        let checked = [...(session.checkedButtons || [])];
        if (btn.isOnce && checked.includes(btnId)) {
          return await ctx.answerCallbackQuery({ text: "Вы уже выбирали этот вариант", show_alert: true });
        }

        if (!checked.includes(btnId)) checked.push(btnId);
        else if (!btn.isOnce) checked = checked.filter(id => id !== btnId);

        sessionManager.updateSession(userId, { 
          checkedButtons: checked,
          menuUnlocked: session.menuUnlocked || btn.isMenuUnlock 
        });

        await ctx.answerCallbackQuery();

        // Обновляем текущую клавиатуру
        try {
          // Ищем начало группы кнопок
          let startBtn = btn;
          const allBlocks = Object.values(config.blocks);
          let found = true;
          while (found) {
            const parent = allBlocks.find(b => b.nextBlockId === startBtn.id && b.type === "button");
            if (parent) startBtn = parent;
            else found = false;
          }

          const btnKb = new InlineKeyboard();
          let current: ScenarioBlock | null = startBtn;
          while (current && current.type === "button") {
            const isCh = checked.includes(current.id);
            const label = current.url ? current.text : (current.rightBlockId ? current.text : (isCh ? `✅ ${current.text}` : current.text));
            if (current.url) btnKb.url(label || "", current.url).row();
            else btnKb.text(label || "", `blk_btn_${current.id}`).row();
            current = current.nextBlockId ? config.blocks[current.nextBlockId] : null;
          }
          await ctx.editMessageReplyMarkup({ reply_markup: btnKb });
        } catch (e) {}

        // Если есть переход вправо — идем туда
        if (btn.rightBlockId) {
          await this.executeBlock(ctx, btn.rightBlockId, userId);
        } else {
          // Или ищем wait_button после всей группы
          let lastInGroup = btn;
          while (lastInGroup.nextBlockId && config.blocks[lastInGroup.nextBlockId]?.type === "button") {
            lastInGroup = config.blocks[lastInGroup.nextBlockId];
          }
          if (lastInGroup.nextBlockId && config.blocks[lastInGroup.nextBlockId]?.type === "wait_button") {
             const waitId = lastInGroup.nextBlockId;
             const trig = session.triggeredWaitBlocks || [];
             if (!trig.includes(waitId)) {
               this.addLog(`Triggering wait_button ${waitId} for user ${userId}`);
               sessionManager.updateSession(userId, { triggeredWaitBlocks: [...trig, waitId] });
               await this.executeBlock(ctx, waitId, userId);
             }
          }
        }
      } else if (data.startsWith("menu_btn_")) {
        const menuBtnId = data.substring(9);
        const btn = config.menu.find(m => m.id === menuBtnId);
        await ctx.answerCallbackQuery();
        if (btn && btn.startBlockId) {
          await this.executeBlock(ctx, btn.startBlockId, userId);
        }
      } else if (data === "gomenu") {
        await ctx.answerCallbackQuery();
        await this.handleReturnToMenu(ctx);
      }
    });

    this.bot.on("message:text", async (ctx) => {
      const userId = ctx.from.id;
      const session = sessionManager.getSession(userId);
      if (!session.lastStartTimestamp) {
        await ctx.reply("Привет! Нажми «Старт», чтобы начать 🤍", {
          reply_markup: this.makeReplyKeyboard(false)
        });
      } else {
        await ctx.reply("Пожалуйста, воспользуйтесь кнопками меню для навигации 😊", {
          reply_markup: this.makeReplyKeyboard(session.menuUnlocked || false)
        });
      }
    });
  }

  /**
   * Логика при получении команды /start
   */
  private async handleStart(ctx: Context) {
    const userId = ctx.from?.id;
    if (!userId) return;

    const config = scenarioManager.loadConfig();
    const timestampNow = Date.now();
    
    sessionManager.resetSession(userId, {
      username: ctx.from?.username || "Anonymous",
      firstName: ctx.from?.first_name || "",
      lastName: ctx.from?.last_name || "",
      startedAt: new Date().toISOString(),
      lastStartTimestamp: timestampNow,
      checkedButtons: [],
      historyBlocks: [],
      triggeredWaitBlocks: [],
      menuUnlocked: false
    });

    if (config.startBlockId && config.blocks[config.startBlockId]) {
      await this.executeBlock(ctx, config.startBlockId, userId, true);
    } else {
      await ctx.reply("Добро пожаловать! Сценарий ещё не настроен в конструкторе.", {
        reply_markup: this.makeReplyKeyboard(false)
      });
    }
  }

  /**
   * Логика кнопки "Вернуться в меню"
   */
  private async handleReturnToMenu(ctx: Context) {
    const userId = ctx.from?.id;
    if (!userId) return;

    const session = sessionManager.getSession(userId);
    if (!session.menuUnlocked) {
      return await this.handleStart(ctx);
    }

    const config = scenarioManager.loadConfig();
    const returnMenuItem = config.menu?.find(m => m.text === "Вернуться в меню");
    
    if (returnMenuItem && returnMenuItem.startBlockId) {
      await this.executeBlock(ctx, returnMenuItem.startBlockId, userId);
    } else {
      const menuBlockId = Object.keys(config.blocks).find(k => config.blocks[k].type === "menu");
      if (menuBlockId) {
        await this.executeBlock(ctx, menuBlockId, userId);
      } else {
        await ctx.reply("Главное меню:", {
          reply_markup: this.makeMainMenuKeyboard()
        });
      }
    }
  }
}

export const telegramBotService = new TelegramBotService();
