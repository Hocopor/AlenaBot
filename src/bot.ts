import { Bot, InlineKeyboard, Keyboard, Context } from "grammy";
import { botConfig } from "./botConfig";
import { sessionManager, UserSession } from "./botSession";

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
    console.log(entry);
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
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      this.addLog("CRITICAL ERROR: TELEGRAM_BOT_TOKEN is missing in environment variables!");
      return { success: false, mode: "failed", error: "Missing TELEGRAM_BOT_TOKEN" };
    }

    try {
      this.bot = new Bot(token);
      this.setupHandlers();
      this.addLog("Bot handlers configured successfully.");

      // Получаем информацию о боте для верификации токена
      const botInfo = await this.bot.api.getMe();
      this.addLog(`Access verified. Bot username is @${botInfo.username}`);

      const appUrl = process.env.APP_URL;
      
      if (appUrl && appUrl.startsWith("https")) {
        // Пробуем настроить Вебхук
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
        this.addLog("APP_URL is not set or not HTTPS. Falling back to Long Polling mode...");
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
    botConfig.mainMenuButtons.forEach((btn) => {
      keyboard.text(btn.text, btn.id).row();
    });
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
    return kb.resized().placeholder("Выбирайте действия ниже ⬇️");
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
        await ctx.reply("Для продолжения заполните, пожалуйста, вопросы первого этапа, нажав на инлайн-кнопочки выше ☺️ Она помогут мне понять твое состояние.");
      }
    });

    // 4. Обработчик клика по инлайн-кнопкам опроса и сценариев
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

        // Запоминаем выбор
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

      // 5. Обработка 6 веток сценариев
      switch (data) {
        
        // ==========================================
        // ВЕТКА 1. ДНЕВНИК МИКРО-ПОБЕД — Гайд
        // ==========================================
        case "menu_diary": {
          await ctx.answerCallbackQuery();
          const diaryKb = new InlineKeyboard().text("1 - Гайд легализации бездействия🩶", "branch1_guide").row();
          await ctx.reply(botConfig.texts.branch1Header, {
            reply_markup: diaryKb
          });
          break;
        }
        case "branch1_guide": {
          await ctx.answerCallbackQuery();
          await ctx.reply(botConfig.texts.branch1Content);
          
          // Ссылка на скачивание дневника
          const downloadKb = new InlineKeyboard().url("📥 Скачать Гайд легализации бездействия", botConfig.materials.diaryPdf).row();
          await ctx.reply("Держи ссылку на материалы гайда:", {
            reply_markup: downloadKb
          });

          // Сохраняем метку времени и планируем через 10 секунд сообщение
          const sessionStart = session.lastStartTimestamp;
          setTimeout(async () => {
            const freshSession = sessionManager.getSession(userId);
            // Если пользователь не нажал Старт заново
            if (freshSession.lastStartTimestamp === sessionStart) {
              const nextKb = new InlineKeyboard()
                .url("✉️ Написать Алёне", botConfig.contactLink).row()
                .text("«Вернуться в меню»", "gomenu").row();
              await bot.api.sendMessage(userId, botConfig.texts.branch1Next, {
                reply_markup: nextKb
              });
            }
          }, 10000);
          break;
        }

        // ==========================================
        // ВЕТКА 2. АУДИО ВРЕМЯ — музыка
        // ==========================================
        case "menu_audio": {
          await ctx.answerCallbackQuery();
          await ctx.reply(botConfig.texts.branch2Header, { parse_mode: "HTML" });
          
          // Отправляем аудиофайл-заглушку с описанием
          try {
            await ctx.replyWithAudio(botConfig.materials.audioMusic, {
              title: "АУДИО ВРЕМЯ — музыка для тебя",
              performer: "Алёна — психолог-СоПутница",
              caption: "🎧 Позаботься о себе прямо сейчас."
            });
          } catch (audioErr) {
            // Если Telegram не может скачать аудио по URL, отправим текстовую ссылку
            await ctx.reply(`Не удалось отправить музыкальный файл напрямую. Вот ссылка на прослушивание: \n🎵 ${botConfig.materials.audioMusic}`);
          }

          const sessionStart = session.lastStartTimestamp;
          setTimeout(async () => {
            const freshSession = sessionManager.getSession(userId);
            if (freshSession.lastStartTimestamp === sessionStart) {
              const nextKb = new InlineKeyboard().text("«Вернуться в меню»", "gomenu").row();
              await bot.api.sendMessage(userId, botConfig.texts.branch2Next, {
                reply_markup: nextKb
              });
            }
          }, 10000);
          break;
        }

        // ==========================================
        // ВЕТКА 3. УПРАЖНЕНИЕ — техники
        // ==========================================
        case "menu_exercise": {
          await ctx.answerCallbackQuery();
          const exerciseKb = new InlineKeyboard().text("«Квадрат Дыхания» аудио", "branch3_square").row();
          await ctx.reply(botConfig.texts.branch3Header, {
            reply_markup: exerciseKb,
            parse_mode: "HTML"
          });
          break;
        }
        case "branch3_square": {
          await ctx.answerCallbackQuery();
          await ctx.reply(botConfig.texts.branch3Content);

          // Отправляем дыхательное упражнение
          try {
            await ctx.replyWithAudio(botConfig.materials.breathingAudio, {
              title: "«Квадрат Дыхания» аудио",
              performer: "Алёна",
              caption: "✨ Мягкое расслабление за 2 минуты."
            });
          } catch (err) {
            await ctx.reply(`Ссылка на аудио квадрат дыхания: \n🧘‍♀️ ${botConfig.materials.breathingAudio}`);
          }

          const sessionStart = session.lastStartTimestamp;
          setTimeout(async () => {
            const freshSession = sessionManager.getSession(userId);
            if (freshSession.lastStartTimestamp === sessionStart) {
              const nextKb = new InlineKeyboard()
                .url("✉️ Написать Алёне", botConfig.contactLink).row()
                .text("«Вернуться в меню»", "gomenu").row();
              await bot.api.sendMessage(userId, botConfig.texts.branch3Next, {
                reply_markup: nextKb
              });
            }
          }, 7000); // 7 секунд из ТЗ!
          break;
        }

        // ==========================================
        // ВЕТКА 4. ОПОРА
        // ==========================================
        case "menu_opora": {
          await ctx.answerCallbackQuery();
          const oporaKb = new InlineKeyboard()
            .text("1 - Маркер Тревоги", "branch4_anxiety").row()
            .text("2 - Фразы Поддержка", "branch4_support").row();
          await ctx.reply(botConfig.texts.branch4Header, {
            reply_markup: oporaKb,
            parse_mode: "HTML"
          });
          break;
        }
        case "branch4_anxiety": {
          await ctx.answerCallbackQuery();
          await ctx.reply(botConfig.texts.branch4Sub1Content, { parse_mode: "HTML" });

          // Отправляем ссылку/файл Маркер Тревоги
          const downloadKb = new InlineKeyboard().url("📥 Скачать Маркер Тревоги", botConfig.materials.anxietyMarkerPdf).row();
          await ctx.reply("Файл Маркера тревоги подготовлен к скачиванию:", {
            reply_markup: downloadKb
          });

          const sessionStart = session.lastStartTimestamp;
          setTimeout(async () => {
            const freshSession = sessionManager.getSession(userId);
            if (freshSession.lastStartTimestamp === sessionStart) {
              const nextKb = new InlineKeyboard().text("«Вернуться в меню»", "gomenu").row();
              await bot.api.sendMessage(userId, botConfig.texts.branch4Sub1Next, {
                reply_markup: nextKb
              });
            }
          }, 10000);
          break;
        }
        case "branch4_support": {
          await ctx.answerCallbackQuery();
          await ctx.reply(botConfig.texts.branch4Sub2Content, { parse_mode: "HTML" });

          // Отправляем ссылку/файл Фразы Поддержки
          const downloadKb = new InlineKeyboard().url("📥 Скачать Фразы Поддержки", botConfig.materials.supportPhrasesPdf).row();
          await ctx.reply("Файл 12 фраз поддержки готов к загрузке:", {
            reply_markup: downloadKb
          });

          const sessionStart = session.lastStartTimestamp;
          setTimeout(async () => {
            const freshSession = sessionManager.getSession(userId);
            if (freshSession.lastStartTimestamp === sessionStart) {
              const nextKb = new InlineKeyboard().text("«Вернуться в меню»", "gomenu").row();
              await bot.api.sendMessage(userId, botConfig.texts.branch4Sub2Next, {
                reply_markup: nextKb
              });
            }
          }, 10000);
          break;
        }

        // ==========================================
        // ВЕТКА 5. ХОЧУ — Челленджи
        // ==========================================
        case "menu_want": {
          await ctx.answerCallbackQuery();
          const challengeKb = new InlineKeyboard()
            .text("7 дней к себе", "branch5_7days").row()
            .text("14 дней к себе", "branch5_14days").row();
          await ctx.reply(botConfig.texts.branch5Header, {
            reply_markup: challengeKb,
            parse_mode: "HTML"
          });
          break;
        }
        case "branch5_7days": {
          await ctx.answerCallbackQuery();
          await ctx.reply(botConfig.texts.branch5Sub1Content, { parse_mode: "HTML" });

          const sessionStart = session.lastStartTimestamp;
          // Через 5 секунд отправляется ссылка доступа
          setTimeout(async () => {
            const freshSession = sessionManager.getSession(userId);
            if (freshSession.lastStartTimestamp === sessionStart) {
              const linkKb = new InlineKeyboard().url("🚪 Начать челлендж (7 дней)", botConfig.materials.challenge7DaysUrl).row();
              await bot.api.sendMessage(userId, "Ваша персональная ссылка на доступ к челленджу открыта:", {
                reply_markup: linkKb
              });
            }
          }, 5000);

          // Через 10 секунд посылаем напутствие и кнопку возврата в меню
          setTimeout(async () => {
            const freshSession = sessionManager.getSession(userId);
            if (freshSession.lastStartTimestamp === sessionStart) {
              const nextKb = new InlineKeyboard().text("«Вернуться в меню»", "gomenu").row();
              await bot.api.sendMessage(userId, botConfig.texts.branch5Next, {
                reply_markup: nextKb
              });
            }
          }, 10000);
          break;
        }
        case "branch5_14days": {
          await ctx.answerCallbackQuery();
          await ctx.reply(botConfig.texts.branch5Sub2Content, { parse_mode: "HTML" });

          const sessionStart = session.lastStartTimestamp;
          // Через 5 секунд отправляется ссылка доступа
          setTimeout(async () => {
            const freshSession = sessionManager.getSession(userId);
            if (freshSession.lastStartTimestamp === sessionStart) {
              const linkKb = new InlineKeyboard().url("🚪 Начать челлендж (14 дней)", botConfig.materials.challenge14DaysUrl).row();
              await bot.api.sendMessage(userId, "Ваша персональная ссылка на доступ к челленджу открыта:", {
                reply_markup: linkKb
              });
            }
          }, 5000);

          // Через 10 секунд посылаем напутствие и кнопку возврата в меню
          setTimeout(async () => {
            const freshSession = sessionManager.getSession(userId);
            if (freshSession.lastStartTimestamp === sessionStart) {
              const nextKb = new InlineKeyboard().text("«Вернуться в меню»", "gomenu").row();
              await bot.api.sendMessage(userId, botConfig.texts.branch5Next, {
                reply_markup: nextKb
              });
            }
          }, 10000);
          break;
        }

        // ==========================================
        // ВЕТКА 6. 🩶 ГРУППА «ПЕРЕРОЖДЕНИЕ»
        // ==========================================
        case "menu_rebirth": {
          await ctx.answerCallbackQuery();
          const writeKb = new InlineKeyboard().url("✉️ Написать лично Алёне", botConfig.contactLink).row();
          await ctx.reply(botConfig.texts.branch6Content, {
            reply_markup: writeKb
          });

          const sessionStart = session.lastStartTimestamp;
          setTimeout(async () => {
            const freshSession = sessionManager.getSession(userId);
            if (freshSession.lastStartTimestamp === sessionStart) {
              const nextKb = new InlineKeyboard()
                .url("✉️ Написать", botConfig.contactLink).row()
                .text("«Вернуться в меню»", "gomenu").row();
              await bot.api.sendMessage(userId, botConfig.texts.branch6Next, {
                reply_markup: nextKb
              });
            }
          }, 10000);
          break;
        }

        default: {
          await ctx.answerCallbackQuery({ text: "Функция в разработке... 🛠" });
        }
      }
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
      lastStartTimestamp: timestampNow
    });

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
    
    if (session.menuUnlocked) {
      await ctx.reply(botConfig.texts.backToMenuHeader, {
        reply_markup: this.makeMainMenuKeyboard()
      });
    } else {
      // Меню еще не разблокировано (пользователь не заполнил опрос)
      await this.sendPromoWelcome(ctx);
    }
  }
}

export const telegramBotService = new TelegramBotService();
