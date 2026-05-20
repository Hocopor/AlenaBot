import React, { useState, useEffect } from "react";
import { 
  Bot, 
  Settings, 
  RefreshCw, 
  Users, 
  FileText, 
  CheckCircle, 
  XCircle, 
  ChevronRight, 
  ExternalLink,
  Shield,
  HelpCircle,
  Copy,
  Terminal,
  Clock,
  ThumbsUp,
  Radio
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface UserSessionInfo {
  userId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  startedAt?: string;
  step1ChoiceId?: string;
  step2ChoiceId?: string;
  menuUnlocked: boolean;
}

interface BotStatus {
  initialized: boolean;
  isPollingActive: boolean;
  isWebhookWorking: boolean;
  hasToken: boolean;
  appUrl: string;
  sessionCount: number;
  sessionsList: UserSessionInfo[];
  config: {
    telegramBotToken: string;
    appUrl: string;
  };
}

export default function App() {
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Авторизационные токены админа
  const [authToken, setAuthToken] = useState<string | null>(localStorage.getItem("alena_admin_token"));
  const [adminUser, setAdminUser] = useState<string | null>(localStorage.getItem("alena_admin_user"));

  // Форма входа
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  // Поля ввода для настройки на лету
  const [tokenInput, setTokenInput] = useState("");
  const [appUrlInput, setAppUrlInput] = useState("");
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSuccessMessage, setConfigSuccessMessage] = useState("");

  // Поля для генерации крипто-хэша SHA-256
  const [hashPasswordInput, setHashPasswordInput] = useState("");
  const [hashResult, setHashResult] = useState<{ salt: string; hash: string; instructions: string } | null>(null);
  const [generatingHash, setGeneratingHash] = useState(false);

  // Выбор активной вкладки
  const [activeTab, setActiveTab] = useState<"dashboard" | "sessions" | "logs" | "guide">("dashboard");

  // Копирование в буфер
  const [copiedText, setCopiedText] = useState("");

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(""), 2200);
  };

  const handleLogout = () => {
    localStorage.removeItem("alena_admin_token");
    localStorage.removeItem("alena_admin_user");
    setAuthToken(null);
    setAdminUser(null);
    setStatus(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setLoggingIn(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: usernameInput,
          password: passwordInput
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        localStorage.setItem("alena_admin_token", data.token);
        localStorage.setItem("alena_admin_user", data.username);
        setAuthToken(data.token);
        setAdminUser(data.username);
        setPasswordInput("");
        setLoginError("");
      } else {
        setLoginError(data.error || "Неверный логин или пароль");
      }
    } catch (err: any) {
      setLoginError(`Ошибка соединения: ${err.message || err}`);
    } finally {
      setLoggingIn(false);
    }
  };

  const handleGenerateHash = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hashPasswordInput) return;
    setGeneratingHash(true);
    setHashResult(null);
    try {
      const res = await fetch("/api/generate-hash", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`
        },
        body: JSON.stringify({ password: hashPasswordInput })
      });
      const data = await res.json();
      if (res.ok) {
        setHashResult(data);
      } else {
        alert(data.error || "Ошибка генерации хэша");
      }
    } catch (err: any) {
      alert(`Сбой при шифровании: ${err.message || err}`);
    } finally {
      setGeneratingHash(false);
    }
  };

  const fetchData = async (silent = false) => {
    if (!authToken) return;
    if (!silent) setLoading(true);
    else setRefreshing(true);
    
    try {
      const headers = { "Authorization": `Bearer ${authToken}` };
      const statusRes = await fetch("/api/bot-status", { headers });
      
      if (statusRes.status === 401) {
        handleLogout();
        return;
      }
      
      const statusData = await statusRes.json();
      setStatus(statusData);

      const logsRes = await fetch("/api/bot-logs", { headers });
      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setLogs(logsData.logs || []);
      }
    } catch (e) {
      console.error("Failed to fetch server state details:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (authToken) {
      fetchData();
      const interval = setInterval(() => {
        fetchData(true);
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [authToken]);

  const handleUpdateConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    setConfigSuccessMessage("");
    try {
      const res = await fetch("/api/bot-restart", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`
        },
        body: JSON.stringify({
          token: tokenInput,
          appUrl: appUrlInput
        })
      });
      
      if (res.status === 401) {
        handleLogout();
        return;
      }

      const data = await res.json();
      if (data.success) {
        setConfigSuccessMessage(`Бот перезапущен! Режим работы: ${data.mode === "webhook" ? "Вебхук" : "Длинный опрос (polling)"}`);
        setTimeout(() => {
          setShowConfigModal(false);
          setConfigSuccessMessage("");
          setHashResult(null);
          setHashPasswordInput("");
        }, 3000);
        fetchData();
      } else {
        setConfigSuccessMessage(`Ошибка при перезапуске: ${data.error || "Неизвестный сбой"}`);
      }
    } catch (err: any) {
      setConfigSuccessMessage(`Сбой запроса: ${err.message || err}`);
    } finally {
      setSavingConfig(false);
    }
  };

  const openConfigModal = () => {
    if (status) {
      setTokenInput(""); // Оставляем пустым для безопасности
      setAppUrlInput(status.appUrl === "not configured" ? "" : status.appUrl);
    }
    setShowConfigModal(true);
  };

  // Перевод идентификаторов выбора на русский язык
  const getChoiceLabel = (id?: string) => {
    if (!id) return "—";
    switch (id) {
      case "step1_tired": return "😮‍💨 Устала, но тяну";
      case "step1_grey": return "😶 Всё серое";
      case "step1_anxiety": return "😰 Тревога";
      case "step1_lost": return "💭 Не понимаю себя";
      case "step1_all": return "🌀 Всё сразу";
      case "step2_lazy": return "«Я просто ленивая»";
      case "step2_control": return "«Надо взять себя в руки»";
      case "step2_others_ok": return "«У других всё нормально»";
      case "step2_dont_know": return "«Я не знаю, чего хочу»";
      default: return id;
    }
  };

  // Вычисление процента прохождения
  const calculateProgress = (session: UserSessionInfo) => {
    let score = 0;
    if (session.step1ChoiceId) score += 33;
    if (session.step2ChoiceId) score += 33;
    if (session.menuUnlocked) score += 34;
    return score;
  };

  if (!authToken) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans antialiased selection:bg-emerald-500 selection:text-white">
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
          <div className="inline-flex p-3 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100/85 mb-4 shadow-xs">
            <Bot className="h-10 w-10 text-emerald-600" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            Вход
          </h2>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 border border-slate-200/90 shadow-md sm:rounded-2xl sm:px-10">
            <form className="space-y-6" onSubmit={handleLogin}>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                  Логин
                </label>
                <input
                  type="text"
                  required
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-400 focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                  Пароль
                </label>
                <input
                  type="password"
                  required
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-400 focus:outline-none transition-all"
                />
              </div>

              {loginError && (
                <div className="p-3 bg-rose-50/70 border border-rose-100 rounded-xl text-[11px] text-rose-800 font-semibold leading-relaxed">
                  ⚠️ {loginError}
                </div>
              )}

              <div>
                <button
                  type="submit"
                  disabled={loggingIn}
                  className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-xs text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-colors cursor-pointer"
                >
                  {loggingIn ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    "Войти"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased">
      {/* Шапка админ-панели */}
      <header className="sticky top-0 z-10 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
                <Bot className="h-6 w-6" id="header-bot-icon" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-slate-900 tracking-tight">Панель управления Алёны</h1>
                <p className="text-xs text-slate-500 font-medium">Телеграм-бот • СоПутница Психолог</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <span className="hidden md:inline-flex items-center px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-semibold rounded-md border border-slate-200 mr-2">
                <Shield className="h-3 w-3 mr-1 text-slate-500" />
                Логин: {adminUser || "admin"}
              </span>

              <button 
                onClick={() => fetchData()}
                disabled={loading || refreshing}
                className="inline-flex items-center px-3 py-1.5 border border-slate-200 text-xs font-semibold rounded-lg bg-white hover:bg-slate-50 text-slate-600 focus:outline-none transition-all duration-200 cursor-pointer"
              >
                <RefreshCw className={`h-3 w-3 mr-1.5 ${refreshing || loading ? "animate-spin" : ""}`} />
                {refreshing ? "Обновление..." : "Обновить"}
              </button>
              
              <button 
                onClick={openConfigModal}
                className="inline-flex items-center px-3 py-1.5 border border-emerald-200 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm focus:outline-none transition-all duration-200 cursor-pointer"
              >
                <Settings className="h-3.5 w-3.5 mr-1.5" />
                Настройка API
              </button>

              <button 
                onClick={handleLogout}
                className="inline-flex items-center px-3 py-1.5 border border-rose-200 text-xs font-semibold rounded-lg bg-white hover:bg-rose-50 text-rose-600 focus:outline-none transition-all duration-200 cursor-pointer"
              >
                Выйти
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Основной контент */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Базовый статус */}
        {status && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Состояние службы</p>
                <div className="mt-1.5 flex items-center">
                  {status.initialized ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-emerald-500 mr-1.5" />
                      <span className="text-md font-bold text-slate-950">Запущен</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 text-rose-500 mr-1.5" />
                      <span className="text-md font-bold text-slate-950">Остановлен</span>
                    </>
                  )}
                </div>
              </div>
              <div className="p-3 bg-slate-50 text-slate-500 rounded-xl">
                <Radio className="h-5 w-5 animate-pulse text-emerald-500" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Режим работы</p>
                <p className="mt-1.5 text-md font-bold text-slate-950">
                  {status.isWebhookWorking ? (
                    <span className="text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 text-xs inline-block">Вебхуки активны</span>
                  ) : status.isPollingActive ? (
                    <span className="text-amber-600 font-semibold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100 text-xs inline-block">Длинный опрос (polling)</span>
                  ) : (
                    <span className="text-rose-600 font-semibold bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100 text-xs inline-block">Ошибка конфигурации</span>
                  )}
                </p>
              </div>
              <div className="p-3 bg-slate-50 text-slate-500 rounded-xl">
                <Shield className="h-5 w-5" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Диалогов в БД</p>
                <p className="mt-1.5 text-2xl font-black text-slate-950">{status.sessionCount}</p>
              </div>
              <div className="p-3 bg-slate-50 text-slate-500 rounded-xl">
                <Users className="h-5 w-5" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Ваш Telegram-Токен</p>
                <p className="mt-1.5 text-sm font-semibold truncate text-slate-600 max-w-[180px]">
                  {status.hasToken ? "Задан (Скрыт)" : "Отсутствует"}
                </p>
              </div>
              <div className="p-3 bg-slate-50 text-slate-500 rounded-xl">
                <Bot className="h-5 w-5" />
              </div>
            </div>
          </div>
        )}

        {/* Инструкция-предупреждение, если токен не заполнен */}
        {status && !status.hasToken && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-8 flex flex-col md:flex-row md:items-center justify-between">
            <div className="flex items-start md:items-center space-x-3">
              <div className="p-2 bg-amber-100 text-amber-700 rounded-lg">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-amber-900 text-sm">Токен Telegram-бота не заполнен!</h3>
                <p className="text-xs text-amber-700 mt-1 max-w-2xl">
                  Чтобы бот начал отвечать клиентам, вам нужно указать API токен из @BotFather. Вы можете добавить его в панель конфигурации прямо сейчас или прописать его в файле <code>.env</code>.
                </p>
              </div>
            </div>
            <button 
              onClick={openConfigModal}
              className="mt-4 md:mt-0 text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 px-4 rounded-lg shadow-xs transition-colors"
            >
              Ввести токен бота
            </button>
          </div>
        )}

        {/* Навигационные вкладки */}
        <div className="flex border-b border-slate-200 mb-6">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`py-3 px-5 text-sm font-semibold border-b-2 transition-all duration-150 flex items-center ${
              activeTab === "dashboard"
                ? "border-emerald-500 text-emerald-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Bot className="h-4 w-4 mr-2" />
            Дашборд Алёны
          </button>
          <button
            onClick={() => setActiveTab("sessions")}
            className={`py-3 px-5 text-sm font-semibold border-b-2 transition-all duration-150 flex items-center ${
              activeTab === "sessions"
                ? "border-emerald-500 text-emerald-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Users className="h-4 w-4 mr-2" />
            Клиенты в боте ({status?.sessionCount || 0})
          </button>
          <button
            onClick={() => setActiveTab("logs")}
            className={`py-3 px-5 text-sm font-semibold border-b-2 transition-all duration-150 flex items-center ${
              activeTab === "logs"
                ? "border-emerald-500 text-emerald-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Terminal className="h-4 w-4 mr-2" />
            Консоль логов
          </button>
          <button
            onClick={() => setActiveTab("guide")}
            className={`py-3 px-5 text-sm font-semibold border-b-2 transition-all duration-150 flex items-center ${
              activeTab === "guide"
                ? "border-emerald-500 text-emerald-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <HelpCircle className="h-4 w-4 mr-2" />
            Внедрение на Ubuntu 24
          </button>
        </div>

        {/* Контент вкладок с плавной анимацией */}
        <div className="min-h-[400px]">
          {loading ? (
            <div className="flex items-center justify-center p-20">
              <div className="flex flex-col items-center space-y-4">
                <RefreshCw className="h-8 w-8 text-emerald-500 animate-spin" />
                <p className="text-sm font-medium text-slate-500">Загрузка данных с сервера...</p>
              </div>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              
              {/* ВКЛАДКА 1: ПАНЕЛЬ/ДАШБОРД */}
              {activeTab === "dashboard" && (
                <motion.div
                  key="dashboard-tab"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Левая колонка: Структура бота и Ссылки */}
                    <div className="lg:col-span-2 space-y-6">
                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
                        <h3 className="text-md font-bold text-slate-900 mb-4 flex items-center">
                          <CheckCircle className="h-4 w-4 text-emerald-500 mr-2" />
                          Локальные ссылки и заглушки материалов
                        </h3>
                        <p className="text-xs text-slate-500 mb-5 leading-relaxed">
                          Эти Ссылки используются ботом для выдачи чек-листов, файлов, аудио-медитаций и перехода в ваши личные сообщения в Telegram. Вы можете заменить их перед экспортом в файле <code>/src/botConfig.ts</code>.
                        </p>

                        <div className="divide-y divide-slate-100 text-sm">
                          <div className="py-3 flex justify-between items-center">
                            <span className="font-semibold text-slate-700">Личные сообщения Алёны:</span>
                            <span className="text-xs font-mono text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100 flex items-center">
                              t.me/ibanezebi64
                              <ExternalLink className="h-3 w-3 ml-1.5 cursor-pointer" onClick={() => window.open("https://t.me/ibanezebi64", "_blank")} />
                            </span>
                          </div>
                          <div className="py-3 flex justify-between items-center">
                            <span className="font-semibold text-slate-700">Гайд легализации бездействия:</span>
                            <span className="text-xs font-mono text-slate-500 truncate max-w-xs" title="Файл PDF">dummy.pdf</span>
                          </div>
                          <div className="py-3 flex justify-between items-center">
                            <span className="font-semibold text-slate-700">Аудио расслабления (библиотека):</span>
                            <span className="text-xs font-mono text-slate-500 truncate max-w-xs" title="Файл MP3">Audio-Song-1.mp3</span>
                          </div>
                          <div className="py-3 flex justify-between items-center">
                            <span className="font-semibold text-slate-700">Аудио «Квадрат Дыхания»:</span>
                            <span className="text-xs font-mono text-slate-500 truncate max-w-xs" title="Файл MP3">Audio-Song-2.mp3</span>
                          </div>
                          <div className="py-3 flex justify-between items-center">
                            <span className="font-semibold text-slate-700">Доступ на челлендж:</span>
                            <span className="text-xs font-mono text-slate-500 truncate max-w-xs">telegra.ph/CHellendzh-7-dnej...</span>
                          </div>
                        </div>

                        <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
                          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-1.5">Как Алёне сменить ссылки на настоящие?</h4>
                          <p className="text-xs text-slate-500 leading-relaxed">
                            В папке приложения откройте файл <code>/src/botConfig.ts</code> и замените ссылки в секции <code>contactLink</code> и <code>materials</code> на ваши реальные ссылки из Телеграф или файлы на Яндекс.Диске / Гугл.Диске. Бот применит их моментально при перезапуске на Ubuntu.
                          </p>
                        </div>
                      </div>

                      {/* Краткий перечень последних действий */}
                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="text-md font-bold text-slate-900 flex items-center">
                            <Terminal className="h-4 w-4 text-emerald-500 mr-2" />
                            Последние системные логи бота (живые)
                          </h3>
                          <button 
                            onClick={() => setActiveTab("logs")}
                            className="text-xs text-emerald-600 font-bold hover:underline"
                          >
                            Вся консоль
                          </button>
                        </div>
                        {logs.length === 0 ? (
                          <p className="text-xs text-slate-400 font-medium py-3 text-center">Действий робота пока не зафиксировано.</p>
                        ) : (
                          <div className="bg-slate-900 rounded-xl p-4 font-mono text-[11px] text-emerald-400 overflow-x-auto h-[180px] space-y-1.5 border border-slate-950">
                            {logs.slice(-10).map((log, idx) => (
                              <div key={idx} className="truncate select-text">{log}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Правая колонка: Ссылка на бот и Статус интеграции */}
                    <div className="space-y-6">
                      <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 p-6 rounded-2xl text-white shadow-md relative overflow-hidden">
                        <div className="absolute right-0 bottom-0 translate-y-6 translate-x-4 opacity-10">
                          <Bot className="h-48 w-48" />
                        </div>
                        <h3 className="text-lg font-bold mb-1">Протестировать бота 🤍</h3>
                        <p className="text-xs text-emerald-100 leading-relaxed mb-6">
                          Если вы уже получили токен у @BotFather и сохранили его, вы можете запустить бота в Telegram и полностью сымитировать переписку с клиентом.
                        </p>

                        <div className="space-y-3">
                          <a 
                            href="https://t.me/BotFather" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="w-full text-center block bg-emerald-500/80 hover:bg-emerald-500 text-xs font-bold py-2.5 px-4 rounded-xl border border-emerald-400 transition-colors"
                          >
                            🤖 Получить токен у @BotFather
                          </a>
                          
                          <button 
                            onClick={() => {
                              if (status?.hasToken) {
                                window.open(`https://t.me/`, "_blank");
                              } else {
                                openConfigModal();
                              }
                            }}
                            className="w-full text-center block bg-white hover:bg-slate-50 text-emerald-800 text-xs font-bold py-2.5 px-4 rounded-xl shadow-xs transition-transform transform active:scale-95"
                          >
                            🔗 Открыть бота в Телеграм
                          </button>
                        </div>
                      </div>

                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Отказоустойчивость</h4>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          По ТЗ бот подключает <b>Вебхуки</b> при деплое на хост Ubuntu с указанием домена в <code>.env</code>. 
                          Но если вебхук падает или домен временно недоступен — бот мгновенно делает бесшовный переход на <b>Long Polling (длинный опрос)</b>. 
                          Поэтому психолог не теряет ни одного входящего сообщения от клиентов! Потрясающая стабильность.
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ВКЛАДКА 2: ПОЛЬЗОВАТЕЛИ В БОТЕ */}
              {activeTab === "sessions" && (
                <motion.div
                  key="sessions-tab"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                    <div className="px-6 py-5 border-b border-slate-200/60 bg-slate-50/60 flex flex-col sm:flex-row justify-between sm:items-center">
                      <div>
                        <h3 className="text-md font-bold text-slate-900">Список активных клиентов на сервере</h3>
                        <p className="text-xs text-slate-500 mt-0.5 font-medium">Здесь отображаются реальные диалоги с пользователями Telegram и их ответы внутри бота.</p>
                      </div>
                      <div className="mt-3 sm:mt-0 text-xs bg-emerald-100 text-emerald-800 font-bold px-3 py-1.5 rounded-lg border border-emerald-100 self-start">
                        Всего: {status?.sessionCount || 0} контактов
                      </div>
                    </div>

                    {!status?.sessionsList || status.sessionsList.length === 0 ? (
                      <div className="p-16 text-center space-y-4">
                        <Users className="h-10 w-10 text-slate-300 mx-auto" />
                        <div>
                          <p className="font-semibold text-slate-800 text-sm">В базе пока нет активных сессий</p>
                          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                            Когда кто-то напишет вашему боту /start в телеграм, тут появится его карточка с выбранными психологическими ответами!
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-100">
                          <thead className="bg-slate-50/40">
                            <tr>
                              <th scope="col" className="px-6 py-3.5 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Пользователь</th>
                              <th scope="col" className="px-6 py-3.5 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Дата старта</th>
                              <th scope="col" className="px-6 py-3.5 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Шаг 1: Состояние</th>
                              <th scope="col" className="px-6 py-3.5 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Шаг 2: Убеждение</th>
                              <th scope="col" className="px-6 py-3.5 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Раздел Меню</th>
                              <th scope="col" className="px-6 py-3.5 className= text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Прохождение квеста</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-slate-100 text-xs text-slate-600">
                            {status.sessionsList.map((user, idx) => {
                              const prog = calculateProgress(user);
                              return (
                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="px-6 py-4.5 whitespace-nowrap">
                                    <div className="flex items-center space-x-2.5">
                                      <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                                        {(user.firstName || user.username || "A").substring(0,2).toUpperCase()}
                                      </div>
                                      <div>
                                        <div className="font-bold text-slate-900">{user.firstName || "Без имени"} {user.lastName || ""}</div>
                                        <div className="text-xs text-indigo-500 font-medium">@{user.username || "нет_юзернейма"}</div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4.5 whitespace-nowrap font-mono text-slate-400">
                                    {user.startedAt ? new Date(user.startedAt).toLocaleString("ru-RU") : "Неизвестно"}
                                  </td>
                                  <td className="px-6 py-4.5 whitespace-nowrap font-semibold">
                                    <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-medium">
                                      {getChoiceLabel(user.step1ChoiceId)}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4.5 whitespace-nowrap font-semibold">
                                    <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-medium">
                                      {getChoiceLabel(user.step2ChoiceId)}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4.5 whitespace-nowrap">
                                    {user.menuUnlocked ? (
                                      <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100 font-semibold text-[10px] inline-block">Вернуться в меню открыто</span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-150 text-[10px] inline-block">Начальный квест</span>
                                    )}
                                  </td>
                                  <td className="px-6 py-4.5 whitespace-nowrap">
                                    <div className="flex items-center space-x-2">
                                      <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                        <div 
                                          className={`h-full rounded-full ${prog === 100 ? "bg-emerald-500" : "bg-emerald-400"}`} 
                                          style={{ width: `${prog}%` }}
                                        ></div>
                                      </div>
                                      <span className="font-black text-slate-800">{prog}%</span>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* ВКЛАДКА 3: КОНСОЛЬ ЛОГОВ */}
              {activeTab === "logs" && (
                <motion.div
                  key="logs-tab"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  <div className="bg-slate-900 border border-slate-950 rounded-2xl shadow-md p-6 overflow-hidden">
                    <div className="flex justify-between items-center pb-4 mb-4 border-b border-slate-800">
                      <div className="flex items-center space-x-2">
                        <Terminal className="h-5 w-5 text-emerald-400" />
                        <div>
                          <h3 className="font-mono text-emerald-400 font-bold text-sm">Системные трейсы сервера бота</h3>
                          <p className="text-[11px] text-slate-500 font-mono">Вызовы Telegram API, нажатия кнопок клиентами, запуски таймаутов.</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button 
                          onClick={() => fetchData()}
                          className="px-3 py-1 bg-slate-800 hover:bg-slate-700 font-mono text-xs rounded text-slate-300 border border-slate-700 cursor-pointer"
                        >
                          Очистить экран
                        </button>
                      </div>
                    </div>

                    <div className="bg-slate-950 rounded-xl p-5 font-mono text-xs text-slate-300 h-[450px] overflow-y-auto space-y-1.5 scrollbar-thin select-text">
                      {logs.length === 0 ? (
                        <p className="text-slate-600 italic font-medium">Консоль пуста. Ждем событий...</p>
                      ) : (
                        logs.map((log, index) => {
                          const isError = log.includes("ERROR") || log.includes("failed") || log.includes("crashed");
                          const isClick = log.includes("clicked inline");
                          return (
                            <div 
                              key={index} 
                              className={`leading-relaxed border-l-2 pl-2.5 ${
                                isError ? "border-rose-500 text-rose-300 bg-rose-500/5 py-0.5" : 
                                isClick ? "border-indigo-400 text-indigo-300" : "border-slate-800 text-emerald-300/90"
                              }`}
                            >
                              {log}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ВКЛАДКА 4: ИНСТРУКЦИЯ ПО ВНЕДРЕНИЮ НА UBUNTU 24 */}
              {activeTab === "guide" && (
                <motion.div
                  key="guide-tab"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs space-y-6 max-w-4xl">
                    <div className="border-b border-slate-100 pb-4">
                      <h3 className="text-lg font-bold text-slate-900">Инструкция по развертыванию на Ubuntu 24.04 LTS</h3>
                      <p className="text-xs text-slate-500 leading-relaxed mt-1">
                        Этот гайд поможет вам быстро перенести проект на ваш сервер Ubuntu, настроить менеджер systemd для автозапуска при сбоях и привязать защищенные поддомены через Caddy Server.
                      </p>
                    </div>

                    {/* ШАГ 1 */}
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-xs">1</span>
                        <h4 className="font-bold text-slate-900 text-sm">Установка Node.js на Ubuntu 24</h4>
                      </div>
                      <p className="text-xs text-slate-600 pl-8 leading-relaxed">
                        Обновите пакеты Linux и поставьте стабильную версию Node.js LTS (например 20+ или 22+):
                      </p>
                      <div className="bg-slate-900 text-emerald-400 font-mono text-xs p-4 rounded-xl pl-8 relative">
<pre>{`sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs`}</pre>
                        <button 
                          onClick={() => copyToClipboard("sudo apt update && sudo apt upgrade -y && curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs", "cmd1")}
                          className="absolute top-2 right-2 text-slate-400 hover:text-white"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        {copiedText === "cmd1" && <span className="absolute top-2 right-8 text-[10px] text-emerald-400">Скопировано!</span>}
                      </div>
                    </div>

                    {/* ШАГ 2 */}
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-xs">2</span>
                        <h4 className="font-bold text-slate-900 text-sm">Скачивание и компиляция проекта c GitHub</h4>
                      </div>
                      <p className="text-xs text-slate-600 pl-8 leading-relaxed">
                        Склонируйте файлы вашего репозитория на сервер, перейдите в целевую директорию, скачайте npm-пакеты и скомпилируйте проект под продакшн:
                      </p>
                      <div className="bg-slate-900 text-emerald-400 font-mono text-xs p-4 rounded-xl pl-8 relative">
<pre>{`git clone ваш-репозиторий-в-github /var/www/alena-bot
cd /var/www/alena-bot
npm install
npm run build`}</pre>
                        <button 
                          onClick={() => copyToClipboard("git clone ваш-репозиторий-в-github /var/www/alena-bot && cd /var/www/alena-bot && npm install && npm run build", "cmd_build")}
                          className="absolute top-2 right-2 text-slate-400 hover:text-white"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        {copiedText === "cmd_build" && <span className="absolute top-2 right-8 text-[10px] text-emerald-400">Скопировано!</span>}
                      </div>
                    </div>

                    {/* ШАГ 3 */}
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-xs">3</span>
                        <h4 className="font-bold text-slate-900 text-sm">Создание демона автозапуска (Systemd Service)</h4>
                      </div>
                      <p className="text-xs text-slate-600 pl-8 leading-relaxed">
                        Чтобы бот оставался активным 24/7 и запускался сразу после старта ОС, создайте конфигурацию systemd службы:
                      </p>
                      <div className="bg-slate-900 text-emerald-400 font-mono text-xs p-4 rounded-xl pl-8 relative">
<pre>{`sudo nano /etc/systemd/system/alena-bot.service`}</pre>
                      </div>
                      <p className="text-xs text-slate-600 pl-8 leading-relaxed">
                        Скопируйте и вставьте туда следующее содержимое (не забудьте прописать корректные токены и ваш домен):
                      </p>
                      <div className="bg-slate-900 text-emerald-300 font-mono text-[11px] p-4 rounded-xl pl-8 relative overflow-x-auto whitespace-pre">
{`[Unit]
Description=Alena Psychological Telegram Bot Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/alena-bot
ExecStart=/usr/bin/npm run start
Restart=on-failure
Environment=NODE_ENV=production
Environment=TELEGRAM_BOT_TOKEN="ВАШ_ТОКЕН_BOT_FATHER"
Environment=APP_URL="https://bot.yourdomain.ru"
Environment=GEMINI_API_KEY="ВАШ_КЛЮЧ_GEMINI"

[Install]
WantedBy=multi-user.target`}
                      </div>
                      <p className="text-xs text-slate-600 pl-8 leading-relaxed">
                        Активируйте службу на сервере:
                      </p>
                      <div className="bg-slate-900 text-emerald-400 font-mono text-xs p-4 rounded-xl pl-8 relative">
<pre>{`sudo systemctl daemon-reload
sudo systemctl start alena-bot
sudo systemctl enable alena-bot`}</pre>
                      </div>
                    </div>

                    {/* ШАГ 4 */}
                    <div className="space-y-4">
                      <div className="flex items-center space-x-2">
                        <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-xs">4</span>
                        <h4 className="font-bold text-slate-900 text-sm">Настройка веб-сервера Caddy и авто-SSL</h4>
                      </div>
                      <div className="pl-8 space-y-4">
                        <div className="p-4 bg-emerald-50/60 border border-emerald-100 rounded-xl">
                          <p className="text-xs text-emerald-900 font-semibold mb-1">🔥 Преимущества Caddy Server перед Nginx</p>
                          <p className="text-[11px] text-emerald-800 leading-relaxed font-sans">
                            Caddy идеально подходит под ваши требования! Он занимает минимум ресурсов, автоматически выпускает и продлевает SSL/TLS сертификаты (Let's Encrypt), имеет ультра-простой синтаксис конфигурации и отлично уживается на одном сервере с Docker-контейнерами AmneziaVPN и любым числом других сайтов или ботов.
                          </p>
                        </div>

                        <div className="space-y-2">
                          <p className="text-xs text-slate-600 leading-relaxed">
                            Установите Caddy Server на вашу Ubuntu:
                          </p>
                          <div className="bg-slate-900 text-emerald-400 font-mono text-xs p-4 rounded-xl relative">
<pre>{`sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy -y`}</pre>
                          </div>
                          
                          <p className="text-xs text-slate-600 leading-relaxed">
                            Откройте конфигурационный файл <code>sudo nano /etc/caddy/Caddyfile</code> и укажите ваши доменные имена:
                          </p>
                          
                          <div className="bg-slate-900 text-emerald-300 font-mono text-[11px] p-4 rounded-xl relative overflow-x-auto whitespace-pre">
{`# Домен для этого Telegram-бота и его панели администрирования
bot.yourdomain.ru {
    reverse_proxy 127.0.0.1:3000
}

# Ваш другой сайт на этом же сервере
another-site.ru {
    reverse_proxy 127.0.0.1:8080
}

# Любой другой сервис в докере или отдельный бот
dashboard.domain.com {
    reverse_proxy 127.0.0.1:9000
}`}
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed">
                            После сохранения конфигурационного файла, перезапустите Caddy без сбоев активных подключений:
                          </p>
                          <div className="bg-slate-900 text-emerald-400 font-mono text-xs p-4 rounded-xl relative">
<pre>{`sudo systemctl reload caddy`}</pre>
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed">
                            Готово! Caddy автоматически сделает под каждый домен бесплатный HTTPS, полностью безопасно изолируя трафик между AmneziaVPN и ботами.
                          </p>
                        </div>
                      </div>
                    </div>

                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </main>

      {/* Окно/модалка для настройки API токенов и домена */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200/60 flex justify-between items-center">
              <h3 className="font-bold text-slate-900 text-sm">Панель настройки бота</h3>
              <button 
                onClick={() => setShowConfigModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="divide-y divide-slate-100 max-h-[82vh] overflow-y-auto">
              {/* Форма изменения токена и домена */}
              <form onSubmit={handleUpdateConfig} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">
                    Токен Telegram от @BotFather:
                  </label>
                  <input 
                    type="password"
                    placeholder="Вставьте токен (например: 123456:ABC-DEF...)"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-emerald-400 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-400 mt-1 font-sans">Оставьте пустым, если не хотите менять записанный токен.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">
                    Доверенный Домен (APP_URL с HTTPS):
                  </label>
                  <input 
                    type="url"
                    placeholder="https://ваш-домен.ru"
                    value={appUrlInput}
                    onChange={(e) => setAppUrlInput(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-emerald-400 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-400 mt-1 font-sans">Используется для автоподключения безопасных вебхуков.</p>
                </div>

                {configSuccessMessage && (
                  <div className={`p-3 rounded-lg text-xs font-semibold ${
                    configSuccessMessage.includes("Ошибка") ? "bg-rose-50 text-rose-800 border-rose-100" : "bg-emerald-50 text-emerald-800 border-emerald-100"
                  } border`}>
                    {configSuccessMessage}
                  </div>
                )}

                <div className="flex justify-end space-x-2 pt-2">
                  <button 
                    type="button"
                    onClick={() => setShowConfigModal(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg cursor-pointer"
                  >
                    Отмена
                  </button>
                  <button 
                    type="submit"
                    disabled={savingConfig}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center cursor-pointer"
                  >
                    {savingConfig ? (
                      <>
                        <RefreshCw className="h-3 w-3 animate-spin mr-1.5" />
                        Перезапуск...
                      </>
                    ) : "Применить и перезапустить"}
                  </button>
                </div>
              </form>

              {/* Модуль шифрования/хэширования паролей */}
              <div className="p-6 bg-slate-50/50 space-y-3">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center">
                  <Shield className="h-3.5 w-3.5 text-slate-500 mr-1.5" />
                  🔐 Инструмент безопасного шифрования (Хэш/Соль)
                </h4>
                <p className="text-[11px] text-slate-500 leading-relaxed font-sans">
                  Хотите скрыть пароль в <code>.env</code>? Введите желаемый пароль администратора, чтобы мгновенно сгенерировать крипто-хэш SHA-256 с солью, полностью исключая хранение в открытом виде:
                </p>
                
                <div className="flex space-x-2">
                  <input 
                    type="password"
                    placeholder="Ваш новый пароль"
                    value={hashPasswordInput}
                    onChange={(e) => setHashPasswordInput(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-400 focus:outline-none"
                  />
                  <button 
                    type="button"
                    onClick={handleGenerateHash}
                    disabled={generatingHash}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                  >
                    {generatingHash ? "Шифруем..." : "Получить Хэш"}
                  </button>
                </div>

                {hashResult && (
                  <div className="mt-3 p-3 bg-slate-900 text-slate-300 rounded-xl space-y-2 border border-slate-950">
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Параметры для файла .env:</p>
                        <button
                          onClick={() => copyToClipboard(`ADMIN_PASSWORD_HASH="${hashResult.hash}"\nADMIN_PASSWORD_SALT="${hashResult.salt}"`, "hash")}
                          className="text-[10px] text-slate-400 hover:text-emerald-400"
                        >
                          {copiedText === "hash" ? "Скопировано!" : "Копировать"}
                        </button>
                      </div>
                      <div className="bg-slate-950 p-2 rounded text-[10px] font-mono overflow-x-auto select-all leading-normal whitespace-pre">
{`ADMIN_PASSWORD_HASH="${hashResult.hash}"
ADMIN_PASSWORD_SALT="${hashResult.salt}"`}
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-normal font-sans">
                      Добавьте эти строки в ваш <code>.env</code> файл на сервере и удалите строчку <code>ADMIN_PASSWORD="..."</code>. При перезапуске служба будет проверять только хэш.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
