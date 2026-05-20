import fs from "fs";
import path from "path";
import crypto from "crypto";

export interface ScenarioBlock {
  id: string;
  type: 'text' | 'button' | 'link' | 'back' | 'menu' | 'pause' | 'wait_button' | 'file' | 'audio';
  text?: string;
  url?: string;
  seconds?: number;
  isOnce?: boolean;
  nextBlockId?: string | null;  // Ссылка на следующий блок вниз
  rightBlockId?: string | null; // Ссылка на блок справа (для типа button)
}

export interface ScenarioMenuButton {
  id: string;
  text: string;
  startBlockId?: string | null;
}

export interface ScenarioError {
  blockId?: string;
  blockText?: string;
  message: string;
  recommendation: string;
}

export interface ScenarioConfig {
  telegramBotToken: string;
  contactLink: string;
  startBlockId?: string;
  menu: ScenarioMenuButton[];
  blocks: Record<string, ScenarioBlock>;
}

// Пути файлов сохранения на сервере
const CONFIG_FILE = path.join(process.cwd(), "scenario.json");
const DRAFT_FILE = path.join(process.cwd(), "scenario-draft.json");
const ERROR_LOG_FILE = path.join(process.cwd(), "errors.json");

// Симметричное шифрование для безопасного хранения токена Telegram
const ENCRYPTION_KEY = crypto.scryptSync(process.env.ADMIN_PASSWORD_SALT || "alena_default_salt", "salt_salt_32", 32);
const IV_LENGTH = 16;

export function encryptToken(token: string): string {
  if (!token) return "";
  if (token.startsWith("enc:")) return token; // Уже зашифрован
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(token, "utf8", "hex");
    encrypted += cipher.final("hex");
    return "enc:" + iv.toString("hex") + ":" + encrypted;
  } catch (e) {
    return token;
  }
}

