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
        keyboard.text(btn.text, `menu_btn_${btn.id}`).row();
      });
    }
    return keyboard;
  }

  /**
   * Нижнее меню (Reply Keyboard)
   * До прохождения квеста — только Старт.
   * После 4-го сообщения — Старт и Вернуться в меню.
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
   * Первоначальное/пре-старт сообщение, если пользователь пишет до /start
   */
  private async sendPromoWelcome(ctx: Context) {
    const replyKb = this.makeReplyKeyboard(false);
    await ctx.reply(botConfig.texts.welcomePreStart, {
      reply_markup: replyKb
    });
  }

  /**
   * Запуск выполнения сценария по блокам
   */
  public async executeBlock(ctx: any, blockId: string | null | undefined, userId: number) {
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
      if (block.type !== "pause" && !history.includes(blockId)) {
        history.push(blockId);
        sessionManager.updateSession(userId, { historyBlocks: history });
      }

      this.addLog(`Executing block ID: ${blockId} (${block.type}) for User ID: ${userId}`);

      switch (block.type) {
        case "text": {
          if (block.nextBlockId && config.blocks[block.nextBlockId] && config.blocks[block.nextBlockId].type === "button") {
            // Attach inline buttons directly to this text
            const buttonsGroup: ScenarioBlock[] = [];
            let current: ScenarioBlock | null = config.blocks[block.nextBlockId];
            while (current && current.type === "button") {
              buttonsGroup.push(current);
              current = current.nextBlockId ? config.blocks[current.nextBlockId] : null;
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

            await ctx.reply(block.text, { parse_mode: "HTML", reply_markup: btnKb });
            // We do NOT execute nextBlockId here because it's a button and buttons wait for user click.
          } else {
            await ctx.reply(block.text, { parse_mode: "HTML" });
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
                if (localPath.startsWith("/")) {
                  localPath = localPath.substring(1);
                }
                const fullPath = path.join(process.cwd(), localPath);
                if (fs.existsSync(fullPath)) {
                  await ctx.replyWithDocument(new InputFile(fullPath));
                } else {
                  await ctx.reply(`[Файл не найден на сервере: ${block.url}]`);
                }
              }
            } catch (err: any) {
              this.addLog(`Failed to send file ${block.url}: ${err.message || err}`);
              await ctx.reply(`[Не удалось отправить файл: ${block.url}]`);
            }
          } else {
            await ctx.reply(block.text || "Прикрепленный файл");
          }
          if (block.nextBlockId) {
            await this.executeBlock(ctx, block.nextBlockId, userId);
          }
          break;
        }
        case "audio": {
          if (block.url) {
            try {
              if (block.url.startsWith("http://") || block.url.startsWith("https://")) {
                await ctx.replyWithAudio(block.url);
              } else {
                let localPath = block.url;
                if (localPath.startsWith("/")) {
                  localPath = localPath.substring(1);
                }
                const fullPath = path.join(process.cwd(), localPath);
                if (fs.existsSync(fullPath)) {
                  await ctx.replyWithAudio(new InputFile(fullPath));
                } else {
                  await ctx.reply(`[Аудиофайл не найден на сервере: ${block.url}]`);
                }
              }
            } catch (err: any) {
              this.addLog(`Failed to send audio ${block.url}: ${err.message || err}`);
              await ctx.reply(`[Не удалось отправить аудиофайл: ${block.url}]`);
            }
          } else {
            await ctx.reply(block.text || "Аудиозапись");
          }
          if (block.nextBlockId) {
            await this.executeBlock(ctx, block.nextBlockId, userId);
          }
          break;
        }
        case "link": {
          const label = block.text || "Открыть ссылку";
          const linkKb = new InlineKeyboard().url(label, block.url || "");
          await ctx.reply(block.text || "Ссылка на материал:", { reply_markup: linkKb });
          if (block.nextBlockId) {
            await this.executeBlock(ctx, block.nextBlockId, userId);
          }
          break;
        }
        case "menu": {
          await this.handleReturnToMenu(ctx);
          break;
        }
        case "menu_return": {
          await this.handleReturnToMenu(ctx);
          break;
        }
        case "back": {
          const curHistory = session.historyBlocks || [];
          if (curHistory.length > 1) {
            const historyCopy = [...curHistory];
            historyCopy.pop(); // удаляем текущий блок ("Назад")
            const prevId = historyCopy.pop(); // берем предыдущий шаг
            sessionManager.updateSession(userId, { historyBlocks: historyCopy });
            if (prevId) {
              await this.executeBlock(ctx, prevId, userId);
            } else {
              await this.handleReturnToMenu(ctx);
            }
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
              // Если пользователь за это время не перезапустил старт
              if (freshSession.lastStartTimestamp === sessionStart) {
                await this.executeBlock(ctx, block.nextBlockId, userId);
              }
            } catch (err: any) {
              scenarioManager.logError(`Ошибка при отработке блока паузы ${blockId}: ${err.message || err}`, err);
            }
          }, seconds * 1000);
          break;
        }
        case "wait_button": {
          // Блок приостанавливает выполнение. Ожидаем нажатия кнопки.
          // Но если этот блок вызван вручную (из обработчика кнопки),
          // он может служить "пропускным пунктом" к следующему блоку.
          if (block.nextBlockId) {
             await this.executeBlock(ctx, block.nextBlockId, userId);
          }
          break;
        }
        case "button": {
          // Fallback if button is executed directly without a text block
          const buttonsGroup: ScenarioBlock[] = [];
          let current: ScenarioBlock | null = block;
          while (current && current.type === "button") {
            buttonsGroup.push(current);
            current = current.nextBlockId ? config.blocks[current.nextBlockId] : null;
          }

          const btnKb = new InlineKeyboard();
          buttonsGroup.forEach((btn) => {
            const isChecked = session.checkedButtons?.includes(btn.id);
            const customText = btn.text || '';
            const label = btn.url ? customText : (btn.rightBlockId ? customText : (isChecked ? `✅ ${customText}` : customText));
            
            if (btn.url) {
              btnKb.url(label, btn.url).row();
            } else {
              btnKb.text(label, `blk_btn_${btn.id}`).row();
            }
          });

          await ctx.reply("Выберите нужный вариант 👇", { reply_markup: btnKb });
          break;
        }
      }
    } catch (e: any) {
      scenarioManager.logError(`Ошибка исполнения блока "${blockId}": ${e.message || e}`, e);
      this.addLog(`Error executing block ${blockId}: ${e.message || e}`);
    }
  }

  /**
   * Настройка обработчиков бота
   */
  private setupHandlers() {
    if (!this.bot) return;

    const bot = this.bot;

    // 1. Команда СТАРТ (или текстовое сообщение "Старт")
    bot.command("start", async (ctx) => {
      await this.handleStart(ctx);
    });

    bot.hears("Старт", async (ctx) => {
      await this.handleStart(ctx);
    });

    // 2. Команда ВЕРНУТЬСЯ В МЕНЮ (или текстовое сообщение "Вернуться в меню")
    bot.hears("Вернуться в меню", async (ctx) => {
      await this.handleReturnToMenu(ctx);
    });

    bot.command("menu", async (ctx) => {
      await this.handleReturnToMenu(ctx);
    });

    // 3. Обработка всех остальных текстовых сообщений
    bot.on("message:text", async (ctx) => {
      const text = ctx.message.text.trim();
      if (text === "Старт" || text === "Вернуться в меню") return; // Уже обработаны выше

      const userId = ctx.from.id;
      const session = sessionManager.getSession(userId);

      // Если пользователь еще не начинал или меню заблокировано
      if (!session.lastStartTimestamp) {
        await this.sendPromoWelcome(ctx);
      } else if (session.menuUnlocked) {
        // Ему доступно меню, напомним о действиях
        await ctx.reply("Пожалуйста, воспользуйтесь интерактивными кнопками меню ⬇️", {
          reply_markup: this.makeReplyKeyboard(true)
        });
      } else {
        // Пользователь находится на этапе приветственного опроса
        await ctx.reply("Для продолжения введите ответ или воспользуйтесь кнопками ☺️");
      }
    });

    // 4. Обработчик клика по инлайн-кнопкам спроса и сценариев
    bot.on("callback_query:data", async (ctx) => {
      const data = ctx.callbackQuery.data;
      const userId = ctx.from.id;
      const session = sessionManager.getSession(userId);
      const username = ctx.from.username || "Anonymous";

      this.addLog(`User @${username} (ID: ${userId}) clicked inline action: ${data}`);

      // Ветка кнопок ШАГА 1
      if (data.startsWith("step1_")) {
        if (session.step1Answered) {
          await ctx.answerCallbackQuery({ text: "Выбор уже зафиксирован!", show_alert: false });
          return;
        }

        // Запонимаем выбор
        sessionManager.updateSession(userId, {
          step1Answered: true,
          step1ChoiceId: data
        });

        // 1) Выделяем нажатую кнопку
        try {
          await ctx.editMessageReplyMarkup({
            reply_markup: this.makeStep1Keyboard(data)
          });
        } catch (e) {
          console.error("Failed to edit step1 keyboard markup: ", e);
        }

        await ctx.answerCallbackQuery({ text: "Спасибо за честность! 🤍" });

        // 2) Отправляем ТРЕТЬЕ сообщение с вопросами шага 2
        await ctx.reply(botConfig.texts.welcome3Question, {
          reply_markup: this.makeStep2Keyboard()
        });
        return;
      }

      // Ветка кнопок ШАГА 2
      if (data.startsWith("step2_")) {
        if (session.step2Answered) {
          await ctx.answerCallbackQuery({ text: "Выбор уже сохранен!", show_alert: false });
          return;
        }

        // Запоминаем выбор
        sessionManager.updateSession(userId, {
          step2Answered: true,
          step2ChoiceId: data,
          menuUnlocked: true // открываем доступ в меню
        });

        // 1) Выделяем нажатую кнопку в шаге 2
        try {
          await ctx.editMessageReplyMarkup({
            reply_markup: this.makeStep2Keyboard(data)
          });
        } catch (e) {
          console.error("Failed to edit step2 keyboard markup: ", e);
        }

        await ctx.answerCallbackQuery({ text: "Запомнила 😌" });

        // 2) Отправляем ЧЕТВЕРТОЕ сообщение (Главное меню) с обновлением Reply-меню снизу
        await ctx.reply(botConfig.texts.welcome4MenuHeader, {
          reply_markup: this.makeMainMenuKeyboard()
        });

        // Посылаем невидимую отмашку для обновления нижней клавиатуры (Reply Keyboard)
        await ctx.reply("Доступно новое меню поддержки. Внизу экрана появилась кнопка «Вернуться в меню» 🤍", {
          reply_markup: this.makeReplyKeyboard(true)
        });
        return;
      }

      // Общий возврат в меню по инлайн-кнопке (gomenu)
      if (data === "gomenu") {
        await ctx.answerCallbackQuery();
        await ctx.reply(botConfig.texts.backToMenuHeader, {
          reply_markup: this.makeMainMenuKeyboard()
        });
        return;
      }

      // Нажатие на кнопку из главного меню сценария
      if (data.startsWith("menu_btn_")) {
        const btnId = data.substring(9);
        const config = scenarioManager.loadConfig();
        const btn = config.menu.find((b) => b.id === btnId);
        if (btn && btn.startBlockId) {
          await ctx.answerCallbackQuery();
          await this.executeBlock(ctx, btn.startBlockId, userId);
        } else {
          await ctx.answerCallbackQuery({ text: "Для этой кнопки ещё нет сценария! 🛠" });
        }
        return;
      }

      // Нажатие на кнопку внутри блочной структуры конструктора
      if (data.startsWith("blk_btn_")) {
        const btnId = data.substring(8);
        const config = scenarioManager.loadConfig();
        const btn = config.blocks[btnId];

        if (btn) {
          if (!session.checkedButtons) {
            session.checkedButtons = [];
          }
          let checked = [...session.checkedButtons];
          
          if (btn.isOnce && checked.includes(btnId)) {
            await ctx.answerCallbackQuery({ text: "Вы уже выбирали этот вариант 😊", show_alert: true });
            return;
          }

          // Toggle check state unless it's one-time
          if (!checked.includes(btnId)) {
            checked.push(btnId);
          } else if (!btn.isOnce) {
            checked = checked.filter(id => id !== btnId);
          }
          
          const updates: any = { checkedButtons: checked };
          if (btn.isMenuUnlock) {
            updates.menuUnlocked = true;
          }
          
          sessionManager.updateSession(userId, updates);

          // Если меню только что разблокировалось, обновим Reply Keyboard (отправив уведомление один раз)
          if (btn.isMenuUnlock && !session.menuUnlocked) {
             await ctx.reply("Доступно новое меню поддержки. Внизу экрана появилась кнопка «Вернуться в меню» 🤍", {
               reply_markup: this.makeReplyKeyboard(true)
             });
          }

          // Перерисовываем клавиатуру для всей вертикальной группы
          try {
            let startBtn = btn;
            const allBlocks = Object.values(config.blocks);
            let foundParent = true;
            while (foundParent) {
              const parent = allBlocks.find((b) => b.nextBlockId === startBtn.id && b.type === "button");
              if (parent) {
                startBtn = parent;
              } else {
                foundParent = false;
              }
            }

            const buttonsGroup: ScenarioBlock[] = [];
            let current: ScenarioBlock | null = startBtn;
            while (current && current.type === "button") {
              buttonsGroup.push(current);
              current = current.nextBlockId ? config.blocks[current.nextBlockId] : null;
            }

            const btnKb = new InlineKeyboard();
            buttonsGroup.forEach((b) => {
              const isCh = checked.includes(b.id);
              const customText = b.text || '';
              const label = b.url ? customText : (b.rightBlockId ? customText : (isCh ? `✅ ${customText}` : customText));
              
              if (b.url) {
                btnKb.url(label, b.url).row();
              } else {
                btnKb.text(label, `blk_btn_${b.id}`).row();
              }
            });

            await ctx.editMessageReplyMarkup({ reply_markup: btnKb });
          } catch (markupErr) {
            console.error("[Bot] Failed to update dynamic button checklist:", markupErr);
          }

          await ctx.answerCallbackQuery();

          if (btn.rightBlockId) {
            // Если кнопка имеет связь ВПРАВО — идем по этой ветви немедленно.
            await this.executeBlock(ctx, btn.rightBlockId, userId);
          } else {
            // Если связи вправо нет, ищем блок ожидания (wait_button) в конце вертикальной группы кнопок.
            let currentInGroup: ScenarioBlock = btn;
            while (currentInGroup.nextBlockId && config.blocks[currentInGroup.nextBlockId]?.type === "button") {
              currentInGroup = config.blocks[currentInGroup.nextBlockId];
            }
            
            const waitBlockId = currentInGroup.nextBlockId;
            if (waitBlockId && config.blocks[waitBlockId]?.type === "wait_button") {
              if (!session.triggeredWaitBlocks) {
                session.triggeredWaitBlocks = [];
              }
              if (!session.triggeredWaitBlocks.includes(waitBlockId)) {
                const updatedWait = [...session.triggeredWaitBlocks, waitBlockId];
                sessionManager.updateSession(userId, { triggeredWaitBlocks: updatedWait });
                // Выполняем переход к блоку ПОД кнопками
                await this.executeBlock(ctx, waitBlockId, userId);
              }
            }
          }
        }
        return;
      }

      // Если встретили неизвестный callback_query
      await ctx.answerCallbackQuery({ text: "Функция в разработке... 🛠" });
    });
  }

  /**
   * Логика при получении команды /start или Кнопки "Старт"
   */
  private async handleStart(ctx: Context) {
    const userId = ctx.from?.id;
    if (!userId) return;

    const username = ctx.from?.username || "Anonymous";
    const firstName = ctx.from?.first_name || "";
    const lastName = ctx.from?.last_name || "";

    const timestampNow = Date.now();
    this.addLog(`User @${username} (ID: ${userId}) triggered /start.`);

    // 1) Сбрасываем и сохраняем сессию на первый шаг
    sessionManager.resetSession(userId, {
      username,
      firstName,
      lastName,
      startedAt: new Date().toISOString(),
      lastStartTimestamp: timestampNow,
      checkedButtons: [],
      historyBlocks: [],
      triggeredWaitBlocks: []
    });

    const config = scenarioManager.loadConfig();

    if (config.startBlockId && config.blocks[config.startBlockId]) {
      // Отправляем системное сообщение для установки Reply Keyboard
      const kb = this.makeReplyKeyboard(false);
      await ctx.reply("Перезапуск бота...", { reply_markup: kb });
      await this.executeBlock(ctx, config.startBlockId, userId);
      return;
    }

    // 2) Отправляем первое приветственное сообщение
    // Прикрепляем Reply-меню (пока только "Старт")
    await ctx.reply(botConfig.texts.welcome1, {
      reply_markup: this.makeReplyKeyboard(false)
    });

    // 3) Планируем отправку второго вопроса строго через 15 секунд
    // Внимание: мы берем timestampNow и сравниваем его в таймауте, чтобы защититься от дублирования сообщений у одного юзера
    setTimeout(async () => {
      try {
        const freshSession = sessionManager.getSession(userId);
        // Проверяем, не нажимал ли он старт заново ПЛЮС не ответил ли уже на первый вопрос
        if (freshSession.lastStartTimestamp === timestampNow && !freshSession.step1Answered) {
          this.addLog(`Sending 15s-delayed step1 questions to user @${username}`);
          await ctx.reply(botConfig.texts.welcome2Question, {
            reply_markup: this.makeStep1Keyboard()
          });
        }
      } catch (e: any) {
        this.addLog(`Error sending step 1 delay: ${e.message || e}`);
      }
    }, 15000);
  }

  /**
   * Логика кнопки "Вернуться в меню"
   */
  private async handleReturnToMenu(ctx: Context) {
    const userId = ctx.from?.id;
    if (!userId) return;

    const session = sessionManager.getSession(userId);
    const config = scenarioManager.loadConfig();

    if (session.menuUnlocked) {
      if (config.menuReturnSettings) {
        const text = config.menuReturnSettings.text || "Сделай свой выбор ⬇️";
        const btnBlockIds = config.menuReturnSettings.buttonBlockIds || [];
        
        const keyboard = new InlineKeyboard();
        btnBlockIds.forEach((id) => {
          // Чистим ID от префиксов и пробелов
          const rawId = id.trim().replace(/^id:\s*/i, "").trim();
          const block = config.blocks[rawId];
          if (block && (block.type === "button" || block.type === "link")) {
            if (block.url) {
              keyboard.url(block.text || "Ссылка", block.url).row();
            } else {
              keyboard.text(block.text || "Кнопка", `blk_btn_${block.id}`).row();
            }
          }
        });

        // Если кнопок нет (или не найдены), показываем дефолтное главное меню
        if (keyboard.inline_keyboard.length === 0) {
          await ctx.reply(text, {
            reply_markup: this.makeMainMenuKeyboard()
          });
        } else {
          await ctx.reply(text, {
            reply_markup: keyboard
          });
        }
      } else {
        await ctx.reply(botConfig.texts.backToMenuHeader, {
          reply_markup: this.makeMainMenuKeyboard()
        });
      }
    } else {
      // Меню еще не разблокировано (пользователь не заполнил опрос)
      await this.sendPromoWelcome(ctx);
    }
  }
}

export const telegramBotService = new TelegramBotService();
