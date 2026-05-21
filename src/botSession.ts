import fs from "fs";
import path from "path";

export interface UserSession {
  userId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  startedAt?: string;
  
  // Состояния опроса
  step1Answered: boolean;
  step1ChoiceId?: string;
  step2Answered: boolean;
  step2ChoiceId?: string;
  
  // Доступ к полному меню (Reply "Вернуться в меню")
  menuUnlocked: boolean;
  
  // Таймеры / Мьютексы для отложенных отправлений
  lastStartTimestamp: number; // Время последнего клика по /start
}

const SESSION_FILE_PATH = path.join(process.cwd(), "sessions.json");

export class SessionManager {
  private sessions: Record<number, UserSession> = {};

  constructor() {
    this.loadSessions();
  }

  /**
   * Загрузка сессий с диска
   */
  private loadSessions() {
    try {
      if (fs.existsSync(SESSION_FILE_PATH)) {
        const fileContent = fs.readFileSync(SESSION_FILE_PATH, "utf-8");
        this.sessions = JSON.parse(fileContent);
        console.log(`[Sessions] Loaded ${Object.keys(this.sessions).length} sessions from ${SESSION_FILE_PATH}`);
      } else {
        this.sessions = {};
        this.saveSessionsToDisk();
      }
    } catch (e) {
      console.error("[Sessions] Failed to load sessions, initializing fresh object:", e);
      this.sessions = {};
    }
  }

  /**
   * Сохранение сессий на диск
   */
  private saveSessionsToDisk() {
    try {
      fs.writeFileSync(SESSION_FILE_PATH, JSON.stringify(this.sessions, null, 2), "utf-8");
    } catch (e) {
      console.error("[Sessions] Failed to write sessions to disk:", e);
    }
  }

  /**
   * Получить сессию пользователя, или создать дефолтную
   */
  public getSession(userId: number): UserSession {
    if (!this.sessions[userId]) {
      this.sessions[userId] = {
        userId,
        step1Answered: false,
        step2Answered: false,
        menuUnlocked: false,
        lastStartTimestamp: 0
      };
      this.saveSessionsToDisk();
    }
    return this.sessions[userId];
  }

  /**
   * Сбросить сессию (например, при повторном клике /start)
   */
  public resetSession(userId: number, initialData?: Partial<UserSession>): UserSession {
    this.sessions[userId] = {
      userId,
      step1Answered: false,
      step1ChoiceId: undefined,
      step2Answered: false,
      step2ChoiceId: undefined,
      menuUnlocked: false,
      lastStartTimestamp: Date.now(),
      ...initialData
    };
    this.saveSessionsToDisk();
    return this.sessions[userId];
  }

  /**
   * Обновить сессию пользователя
   */
  public updateSession(userId: number, update: Partial<UserSession>): UserSession {
    const session = this.getSession(userId);
    const updated = { ...session, ...update };
    this.sessions[userId] = updated;
    this.saveSessionsToDisk();
    return updated;
  }

  /**
   * Получить весь список сессий для панели управления
   */
  public getAllSessions(): UserSession[] {
    return Object.values(this.sessions);
  }
}

// Экспортируем единственный экземпляр менеджера сессий
export const sessionManager = new SessionManager();