export function decryptToken(token: string): string {
  if (!token) return "";
  if (!token.startsWith("enc:")) return token; // Не зашифрован
  try {
    const parts = token.split(":");
    const iv = Buffer.from(parts[1], "hex");
    const encryptedText = parts[2];
    const decipher = crypto.createDecipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (e) {
    return token;
  }
}

// Дефолтный сценарий (соответствует первоначальной структуре бота из botConfig.ts)
const defaultScenario: ScenarioConfig = {
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || "",
  contactLink: "https://t.me/ibanezebi64",
  startBlockId: "start_node",
  menu: [
    { id: "menu_diary", text: "ДНЕВНИК МИКРО-ПОБЕД — Гайд", startBlockId: "diary_header" },
    { id: "menu_audio", text: "АУДИО ВРЕМЯ — музыка", startBlockId: "audio_header" },
    { id: "menu_exercise", text: "УПРАЖНЕНИЕ   —  техники", startBlockId: "exercise_header" },
    { id: "menu_opora", text: "ОПОРА", startBlockId: "opora_header" },
    { id: "menu_want", text: "ХОЧУ — Челленджи", startBlockId: "want_header" },
    { id: "menu_rebirth", text: "🩶 ГРУППА «ПЕРЕРОЖДЕНИЕ»", startBlockId: "rebirth_content" }
  ],
  blocks: {
    "start_node": {
      id: "start_node",
      type: "text",
      text: "Привет! Добро пожаловать. Это стартовое сообщение.",
      nextBlockId: "start_pause_1",
    },
    "start_pause_1": {
      id: "start_pause_1",
      type: "pause",
      seconds: 5,
      nextBlockId: "start_btn_1"
    },
    "start_btn_1": {
      id: "start_btn_1",
      type: "button",
      text: "Понятно",
      isOnce: true,
      nextBlockId: "start_to_menu"
    },
    "start_to_menu": {
      id: "start_to_menu",
      type: "menu",
      text: "«В меню»"
    },
    // Ветка 1 Дневник микро-побед
    "diary_header": {
      id: "diary_header",
      type: "text",
      text: "ДНЕВНИК МИКРО-ПОБЕД — Гайд",
      nextBlockId: "diary_btn_guide"
    },
    "diary_btn_guide": {
      id: "diary_btn_guide",
      type: "button",
      text: "1 - Гайд легализации бездействия🩶",
      rightBlockId: "diary_content"
    },
    "diary_content": {
      id: "diary_content",
      type: "text",
      text: "Сначала — одна мысль.\nБездействие это не провал. Иногда это кажется большим, на то, что хватает силы. И это честно.\nВнутри дневника — маленькие шаги. Таких, чтобы не надо было «брать себя в руки».\nПросто — чуть бережнее к себе. День за днём.",
      nextBlockId: "diary_download"
    },
    "diary_download": {
      id: "diary_download",
      type: "link",
      text: "📖 Скачать Дневник микро-побед (Гайд)",
      url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
      nextBlockId: "diary_pause"
    },
    "diary_pause": {
      id: "diary_pause",
      type: "pause",
      seconds: 10,
      nextBlockId: "diary_next"
    },
    "diary_next": {
      id: "diary_next",
      type: "text",
      text: "Надеюсь, он станет твоим маленьким другом \nЕсли почувствуешь, что хочется глубже — я рядом. В июне открываю живую группу «Перерождение». Напиши мне — поговорим подробнее.",
      nextBlockId: "diary_contact_link"
    },
    "diary_contact_link": {
      id: "diary_contact_link",
      type: "link",
      text: "✉️ Написать Алёне",
      url: "https://t.me/ibanezebi64",
      nextBlockId: "diary_to_menu"
    },
    "diary_to_menu": {
      id: "diary_to_menu",
      type: "menu",
      text: "«Вернуться в меню»"
    },

    // Ветка 2 Аудио время
    "audio_header": {
      id: "audio_header",
      type: "text",
      text: "Аудио библиотека\nВключай — и просто побудь. Ничего делать не нужно.\nЭто твои несколько минут только для тебя.",
      nextBlockId: "audio_link"
    },
    "audio_link": {
      id: "audio_link",
      type: "link",
      text: "🎵 Аудио библиотека - успокаивающая музыка",
      url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
      nextBlockId: "audio_pause"
    },
    "audio_pause": {
      id: "audio_pause",
      type: "pause",
      seconds: 10,
      nextBlockId: "audio_next"
    },
    "audio_next": {
      id: "audio_next",
      type: "text",
      text: "Побудь в этом состоянии чуть дольше \nА если захочешь — загляни в другие материалы. Там есть реальность, дневник и кое-что ещё ⬇️",
      nextBlockId: "audio_to_menu"
    },
    "audio_to_menu": {
      id: "audio_to_menu",
      type: "menu",
      text: "«Вернуться в меню»"
    },

    // Ветка 3 Упражнения
    "exercise_header": {
      id: "exercise_header",
      type: "text",
      text: "УПРАЖНЕНИЕ   —  техники",
      nextBlockId: "exercise_btn_square"
    },
    "exercise_btn_square": {
      id: "exercise_btn_square",
      type: "button",
      text: "«Квадрат Дыхания» аудио",
      rightBlockId: "exercise_content"
    },
    "exercise_content": {
      id: "exercise_content",
      type: "text",
      text: "Упражнение за 2 минуты успокаивает нервную систему.\nВключай прямо сейчас. Можно лёжа.",
      nextBlockId: "exercise_audio_link"
    },
    "exercise_audio_link": {
      id: "exercise_audio_link",
      type: "link",
      text: "🎧 Аудиоинструкция «Квадрат Дыхания»",
      url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
      nextBlockId: "exercise_pause"
    },
    "exercise_pause": {
      id: "exercise_pause",
      type: "pause",
      seconds: 7,
      nextBlockId: "exercise_next"
    },
    "exercise_next": {
      id: "exercise_next",
      type: "text",
      text: "Как ты? \nСохрани аудио — и возвращайся каждый раз, когда найдешь. Это работает.\nЕсли хочешь понять глубже — почему тревога возвращается снова и снова — напиши мне. Поговорим.",
      nextBlockId: "exercise_contact_link"
    },
    "exercise_contact_link": {
      id: "exercise_contact_link",
      type: "link",
      text: "✉️ Написать Алёне",
      url: "https://t.me/ibanezebi64",
      nextBlockId: "exercise_to_menu"
    },
    "exercise_to_menu": {
      id: "exercise_to_menu",
      type: "menu",
      text: "«Вернуться в меню»"
    },

    // Ветка 4 Опора
    "opora_header": {
      id: "opora_header",
      type: "text",
      text: "ОПОРА",
      nextBlockId: "opora_btn_anxiety"
    },
    "opora_btn_anxiety": {
      id: "opora_btn_anxiety",
      type: "button",
      text: "1 - Маркер Тревоги",
      rightBlockId: "opora_anxiety_content",
      nextBlockId: "opora_btn_support"
    },
    "opora_btn_support": {
      id: "opora_btn_support",
      type: "button",
      text: "2 - Фразы Поддержка",
      rightBlockId: "opora_support_content"
    },
    "opora_anxiety_content": {
      id: "opora_anxiety_content",
      type: "text",
      text: "Маркер Тревоги \nЭтот простой инструмент — поможет понять, что сейчас происходит внутри. Тревога, страх или апатия.\nКогда узнаешь — становится чуть легче. Уже не «со мной что-то не так», а просто — вот что сейчас есть.",
      nextBlockId: "opora_anxiety_link"
    },
    "opora_anxiety_link": {
      id: "opora_anxiety_link",
      type: "link",
      text: "📋 Скачать Маркер Тревоги (PDF)",
      url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
      nextBlockId: "opora_anxiety_pause"
    },
    "opora_anxiety_pause": {
      id: "opora_anxiety_pause",
      type: "pause",
      seconds: 10,
      nextBlockId: "opora_anxiety_next"
    },
    "opora_anxiety_next": {
      id: "opora_anxiety_next",
      type: "text",
      text: "Теперь ты знаешь чуть больше о себе. \nЭто уже немаловажно. Если хочешь — следующий шаг: реальный Квадрат. Оно помогает прямо в данный момент.",
      nextBlockId: "opora_anxiety_to_menu"
    },
    "opora_anxiety_to_menu": {
      id: "opora_anxiety_to_menu",
      type: "menu",
      text: "«Вернуться в меню»"
    },
    "opora_support_content": {
      id: "opora_support_content",
      type: "text",
      text: "Фразы Поддержка\nСтань переводчиком для своего ребенка.\n12 фраз которые открывают диалог без давления и осуждения.",
      nextBlockId: "opora_support_link"
    },
    "opora_support_link": {
      id: "opora_support_link",
      type: "link",
      text: "📋 Скачать Фразы Поддержки (PDF)",
      url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
      nextBlockId: "opora_support_pause"
    },
    "opora_support_pause": {
      id: "opora_support_pause",
      type: "pause",
      seconds: 10,
      nextBlockId: "opora_support_next"
    },
    "opora_support_next": {
      id: "opora_support_next",
      type: "text",
      text: "Возвращайся к ним в любой момент \nИ помни — слова работают, когда мы готовы их услышать. Сегодня ты была готова.\nЕсли захочется большего — я здесь. Живая группа «Перерождение» всегда открыта.",
      nextBlockId: "opora_support_to_menu"
    },
    "opora_support_to_menu": {
      id: "opora_support_to_menu",
      type: "menu",
      text: "«Вернуться в меню»"
    },

    // Ветка 5 Челленджи
    "want_header": {
      id: "want_header",
      type: "text",
      text: "ХОЧУ — Челленджи",
      nextBlockId: "want_btn_7days"
    },
    "want_btn_7days": {
      id: "want_btn_7days",
      type: "button",
      text: "7 дней к себе",
      rightBlockId: "want_7days_content",
      nextBlockId: "want_btn_14days"
    },
    "want_btn_14days": {
      id: "want_btn_14days",
      type: "button",
      text: "14 дней к себе",
      rightBlockId: "want_14days_content"
    },
    "want_7days_content": {
      id: "want_7days_content",
      type: "text",
      text: "7 дней к себе \nОтлично, что ты здесь \nЧеллендж — это не «заставить себя». Это маленькое приключение к себе.\nКаждый день — одно простое действие. Без давления. Без оценок. Просто попробуй — каково это, когда к себе по-доброму.",
      nextBlockId: "want_7days_pause5"
    },
    "want_7days_pause5": {
      id: "want_7days_pause5",
      type: "pause",
      seconds: 5,
      nextBlockId: "want_7days_link"
    },
    "want_7days_link": {
      id: "want_7days_link",
      type: "link",
      text: "🚪 Начать челлендж (7 дней)",
      url: "https://telegra.ph/CHellendzh-7-dnej-k-sebe-05-20",
      nextBlockId: "want_7days_pause10"
    },
    "want_7days_pause10": {
      id: "want_7days_pause10",
      type: "pause",
      seconds: 10,
      nextBlockId: "want_7days_next"
    },
    "want_7days_next": {
      id: "want_7days_next",
      type: "text",
      text: "Ты решилась — и это уже шаг 🤍\nВеди дневник рядом — так будет виднее, как ты меня. Даже когда кажется, что ничего не происходит.",
      nextBlockId: "want_7days_to_menu"
    },
    "want_7days_to_menu": {
      id: "want_7days_to_menu",
      type: "menu",
      text: "«Вернуться в меню»"
    },
    "want_14days_content": {
      id: "want_14days_content",
      type: "text",
      text: "14 дней к себе \nОтлично, что ты здесь \nЧеллендж — это не «заставить себя». Это маленькое приключение к себе.\nКаждый день — одно простое действие. Без давления. Без оценок. Просто попробуй — каково это, когда к себе по-доброму.",
      nextBlockId: "want_14days_pause5"
    },
    "want_14days_pause5": {
      id: "want_14days_pause5",
      type: "pause",
      seconds: 5,
      nextBlockId: "want_14days_link"
    },
    "want_14days_link": {
      id: "want_14days_link",
      type: "link",
      text: "🚪 Начать челлендж (14 дней)",
      url: "https://telegra.ph/CHellendzh-14-dnej-k-sebe-05-20",
      nextBlockId: "want_14days_pause10"
    },
    "want_14days_pause10": {
      id: "want_14days_pause10",
      type: "pause",
      seconds: 10,
      nextBlockId: "want_14days_next"
    },
    "want_14days_next": {
      id: "want_14days_next",
      type: "text",
      text: "Ты решилась — и это уже шаг 🤍\nВеди дневник рядом — так будет виднее, как ты меня. Даже когда кажется, что ничего не происходит.",
      nextBlockId: "want_14days_to_menu"
    },
    "want_14days_to_menu": {
      id: "want_14days_to_menu",
      type: "menu",
      text: "«Вернуться в меню»"
    },

    // Ветка 6 Группа перерождение
    "rebirth_content": {
      id: "rebirth_content",
      type: "text",
      text: "Рада, что ты здесь \n«Перерождение» — это живая группа. Всего 10 мест. \nЗдесь не будет лекций и домашних занятий. Только живая работа — мягко, в своем темпе, с обратной связью от меня.\nДля тех, кто давно думал: что-то должно измениться. Но непонятно — с чего начать и хватит ли сил.\nХочешь узнать подробнее — напиши мне лично. Расскажу всё.",
      nextBlockId: "rebirth_link"
    },
    "rebirth_link": {
      id: "rebirth_link",
      type: "link",
      text: "✉️ Написать лично Алёне",
      url: "https://t.me/ibanezebi64",
      nextBlockId: "rebirth_pause"
    },
    "rebirth_pause": {
      id: "rebirth_pause",
      type: "pause",
      seconds: 10,
      nextBlockId: "rebirth_next"
    },
    "rebirth_next": {
      id: "rebirth_next",
      type: "text",
      text: "Буду ждать твоих сообщений 🤍\nНе торопись — просто знай, что место есть. И оно может быть твоим.",
      nextBlockId: "rebirth_link_write"
    },
    "rebirth_link_write": {
      id: "rebirth_link_write",
      type: "link",
      text: "✉️ Написать",
      url: "https://t.me/ibanezebi64",
      nextBlockId: "rebirth_to_menu"
    },
    "rebirth_to_menu": {
      id: "rebirth_to_menu",
      type: "menu",
      text: "«Вернуться в меню»"
    }
  }
};

export class ScenarioManager {
  private currentConfig: ScenarioConfig;

  constructor() {
    this.currentConfig = defaultScenario;
    this.loadConfig();
  }

  /**
   * Загрузить боевой конфиг сценария с диска
   */
  public loadConfig(): ScenarioConfig {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const data = fs.readFileSync(CONFIG_FILE, "utf-8");
        const parsed = JSON.parse(data);
        parsed.telegramBotToken = decryptToken(parsed.telegramBotToken);
        this.currentConfig = parsed;
      } else {
        this.currentConfig = {
          ...defaultScenario,
          telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || ""
        };
        this.saveConfig(this.currentConfig);
      }
    } catch (e) {
      console.error("[ScenarioManager] Error loading scenario.json, using default:", e);
      this.currentConfig = defaultScenario;
    }
    return this.currentConfig;
  }

  /**
   * Сохранить боевой конфиг сценария на диск
   */
  public saveConfig(config: ScenarioConfig) {
    try {
      this.currentConfig = { ...config };
      const encryptedConfig = {
        ...config,
        telegramBotToken: encryptToken(config.telegramBotToken)
      };
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(encryptedConfig, null, 2), "utf-8");
    } catch (e) {
      console.error("[ScenarioManager] Error saving scenario.json:", e);
    }
  }

  /**
   * Загрузить черновик
   */
  public loadDraft(): ScenarioConfig | null {
    try {
      if (fs.existsSync(DRAFT_FILE)) {
        const data = fs.readFileSync(DRAFT_FILE, "utf-8");
        const parsed = JSON.parse(data);
        parsed.telegramBotToken = decryptToken(parsed.telegramBotToken);
        return parsed;
      }
    } catch (e) {
      console.error("[ScenarioManager] Error loading scenario-draft.json:", e);
    }
    return null;
  }

  /**
   * Сохранить черновик
   */
  public saveDraft(config: ScenarioConfig) {
    try {
      const encryptedDraft = {
        ...config,
        telegramBotToken: encryptToken(config.telegramBotToken)
      };
      fs.writeFileSync(DRAFT_FILE, JSON.stringify(encryptedDraft, null, 2), "utf-8");
    } catch (e) {
      console.error("[ScenarioManager] Error saving scenario-draft.json:", e);
    }
  }

  /**
   * Удалить черновик
   */
  public deleteDraft() {
    try {
      if (fs.existsSync(DRAFT_FILE)) {
        fs.unlinkSync(DRAFT_FILE);
      }
    } catch (e) {
      console.error("[ScenarioManager] Error deleting scenario-draft.json:", e);
    }
  }

  /**
   * Получить логи ошибок бота
   */
  public getErrorLogs(): any[] {
    try {
      if (fs.existsSync(ERROR_LOG_FILE)) {
        const data = fs.readFileSync(ERROR_LOG_FILE, "utf-8");
        return JSON.parse(data);
      }
    } catch (e) {
      // Инициализируем пустой массив
    }
    return [];
  }

  /**
   * Записать ошибку в лог
   */
  public logError(message: string, context?: any) {
    try {
      const logs = this.getErrorLogs();
      const entry = {
        id: crypto.randomBytes(8).toString("hex"),
        timestamp: new Date().toISOString(),
        message,
        context: context ? JSON.stringify(context) : null
      };
      logs.unshift(entry);
      if (logs.length > 50) {
        logs.pop();
      }
      fs.writeFileSync(ERROR_LOG_FILE, JSON.stringify(logs, null, 2), "utf-8");
    } catch (e) {
      console.error("[ScenarioManager] Error writing to errors.json:", e);
    }
  }

  /**
   * Валидация черновика на соответствие лимитам Telegram и логической корректности
   */
  public validateScenario(config: ScenarioConfig): { valid: boolean; errors: ScenarioError[] } {
    const errors: ScenarioError[] = [];

    // Проверяем токен
    if (config.telegramBotToken && !/^\d+:[A-Za-z0-9_-]{35}$/.test(config.telegramBotToken.trim())) {
      errors.push({
        message: "Некорректный формат Telegram-токена бота.",
        recommendation: "Telegram Bot Token должен соответствовать стандартному виду, например: 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ."
      });
    }

    // Проверяем главное меню
    if (!config.menu || config.menu.length === 0) {
      errors.push({
        message: "Главное меню пустое.",
        recommendation: "Добавьте как минимум одну кнопку в главное меню в левой панели конструктора."
      });
    } else {
      config.menu.forEach((btn, idx) => {
        if (!btn.text.trim()) {
          errors.push({
            message: `Кнопка главного меню #${idx + 1} не имеет названия.`,
            recommendation: "Задайте непустой текст для кнопки главного меню."
          });
        }
        if (btn.text.length > 64) {
          errors.push({
            message: `Имя кнопки "${btn.text.substring(0, 20)}..." превышает 64 символа.`,
            recommendation: "Сократите название кнопки до 64 символов согласно лимитам Telegram."
          });
        }
        if (!btn.startBlockId || !config.blocks[btn.startBlockId]) {
          errors.push({
            message: `Для кнопки "${btn.text || '#' + (idx + 1)}" не задан начальный блок сценария.`,
            recommendation: "Присоедините блок (например, блок Текста) кликом по плюсику справа от названия кнопки."
          });
        }
      });
    }

    // Проверяем все блоки в сценарии на корректность
    Object.values(config.blocks).forEach((block) => {
      const heading = `Блок [${block.type.toUpperCase()}] "${block.text ? block.text.substring(0, 30) : block.id}"`;

      // Проверка пустого текста
      if (block.type === 'text' || block.type === 'button' || block.type === 'link') {
        if (!block.text || !block.text.trim()) {
          errors.push({
            blockId: block.id,
            blockText: block.text,
            message: `${heading} имеет пустое текстовое поле.`,
            recommendation: "Заполните текстовое поле или удалите этот блок, если он не нужен."
          });
        }
      }

      // Лимиты Telegram на длину сообщения (4096)
      if (block.type === 'text' && block.text && block.text.length > 4096) {
        errors.push({
          blockId: block.id,
          blockText: block.text,
          message: `${heading} превышает лимит в 4096 символов.`,
          recommendation: "Разбейте это объёмное сообщение на две отдельные текстовые карточки, добавив между ними паузу."
        });
      }

      // Лимиты кнопок (64 символа)
      if ((block.type === 'button' || block.type === 'link') && block.text && block.text.length > 64) {
        errors.push({
          blockId: block.id,
          blockText: block.text,
          message: `${heading} содержит слишком длинную надпись кнопки (более 64 символов).`,
          recommendation: "Сделайте надпись на кнопке короче, например до 30-40 символов."
        });
      }

      // Проверка ссылок
      if (block.type === 'link') {
        if (!block.url || !block.url.trim()) {
          errors.push({
            blockId: block.id,
            blockText: block.text,
            message: `${heading} не содержит веб-ссылку.`,
            recommendation: "Укажите корректный URL-адрес ссылки, например: https://example.com"
          });
        } else if (!/^https?:\/\/[^\s$.?#].[^\s]*$/i.test(block.url.trim())) {
          errors.push({
            blockId: block.id,
            blockText: block.text,
            message: `${heading} имеет невалидный URL: "${block.url}".`,
            recommendation: "Ссылка должна начинаться с http:// или https:// и быть корректным URL-адресом."
          });
        }
      }

      // Проверка файлов и аудио
      if (block.type === 'file' || block.type === 'audio') {
        if (!block.url || !block.url.trim()) {
          errors.push({
            blockId: block.id,
            blockText: block.text,
            message: `${heading} не содержит прикрепленный файл или ссылку.`,
            recommendation: "Загрузите файл или укажите путь/URL к медиафайлу."
          });
        }
      }

      // Проверка паузы
      if (block.type === 'pause') {
        if (block.seconds === undefined || isNaN(block.seconds) || block.seconds <= 0) {
          errors.push({
            blockId: block.id,
            blockText: block.text,
            message: `В блоке паузы не задано время ожидания.`,
            recommendation: "Укажите количество секунд ожидания (целое число секунд больше нуля)."
          });
        } else if (block.seconds > 7200) {
          errors.push({
            blockId: block.id,
            blockText: block.text,
            message: `Время задержки ${block.seconds} сек превышает 2 часа.`,
            recommendation: "Максимальное рекомендуемое время задержки в интерактивных паузах составляет 1-2 часа (3600-7200 сек)."
          });
        }
      }

      // Проверка тупиковых кнопок (у которых нет ни правого перехода, ни веток ниже)
      if (block.type === 'button') {
        // Если у кнопки нет правого перехода RIGHT, она должна быть либо терминальным выбором, либо частью цепочки
        if (!block.rightBlockId && !block.nextBlockId) {
          // Это не критическая ошибка, но предупредим
        }
      }
    });

    // Поиск циклов, которые могут замкнуть бота бесконечно
    const visited = new Set<string>();
    const hasCycle = (blockId: string, currentPath: Set<string>): boolean => {
      if (currentPath.has(blockId)) return true;
      if (visited.has(blockId)) return false;

      currentPath.add(blockId);
      visited.add(blockId);

      const block = config.blocks[blockId];
      if (block) {
        if (block.nextBlockId && hasCycle(block.nextBlockId, new Set(currentPath))) {
          return true;
        }
        if (block.rightBlockId && hasCycle(block.rightBlockId, new Set(currentPath))) {
          return true;
        }
      }
      return false;
    };

    config.menu.forEach((btn) => {
      if (btn.startBlockId) {
        if (hasCycle(btn.startBlockId, new Set<string>())) {
          errors.push({
            message: `Обнаружено бесконечное зацикливание при переходе из кнопки меню "${btn.text}".`,
            recommendation: "Убедитесь, что стрелочки переходов не замыкают одинаковые карточки друг на друга в бесконечную петлю."
          });
        }
      }
    });

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Обертка для соответствия контракту API Express
   */
  public validateConfig(config: ScenarioConfig): { isValid: boolean; errors: ScenarioError[] } {
    const res = this.validateScenario(config);
    return {
      isValid: res.valid,
      errors: res.errors
    };
  }
}

export const scenarioManager = new ScenarioManager();
