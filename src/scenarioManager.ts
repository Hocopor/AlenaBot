import fs from "fs";
import path from "path";
import crypto from "crypto";

export interface ScenarioBlock {
  id: string;
  type: 'text' | 'button' | 'link' | 'back' | 'menu' | 'pause' | 'wait_button' | 'file' | 'audio' | 'menu_return';
  text?: string;
  url?: string;
  seconds?: number;
  isOnce?: boolean;
  isMenuUnlock?: boolean;
  nextBlockId?: string | null;  // Ссылка на следующий блок вниз
  rightBlockId?: string | null; // Ссылка на блок справа (для типа button)
}

export interface MenuReturnSettings {
  text: string;
  buttonBlockIds: string[];
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
  menuReturnSettings?: MenuReturnSettings;
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

// Дефолтный сценарий
const defaultScenario: ScenarioConfig = {
  "telegramBotToken": process.env.TELEGRAM_BOT_TOKEN || "",
  "contactLink": "https://t.me/ibanezebi64",
  "startBlockId": "welcome_1",
  "menu": [
    {
      "id": "menu_start",
      "text": "Старт",
      "startBlockId": "welcome_1"
    }
  ],
  "blocks": {
    "welcome_1": {
      "id": "welcome_1",
      "type": "text",
      "text": "Привет. Рада, что ты здесь🤍\n\nЯ Алёна — психолог-СоПутница. Помогаю мягко распутать то, что внутри давно накопилось. Без давления и осуждения.\n\nПрежде чем отдам тебе шаги - инструменты, я хочу понять, что сейчас происходит внутри. Два ключевых вопроса, которые помогут подобрать решение именно под тебя.\n\nЭто место — безопасное. Можно выдохнуть.",
      "nextBlockId": "pause_1"
    },
    "pause_1": {
      "id": "pause_1",
      "type": "pause",
      "seconds": 15,
      "nextBlockId": "welcome_2_txt"
    },
    "welcome_2_txt": {
      "id": "welcome_2_txt",
      "type": "text",
      "text": "Скажи честно — что из этого сейчас про тебя?",
      "nextBlockId": "wb_q1_b1"
    },
    "wb_q1_b1": {
      "id": "wb_q1_b1",
      "type": "button",
      "text": "😮‍💨 Устала, но продолжаю тянуть",
      "isOnce": true,
      "rightBlockId": "welcome_3_txt",
      "nextBlockId": "wb_q1_b2"
    },
    "wb_q1_b2": {
      "id": "wb_q1_b2",
      "type": "button",
      "text": "😶 Всё серое — и не знаю почему",
      "isOnce": true,
      "rightBlockId": "welcome_3_txt",
      "nextBlockId": "wb_q1_b3"
    },
    "wb_q1_b3": {
      "id": "wb_q1_b3",
      "type": "button",
      "text": "😰 Тревога, которая не отпускает",
      "isOnce": true,
      "rightBlockId": "welcome_3_txt",
      "nextBlockId": "wb_q1_b4"
    },
    "wb_q1_b4": {
      "id": "wb_q1_b4",
      "type": "button",
      "text": "💭Не понимаю себя и что со мной",
      "isOnce": true,
      "rightBlockId": "welcome_3_txt",
      "nextBlockId": "wb_q1_b5"
    },
    "wb_q1_b5": {
      "id": "wb_q1_b5",
      "type": "button",
      "text": "🌀 Всё сразу",
      "isOnce": true,
      "rightBlockId": "welcome_3_txt"
    },
    "welcome_3_txt": {
      "id": "welcome_3_txt",
      "type": "text",
      "text": "А внутри чаще всего звучит что-то из этого?",
      "nextBlockId": "wb_q2_b1"
    },
    "wb_q2_b1": {
      "id": "wb_q2_b1",
      "type": "button",
      "text": "Я просто ленивая",
      "isOnce": true,
      "rightBlockId": "welcome_4_txt",
      "nextBlockId": "wb_q2_b2"
    },
    "wb_q2_b2": {
      "id": "wb_q2_b2",
      "type": "button",
      "text": "Надо взять себя в руки",
      "isOnce": true,
      "rightBlockId": "welcome_4_txt",
      "nextBlockId": "wb_q2_b3"
    },
    "wb_q2_b3": {
      "id": "wb_q2_b3",
      "type": "button",
      "text": "У других всё норм — только у меня",
      "isOnce": true,
      "rightBlockId": "welcome_4_txt",
      "nextBlockId": "wb_q2_b4"
    },
    "wb_q2_b4": {
      "id": "wb_q2_b4",
      "type": "button",
      "text": "Я не знаю, чего хочу",
      "isOnce": true,
      "rightBlockId": "welcome_4_txt"
    }
  },
  "menuReturnSettings": {
    "text": "Сделай свой выбор ⬇️",
    "buttonBlockIds": ["wb_q3_b1", "wb_q3_b2", "wb_q3_b3", "wb_q3_b4", "wb_q3_b5", "wb_q3_b6"]
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
