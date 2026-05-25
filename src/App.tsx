import React, { useState, useEffect, useRef } from "react";
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
  Radio,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Wrench,
  Undo2,
  Redo2,
  AlertTriangle,
  Play,
  FileCode,
  Lock,
  Link,
  Check,
  AlertCircle,
  Minus,
  Focus
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// Интерфейсы данных
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

interface ScenarioBlock {
  id: string;
  type: "text" | "button" | "link" | "back" | "menu" | "pause" | "wait_button" | "file" | "audio";
  text?: string;
  url?: string;
  seconds?: number;
  isOnce?: boolean;
  nextBlockId?: string | null;
  rightBlockId?: string | null;
  menuMessageText?: string;
  menuGateMessageText?: string;
  menuGateButtonText?: string;
  linkButtonText?: string;
  menuAttachedBlocks?: string[];
  urlType?: "url" | "upload" | "";
  linkUrl?: string;
  uploadedUrl?: string;
  uploadedName?: string;
}

interface ScenarioMenuButton {
  id: string;
  text: string;
  startBlockId?: string | null;
}

interface ScenarioConfig {
  telegramBotToken: string;
  contactLink: string;
  startBlockId?: string;
  menu: ScenarioMenuButton[];
  blocks: Record<string, ScenarioBlock>;
}

interface ScenarioError {
  blockId?: string;
  blockText?: string;
  message: string;
  recommendation: string;
}

interface TutorialStepDef {
  target: string;
  title: string;
  desc: string;
  placement?: "top" | "bottom";
}

const TUTORIAL_STEPS: TutorialStepDef[] = [
  {
    target: "tabs",
    title: "🧭 Навигация по панели управления",
    desc: "Админка разделена на 4 вкладки: «Конструктор» для настройки бота, «Клиенты» для просмотра базы и статистики, «Настройки» для паролей/токенов, и подробный учебник «Инструкция»."
  },
  {
    target: "status",
    title: "🟢 Статус изменений и черновик",
    desc: "Важнейший индикатор! Зелёный цвет («Актуален с боевым») показывает, что бот работает на текущей схеме. Оранжевый («Несохраненный черновик») означает, что есть несохранённые изменения, которые пока не видны пользователям."
  },
  {
    target: "backup",
    title: "💾 Резервные копии сценария",
    desc: "Скачивайте полную схему вашего бота в файл для резервного хранения («Скачать сценарий») или загружайте файлы сценариев («Загрузить сценарий») для быстрого копирования или восстановления."
  },
  {
    target: "palette",
    title: "➕ Кнопки добавления блоков",
    desc: "Нажмите на круглые плюсы на линиях связи в конструкторе. Это вызовет выбор из 9 типов блоков для создания новых шагов в диалоге. С помощью стрелочек слева выделенного блока, можно перемещать его в очерёдности."
  },
  {
    target: "canvas",
    title: "🧩 Схема сценария (Miro-холст)",
    desc: "Ваше рабочее интерактивное поле. Каждый блок — это шаг вашего бота, а стрелки — направление диалога. Зажмите левую кнопку мыши, для навигации по доске. Зум - колёсиком мыши.",
    placement: "top"
  },
  {
    target: "editor",
    title: "⚙️ Параметры блока",
    desc: "Эта правая панель открывается при выборе любого блока на холсте. Здесь вы настраиваете всё содержимое: пишите тексты сообщений, вводите ссылки, загружаете файлы и регулируете время пауз.",
    placement: "top"
  },
  {
    target: "validate",
    title: "🔍 Проверка на ошибки",
    desc: "Система автоматически проанализирует всю вашу логику на ошибки и пустоты. Запустите её принудительно, чтобы убедиться, что диалог составлен безупречно."
  },
  {
    target: "publish",
    title: "🚀 Опубликовать в бот",
    desc: "Итоговый шаг! При нажатии бот мгновенно принимает новые правила игры и начинает работать на живом сервере по отредактированному сценарию!"
  }
];

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

  // Режим экрана: "admin" (основная) или "developer" (патчи / логи)
  const [panelMode, setPanelMode] = useState<"admin" | "developer">("admin");
  const [adminTab, setAdminTab ] = useState<"constructor" | "settings" | "clients" | "instructions">("constructor");
  const [devTab, setDevTab] = useState<"status" | "logs" | "guide">("status");

  // Поиск и разделы внутри интерактивной справки-инструкции
  const [instructionSearch, setInstructionSearch] = useState("");
  const [instructionSubTab, setInstructionSubTab] = useState<"blocks" | "logic">("blocks");

  // Состояния интерактивного обучения (Tutorial)
  const [tutorialStep, setTutorialStep] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0, width: 0, height: 0, ready: false });

  // Состояния Конструктора Сценариев
  const [scenario, setScenario] = useState<ScenarioConfig | null>(null);
  const [selectedMenuId, setSelectedMenuId] = useState<string>("");
  const [addingMenuBtn, setAddingMenuBtn] = useState(false);
  const [newMenuBtnText, setNewMenuBtnText] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [errorsList, setErrorsList] = useState<any[]>([]);

  // Состояние Истории редактирования (Undo / Redo)
  const [history, setHistory] = useState<ScenarioConfig[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Состояние модалок валидации и деплоя
  const [validationModal, setValidationModal] = useState<{
    show: boolean;
    success: boolean;
    errors: ScenarioError[];
  } | null>(null);
  
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Системные настройки
  const [botTokenInput, setBotTokenInput] = useState("");
  const [contactLinkInput, setContactLinkInput] = useState("");
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState(false);

  // Поля для генерации крипто-хэша SHA-256 (в панели разработчика)
  const [hashPasswordInput, setHashPasswordInput] = useState("");
  const [hashResult, setHashResult] = useState<{ salt: string; hash: string; instructions: string } | null>(null);
  const [generatingHash, setGeneratingHash] = useState(false);

  // Контроль открытия панели добавления блока ниже/правее
  const [activeAddPopover, setActiveAddPopover] = useState<{
    blockId: string;
    relation: "next" | "right";
  } | null>(null);

  // Состояния интерактивной Miro-доски
  const [zoom, setZoom] = useState<number>(0.9);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 40, y: 100 });
  const [isDraggingCanvas, setIsDraggingCanvas] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<Record<string, { fileName: string; progress: number; success: boolean; error?: string }>>({});
  const canvasRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);

  // Синхронизируем рефы с состоянием для использования в обработчиках событий
  useEffect(() => {
    zoomRef.current = zoom;
    panRef.current = pan;
  }, [zoom, pan]);

  useEffect(() => {
    if (tutorialStep !== null) {
      const step = TUTORIAL_STEPS[tutorialStep];
      const target = step.target;

      // Если мы на шаге редактирования параметров блока или добавления/перемещения блоков, выделим первый попавшийся фрагмент
      if ((target === "editor" || target === "palette") && !selectedBlockId && scenario) {
        const blockIds = Object.keys(scenario.blocks);
        if (blockIds.length > 0) {
          setSelectedBlockId(blockIds[0]);
        }
      }

      const updatePos = () => {
        const el = document.getElementById("tutorial-" + target);
        if (el) {
          const rect = el.getBoundingClientRect();
          setTooltipPos({
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            ready: true
          });
        } else {
          setTooltipPos({
            top: window.innerHeight / 2 - 100,
            left: window.innerWidth / 2 - 200,
            width: 0,
            height: 0,
            ready: false
          });
        }
      };

      const timer = setTimeout(updatePos, 150);
      window.addEventListener("resize", updatePos);
      window.addEventListener("scroll", updatePos);

      return () => {
        clearTimeout(timer);
        window.removeEventListener("resize", updatePos);
        window.removeEventListener("scroll", updatePos);
      };
    }
  }, [tutorialStep, selectedBlockId, adminTab, scenario]);

  // Обработка Zoom через колесико (с привязкой к центру окна конструктора по просьбе пользователя)
  useEffect(() => {
    // ВАЖНО: Следим за появлением элемента в DOM, так как конструктор рендерится условно
    const el = canvasRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      // Предотвращаем стандартный скролл страницы
      e.preventDefault();

      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      // Пользователь просил: "Должно чётко в центр окошка конструктора приближать"
      const pivotX = rect.width / 2;
      const pivotY = rect.height / 2;

      const currentZoom = zoomRef.current;
      const currentPan = panRef.current;

      // Рассчитываем коэффициент масштабирования
      const delta = -e.deltaY;
      const factor = Math.pow(1.1, delta / 120);
      let newZoom = currentZoom * factor;
      
      // Ограничения для зума
      newZoom = Math.min(Math.max(0.1, newZoom), 5);

      if (newZoom !== currentZoom) {
        // Вычисляем мировые координаты точки, которая сейчас в центре вьюпорта
        const worldX = (pivotX - currentPan.x) / currentZoom;
        const worldY = (pivotY - currentPan.y) / currentZoom;

        // Новое смещение, чтобы эта же мировая точка осталась в центре вьюпорта при новом зуме
        const newPan = {
          x: pivotX - worldX * newZoom,
          y: pivotY - worldY * newZoom
        };

        // Сначала обновляем рефы, чтобы следующие быстрые события колесика не использовали старые данные
        zoomRef.current = newZoom;
        panRef.current = newPan;

        setZoom(newZoom);
        setPan(newPan);
      }
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
    // Добавляем зависимости, которые влияют на рендеринг канваса
  }, [adminTab, panelMode, !!scenario]);

  // Копирование в буфер
  const [copiedText, setCopiedText] = useState("");

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(""), 2200);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Метод центрирования вида на Miro-доске
  const handleCenterView = () => {
    setPan({ x: 40, y: 100 });
    setZoom(0.85);
    showToast("Вид доски отцентрирован 🎯");
  };

  // Расчет плавной кривой Безье для связей
  const getBezierPath = (x1: number, y1: number, x2: number, y2: number, isRight: boolean) => {
    if (isRight) {
      const controlX = x1 + Math.max(80, (x2 - x1) * 0.45);
      return `M ${x1} ${y1} C ${controlX} ${y1}, ${x2 - Math.max(80, (x2 - x1) * 0.45)} ${y2}, ${x2} ${y2}`;
    } else {
      const controlY = y1 + Math.max(60, (y2 - y1) * 0.45);
      return `M ${x1} ${y1} C ${x1} ${controlY}, ${x2} ${y2 - Math.max(60, (y2 - y1) * 0.45)}, ${x2} ${y2}`;
    }
  };

  // Обработчики мыши для перемещения по холсту
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (
      (e.target as HTMLElement).closest('.board-card') || 
      (e.target as HTMLElement).closest('button') || 
      (e.target as HTMLElement).closest('input') || 
      (e.target as HTMLElement).closest('select') || 
      (e.target as HTMLElement).closest('textarea')
    ) {
      return;
    }
    setIsDraggingCanvas(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingCanvas) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleCanvasMouseUp = () => {
    setIsDraggingCanvas(false);
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

  // Метод для криптошифрования на дев панели
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
      
      // Чтение статуса бота
      const statusRes = await fetch("/api/bot-status", { headers });
      if (statusRes.status === 401) {
        handleLogout();
        return;
      }
      const statusData = await statusRes.json();
      setStatus(statusData);

      // Чтение логов ошибок
      const errorsRes = await fetch("/api/error-logs", { headers });
      if (errorsRes.ok) {
        const errorsData = await errorsRes.json();
        setErrorsList(errorsData.errors || []);
      }

      // Системные логи консоли
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

  // Чтение черновика или боевой копии сценария
  const fetchScenario = async () => {
    if (!authToken) return;
    try {
      const headers = { "Authorization": `Bearer ${authToken}` };
      const res = await fetch("/api/scenario/draft", { headers });
      if (res.ok) {
        const data = await res.json();
        const conf = data.draft as ScenarioConfig;
        
        // Базовые фоллбеки для защиты от старых или пустых конфигов
        if (!conf.blocks) conf.blocks = {};
        if (!conf.menu) conf.menu = [];
        if (!conf.startBlockId) conf.startBlockId = "start_node";

        setScenario(conf);
        
        // Установка токена и ссылки для формы настроек
        setBotTokenInput(conf.telegramBotToken || "");
        setContactLinkInput(conf.contactLink || "");
        
        // Инициализируем историю
        setHistory([conf]);
        setHistoryIndex(0);
        setHasUnsavedChanges(data.hasDraft);

        // НЕ ограничиваем выбранный пункт меню первым, так как вся логика на одной доске
        // Если меню есть, пусть выделен первый, чисто чтобы подсветка была
        if (conf.menu && conf.menu.length > 0 && !selectedMenuId) {
          setSelectedMenuId(conf.menu[0].id);
        }
      }
    } catch (e) {
      console.error("Failed to load constructor scenario:", e);
    }
  };

  useEffect(() => {
    if (authToken) {
      fetchData();
      fetchScenario();
      const interval = setInterval(() => {
        fetchData(true);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [authToken]);

  // Запись изменений в React-state, историю и автосохранение черновика
  const updateScenarioState = (newConfig: ScenarioConfig) => {
    // Отрезаем всё что шло после текущего индекса в истории (для хопа по Undo/Redo)
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newConfig);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setScenario(newConfig);
    setHasUnsavedChanges(true);

    autoSaveDraft(newConfig);
  };

  // Фоновое автосохранение на сервер
  const autoSaveDraft = async (conf: ScenarioConfig) => {
    setIsSavingDraft(true);
    try {
      await fetch("/api/scenario/draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`
        },
        body: JSON.stringify(conf)
      });
    } catch (err) {
      console.error("Failed to autosave draft:", err);
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Undo (Ctrl + Z)
  const handleUndo = () => {
    if (historyIndex > 0) {
      const idx = historyIndex - 1;
      const prev = history[idx];
      setHistoryIndex(idx);
      setScenario(prev);
      setHasUnsavedChanges(true);
      autoSaveDraft(prev);
      showToast("Изменение отменено ↩️");
    }
  };

  // Redo (Ctrl + Y)
  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const idx = historyIndex + 1;
      const next = history[idx];
      setHistoryIndex(idx);
      setScenario(next);
      setHasUnsavedChanges(true);
      autoSaveDraft(next);
      showToast("Изменение повторено ↪️");
    }
  };

  // Сбросить черновик (удаление scenario-draft)
  const handleDiscardChanges = async () => {
    if (!window.confirm("Вы уверены, что хотите сбросить все несохраненные изменения черновика? Это восстановит сценарии к текущей боевой версии бота.")) {
      return;
    }
    try {
      const res = await fetch("/api/scenario/draft", {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${authToken}` }
      });
      if (res.ok) {
        setHasUnsavedChanges(false);
        showToast("Черновик успешно сброшен к оригиналу 🗑️");
        await fetchScenario();
      }
    } catch (e) {
      alert("Не удалось сбросить черновик");
    }
  };

  // Проверить черновик на лимиты и петли
  const handleValidateDraft = async () => {
    if (!scenario) return;
    try {
      const res = await fetch("/api/scenario/validate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`
        },
        body: JSON.stringify(scenario)
      });
      if (res.ok) {
        const data = await res.json();
        setValidationModal({
          show: true,
          success: data.isValid,
          errors: data.errors || []
        });
      }
    } catch (e) {
      alert("Сбой верификации сценария");
    }
  };

  // Публикация в реальный цикл (Deploy)
  const handleDeployDraft = async () => {
    if (!scenario) return;
    try {
      const res = await fetch("/api/scenario/deploy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setHasUnsavedChanges(false);
        setValidationModal(null);
        showToast("🎉 Сценарий успешно опубликован в живой цикл! Бот перезапущен.");
        fetchData();
        fetchScenario();
      } else {
        alert(data.error || "Не удалось опубликовать настройки");
      }
    } catch (e) {
      alert("Сбой операции публикации настроек");
    }
  };

  // Скачивание боевой конфигурации в JSON
  const handleExportScenario = async () => {
    if (!authToken) return;
    try {
      const res = await fetch("/api/scenario", {
        headers: { "Authorization": `Bearer ${authToken}` }
      });
      if (res.ok) {
        const config = await res.json();
        const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const dateStr = new Date().toISOString().slice(0, 10);
        a.href = url;
        a.download = `alena_bot_scenario_${dateStr}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast("Боевая конфигурация скачана 📥");
      }
    } catch (e) {
      alert("Ошибка при скачивании конфигурации");
    }
  };

  // Импорт конфигурации из JSON файла
  const handleImportScenario = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !authToken) return;

    if (!window.confirm("⚠️ ВНИМАНИЕ: Это действие ПОЛНОСТЬЮ ЗАМЕНИТ текущий боевой сценарий данными из файла и ПЕРЕЗАПУСТИТ бота. Продолжить?")) {
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const config = JSON.parse(content);
        
        const res = await fetch("/api/scenario/import", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${authToken}`
          },
          body: JSON.stringify(config)
        });
        
        const data = await res.json();
        if (res.ok && data.success) {
          showToast("Конфигурация успешно импортирована и применена! 🚀");
          fetchScenario();
          fetchData();
        } else {
          alert(data.error || "Ошибка при импорте конфигурации");
        }
      } catch (err) {
        alert("Ошибка при чтении файла: неверный формат JSON или файл поврежден.");
      } finally {
        e.target.value = "";
      }
    };
    reader.readAsText(file);
  };

  // Смена глобальных настроек (токен, пароли, ссылки)
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    setSettingsSuccess(false);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`
        },
        body: JSON.stringify({
          contactLink: contactLinkInput,
          telegramBotToken: botTokenInput,
          newPassword: newPasswordInput || undefined
        })
      });
      if (res.ok) {
        setSettingsSuccess(true);
        setNewPasswordInput("");
        showToast("Настройки успешно сохранены 🕊️");
        fetchData();
        fetchScenario();
      } else {
        const d = await res.json();
        alert(d.error || "Ошибка сохранения настроек");
      }
    } catch (err: any) {
      alert(`Сбой: ${err.message}`);
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Вспомогательный поиск цепочки ИД блоков по нисходящей (nextBlockId)
  const getOrderedWaterfall = (startId: string | null | undefined): string[] => {
    if (!startId || !scenario) return [];
    const ids: string[] = [];
    const visited = new Set<string>();
    let curr: string | null | undefined = startId;
    while (curr && !visited.has(curr)) {
      visited.add(curr);
      ids.push(curr);
      curr = scenario.blocks[curr]?.nextBlockId;
    }
    return ids;
  };

  // Генерация UUID для блоков
  const generateUUID = () => {
    return "blk_" + Math.random().toString(36).substring(2, 10);
  };

  // ДОБАВЛЕНИЕ ЭЛЕМЕНТА
  const handleAddBlock = (targetId: string, relation: "next" | "right", type: ScenarioBlock["type"]) => {
    if (!scenario) return;

    const newId = generateUUID();
    
    // Поиск эталонных настроек для кнопки "В меню"
    const globalMenu = (Object.values(scenario.blocks) as ScenarioBlock[]).find(b => b.type === 'menu');

    const newBlock: ScenarioBlock = {
      id: newId,
      type: type,
      text: type === "pause" || type === "link" ? "" : (type === "file" ? "Прикрепленный файл" : type === "audio" ? "Аудиозапись" : (type === "menu" ? (globalMenu?.text || "Вернуться в меню") : "Новая карточка. Отредактируйте текст...")),
      seconds: type === "pause" ? 5 : undefined,
      url: type === "link" ? "https://" : (type === "file" || type === "audio") ? "" : undefined,
      linkButtonText: type === "link" ? "Открыть ссылку" : undefined,
      menuGateMessageText: type === "menu" ? (globalMenu?.menuGateMessageText || "Для перехода к выбору разделов нажмите на кнопку ниже ⬇️") : undefined,
      menuGateButtonText: type === "menu" ? (globalMenu?.menuGateButtonText || "Вернуться в меню") : undefined,
      menuMessageText: type === "menu" ? (globalMenu?.menuMessageText || "Сделай свой выбор ⬇️") : undefined,
      menuAttachedBlocks: type === "menu" ? (globalMenu?.menuAttachedBlocks ? [...globalMenu.menuAttachedBlocks] : []) : undefined
    };

    const updatedBlocks = { ...scenario.blocks };
    updatedBlocks[newId] = newBlock;

    // Сшиваем по связям pointer-ов
    const targetBlock = updatedBlocks[targetId];
    if (relation === "next") {
      newBlock.nextBlockId = targetBlock.nextBlockId;
      targetBlock.nextBlockId = newId;
    } else {
      newBlock.rightBlockId = targetBlock.rightBlockId;
      targetBlock.rightBlockId = newId;
    }

    updateScenarioState({
      ...scenario,
      blocks: updatedBlocks
    });

    setActiveAddPopover(null);
    showToast(`Добавлен блок: ${type.toUpperCase()} 🌟`);
  };

  // УДАЛЕНИЕ ЭЛЕМЕНТА С АВТОМАТИЧЕСКИМ СВЯЗЫВАНИЕМ POINTER-ОВ РОДИТЕЛЯ К ПОТОМКУ
  const handleDeleteBlock = (blockId: string) => {
    if (!scenario) return;

    const config = { ...scenario };
    const blocksCopy = { ...config.blocks };
    const target = blocksCopy[blockId];
    if (!target) return;

    // Удаляем файл с сервера, если у блока была прикреплена ссылка на uploads/
    if (target.url && target.url.startsWith("/uploads/")) {
      fetch("/api/delete-file", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`
        },
        body: JSON.stringify({ url: target.url })
      }).catch(err => console.error("Error deleting file on block removal:", err));
    }

    const nextId = target.nextBlockId;

    // Находим родителя, который указывал на удаляемый блок (nextBlockId или rightBlockId или startBlockId кнопки меню)
    let parentFound = false;

    // Ищем в главных кнопках меню
    config.menu.forEach((btn) => {
      if (btn.startBlockId === blockId) {
        btn.startBlockId = nextId;
        parentFound = true;
      }
    });

    // Ищем в блоках
    Object.values(blocksCopy).forEach((b: any) => {
      if (b.nextBlockId === blockId) {
        b.nextBlockId = nextId;
        parentFound = true;
      }
      if (b.rightBlockId === blockId) {
        b.rightBlockId = nextId;
        parentFound = true;
      }
    });

    delete blocksCopy[blockId];

    updateScenarioState({
      ...config,
      blocks: blocksCopy
    });

    showToast("Блок успешно удален 🗑️");
  };

  // СДВИГ БЛОКА ВВЕРХ ИЛИ ВНИЗ (ArrowUp / ArrowDown)
  const handleMoveBlock = (blockId: string, direction: "up" | "down") => {
    if (!scenario) return;

    const config = { ...scenario };
    const blocks = { ...config.blocks };
    const target = blocks[blockId];
    if (!target) return;

    // Для сдвига нам нужна цепочка в которой сидит блок
    // Найдем начало цепочки (старт меню кнопки, либо из rightBlockId какой-то кнопки)
    let startBlockId: string | null = null;
    let parentId: string | null = null;
    let parentRel: string = "menu";

    // Пытаемся найти родительский блок
    Object.values(scenario.blocks).forEach((b: any) => {
      if (b.nextBlockId === blockId) {
        parentId = b.id;
        parentRel = "next";
      }
      if (b.rightBlockId === blockId) {
        parentId = b.id;
        parentRel = "right";
      }
    });

    if (!parentId) {
      // Ищем в кнопках меню
      config.menu.forEach((btn) => {
        if (btn.startBlockId === blockId) {
          parentId = btn.id;
          parentRel = "menu";
        }
      });
    }

    if (direction === "down") {
      const nextId = target.nextBlockId;
      if (!nextId) return; // Некуда сдвигать вниз

      const nextBlock = blocks[nextId];
      const afterNextId = nextBlock.nextBlockId;

      // Перестраиваем: parent -> nextBlock -> target -> afterNextId
      if (parentRel === "next" && parentId) {
        blocks[parentId].nextBlockId = nextId;
      } else if (parentRel === "right" && parentId) {
        blocks[parentId].rightBlockId = nextId;
      } else if (parentRel === "menu" && parentId) {
        const btn = config.menu.find((m) => m.id === parentId);
        if (btn) btn.startBlockId = nextId;
      }

      target.nextBlockId = afterNextId;
      nextBlock.nextBlockId = blockId;
    } else {
      // Сдвиг вверх: это значит поменяться местами с родителем, если родитель — тоже блок в цепочке типа next
      if (!parentId || parentRel !== "next") return; // Нельзя сдвинуть вверх если мы начало ветки

      const parentBlock = blocks[parentId];

      // Найдем прадедушку
      let grandId: string | null = null;
      let grandRel: string = "menu";

      Object.values(scenario.blocks).forEach((b: any) => {
        if (b.nextBlockId === parentId) {
          grandId = b.id;
          grandRel = "next";
        }
        if (b.rightBlockId === parentId) {
          grandId = b.id;
          grandRel = "right";
        }
      });

      if (!grandId) {
        config.menu.forEach((btn) => {
          if (btn.startBlockId === parentId) {
            grandId = btn.id;
            grandRel = "menu";
          }
        });
      }

      // Перестраиваем: grandparent -> target -> parent -> target.nextBlockId
      if (grandRel === "next" && grandId) {
        blocks[grandId].nextBlockId = blockId;
      } else if (grandRel === "right" && grandId) {
        blocks[grandId].rightBlockId = blockId;
      } else if (grandRel === "menu" && grandId) {
        const btn = config.menu.find((m) => m.id === grandId);
        if (btn) btn.startBlockId = blockId;
      }

      const tempNext = target.nextBlockId;
      target.nextBlockId = parentId;
      parentBlock.nextBlockId = tempNext;
    }

    updateScenarioState({
      ...config,
      blocks
    });

    showToast("Позиция блока изменена 🔼");
  };

  // ОБНОВЛЕНИЕ ЗНАЧЕНИЙ В ПОЛЯХ КАРТОЧКИ
  const handleUpdateBlockField = (blockId: string, fields: Partial<ScenarioBlock>) => {
    if (!scenario) return;

    const updatedBlocks = { ...scenario.blocks };
    const currentBlock = updatedBlocks[blockId];
    if (!currentBlock) return;

    // СИНХРОНИЗАЦИЯ/ВЫЧИСЛЕНИЯ ДЛЯ БЛОКОВ МЕДИА И ФАЙЛОВ
    const blockType = fields.type || currentBlock.type;
    if (blockType === "file" || blockType === "audio") {
      const urlType = fields.urlType !== undefined ? fields.urlType : (currentBlock.urlType || (currentBlock.url && currentBlock.url.startsWith("/uploads/") ? "upload" : "url"));
      const linkUrl = fields.linkUrl !== undefined ? fields.linkUrl : (currentBlock.linkUrl !== undefined ? currentBlock.linkUrl : (urlType === "url" ? (currentBlock.url || "") : ""));
      const uploadedUrl = fields.uploadedUrl !== undefined ? fields.uploadedUrl : (currentBlock.uploadedUrl !== undefined ? currentBlock.uploadedUrl : (urlType === "upload" ? (currentBlock.url || "") : ""));
      const uploadedName = fields.uploadedName !== undefined ? fields.uploadedName : (currentBlock.uploadedName !== undefined ? currentBlock.uploadedName : (urlType === "upload" ? (currentBlock.text || "") : ""));

      fields.urlType = urlType;
      fields.linkUrl = linkUrl;
      fields.uploadedUrl = uploadedUrl;
      fields.uploadedName = uploadedName;

      if (urlType === "url") {
        fields.url = linkUrl;
      } else {
        fields.url = uploadedUrl;
        fields.text = uploadedName;
      }
    }

    // СИНХРОНИЗАЦИЯ: Если это блок типа "menu", либо меняется тип на "menu"
    const isMenuTarget = fields.type === 'menu' || (currentBlock.type === 'menu' && !fields.type);

    if (isMenuTarget) {
      const globalMenu = (Object.values(updatedBlocks) as ScenarioBlock[]).find(b => b.type === 'menu' && b.id !== blockId);
      
      // Если меняем тип на MENU — подтягиваем глобальные настройки (если есть)
      if (fields.type === 'menu' && currentBlock.type !== 'menu') {
        const globalMenu = (Object.values(updatedBlocks) as ScenarioBlock[]).find(b => b.type === 'menu' && b.id !== blockId);
        if (globalMenu) {
          fields.text = globalMenu.text;
          fields.menuGateMessageText = globalMenu.menuGateMessageText;
          fields.menuGateButtonText = globalMenu.menuGateButtonText;
          fields.menuMessageText = globalMenu.menuMessageText;
          fields.menuAttachedBlocks = globalMenu.menuAttachedBlocks ? [...globalMenu.menuAttachedBlocks] : [];
        } else {
          // Дефолтные если это первый такой блок
          if (!fields.text) fields.text = "Вернуться в меню";
          if (!fields.menuGateMessageText) fields.menuGateMessageText = "Для перехода к выбору разделов нажмите на кнопку ниже ⬇️";
          if (!fields.menuGateButtonText) fields.menuGateButtonText = "Вернуться в меню";
          if (!fields.menuMessageText) fields.menuMessageText = "Сделай свой выбор ⬇️";
          if (!fields.menuAttachedBlocks) fields.menuAttachedBlocks = [];
        }
      }

      const newBlock = { ...currentBlock, ...fields };
      updatedBlocks[blockId] = newBlock;

      // Рассылаем настройки по всем остальным блокам типа "menu"
      const syncFields = {
        text: newBlock.text,
        menuGateMessageText: newBlock.menuGateMessageText,
        menuGateButtonText: newBlock.menuGateButtonText,
        menuMessageText: newBlock.menuMessageText,
        menuAttachedBlocks: newBlock.menuAttachedBlocks ? [...newBlock.menuAttachedBlocks] : []
      };

      Object.keys(updatedBlocks).forEach(id => {
        if (updatedBlocks[id].type === 'menu') {
          updatedBlocks[id] = { ...updatedBlocks[id], ...syncFields };
        }
      });
    } else {
      updatedBlocks[blockId] = { ...currentBlock, ...fields };
    }

    updateScenarioState({
      ...scenario,
      blocks: updatedBlocks
    });
  };

  // ЗАГРУЗКА МЕДИАФАЙЛОВ И ДОКУМЕНТОВ НА СЕРВЕР И ПРИВЯЗКА К КАРТОЧКЕ
  const handleFileUploadAsync = async (file: File, blockId: string) => {
    try {
      const activeBlock = scenario?.blocks?.[blockId];
      if (!activeBlock) return;

      // Валидация для аудиофайлов: только форматы, поддерживаемые Telegram
      if (activeBlock.type === "audio") {
        const allowedExtensions = [".mp3", ".ogg", ".m4a", ".wav", ".flac"];
        const extension = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
        if (!allowedExtensions.includes(extension) && !file.type.startsWith("audio/")) {
          alert("Пожалуйста, загрузите поддерживаемый Telegram аудиофайл (.mp3, .ogg, .m4a, .wav или .flac) для корректного воспроизведения встроенным плеером.");
          return;
        }
      }

      // Если в блоке уже есть локальный загруженный файл — сначала удаляем его с сервера
      const fileUrl = activeBlock.uploadedUrl || (activeBlock.url && activeBlock.url.startsWith("/uploads/") ? activeBlock.url : "");
      if (fileUrl) {
        try {
          await fetch("/api/delete-file", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${authToken}`
            },
            body: JSON.stringify({ url: fileUrl })
          });
        } catch (delErr) {
          console.error("Failed to delete older file:", delErr);
        }
      }

      // Инициализируем статус загрузки в стейте
      setUploadProgress(prev => ({
        ...prev,
        [blockId]: { fileName: file.name, progress: 0, success: false }
      }));

      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/upload");
      xhr.setRequestHeader("Authorization", `Bearer ${authToken}`);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const pct = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(prev => {
            const current = prev[blockId];
            if (!current) return prev;
            return {
              ...prev,
              [blockId]: { ...current, progress: pct }
            };
          });
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const result = JSON.parse(xhr.responseText);
            if (result.success && result.url) {
              setUploadProgress(prev => {
                const current = prev[blockId];
                if (!current) return prev;
                return {
                  ...prev,
                  [blockId]: { ...current, progress: 100, success: true }
                };
              });
              handleUpdateBlockField(blockId, { uploadedUrl: result.url, uploadedName: result.name });
              showToast("Файл успешно загружен!");
            } else {
              const errMsg = result.error || "Неизвестная ошибка загрузки";
              showToast(`Ошибка загрузки: ${errMsg}`);
              setUploadProgress(prev => ({
                ...prev,
                [blockId]: { ...prev[blockId], error: errMsg }
              }));
            }
          } catch (pe: any) {
            showToast("Не удалось разобрать ответ сервера.");
            setUploadProgress(prev => ({
              ...prev,
              [blockId]: { ...prev[blockId], error: "Ошибка парсинга ответа" }
            }));
          }
        } else {
          const statusErr = `Ошибка сервера: ${xhr.status}`;
          showToast(statusErr);
          setUploadProgress(prev => ({
            ...prev,
            [blockId]: { ...prev[blockId], error: statusErr }
          }));
        }
      };

      xhr.onerror = () => {
        showToast("Сетевая ошибка при загрузке файла.");
        setUploadProgress(prev => ({
          ...prev,
          [blockId]: { ...prev[blockId], error: "Сетевая ошибка" }
        }));
      };

      const formData = new FormData();
      formData.append("file", file);
      xhr.send(formData);

    } catch (e: any) {
      showToast(`Не удалось запустить загрузку: ${e.message || e}`);
    }
  };

  // Удаление файла через настройки блока
  const handleRemoveUploadedFile = async (blockId: string) => {
    const b = scenario?.blocks?.[blockId];
    if (!b) return;

    const fileUrl = b.uploadedUrl || (b.url && b.url.startsWith("/uploads/") ? b.url : "");

    if (fileUrl && fileUrl.startsWith("/uploads/")) {
      try {
        await fetch("/api/delete-file", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${authToken}`
          },
          body: JSON.stringify({ url: fileUrl })
        });
        showToast("Файл удален с сервера.");
      } catch (e) {
        console.error("Error deleting file:", e);
      }
    }

    handleUpdateBlockField(blockId, { uploadedUrl: "", uploadedName: "" });

    // Сбрасываем стейт прогресса загрузки
    setUploadProgress(prev => {
      const copy = { ...prev };
      delete copy[blockId];
      return copy;
    });
  };

  // Переключение источника файлов (ссылка или uploaded)
  const handleSwitchFileSource = (blockId: string, newType: "url" | "upload") => {
    handleUpdateBlockField(blockId, { urlType: newType });
  };

  // ДОБАВЛЕНИЕ НОВОЙ КНОПКИ В ГЛАВНОЕ МЕНЮ
  const handleAddMenuButton = () => {
    if (!scenario || !newMenuBtnText.trim()) return;

    const newBtnId = "menu_" + Math.random().toString(36).substring(2, 8);
    const startBlkId = generateUUID();
    const initBlock: ScenarioBlock = {
      id: startBlkId,
      type: "text",
      text: `Приветственный блок для раздела "${newMenuBtnText}"...`
    };

    const updatedMenu = [...scenario.menu, {
      id: newBtnId,
      text: newMenuBtnText,
      startBlockId: startBlkId
    }];

    const updatedBlocks = { ...scenario.blocks };
    updatedBlocks[startBlkId] = initBlock;

    updateScenarioState({
      ...scenario,
      menu: updatedMenu,
      blocks: updatedBlocks
    });

    setNewMenuBtnText("");
    setAddingMenuBtn(false);
    setSelectedMenuId(newBtnId);
    showToast("Создан новый раздел в главном меню! 📂");
  };

  // УДАЛЕНИЕ КНОПКИ ИЗ ГЛАВНОГО МЕНЮ
  const handleDeleteMenuButton = (btnId: string) => {
    if (!scenario) return;
    if (scenario.menu.length <= 1) {
      alert("Нельзя удалить последнюю кнопку главного меню! Должен оставаться хотя бы один сценарий.");
      return;
    }
    if (!window.confirm("Вы уверены, что хотите удалить эту кнопку меню со ВСЕМИ привязанными к ней блоками сценария?")) {
      return;
    }

    const config = { ...scenario };
    const btn = config.menu.find((b) => b.id === btnId);
    if (!btn) return;

    // Сначала рекурсивно соберем все блоки этой ветки, чтобы стереть их из БД и не захламлять файл
    const deleteBlockAndDescendants = (id: string | null | undefined, blocksMap: Record<string, ScenarioBlock>) => {
      if (!id) return;
      const b = blocksMap[id];
      if (b) {
        if (b.url && b.url.startsWith("/uploads/")) {
          fetch("/api/delete-file", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${authToken}`
            },
            body: JSON.stringify({ url: b.url })
          }).catch(err => console.error("Error deleting file during descendants delete:", err));
        }
        if (b.nextBlockId) deleteBlockAndDescendants(b.nextBlockId, blocksMap);
        if (b.rightBlockId) deleteBlockAndDescendants(b.rightBlockId, blocksMap);
        delete blocksMap[id];
      }
    };

    const blocksCopy = { ...config.blocks };
    deleteBlockAndDescendants(btn.startBlockId, blocksCopy);

    const updatedMenu = config.menu.filter((b) => b.id !== btnId);

    updateScenarioState({
      ...config,
      menu: updatedMenu,
      blocks: blocksCopy
    });

    setSelectedMenuId(updatedMenu[0].id);
    showToast("Вкладка меню и привязанный сценарий успешно удалены.");
  };

  const selectedMenuBtn = scenario?.menu.find((m) => m.id === selectedMenuId);

  // Перевод идентификаторов выбора на русский язык (для вывода сессий клиентов)
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

  const calculateProgress = (session: UserSessionInfo) => {
    let score = 0;
    if (session.step1ChoiceId) score += 33;
    if (session.step2ChoiceId) score += 33;
    if (session.menuUnlocked) score += 34;
    return score;
  };

  // ВКЛАДКА LOGIN (Вход)
  if (!authToken) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans antialiased selection:bg-emerald-500 selection:text-white">
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
          <div className="inline-flex p-3 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 mb-4 shadow-xs">
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
                  placeholder=""
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
                  placeholder=""
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
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased selection:bg-emerald-600 selection:text-white">
      
      {/* Шапка портала */}
      <header className="sticky top-0 z-10 bg-white border-b border-slate-200/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row lg:h-16 py-3 lg:py-0 justify-between items-center gap-4">
            
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
                <Bot className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-sm font-black text-slate-900 tracking-tight">Алёна СоПутница - админ панель</h1>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Управление сценарием и клиентами бота</p>
              </div>
            </div>

            {/* Вкладки Режима Администратора */}
            {panelMode === "admin" && (
              <div className="flex flex-wrap gap-1.5 items-center">
                <div id="tutorial-tabs" className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button
                    onClick={() => setAdminTab("constructor")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      adminTab === "constructor" ? "bg-white text-emerald-600 shadow-xs border border-slate-200" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    🧩 Конструктор
                  </button>
                  <button
                    onClick={() => setAdminTab("clients")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      adminTab === "clients" ? "bg-white text-emerald-600 shadow-xs border border-slate-200" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    👥 Клиенты ({status?.sessionCount || 0})
                  </button>
                  <button
                    onClick={() => setAdminTab("settings")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      adminTab === "settings" ? "bg-white text-emerald-600 shadow-xs border border-slate-200" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    ⚙️ Настройки
                  </button>
                  <button
                    onClick={() => setAdminTab("instructions")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      adminTab === "instructions" ? "bg-white text-emerald-600 shadow-xs border border-slate-200" : "text-slate-650 hover:text-slate-900"
                    }`}
                  >
                    📖 Инструкция
                  </button>
                </div>

                <button
                  onClick={() => {
                    setAdminTab("constructor");
                    setTimeout(() => setTutorialStep(0), 100);
                  }}
                  className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-lg text-xs font-extrabold shadow-sm active:scale-95 hover:shadow-md transition-all flex items-center space-x-1 cursor-pointer shrink-0"
                >
                  <span>🎓 Обучение</span>
                </button>
              </div>
            )}

            {/* Вкладки Режима Разработчика */}
            {panelMode === "developer" && (
              <div className="hidden md:flex space-x-1 bg-slate-900 p-1 rounded-xl border border-slate-950">
                <button
                  onClick={() => setDevTab("status")}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    devTab === "status" ? "bg-slate-800 text-emerald-400 shadow-xs border border-slate-700" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  📟 Статус севера
                </button>
                <button
                  onClick={() => setDevTab("logs")}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    devTab === "logs" ? "bg-slate-800 text-emerald-400 shadow-xs border border-slate-700" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  🪵 Логи контейнера
                </button>
                <button
                  onClick={() => setDevTab("guide")}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    devTab === "guide" ? "bg-slate-800 text-emerald-400 shadow-xs border border-slate-700" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  📝 Справка
                </button>
              </div>
            )}

          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ------------------------------------------- */}
        {/* РЕЖИМ 1: ОСНОВНАЯ АДМИНКА (АДМИНИСТРАТОР) */}
        {/* ------------------------------------------- */}
        {panelMode === "admin" && (
          <div>
            
            {/* ВКЛАДКА: КОНСТРУКТОР СЦЕНАРИЕВ */}
            {adminTab === "constructor" && scenario && (
              <div className="space-y-6">
                
                {/* Тулбар конструктора */}
                <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col gap-4">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center space-x-3">
                      <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Инструменты конструктора:</span>
                      
                      <div id="tutorial-status" className="inline-flex">
                        {hasUnsavedChanges ? (
                          <span className="inline-flex items-center text-[10px] bg-amber-50 text-amber-700 px-2.5 py-0.5 font-bold rounded-md border border-amber-100">
                            <AlertCircle className="h-3 w-3 mr-1 animate-pulse" /> Несохраненный черновик
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-[10px] bg-emerald-50 text-emerald-700 px-2.5 py-0.5 font-bold rounded-md border border-emerald-100">
                            <Check className="h-3 w-3 mr-1" /> Актуален с боевым
                          </span>
                        )}
                      </div>

                      {isSavingDraft && (
                        <span className="text-[10px] text-slate-400 font-medium animate-pulse">автосохранение...</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleUndo}
                        disabled={historyIndex <= 0}
                        title="Undo (Ctrl+Z)"
                        className="p-1.5 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 rounded-lg text-slate-600 cursor-pointer transition-all"
                      >
                        <Undo2 className="h-4 w-4" />
                      </button>

                      <button
                        onClick={handleRedo}
                        disabled={historyIndex >= history.length - 1}
                        title="Redo (Ctrl+Y)"
                        className="p-1.5 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 rounded-lg text-slate-600 cursor-pointer transition-all"
                      >
                        <Redo2 className="h-4 w-4" />
                      </button>

                      <div className="w-[1px] h-7 bg-slate-200 mx-1 self-center" />

                      <button
                        onClick={handleDiscardChanges}
                        className="inline-flex items-center px-3 py-1.5 border border-slate-200 text-xs font-bold rounded-lg bg-white hover:bg-rose-50 text-rose-600 cursor-pointer transition-all"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Сбросить изменения
                      </button>

                      <div className="w-[1px] h-7 bg-slate-200 mx-1 self-center" />

                      <button
                        onClick={handleValidateDraft}
                        id="tutorial-validate" className="inline-flex items-center px-3 py-1.5 border border-slate-200 text-xs font-bold rounded-lg bg-white hover:bg-slate-50 text-slate-700 cursor-pointer transition-all"
                      >
                        🔍 Проверить черновик
                      </button>

                      <button
                        onClick={handleValidateDraft}
                        id="tutorial-publish" className="inline-flex items-center px-4 py-1.5 border border-transparent shadow-xs text-xs font-black rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer transition-all"
                      >
                        🚀 Опубликовать в бот
                      </button>
                    </div>
                  </div>

                  {/* Вторая строка: Резервное копирование и управление файлами */}
                  <div className="flex items-center space-x-3 pt-3 border-t border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Файлы сценария:</span>
                    
                    <div id="tutorial-backup" className="flex items-center space-x-2.5">
                      <button
                        onClick={handleExportScenario}
                        className="inline-flex items-center px-3 py-1.5 border border-slate-200 text-xs font-bold rounded-lg bg-white hover:bg-blue-50 text-blue-600 cursor-pointer transition-all"
                      >
                        <ArrowDown className="h-3.5 w-3.5 mr-1" />
                        Скачать сценарий
                      </button>

                      <label
                        htmlFor="import-scenario-input"
                        className="inline-flex items-center px-3 py-1.5 border border-slate-200 text-xs font-bold rounded-lg bg-white hover:bg-indigo-50 text-indigo-600 cursor-pointer transition-all"
                      >
                        <ArrowUp className="h-3.5 w-3.5 mr-1" />
                        Загрузить сценарий
                      </label>
                    </div>
                    <input 
                      type="file" 
                      id="import-scenario-input" 
                      className="hidden" 
                      accept=".json" 
                      onChange={handleImportScenario}
                    />
                  </div>
                </div>

                {/* Основное полотно Miro Доски */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col gap-4">
                  <div className="flex flex-wrap justify-between items-center gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <div className="flex items-center space-x-1.5 capitalize text-xs font-bold text-slate-600">
                      <span>Навигация по холсту: зажмите левую кнопку мыши для панорамирования (drag), используйте колесико для зума</span>
                    </div>

                    <div className="flex items-center space-x-1">
                      <button onClick={() => setZoom(z => Math.max(0.5, z - 0.1))} className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"><Minus className="h-4 w-4" /></button>
                      <div className="flex items-center justify-center text-xs font-bold text-slate-600">
                        {Math.round(zoom * 100)}%
                      </div>
                      <button onClick={() => setZoom(z => Math.min(2, z + 0.1))} className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"><Plus className="h-4 w-4" /></button>
                      <div className="w-[1px] h-5 bg-slate-200 self-center mx-1" />
                      <button onClick={() => { setZoom(1); setPan({x:0, y:0}); }} className="px-3 flex items-center space-x-1.5 text-xs font-bold text-slate-600 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-colors">
                        <Focus className="h-3.5 w-3.5" />
                        <span>СБРОС ВИДА</span>
                      </button>
                    </div>
                  </div>

                  {/* Список карточек в формате Miro-доски */}
                  {(() => {
                    const coords: Record<string, { row: number; col: number }> = {};
                      const visited = new Set<string>();
                      const mainFlowVisited = new Set<string>();
                      
                      // Находим корневые элементы (на которые никто не ссылается)
                      const inDegree: Record<string, number> = {};
                      Object.keys(scenario.blocks).forEach(id => inDegree[id] = 0);
                      
                      Object.values(scenario.blocks).forEach((b: ScenarioBlock) => {
                        if (b.nextBlockId) inDegree[b.nextBlockId] = (inDegree[b.nextBlockId] || 0) + 1;
                        if (b.rightBlockId) inDegree[b.rightBlockId] = (inDegree[b.rightBlockId] || 0) + 1;
                      });

                      let nextCol = 0;

                      // Выстраиваем вертикальную цепочку в колонку
                      function layoutChain(startId: string, col: number, startRow: number, isMain: boolean): number {
                        let currentId: string | null = startId;
                        let r = startRow;
                        let maxR = startRow;
                        
                        while (currentId && !visited.has(currentId)) {
                          visited.add(currentId);
                          if (isMain) {
                            mainFlowVisited.add(currentId);
                          }
                          
                          // Защита от наложения карточек друг на друга внутри одной колонки
                          while (Object.values(coords).some(p => p.row === r && p.col === col)) {
                            r += 1;
                          }
                          
                          coords[currentId] = { row: r, col: col };
                          if (r > maxR) maxR = r;
                          
                          const b = scenario.blocks[currentId];
                          if (!b) break;

                          // Переход вправо ( rightBlockId ) запускает новую колонку на том же уровне строки r
                          if (b.rightBlockId && !visited.has(b.rightBlockId)) {
                            // Вместо глобального инкремента используем колонку сразу справа от текущей
                            const branchCol = col + 1;
                            const branchMaxR = layoutChain(b.rightBlockId, branchCol, r, isMain);
                            if (branchMaxR > maxR) maxR = branchMaxR;
                          }

                          // Идем вниз по текущему столбцу последовательно
                          if (b.nextBlockId && !visited.has(b.nextBlockId)) {
                            currentId = b.nextBlockId;
                            // Сдвигаем текущий вертикальный ряд ниже, чем закончились любые правые ответвления выше
                            r = maxR + 1;
                          } else {
                            currentId = null;
                          }
                        }
                        return maxR;
                      }

                      // 1. Сначала размещаем стартовую цепочку (главный поток)
                      if (scenario.startBlockId && !visited.has(scenario.startBlockId)) {
                        const startCol = nextCol++;
                        layoutChain(scenario.startBlockId, startCol, 0, true);
                      }

                      // 2. Затем размещаем стартовые блоки меню (также главный поток)
                      if (scenario.menu) {
                        scenario.menu.forEach(m => {
                          if (m.startBlockId && !visited.has(m.startBlockId)) {
                            const mCol = nextCol++;
                            layoutChain(m.startBlockId, mCol, 0, true);
                          }
                        });
                      }

                      // 3. Затем размещаем остальные корневые блоки
                      Object.keys(inDegree).forEach(id => {
                        if (inDegree[id] === 0 && !visited.has(id)) {
                          const rootCol = nextCol++;
                          layoutChain(id, rootCol, 0, false);
                        }
                      });

                      // 4. Размещаем оставшиеся изолированные/разрозненные блоки
                      Object.keys(scenario.blocks).forEach(id => {
                        if (!visited.has(id)) {
                          const orphanCol = nextCol++;
                          layoutChain(id, orphanCol, 0, false);
                        }
                      });


                          // Базовая геометрия расположения на доске Miro
                          const cardWidth = 280;
                          const cardHeight = 135;
                          const colWidth = 370;
                          const rowHeight = 220;

                          return (
                            <div className="flex flex-col lg:flex-row gap-5 items-stretch h-[660px] w-full">
                              
                              {/* ЗАБОР КАНВАСА РИСОВАНИЯ */}
                              <div 
                                ref={canvasRef}
                                id="tutorial-canvas"
                                className="flex-1 bg-slate-50 relative overflow-hidden border border-slate-200 rounded-2xl select-none touch-none"
                                style={{ cursor: isDraggingCanvas ? 'grabbing' : 'grab' }}
                                onMouseDown={handleCanvasMouseDown}
                                onMouseMove={handleCanvasMouseMove}
                                onMouseUp={handleCanvasMouseUp}
                                onMouseLeave={handleCanvasMouseUp}
                              >
                                {/* Фоновая Miro-сетка из точек */}
                                <div 
                                  className="absolute inset-0 pointer-events-none" 
                                  style={{
                                    backgroundImage: 'radial-gradient(#cbd5e1 1.5px, transparent 1.5px)',
                                    backgroundSize: `${22 * zoom}px ${22 * zoom}px`,
                                    backgroundPosition: `${pan.x}px ${pan.y}px`,
                                    opacity: 0.75
                                  }}
                                />

                                {/* Трансформируемый контейнер элементов */}
                                <div 
                                  className="absolute origin-top-left"
                                  style={{
                                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                                    width: '10000px',
                                    height: '10000px',
                                  }}
                                >
                                  {/* Слой SVG соединений */}
                                  <svg className="absolute inset-0 pointer-events-none overflow-visible w-full h-full">
                                    <defs>
                                      <marker id="arrow-next" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                                        <path d="M 0 1 L 10 5 L 0 9 z" fill="#10b981" />
                                      </marker>
                                      <marker id="arrow-right" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                                        <path d="M 0 1 L 10 5 L 0 9 z" fill="#3b82f6" />
                                      </marker>
                                      <marker id="arrow-menu" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                                        <path d="M 0 1 L 10 5 L 0 9 z" fill="#f59e0b" />
                                      </marker>
                                    </defs>

                                    {/* Рисуем соединительные дуги по координатам на доске */}
                                    {Object.entries(coords).map(([id, pos]) => {
                                      const block = scenario.blocks[id];
                                      if (!block) return null;

                                      const x = pos.col * colWidth + 40;
                                      const y = pos.row * rowHeight + 40;

                                      const lines: React.ReactNode[] = [];

                                      // Связь вниз (nextBlockId)
                                      if (block.nextBlockId && coords[block.nextBlockId]) {
                                        const np = coords[block.nextBlockId];
                                        const startX = x + cardWidth / 2;
                                        const startY = y + cardHeight;
                                        const endX = np.col * colWidth + 40 + cardWidth / 2;
                                        const endY = np.row * rowHeight + 40;

                                        lines.push(
                                          <g key={`${id}-to-next`} className="opacity-80 hover:opacity-100 transition-opacity">
                                            <path 
                                              d={getBezierPath(startX, startY, endX, endY, false)} 
                                              fill="none" 
                                              stroke="#10b981" 
                                              strokeWidth="3" 
                                              strokeDasharray={block.type === 'pause' ? '4 4' : 'none'}
                                              markerEnd="url(#arrow-next)" 
                                            />
                                          </g>
                                        );
                                      }

                                      // Связь вправо (rightBlockId)
                                      if (block.rightBlockId && coords[block.rightBlockId]) {
                                        const rp = coords[block.rightBlockId];
                                        const startX = x + cardWidth;
                                        const startY = y + cardHeight / 2;
                                        const endX = rp.col * colWidth + 40;
                                        const endY = rp.row * rowHeight + 40 + cardHeight / 2;

                                        lines.push(
                                          <g key={`${id}-to-right`} className="opacity-80 hover:opacity-100 transition-opacity">
                                            <path 
                                              d={getBezierPath(startX, startY, endX, endY, true)} 
                                              fill="none" 
                                              stroke="#3b82f6" 
                                              strokeWidth="3" 
                                              markerEnd="url(#arrow-right)" 
                                            />
                                          </g>
                                        );
                                      }

                                      return lines;
                                    })}
                                  </svg>

                                  {/* Рендеринг карточек блоков как визуальных нод */}
                                  {Object.entries(coords).map(([id, pos]) => {
                                    const block = scenario.blocks[id];
                                    if (!block) return null;

                                    const x = pos.col * colWidth + 40;
                                    const y = pos.row * rowHeight + 40;
                                    const isSelected = selectedBlockId === id;
                                    const isOrphan = !mainFlowVisited.has(id);

                                    return (
                                      <div
                                        key={id}
                                        className={`board-card absolute rounded-2xl bg-white border cursor-pointer select-none group transition-all duration-200 ${
                                          isSelected 
                                            ? "ring-4 ring-emerald-500 ring-offset-2 border-emerald-500 shadow-md scale-[1.01] z-30" 
                                            : "border-slate-200/90 hover:border-slate-350 hover:shadow-sm"
                                        }`}
                                        style={{
                                          left: `${x}px`,
                                          top: `${y}px`,
                                          width: `${cardWidth}px`,
                                          height: `${cardHeight}px`
                                        }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedBlockId(id);
                                        }}
                                      >
                                        {/* ПЛАВАЮЩИЙ ТУЛБАР УДАЛЕНИЯ ПРИ КЛИКЕ НА КАРТОЧКУ */}
                                        {isSelected && (
                                          <div 
                                            className="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-3 py-1.5 rounded-lg shadow-xl flex items-center space-x-2 z-40"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <span className="text-[9px] font-mono font-bold text-slate-300">ID: {block.id}</span>
                                            <div className="w-[1px] h-3 bg-slate-700" />
                                            <button 
                                              onClick={() => {
                                                handleDeleteBlock(block.id);
                                                setSelectedBlockId(null);
                                              }}
                                              className="text-[10px] font-black text-rose-300 hover:text-rose-100 flex items-center space-x-1 cursor-pointer"
                                            >
                                              <Trash2 className="h-3 w-3 mr-0.5" />
                                              <span>УДАЛИТЬ</span>
                                            </button>
                                          </div>
                                        )}

                                        {/* ЗАГОЛОВОК НОДЫ (Разноцветный хедер по типам) */}
                                        <div className={`px-3.5 py-2.5 rounded-t-2xl border-b flex justify-between items-center ${
                                          block.type === 'text' ? 'bg-slate-50 border-slate-100 text-slate-700' :
                                          block.type === 'button' ? 'bg-blue-50/60 border-blue-100 text-blue-800 font-extrabold' :
                                          block.type === 'link' ? 'bg-cyan-50/65 border-cyan-100 text-cyan-800' :
                                          block.type === 'pause' ? 'bg-purple-50 border-purple-100 text-purple-700 font-bold' :
                                          block.type === 'back' ? 'bg-amber-50 border-amber-100 text-amber-800' :
                                          block.type === 'menu' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' :
                                          block.type === 'file' ? 'bg-teal-50 border-teal-100 text-teal-850 font-bold' :
                                          block.type === 'audio' ? 'bg-indigo-50 border-indigo-100 text-indigo-850 font-bold' :
                                          'bg-rose-50 border-rose-100 text-rose-800'
                                        }`}>
                                          <div className="flex items-center space-x-2 min-w-0">
                                            <span className="text-[11px] shrink-0">
                                              {block.type === 'text' && "📝"}
                                              {block.type === 'button' && "🔘"}
                                              {block.type === 'link' && "🔗"}
                                              {block.type === 'pause' && "⏳"}
                                              {block.type === 'back' && "↩️"}
                                              {block.type === 'menu' && "🏠"}
                                              {block.type === 'wait_button' && "🚦"}
                                              {block.type === 'file' && "📁"}
                                              {block.type === 'audio' && "🎵"}
                                            </span>
                                            <span className="text-[10px] font-black uppercase tracking-wider truncate">
                                              {block.type === 'text' && "Описание"}
                                              {block.type === 'button' && "Кнопка выбора"}
                                              {block.type === 'link' && "Внешняя Ссылка"}
                                              {block.type === 'pause' && "Задержка"}
                                              {block.type === 'back' && "Кнопка Назад"}
                                              {block.type === 'menu' && "Кнопка «В меню»"}
                                              {block.type === 'wait_button' && "Ожидание действия"}
                                              {block.type === 'file' && "Файл документ"}
                                              {block.type === 'audio' && "Аудиофайл"}
                                            </span>
                                          </div>
                                          
                                          {isOrphan && (
                                            <span className="text-[8px] bg-amber-100 text-amber-700 font-bold px-1 rounded-sm">СИРОТА</span>
                                          )}
                                        </div>

                                        {/* КОНТЕНТ НОДЫ */}
                                        <div className="p-3 text-[11px] leading-snug">
                                          {block.type === 'pause' ? (
                                            <div className="flex items-center space-x-1.5 text-purple-900 bg-purple-50/60 p-2 rounded-lg border border-purple-100 font-bold">
                                              <Clock className="w-3.5 h-3.5 text-purple-600" />
                                              <span>Задержка: {block.seconds || 5} секунд</span>
                                            </div>
                                          ) : block.type === 'link' ? (
                                            <div className="space-y-1">
                                              <div className="font-extrabold text-slate-800 truncate">{block.text || "Ссылка без текста"}</div>
                                              <div className="text-[9px] font-mono text-indigo-500 truncate">{block.url || "https://"}</div>
                                            </div>
                                          ) : block.type === 'file' ? (
                                            <div className="space-y-1">
                                              <div className="font-extrabold text-slate-800 truncate">{block.text || "Прикрепленный файл"}</div>
                                              <div className="text-[9px] text-teal-650 bg-teal-50/50 p-1 border border-teal-100 rounded truncate flex items-center gap-1 font-mono">
                                                <span>📎</span>
                                                <span>{block.url || "Файл не загружен..."}</span>
                                              </div>
                                            </div>
                                          ) : block.type === 'audio' ? (
                                            <div className="space-y-1">
                                              <div className="font-extrabold text-slate-800 truncate">{block.text || "Аудиозапись"}</div>
                                              <div className="text-[9px] text-indigo-650 bg-indigo-50/50 p-1 border border-indigo-100 rounded truncate flex items-center gap-1 font-mono font-bold">
                                                <span>🔊</span>
                                                <span>{block.url || "Файл не загружен..."}</span>
                                              </div>
                                            </div>
                                          ) : (
                                            <p className="text-slate-600 font-medium line-clamp-3 leading-relaxed">
                                              {block.text || <em className="text-slate-400">Текст не настроен...</em>}
                                            </p>
                                          )}
                                        </div>

                                        {/* ИНТЕРАКТИВНЫЕ ПЛЮСИКИ ДОБАВЛЕНИЯ КАРТОЧЕК */}
                                        {/* Плюс вниз (relation: next) */}
                                        {block.type !== 'menu' && (
                                          <button
                                            id={undefined}
                                            className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center border border-white shadow-md cursor-pointer hover:scale-110 active:scale-95 transition-all z-25"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setActiveAddPopover({ blockId: id, relation: "next" });
                                            }}
                                            title="Вставить следующее действие по цепочке ниже"
                                          >
                                            <Plus className="h-3 w-3" />
                                          </button>
                                        )}

                                        {/* Ghost element for Step 4 tutorial-palette highlight encompassing both left arrows and bottom plus */}
                                        {id === Object.keys(scenario.blocks)[0] && (
                                          <div 
                                            id="tutorial-palette" 
                                            className="absolute -left-12 -top-2 -right-2 -bottom-5 pointer-events-none rounded-2xl" 
                                          />
                                        )}

                                        {/* Кнопки перемещения вверх/вниз для цепочки */}
                                        {isSelected && (
                                          <div className="absolute top-1/2 -left-8 -translate-y-1/2 flex flex-col space-y-1 shadow-lg bg-white rounded-lg border border-slate-200">
                                            <button 
                                              onClick={(e) => { e.stopPropagation(); handleMoveBlock(id, "up"); }}
                                              className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-t-lg transition-colors border-b border-slate-100"
                                              title="Передвинуть блок вверх по цепочке"
                                            >
                                              <ArrowUp className="w-4 h-4" />
                                            </button>
                                            <button 
                                              onClick={(e) => { e.stopPropagation(); handleMoveBlock(id, "down"); }}
                                              className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-b-lg transition-colors"
                                              title="Передвинуть блок вниз по цепочке"
                                            >
                                              <ArrowDown className="w-4 h-4" />
                                            </button>
                                          </div>
                                        )}

                                        {/* Плюс вправо (relation: right) для разветвления на кнопках */}
                                        {block.type === 'button' && (
                                          <button
                                            className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center border border-white shadow-md cursor-pointer hover:scale-110 active:scale-95 transition-all z-25"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setActiveAddPopover({ blockId: id, relation: "right" });
                                            }}
                                            title="Привязать правую ветку выбора к этой кнопке"
                                          >
                                            <Plus className="h-3 w-3" />
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* ИНСТРУМЕНТАЛЬНАЯ HUD-ПАНЕЛЬ МАСШТАБА И ВИДА */}
                                <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-xs px-3 py-2 rounded-xl border border-slate-200/85 shadow-md flex items-center space-x-3 text-xs font-bold text-slate-705 z-30 pointer-events-auto">
                                  <div className="flex items-center space-x-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                                    <button 
                                      className="px-2 py-0.5 hover:bg-white rounded transition-colors text-slate-500 hover:text-slate-800 text-xs font-black"
                                      onClick={() => setZoom(prev => Math.max(0.4, prev - 0.15))}
                                      title="Уменьшить масштаб"
                                    >
                                      -
                                    </button>
                                    <span className="px-1.5 font-mono text-[9px] text-slate-650">
                                      {Math.round(zoom * 100)}%
                                    </span>
                                    <button 
                                      className="px-2 py-0.5 hover:bg-white rounded transition-colors text-slate-500 hover:text-slate-800 text-xs font-black"
                                      onClick={() => setZoom(prev => Math.min(1.4, prev + 0.15))}
                                      title="Увеличить масштаб"
                                    >
                                      +
                                    </button>
                                  </div>
                                  
                                  <div className="w-[1px] h-4 bg-slate-200" />
                                  
                                  <button
                                    onClick={handleCenterView}
                                    className="px-2 py-1 hover:bg-slate-150 text-[10px] text-indigo-600 font-extrabold uppercase tracking-wide border border-indigo-200/50 rounded-lg transition-colors cursor-pointer"
                                  >
                                    🎯 Сброс вида
                                  </button>

                                  <div className="hidden sm:inline-block text-[9px] text-slate-450 font-medium">
                                    Зажмите пустую область для перемещения
                                  </div>
                                </div>

                              </div>

                              {/* БОКОВАЯ FIGMA-ПАНЕЛЬ НАСТРОЕК ВЫДЕЛЕННОГО БЛОКА */}
                              {selectedBlockId && scenario.blocks[selectedBlockId] ? (() => {
                                const activeBlock = scenario.blocks[selectedBlockId];
                                const activeUrlType = activeBlock.urlType || (activeBlock.url && activeBlock.url.startsWith("/uploads/") ? "upload" : "url");
                                const activeLinkUrl = activeBlock.linkUrl !== undefined ? activeBlock.linkUrl : (activeUrlType === "url" ? (activeBlock.url || "") : "");
                                const activeUploadedUrl = activeBlock.uploadedUrl !== undefined ? activeBlock.uploadedUrl : (activeUrlType === "upload" ? (activeBlock.url || "") : "");
                                const activeUploadedName = activeBlock.uploadedName !== undefined ? activeBlock.uploadedName : (activeUrlType === "upload" ? (activeBlock.text || "") : "");
                                return (
                                  <motion.div 
                                    initial={{ opacity: 0, x: 25 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    id="tutorial-editor" className="w-full lg:w-[320px] bg-white rounded-2xl border border-slate-200 p-4 shrink-0 flex flex-col justify-between overflow-y-auto"
                                  >
                                    <div className="space-y-4">
                                      {/* Локальная шапка инспектора */}
                                      <div className="flex justify-between items-center pb-2.5 border-b border-slate-100">
                                        <div>
                                          <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Параметры блока</h4>
                                          <span className="text-[10px] font-mono text-slate-400 font-bold">id: {activeBlock.id}</span>
                                        </div>
                                        <button 
                                          onClick={() => setSelectedBlockId(null)}
                                          className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1 rounded font-black text-xs"
                                        >
                                          ✕
                                        </button>
                                      </div>

                                      {/* 1. Логический тип блока в БД */}
                                      <div>
                                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Тип действия элемента:</label>
                                        <select
                                          value={activeBlock.type}
                                          onChange={(e) => {
                                            const newType = e.target.value as ScenarioBlock["type"];
                                            const fields: Partial<ScenarioBlock> = { type: newType };
                                            if (newType === "menu") {
                                              fields.nextBlockId = null;
                                              fields.rightBlockId = null;
                                            }
                                            handleUpdateBlockField(activeBlock.id, fields);
                                          }}
                                          className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-400 focus:outline-none bg-slate-50 font-bold text-slate-700"
                                        >
                                          <option value="text">📝 Сообщение-Текст</option>
                                          <option value="button">🔘 Кнопка выбора</option>
                                          <option value="link">🔗 Веб-ссылка URL</option>
                                          <option value="file">📁 Файл документ</option>
                                          <option value="audio">🎵 Аудиофайл</option>
                                          <option value="pause">⏳ Пауза (задержка)</option>
                                          <option value="back">↩️ Кнопка «Назад»</option>
                                          <option value="menu">🏠 Кнопка «В меню»</option>
                                          <option value="wait_button">🚦 Ожидание клика</option>
                                        </select>
                                      </div>

                                      {/* 2. Текст сообщения / кнопка */}
                                      {(activeBlock.type === "text" || activeBlock.type === "button" || activeBlock.type === "back") && (
                                        <div>
                                          <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                            {activeBlock.type === "button" ? "Текст кнопки выбора" : "Отправляемый текст сообщения"}
                                          </label>
                                          {activeBlock.type === "text" ? (
                                            <textarea
                                              value={activeBlock.text || ""}
                                              onChange={(e) => handleUpdateBlockField(activeBlock.id, { text: e.target.value })}
                                              rows={6}
                                              placeholder="Введите текст сообщения... Поддерживаются HTML разметки <b>жирный</b>, <i>курсив</i>, <code>код</code>."
                                              className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-400 leading-normal font-sans text-slate-700"
                                            />
                                          ) : (
                                            <input
                                              type="text"
                                              value={activeBlock.text || ""}
                                              onChange={(e) => handleUpdateBlockField(activeBlock.id, { text: e.target.value })}
                                              placeholder="Текст на кнопке"
                                              className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-400 text-slate-700 font-bold"
                                            />
                                          )}
                                        </div>
                                      )}

                                      {/* Логика "Ссылка" */}
                                      {activeBlock.type === "link" && (
                                        <div className="space-y-4 bg-sky-50/50 p-4 rounded-xl border border-sky-100 mt-2">
                                          <div>
                                            <label className="block text-[9px] font-black text-sky-800 uppercase tracking-widest mb-1">
                                              1. Текст сообщения (необязательно):
                                            </label>
                                            <textarea
                                              value={activeBlock.text || ""}
                                              onChange={(e) => handleUpdateBlockField(activeBlock.id, { text: e.target.value })}
                                              rows={3}
                                              placeholder="Если оставить пустым — ссылка прикрепится к предыдущему сообщению..."
                                              className="w-full text-xs px-2.5 py-1.5 border border-sky-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-400 leading-normal font-sans text-slate-700 bg-white"
                                            />
                                          </div>

                                          <div>
                                            <label className="block text-[9px] font-black text-sky-800 uppercase tracking-widest mb-1">
                                              2. Текст названия ссылки:
                                            </label>
                                            <input
                                              type="text"
                                              value={activeBlock.linkButtonText || ""}
                                              onChange={(e) => handleUpdateBlockField(activeBlock.id, { linkButtonText: e.target.value })}
                                              placeholder="Например: Перейти на сайт"
                                              className="w-full text-xs px-2.5 py-1.5 border border-sky-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-400 text-slate-700 bg-white font-bold"
                                            />
                                          </div>

                                          <div>
                                            <label className="block text-[9px] font-black text-sky-800 uppercase tracking-widest mb-1">
                                              3. Сама ссылка (URL):
                                            </label>
                                            <input
                                              type="text"
                                              value={activeBlock.url || ""}
                                              onChange={(e) => handleUpdateBlockField(activeBlock.id, { url: e.target.value })}
                                              placeholder="https://example.com"
                                              className="w-full text-xs px-2.5 py-1.5 border border-sky-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-400 text-slate-700 bg-white"
                                            />
                                          </div>
                                        </div>
                                      )}

                                      {/* Внутренняя логика кнопки "В меню" */}
                                      {activeBlock.type === "menu" && (
                                        <div className="space-y-4 bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 mt-2">
                                          <div>
                                            <label className="block text-[9px] font-black text-emerald-800 uppercase tracking-widest mb-1">
                                              1. Текст сообщения (с кнопкой перехода):
                                            </label>
                                            <textarea
                                              value={activeBlock.menuGateMessageText || ""}
                                              onChange={(e) => handleUpdateBlockField(activeBlock.id, { menuGateMessageText: e.target.value })}
                                              rows={3}
                                              placeholder="Текст сообщения, который придет первым..."
                                              className="w-full text-xs px-2.5 py-1.5 border border-emerald-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-400 leading-normal font-sans text-slate-700 bg-white"
                                            />
                                          </div>
                                          
                                          <div>
                                            <label className="block text-[9px] font-black text-emerald-800 uppercase tracking-widest mb-1">
                                              2. Текст самой кнопки:
                                            </label>
                                            <input
                                              type="text"
                                              value={activeBlock.menuGateButtonText || ""}
                                              onChange={(e) => handleUpdateBlockField(activeBlock.id, { menuGateButtonText: e.target.value, text: e.target.value })}
                                              placeholder="Название кнопки перехода..."
                                              className="w-full text-xs px-2.5 py-1.5 border border-emerald-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-400 leading-normal font-sans text-slate-700 bg-white font-bold"
                                            />
                                          </div>

                                          <div>
                                            <label className="block text-[9px] font-black text-emerald-800 uppercase tracking-widest mb-1">
                                              3. Текст сообщения меню (с выбором):
                                            </label>
                                            <textarea
                                              value={activeBlock.menuMessageText || ""}
                                              onChange={(e) => handleUpdateBlockField(activeBlock.id, { menuMessageText: e.target.value })}
                                              rows={3}
                                              placeholder="Текст сообщения с кнопками подразделов..."
                                              className="w-full text-xs px-2.5 py-1.5 border border-emerald-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-400 leading-normal font-sans text-slate-700 bg-white"
                                            />
                                          </div>

                                          <div className="space-y-1.5">
                                            <div className="flex items-center justify-between">
                                              <label className="block text-[9px] font-black text-emerald-800 uppercase tracking-widest">
                                                Прикрепленные кнопки выбора:
                                              </label>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const currentAttached = activeBlock.menuAttachedBlocks || [];
                                                  handleUpdateBlockField(activeBlock.id, {
                                                    menuAttachedBlocks: [...currentAttached, ""]
                                                  });
                                                }}
                                                className="w-5 h-5 flex items-center justify-center rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors cursor-pointer"
                                                title="Добавить кнопку"
                                              >
                                                <Plus className="h-3 w-3" />
                                              </button>
                                            </div>

                                            {(activeBlock.menuAttachedBlocks || []).map((attachedId, idx) => (
                                              <div key={idx} className="flex items-center space-x-1">
                                                <select
                                                  value={attachedId}
                                                  onChange={(e) => {
                                                    const nextAttached = [...(activeBlock.menuAttachedBlocks || [])];
                                                    nextAttached[idx] = e.target.value;
                                                    handleUpdateBlockField(activeBlock.id, {
                                                      menuAttachedBlocks: nextAttached
                                                    });
                                                  }}
                                                  className="flex-1 text-[11px] px-2 py-1 border border-slate-200 bg-white rounded-lg focus:outline-none"
                                                >
                                                  <option value="">-- Выберите блок-кнопку --</option>
                                                  {Object.keys(scenario.blocks).map((blkId) => {
                                                    if (blkId === activeBlock.id) return null;
                                                    const b = scenario.blocks[blkId];
                                                    return (
                                                      <option key={blkId} value={blkId}>
                                                        {blkId} ({b?.type}: {b?.text?.substring(0, 24)}...)
                                                      </option>
                                                    );
                                                  })}
                                                </select>
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    const nextAttached = (activeBlock.menuAttachedBlocks || []).filter((_, i) => i !== idx);
                                                    handleUpdateBlockField(activeBlock.id, {
                                                      menuAttachedBlocks: nextAttached
                                                    });
                                                  }}
                                                  className="w-6 h-6 flex items-center justify-center text-rose-500 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-100 transition-colors"
                                                  title="Удалить привязку"
                                                >
                                                  <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                              </div>
                                            ))}
                                            {(activeBlock.menuAttachedBlocks || []).length === 0 && (
                                              <p className="text-[9px] text-slate-400 font-bold italic">
                                                Нет прикрепленных кнопок. Нажмите +, чтобы добавить.
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      )}

                                      {/* 2.5 Настройки кнопки */}
                                      {activeBlock.type === "button" && (
                                        <div className="flex items-center space-x-2 mt-2">
                                          <input
                                            type="checkbox"
                                            id="btn-isOnce"
                                            checked={!!activeBlock.isOnce}
                                            onChange={(e) => handleUpdateBlockField(activeBlock.id, { isOnce: e.target.checked })}
                                            className="rounded text-emerald-500 focus:ring-emerald-400 focus:ring-offset-0 border-slate-300"
                                          />
                                          <label htmlFor="btn-isOnce" className="text-[10px] font-bold text-slate-600 block cursor-pointer select-none">
                                            Однократное действие (нельзя нажать повторно)
                                          </label>
                                        </div>
                                      )}

                                      {/* 3. Ссылка URL или загрузка медиафайла */}
                                      {(activeBlock.type === "link" || activeBlock.type === "file" || activeBlock.type === "audio") && (
                                        <div className="space-y-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
                                          {(activeBlock.type === "file" || activeBlock.type === "audio") && (
                                            <div className="flex border-b border-slate-200 pb-1.5 mb-1.5 space-x-1">
                                              <button
                                                type="button"
                                                onClick={() => handleSwitchFileSource(activeBlock.id, "url")}
                                                className={`flex-1 py-1 text-[10.5px] font-bold text-center border-b-2 transition-all duration-150 ${
                                                  activeUrlType === "url"
                                                    ? "border-indigo-500 text-indigo-600"
                                                    : "border-transparent text-slate-400 hover:text-slate-600"
                                                }`}
                                              >
                                                🌐 Ввести ссылку
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => handleSwitchFileSource(activeBlock.id, "upload")}
                                                className={`flex-1 py-1 text-[10.5px] font-bold text-center border-b-2 transition-all duration-150 ${
                                                  activeUrlType === "upload"
                                                    ? "border-emerald-500 text-emerald-600"
                                                    : "border-transparent text-slate-400 hover:text-slate-600"
                                                }`}
                                              >
                                                💻 Загрузить файл
                                              </button>
                                            </div>
                                          )}

                                          {/* Вкладка ссылка: отображается ДЛЯ КНОПОК LINK или ЕСЛИ активна вкладка url */}
                                          {(activeBlock.type === "link" || activeUrlType === "url") && (
                                            <div className="space-y-1">
                                              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                                {activeBlock.type === "link" ? "Веб-ссылка перехода (URL):" : "Ссылка:"}
                                              </label>
                                              <input
                                                type="text"
                                                placeholder={activeBlock.type === "link" ? "https://" : "https://example.com/file.mp3 или /uploads/file"}
                                                value={activeBlock.type === "link" ? (activeBlock.url || "") : activeLinkUrl}
                                                onChange={(e) => {
                                                  if (activeBlock.type === "link") {
                                                    handleUpdateBlockField(activeBlock.id, { url: e.target.value });
                                                  } else {
                                                    handleUpdateBlockField(activeBlock.id, { linkUrl: e.target.value });
                                                  }
                                                }}
                                                className="w-full text-[11px] px-2.5 py-1.5 border border-slate-200 bg-white rounded-lg font-mono text-indigo-650 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                                              />
                                            </div>
                                          )}

                                          {/* Вкладка загрузка: отображается ТОЛЬКО ЕСЛИ тип file/audio и активна вкладка upload */}
                                          {(activeBlock.type === "file" || activeBlock.type === "audio") && activeUrlType === "upload" && (
                                            <div className="space-y-2">
                                              {activeUploadedUrl && activeUploadedUrl.startsWith("/uploads/") ? (
                                                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-2.5 flex items-center justify-between">
                                                  <div className="flex items-center space-x-2 overflow-hidden truncate">
                                                    <span className="text-emerald-600 text-sm">✅</span>
                                                    <div className="overflow-hidden">
                                                      <p className="text-[10px] font-bold text-slate-700 truncate border-transparent">
                                                        {activeUploadedName || activeUploadedUrl.split("/").pop()}
                                                      </p>
                                                      <p className="text-[8px] text-emerald-600 font-mono italic">
                                                        Файл сохранен на сервере
                                                      </p>
                                                    </div>
                                                  </div>
                                                  <button
                                                    type="button"
                                                    onClick={() => handleRemoveUploadedFile(activeBlock.id)}
                                                    className="hover:bg-red-50 p-1.5 rounded-lg transition-colors text-xs text-rose-500 hover:text-rose-700"
                                                    title="Удалить файл с сервера"
                                                  >
                                                    🗑️
                                                  </button>
                                                </div>
                                              ) : (
                                                <div>
                                                  {uploadProgress[activeBlock.id] ? (
                                                    <div className="bg-white border border-slate-200 rounded-xl p-2.5 space-y-2">
                                                      <div className="flex justify-between items-center text-[10px] text-slate-650">
                                                        <span className="font-bold truncate max-w-[70%] border-transparent">
                                                          {uploadProgress[activeBlock.id].fileName}
                                                        </span>
                                                        <span>
                                                          {uploadProgress[activeBlock.id].success ? (
                                                            <span className="text-emerald-600 font-extrabold flex items-center space-x-0.5">
                                                              <span>Готово</span> <span>✅</span>
                                                            </span>
                                                          ) : uploadProgress[activeBlock.id].error ? (
                                                            <span className="text-red-500 font-semibold">Ошибка ❌</span>
                                                          ) : (
                                                            <span className="text-indigo-600 font-mono font-bold">
                                                              {uploadProgress[activeBlock.id].progress}%
                                                            </span>
                                                          )}
                                                        </span>
                                                      </div>
                                                      
                                                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                                        <div
                                                          className={`h-full transition-all duration-300 ${
                                                            uploadProgress[activeBlock.id].error 
                                                              ? "bg-red-500" 
                                                              : uploadProgress[activeBlock.id].success 
                                                                ? "bg-emerald-500" 
                                                                : "bg-indigo-500"
                                                          }`}
                                                          style={{ width: `${uploadProgress[activeBlock.id].progress}%` }}
                                                        />
                                                      </div>
                                                      
                                                      {uploadProgress[activeBlock.id].error && (
                                                        <p className="text-[9px] text-red-500 font-medium">
                                                          {uploadProgress[activeBlock.id].error}
                                                        </p>
                                                      )}

                                                      {(uploadProgress[activeBlock.id].success || uploadProgress[activeBlock.id].error) && (
                                                        <button
                                                          type="button"
                                                          onClick={() => {
                                                            setUploadProgress(prev => {
                                                              const copy = { ...prev };
                                                              delete copy[activeBlock.id];
                                                              return copy;
                                                            });
                                                          }}
                                                          className="text-[9.5px] text-indigo-500 hover:text-indigo-700 underline font-extrabold cursor-pointer animate-pulse"
                                                        >
                                                          Сбросить и выбрать заново
                                                        </button>
                                                      )}
                                                    </div>
                                                  ) : (
                                                    <div
                                                      onDragOver={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                      }}
                                                      onDrop={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        const file = e.dataTransfer.files?.[0];
                                                        if (file) {
                                                          handleFileUploadAsync(file, activeBlock.id);
                                                        }
                                                      }}
                                                    >
                                                      <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 hover:border-emerald-400 bg-white hover:bg-emerald-50/20 rounded-xl p-3.5 transition-all cursor-pointer select-none">
                                                        <input
                                                          type="file"
                                                          accept={activeBlock.type === "audio" ? "audio/*" : "*/*"}
                                                          className="hidden"
                                                          onChange={(e) => {
                                                            const file = e.target.files?.[0];
                                                            if (file) {
                                                              handleFileUploadAsync(file, activeBlock.id);
                                                            }
                                                          }}
                                                        />
                                                        <span className="text-xl mb-1">📤</span>
                                                        <span className="text-[10px] font-bold text-slate-700">
                                                          Выбрать и загрузить файл...
                                                        </span>
                                                        <span className="text-[8px] text-slate-400 mt-0.5 text-center">
                                                          Перетащите файл сюда (Drag & Drop) или кликните для выбора
                                                        </span>
                                                      </label>
                                                    </div>
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      )}

                                      {/* 4. Задержка в секундах для паузы */}
                                      {activeBlock.type === "pause" && (
                                        <div className="bg-purple-50 p-3 rounded-xl border border-purple-100">
                                          <label className="block text-[9px] font-black text-purple-700 uppercase tracking-widest mb-1.5">Таймаут задержки в секундах:</label>
                                          <div className="flex items-center space-x-2">
                                            <input
                                              type="number"
                                              min={1}
                                              value={activeBlock.seconds || 5}
                                              onChange={(e) => handleUpdateBlockField(activeBlock.id, { seconds: parseInt(e.target.value) || 5 })}
                                              className="w-20 text-xs px-2 py-1 border border-purple-200 rounded text-center font-bold text-purple-950 bg-white"
                                            />
                                            <span className="text-xs text-purple-900 font-bold">сек.</span>
                                          </div>
                                        </div>
                                      )}

                                      {/* 5. Настройка связей (Select-дропдауны прямого маппинга) */}
                                      <div className="space-y-2.5 pt-3 border-t border-slate-100">
                                        <h5 className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Переопределение связей:</h5>
                                        
                                        <div>
                                          <label className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Связь ВНИЗ (next):</label>
                                          <select
                                            value={activeBlock.nextBlockId || ""}
                                            onChange={(e) => handleUpdateBlockField(activeBlock.id, { nextBlockId: e.target.value || null })}
                                            className="w-full text-[11px] px-2 py-1 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 focus:outline-none"
                                          >
                                            <option value="">Нет (Прервать цепочку)</option>
                                            {Object.keys(scenario.blocks).map((blkId) => {
                                              if (blkId === activeBlock.id) return null;
                                              const b = scenario.blocks[blkId];
                                              return (
                                                <option key={blkId} value={blkId}>
                                                  {blkId} ({b?.type}: {b?.text?.substring(0, 16)}...)
                                                </option>
                                              );
                                            })}
                                          </select>
                                        </div>

                                        {activeBlock.type === "button" && (
                                          <div>
                                            <label className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Связь ВПРАВО (right):</label>
                                            <select
                                              value={activeBlock.rightBlockId || ""}
                                              onChange={(e) => handleUpdateBlockField(activeBlock.id, { rightBlockId: e.target.value || null })}
                                              className="w-full text-[11px] px-2 py-1 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 focus:outline-none"
                                            >
                                              <option value="">Нет (Без правой ветки)</option>
                                              {Object.keys(scenario.blocks).map((blkId) => {
                                                if (blkId === activeBlock.id) return null;
                                                const b = scenario.blocks[blkId];
                                                return (
                                                  <option key={blkId} value={blkId}>
                                                    {blkId} ({b?.type}: {b?.text?.substring(0, 16)}...)
                                                  </option>
                                                );
                                              })}
                                            </select>
                                          </div>
                                        )}
                                      </div>

                                    </div>

                                    {/* Удаление карточки */}
                                    <div className="pt-3 border-t border-slate-100">
                                      <button
                                        onClick={() => {
                                          handleDeleteBlock(activeBlock.id);
                                          setSelectedBlockId(null);
                                        }}
                                        className="w-full flex items-center justify-center py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl border border-rose-100 text-xs font-black transition-colors"
                                      >
                                        <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                                        Удалить блок
                                      </button>
                                    </div>
                                  </motion.div>
                                );
                              })() : (
                                <div className="hidden lg:flex w-[320px] bg-slate-50 border border-dashed border-slate-200 rounded-2xl items-center justify-center p-6 text-center shrink-0">
                                  <div className="space-y-2">
                                    <div className="text-xl">👇</div>
                                    <p className="text-[11px] text-slate-400 font-bold leading-normal">
                                      Выберите любой блок на Miro-карте, чтобы редактировать его текст, события и связи.
                                    </p>
                                  </div>
                                </div>
                              )}

                            </div>
                          );
                        })()}

                </div>
              </div>
            )}

            {/* ВКЛАДКА: НАСТРОЙКИ СИСТЕМЫ */}
            {adminTab === "settings" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* 1. Настройка параметров доступа */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-6">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center">
                      <Lock className="h-4 w-4 text-emerald-500 mr-2" />
                      Глобальные настройки доступа и ботов
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">Тут вы можете сменить токен бота или изменить переадресацию обращений.</p>
                  </div>

                  <form className="space-y-4" onSubmit={handleSaveSettings}>
                    
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                        Токен бота Telegram (BOT TOKEN):
                      </label>
                      <input
                        type="password"
                        placeholder="Оставьте пустым, чтобы не перезаписывать..."
                        value={botTokenInput}
                        onChange={(e) => setBotTokenInput(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-1 focus:ring-emerald-400 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                        Ссылка для переадресации ЛС (contactLink):
                      </label>
                      <input
                        type="text"
                        placeholder="https://t.me/your_account"
                        value={contactLinkInput}
                        onChange={(e) => setContactLinkInput(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono text-indigo-600 focus:ring-1 focus:ring-emerald-400 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                        Новый пароль Администратора:
                      </label>
                      <input
                        type="password"
                        placeholder="Введите новый пароль для входа..."
                        value={newPasswordInput}
                        onChange={(e) => setNewPasswordInput(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-emerald-400 focus:outline-none"
                      />
                      <p className="text-[10px] text-slate-400 mt-1">Пароль надежно шифруется по крипто-стандарту SHA-256 перед записью.</p>
                    </div>

                    {settingsSuccess && (
                      <div className="p-2.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg text-[11px] font-bold">
                        ✓ Настройки успешно зафиксированы и применены!
                      </div>
                    )}

                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        disabled={isSavingSettings}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs text-xs font-bold rounded-lg cursor-pointer"
                      >
                        {isSavingSettings ? "Сохранение..." : "Сохранить настройки"}
                      </button>
                    </div>

                  </form>
                </div>

                {/* 2. Логи ошибок бота на стороне ТГ */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center">
                      <AlertTriangle className="h-4 w-4 text-amber-500 mr-2" />
                      Журнал ошибок бота (Telegram API)
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">Здесь записываются ошибки, возникшие у пользователей при прохождении карточек.</p>
                  </div>

                  <div className="border border-slate-100 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-[380px] overflow-y-auto">
                    {errorsList.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-400">
                        Ошибок бота не зафиксировано! Всё работает идеально 🕊️
                      </div>
                    ) : (
                      errorsList.map((err) => (
                        <div key={err.id} className="p-3 bg-red-50/10 text-xs text-slate-600 space-y-1">
                          <div className="flex justify-between font-mono text-[10px] text-slate-400 mb-1">
                            <span>{new Date(err.timestamp).toLocaleString("ru-RU")}</span>
                            <span>ID: {err.id}</span>
                          </div>
                          <p className="font-bold text-red-700">{err.message}</p>
                          {err.context && (
                            <pre className="p-2 bg-slate-900 text-emerald-400 font-mono text-[10px] rounded overflow-x-auto mt-2 truncate">
                              {err.context}
                            </pre>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>
            )}

            {/* ВКЛАДКА: КЛИЕНТЫ В БОТЕ */}
            {adminTab === "clients" && (
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
                          <th scope="col" className="px-6 py-3.5 text-left text-xs font-bold text-slate-400 uppercase tracking-wider font-sans">Дата старта</th>
                          <th scope="col" className="px-6 py-3.5 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Шаг 1: Состояние</th>
                          <th scope="col" className="px-6 py-3.5 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Шаг 2: Убеждение</th>
                          <th scope="col" className="px-6 py-3.5 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Раздел Меню</th>
                          <th scope="col" className="px-6 py-3.5 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Прохождение квеста</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-slate-100 text-xs text-slate-600">
                        {status.sessionsList.map((user, idx) => {
                          const prog = calculateProgress(user);
                          return (
                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-6 py-4.5 whitespace-nowrap">
                                <div className="flex items-center space-x-2.5">
                                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-xs">
                                    {(user.firstName || user.username || "A").substring(0,2).toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="font-bold text-slate-900">{user.firstName || "Без имени"} {user.lastName || ""}</div>
                                    <div className="text-[10px] text-indigo-500 font-bold">@{user.username || "нет_юзернейма"}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4.5 whitespace-nowrap font-medium text-slate-400">
                                {user.startedAt ? new Date(user.startedAt).toLocaleString("ru-RU") : "Неизвестно"}
                              </td>
                              <td className="px-6 py-4.5 whitespace-nowrap font-semibold">
                                <span className="px-2 py-0.5 rounded-md bg-slate-150 text-slate-700 text-[10px] font-bold">
                                  {getChoiceLabel(user.step1ChoiceId)}
                                </span>
                              </td>
                              <td className="px-6 py-4.5 whitespace-nowrap font-semibold">
                                <span className="px-2 py-0.5 rounded-md bg-slate-150 text-slate-700 text-[10px] font-bold">
                                  {getChoiceLabel(user.step2ChoiceId)}
                                </span>
                              </td>
                              <td className="px-6 py-4.5 whitespace-nowrap">
                                {user.menuUnlocked ? (
                                  <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100 font-bold text-[10px] inline-block">Вернуться в меню открыто</span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-150 text-[10px] font-bold inline-block">Начальный квест</span>
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
            )}

            {/* ВКЛАДКА: ИНСТРУКЦИЯ ПОЛЬЗОВАТЕЛЯ */}
            {adminTab === "instructions" && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                {/* Шапка руководства */}
                <div className="px-6 py-5 border-b border-slate-200/60 bg-gradient-to-r from-emerald-500/5 to-teal-500/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center">
                      <span className="mr-2">📖</span>
                      База Знаний
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 font-medium leading-normal">
                      Руководство по работе с конструктором.
                    </p>
                  </div>
                  
                  {/* Кнопка запуска Быстрого Обучения */}
                  <button
                    onClick={() => {
                      setAdminTab("constructor");
                      setTimeout(() => setTutorialStep(0), 100);
                    }}
                    className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-extrabold text-xs rounded-xl shadow-xs hover:shadow-md hover:scale-102 active:scale-98 cursor-pointer transition-all flex items-center space-x-1.5"
                  >
                    <span>🎯</span>
                    <span>Пройти Обучающий Тур заново</span>
                  </button>
                </div>

                {/* Строка поиска и фильтрации */}
                <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  {/* Локальные Подвкладки */}
                  <div className="flex bg-slate-200/70 p-1 rounded-xl border border-slate-200/50 self-start">
                    <button
                      onClick={() => setInstructionSubTab("blocks")}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        instructionSubTab === "blocks" ? "bg-white text-emerald-600 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      🧩 Описание Блоков
                    </button>
                    <button
                      onClick={() => setInstructionSubTab("logic")}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        instructionSubTab === "logic" ? "bg-white text-emerald-600 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      🔒 Публикация и Бекапы
                    </button>
                  </div>

                  {/* Инпут поиска */}
                  <div className="relative w-full md:w-64">
                    <input
                      type="text"
                      placeholder="Быстрый поиск по справке..."
                      value={instructionSearch}
                      onChange={(e) => setInstructionSearch(e.target.value)}
                      className="w-full text-xs pl-8 pr-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-400 focus:outline-none transition-all"
                    />
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">🔍</span>
                  </div>
                </div>

                {/* Основное Тело Руководства */}
                <div className="p-6 md:p-8 max-h-[640px] overflow-y-auto space-y-8">
                  
                  {/* ИНСТРУМЕНТ ПОИСКА ПЕРЕПОЛНЕНИЯ - ФИЛЬТРАЦИЯ */}
                  {instructionSearch && (
                    <div className="p-4 bg-emerald-50/50 border border-emerald-100/70 rounded-xl text-teal-850 text-xs font-bold mb-4">
                      Результаты поиска по фильтру "{instructionSearch}":
                    </div>
                  )}

                  {/* СЕКЦИЯ 2: ПОЛНЫЙ КАТАЛОГ БЛОКОВ */}
                  {(instructionSubTab === "blocks" || (instructionSearch && "Описание Блоков".toLowerCase().includes(instructionSearch.toLowerCase()))) && (
                    <div className="space-y-6 pt-2">
                      <div className="border-b border-indigo-100 pb-3">
                        <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center">
                          <span className="mr-2 text-emerald-500">🧩</span> Секция 2. Описание всех блоков конструктора
                        </h4>
                        <p className="text-[11px] text-slate-400 font-bold uppercase mt-1">Что умеет каждый блок и как правильно его настраивать</p>
                      </div>

                      <div className="space-y-4">
                        
                        {/* Блок 1. Текстовое сообщение */}
                        <div className="p-4 bg-white border border-slate-200/80 rounded-xl shadow-2xs hover:border-emerald-300 transition-colors flex flex-col md:flex-row gap-4">
                          <div className="w-10 h-10 shrink-0 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center font-bold text-lg select-none">💬</div>
                          <div className="space-y-2">
                            <h5 className="font-extrabold text-xs text-slate-800">Текстовое сообщение</h5>
                            <div className="text-[11px] text-slate-500 leading-relaxed space-y-1">
                              <p>Основной текстовый блок.</p>
                              <p>Отправляет пользователю обычное текстовое сообщение.</p>
                              <p>К нему можно «приклеить» кнопку-ссылку, если поставить блок ссылки под ним. Можно делать жирный текст, с помощью двух звёздочек в начале и конце текста, который нужно выделить жирным. Курсив - одна звёздочка в начале и конце.</p>
                            </div>
                          </div>
                        </div>

                        {/* Блок 2. Кнопка перехода или галочки-выбора */}
                        <div className="p-4 bg-white border border-slate-200/80 rounded-xl shadow-2xs hover:border-emerald-300 transition-colors flex flex-col md:flex-row gap-4">
                          <div className="w-10 h-10 shrink-0 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center font-bold text-lg select-none">☑️</div>
                          <div className="space-y-2">
                            <h5 className="font-extrabold text-xs text-slate-800">Кнопка перехода или галочки-выбора</h5>
                            <div className="text-[11px] text-slate-500 leading-relaxed space-y-1">
                              <p>Кнопки, которые могут ветвиться вправо, создавая отдельную ветку логики.</p>
                              <p>Так же кнопка может не иметь ветки вправо, тогда будет просто поставлена галочка на выборе. Но после кнопок без веток вправо (после тех, у которых идёт логика вниз), нужно ставить блок ожидание нажатия кнопок.</p>
                              <p><strong>Что делает:</strong> Создает кнопку под сообщением.</p>
                              <p><strong>Логика:</strong> При нажатии бот может либо просто отметить пункт «галочкой», либо перебросить пользователя в другой раздел сценария(вправо).</p>
                            </div>
                          </div>
                        </div>

                        {/* Блок 3. Кнопка со внешней веб-ссылкой URL */}
                        <div className="p-4 bg-white border border-slate-200/80 rounded-xl shadow-2xs hover:border-emerald-300 transition-colors flex flex-col md:flex-row gap-4">
                          <div className="w-10 h-10 shrink-0 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center font-bold text-lg select-none">🔗</div>
                          <div className="space-y-2">
                            <h5 className="font-extrabold text-xs text-slate-800">Кнопка со внешней веб-ссылкой URL</h5>
                            <div className="text-[11px] text-slate-500 leading-relaxed space-y-1">
                              <p>Создает кнопку, ведущую по ссылке.</p>
                              <p>Если в блоке не указан свой текст сообщения, кнопка автоматически прикрепляется к предыдущему блоку (тексту, файлу или аудио). Но при создании блока автоматически там уже есть текст. Так что если нужно прикрепить к верхнему блоку - нужно удалить его(текст). В настройках можно настроить текст сообщения, к которому прикрепится ссылка(если не нужно прикрепить к верхнему сообщению), текст ссылки, который будет показан пользователю, вместо ссылки, сама ссылка.</p>
                            </div>
                          </div>
                        </div>

                        {/* Блок 4. Таймер-пауза задержки сообщений */}
                        <div className="p-4 bg-white border border-slate-200/80 rounded-xl shadow-2xs hover:border-emerald-300 transition-colors flex flex-col md:flex-row gap-4">
                          <div className="w-10 h-10 shrink-0 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center font-bold text-lg select-none">⏳</div>
                          <div className="space-y-2">
                            <h5 className="font-extrabold text-xs text-slate-800">Таймер-пауза задержки сообщений</h5>
                            <p className="text-[11px] text-slate-500 leading-relaxed">
                              Делает паузу на заданное количество секунд перед отправкой следующего блока.
                            </p>
                          </div>
                        </div>

                        {/* Блок 5. Системная кнопка «Назад» */}
                        <div className="p-4 bg-white border border-slate-200/80 rounded-xl shadow-2xs hover:border-emerald-300 transition-colors flex flex-col md:flex-row gap-4">
                          <div className="w-10 h-10 shrink-0 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center font-bold text-lg select-none">↩️</div>
                          <div className="space-y-2">
                            <h5 className="font-extrabold text-xs text-slate-800">Системная кнопка «Назад»</h5>
                            <p className="text-[11px] text-slate-500 leading-relaxed">
                              Позволяет вернуться к предыдущему шагу.
                            </p>
                          </div>
                        </div>

                        {/* Блок 6. Системная «Вернуться в меню» */}
                        <div className="p-4 bg-white border border-slate-200/80 rounded-xl shadow-2xs hover:border-emerald-300 transition-colors flex flex-col md:flex-row gap-4">
                          <div className="w-10 h-10 shrink-0 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center font-bold text-lg select-none">🏠</div>
                          <div className="space-y-2">
                            <h5 className="font-extrabold text-xs text-slate-800">Системная «Вернуться в меню»</h5>
                            <div className="text-[11px] text-slate-500 leading-relaxed space-y-1">
                              <p>Интерактивный блок перехода в меню. Работает в два этапа. Сначала бот присылает сообщение с кнопкой «Открыть меню»(текст этого сообщения и текст кнопки в меню, устанавливается в настройках блока). После нажатия на нее отправляется сообщения главного меню и выбранные кнопки, из существующих.(сообщение главного меню устанавливается через настройки блока. Кнопки меню выбираются из существующих кнопок, так же через настройки блока.)</p>
                              <p>Можно отдельно настроить текст сообщения перед кнопкой меню, текст самой кнопки меню и основной текст меню и выбрать кнопки для отображения. Так же, При редактировании одного блока "В меню", остальные и новые блоки "В меню", подтягивают настройки, которые вы изменили.</p>
                            </div>
                          </div>
                        </div>

                        {/* Блок 7. Ожидание нажатия кнопок */}
                        <div className="p-4 bg-white border border-slate-200/80 rounded-xl shadow-2xs hover:border-emerald-300 transition-colors flex flex-col md:flex-row gap-4">
                          <div className="w-10 h-10 shrink-0 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center font-bold text-lg select-none">🚦</div>
                          <div className="space-y-2">
                            <h5 className="font-extrabold text-xs text-slate-800">Ожидание нажатия кнопок</h5>
                            <p className="text-[11px] text-slate-500 leading-relaxed">
                              Останавливает непрерывный вывод диалога. Бот ждет, пока клиент кликнет на любую из предложенных под сообщением кнопок. Без этого блока сообщения будут сыпаться сплошным потоком одно за другим. <strong>Важное правило:</strong> Всегда вставляйте блок «Ожидание кнопок» сразу под сообщением, к которому крепятся кнопки перехода!
                            </p>
                          </div>
                        </div>

                        {/* Блок 8. Добавить файл или документ */}
                        <div className="p-4 bg-white border border-slate-200/80 rounded-xl shadow-2xs hover:border-emerald-300 transition-colors flex flex-col md:flex-row gap-4">
                          <div className="w-10 h-10 shrink-0 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center font-bold text-lg select-none">📁</div>
                          <div className="space-y-2">
                            <h5 className="font-extrabold text-xs text-slate-800">Добавить файл или документ</h5>
                            <div className="text-[11px] text-slate-500 leading-relaxed space-y-1">
                              <p>Отправляет файлы, как документы. В настройках блока указываете ссылку на файл, и бот отправляет пользователю файл из ссылки.</p>
                              <p>К файлу можно прикрепить кнопку-ссылку, если она стоит в сценарии снизу.</p>
                            </div>
                          </div>
                        </div>

                        {/* Блок 9. Добавить аудиозапись / звук */}
                        <div className="p-4 bg-white border border-slate-200/80 rounded-xl shadow-2xs hover:border-emerald-300 transition-colors flex flex-col md:flex-row gap-4">
                          <div className="w-10 h-10 shrink-0 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center font-bold text-lg select-none">🎵</div>
                          <div className="space-y-2">
                            <h5 className="font-extrabold text-xs text-slate-800">Добавить аудиозапись / звук</h5>
                            <div className="text-[11px] text-slate-500 leading-relaxed space-y-1">
                              <p>Голосовые сообщения или музыка.</p>
                              <p><strong>Что делает:</strong> Отправляет аудиофайл. Настраивается так же как документ, указываете ссылку и бот отправляет аудиофайл, который по этой ссылке.</p>
                            </div>
                          </div>
                        </div>

                      </div>
                    </div>
                  )}

                  {/* СЕКЦИЯ 3: ПРОДВИНУТАЯ ЛОГИКА */}
                  {(instructionSubTab === "logic" || (instructionSearch && "Публикация и Бекапы".toLowerCase().includes(instructionSearch.toLowerCase()))) && (
                    <div className="space-y-6 pt-2">
                      <div className="border-b border-indigo-100 pb-3">
                        <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center">
                          <span className="mr-2 text-indigo-500">🔒</span> Публикация и Бэкапы
                        </h4>
                      </div>

                      <div className="space-y-4 text-xs text-slate-650 font-medium leading-relaxed">
                        
                        <div className="p-5 bg-indigo-50/45 border border-indigo-100/60 rounded-2xl space-y-2">
                          <h5 className="font-black text-[12px] text-indigo-950 flex items-center">
                            <span>🔍</span>
                            <span className="ml-1.5">Встроенная Авто-Валидация (Интеллектуальная проверка)</span>
                          </h5>
                          <p className="text-[11px] text-slate-500 text-justify">
                            Конструктор снабжен защитой от случайных ошибок. При нажатии кнопки <strong>🔍 Проверить черновик</strong> сервер проверяет целостность всего графа связей:
                          </p>
                          <ul className="list-disc list-inside space-y-1 pl-1 text-[11px] text-slate-500">
                            <li>Обязательное присутствие текстов в текстовых сообщениях и на задействованных кнопках;</li>
                            <li>Присутствие завершающих связей;</li>
                            <li>Предупреждения о дублировании или неподключенных узлах.</li>
                          </ul>
                          <p className="text-[11px] font-bold text-slate-600 mt-1">Только при 100% корректности проверки черновика вам станет доступна кнопка публикации.</p>
                        </div>

                        <div className="p-5 bg-teal-50/45 border border-teal-100/60 rounded-2xl space-y-2">
                          <h5 className="font-black text-[12px] text-teal-950 flex items-center">
                            <span>📁</span>
                            <span className="ml-1.5">Резервное копирование (Backups)</span>
                          </h5>
                          <p className="text-[11px] text-slate-500 text-justify">
                            Настоятельно рекомендуется скачивать копию сценария на локальный компьютер перед внесением глобальных структурных инноваций. Для этого используйте кнопки в тулбаре:
                          </p>
                          <ul className="list-disc list-inside space-y-1 pl-1 text-[11px] text-slate-500">
                            <li><strong>Скачать сценарий</strong>: Формирует один компактный зашифрованный JSON-файл со всеми вашими текстами, аудиозаписями и связями. Сохраните его на компьютере;</li>
                            <li><strong>Загрузить сценарий</strong>: Позволяет моментально залить обратно ранее сохраненную структуру, вернув состояние квеста на любую дату истории, если что-то пошло не так.</li>
                          </ul>
                        </div>

                      </div>
                    </div>
                  )}

                </div>
              </div>
            )}

          </div>
        )}

        {/* ------------------------------------------- */}
        {/* РЕЖИМ 2: ПАНЕЛЬ ДЛЯ РАЗРАБОТЧИКОВ (🔧) */}
        {/* ------------------------------------------- */}
        {panelMode === "developer" && (
          <div className="space-y-6">
            
            {/* ВКЛАДКА: СТАТУС СЕРВЕРА */}
            {devTab === "status" && status && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                
                <div className="bg-white p-5 rounded-xl border border-slate-200/85 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Сервис Телеграм</span>
                    <span className="mt-1.5 flex items-center">
                      <CheckCircle className="h-4 w-4 text-emerald-500 mr-1.5" />
                      <span className="text-sm font-black text-slate-900">Запущен</span>
                    </span>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200/85 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Режим Входящих</span>
                    <p className="mt-1">
                      {status.isWebhookWorking ? (
                        <span className="text-white text-[9px] font-black tracking-widest uppercase bg-indigo-600 px-2.5 py-1 rounded">Webhook</span>
                      ) : (
                        <span className="text-white text-[9px] font-black tracking-widest uppercase bg-amber-600 px-2.5 py-1 rounded">Polling</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200/85 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">APP_URL (Хост)</span>
                    <p className="mt-1.5 text-xs font-mono text-slate-600 font-bold max-w-[150px] truncate">{status.appUrl}</p>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200/85 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">База Диалогов</span>
                    <p className="mt-1 text-md font-black text-slate-900">{status.sessionCount} сессий</p>
                  </div>
                </div>

              </div>
            )}

            {/* ВКЛАДКА: КОНСОЛЬ ВЫЗОВОВ */}
            {devTab === "logs" && (
              <div className="bg-slate-900 border border-slate-950 rounded-2xl shadow-md p-6 overflow-hidden">
                <div className="flex justify-between items-center pb-4 mb-4 border-b border-slate-800">
                  <div className="flex items-center space-x-2">
                    <Terminal className="h-5 w-5 text-emerald-400" />
                    <div>
                      <h3 className="font-mono text-emerald-400 font-bold text-sm">Системные трейсы сервера бота</h3>
                      <p className="text-[11px] text-slate-500 font-mono">Вызовы Telegram API, нажатия кнопок клиентами, запуски таймаутов.</p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-950 rounded-xl p-5 font-mono text-xs text-slate-300 h-[450px] overflow-y-auto space-y-1.5 scrollbar-thin select-text">
                  {logs.length === 0 ? (
                    <p className="text-slate-600 italic font-medium">Консоль вызова пуста.</p>
                  ) : (
                    logs.map((log, index) => {
                      const isError = log.includes("Error") || log.includes("failed") || log.includes("failed");
                      return (
                        <div key={index} className={`border-l pl-2 ${isError ? "border-rose-600 text-rose-300 bg-rose-500/5 py-0.5" : "border-emerald-600 text-emerald-400"}`}>
                          {log}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* ВКЛАДКА: СПРАВКА UBUNTU */}
            {devTab === "guide" && (
              <div className="bg-white p-6 rounded-xl border border-slate-200 max-w-4xl space-y-6">
                <div>
                  <h3 className="text-md font-black text-slate-900 uppercase tracking-wider">Инструкция по развертыванию на Ubuntu 24.04 LTS</h3>
                  <p className="text-xs text-slate-500 mt-1">Обеспечивает автозапуск и защиту SSL с помощью Systemd и Caddy</p>
                </div>

                {/* Генератор хэша */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-4">
                  <div>
                    <h4 className="font-black text-slate-800 tracking-wide">Генератор крипто-хэша SHA-256 для Администратора</h4>
                    <p className="text-slate-500 mt-0.5">Сгенерируйте и замените открытые пароли в `.env` на защищенный хеш.</p>
                  </div>

                  <form className="flex gap-2 items-center" onSubmit={handleGenerateHash}>
                    <input
                      type="password"
                      placeholder="Введите пароль для хеширования..."
                      value={hashPasswordInput}
                      onChange={(e) => setHashPasswordInput(e.target.value)}
                      className="px-3 py-1.5 border border-slate-300 rounded bg-white text-xs max-w-sm flex-1 focus:ring-1 focus:ring-emerald-400 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={generatingHash || !hashPasswordInput}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded cursor-pointer"
                    >
                      Хешировать
                    </button>
                  </form>

                  {hashResult && (
                    <div className="p-3 bg-white border border-slate-300 rounded space-y-2">
                      <p className="font-mono text-[10px] break-all select-text"><b>Хэш шифра:</b> {hashResult.hash}</p>
                      <p className="font-mono text-[10px] break-all select-text"><b>Соль:</b> {hashResult.salt}</p>
                      <pre className="p-2.5 bg-slate-900 text-slate-100 font-mono text-[10px] rounded break-all whitespace-pre-wrap select-text">
                        {hashResult.instructions}
                      </pre>
                    </div>
                  )}
                </div>

                {/* Инструкции Systemd */}
                <div className="space-y-3 font-sans text-xs text-slate-600 leading-relaxed">
                  <p className="font-black text-slate-800">1. Настройка Systemd службы автозапуска /etc/systemd/system/AlenaBot.service:</p>
                  <pre className="p-3 bg-slate-900 text-slate-100 rounded font-mono text-[10px] overflow-x-auto">
{`[Unit]
Description=Alena Telegram Bot & Web Admin
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/prod/AlenaBot
ExecStart=/usr/bin/node dist/server.cjs
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target`}
                  </pre>
                </div>

              </div>
            )}

          </div>
        )}

      </main>

      {/* ------------------------------------------- */}
      {/* ПЛАВАЮЩЕЕ ОКНО ДОБАВЛЕНИЯ БЛОКА В КАНВАС  */}
      {/* ------------------------------------------- */}
      {activeAddPopover && (
        <div className="fixed inset-0 bg-slate-950/20 backdrop-blur-xs flex items-center justify-center z-50">
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xl max-w-sm w-full p-5 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Выберите добавляемый тип блока:</h3>
              <button 
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
                onClick={() => setActiveAddPopover(null)}
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2 text-xs">
              
              <button 
                onClick={() => handleAddBlock(activeAddPopover.blockId, activeAddPopover.relation, "text")}
                className="flex items-center space-x-2.5 p-2 bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 font-bold rounded-lg transition-colors border border-slate-200"
              >
                <span>📝</span>
                <span>Текстовое сообщение</span>
              </button>

              <button 
                onClick={() => handleAddBlock(activeAddPopover.blockId, activeAddPopover.relation, "button")}
                className="flex items-center space-x-2.5 p-2 bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-bold rounded-lg transition-colors border border-slate-200"
              >
                <span>🔘</span>
                <span>Кнопка перехода или галочки-выбора</span>
              </button>

              <button 
                onClick={() => handleAddBlock(activeAddPopover.blockId, activeAddPopover.relation, "link")}
                className="flex items-center space-x-2.5 p-2 bg-slate-50 hover:bg-cyan-50 text-slate-700 hover:text-cyan-700 font-bold rounded-lg transition-colors border border-slate-200"
              >
                <span>🔗</span>
                <span>Кнопка со внешней веб-ссылкой URL</span>
              </button>

              <button 
                onClick={() => handleAddBlock(activeAddPopover.blockId, activeAddPopover.relation, "pause")}
                className="flex items-center space-x-2.5 p-2 bg-slate-50 hover:bg-purple-50 text-slate-700 hover:text-purple-700 font-bold rounded-lg transition-colors border border-slate-200"
              >
                <span>⏳</span>
                <span>Таймер-пауза задержки сообщений</span>
              </button>

              <button 
                onClick={() => handleAddBlock(activeAddPopover.blockId, activeAddPopover.relation, "back")}
                className="flex items-center space-x-2.5 p-2 bg-slate-50 hover:bg-amber-50 text-slate-700 hover:text-amber-700 font-bold rounded-lg transition-colors border border-slate-200"
              >
                <span>↩️</span>
                <span>Системная кнопка «Назад»</span>
              </button>

              <button 
                onClick={() => handleAddBlock(activeAddPopover.blockId, activeAddPopover.relation, "menu")}
                className="flex items-center space-x-2.5 p-2 bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 font-bold rounded-lg transition-colors border border-slate-200"
              >
                <span>🏠</span>
                <span>Системная «Вернуться в меню»</span>
              </button>

              <button 
                onClick={() => handleAddBlock(activeAddPopover.blockId, activeAddPopover.relation, "wait_button")}
                className="flex items-center space-x-2.5 p-2 bg-slate-50 hover:bg-rose-50 text-slate-700 hover:text-rose-700 font-bold rounded-lg transition-colors border border-slate-200"
              >
                <span>🚦</span>
                <span>Ожидание нажатия кнопок</span>
              </button>

              <button 
                onClick={() => handleAddBlock(activeAddPopover.blockId, activeAddPopover.relation, "file")}
                className="flex items-center space-x-2.5 p-2 bg-slate-50 hover:bg-teal-50 text-slate-700 hover:text-teal-700 font-bold rounded-lg transition-colors border border-slate-200"
              >
                <span>📁</span>
                <span>Добавить файл или документ</span>
              </button>

              <button 
                onClick={() => handleAddBlock(activeAddPopover.blockId, activeAddPopover.relation, "audio")}
                className="flex items-center space-x-2.5 p-2 bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 font-bold rounded-lg transition-colors border border-slate-200"
              >
                <span>🎵</span>
                <span>Добавить аудиозапись / звук</span>
              </button>

            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------- */}
      {/* КЕНТРИРУЮЩАЯ МОДАЛКА ВАЛИДАЦИИ ЧЕРНОВИКА */}
      {/* ------------------------------------------- */}
      {validationModal && (
        <div className="fixed inset-0 bg-slate-950/20 backdrop-blur-xs flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-6">
            
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center">
                {validationModal.success ? (
                  <CheckCircle className="h-5 w-5 text-emerald-500 mr-2" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-rose-500 mr-2" />
                )}
                Результаты проверки черновика
              </h3>
              <button 
                onClick={() => setValidationModal(null)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {/* Контент успешен / ошибки */}
            {validationModal.success ? (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50/70 border border-emerald-100 rounded-xl text-xs text-emerald-800 font-bold leading-relaxed">
                  ✓ Проверка пройдена! Временные лимиты сообщений, корректность структуры переходов и ссылки Caddy/Telegram полностью соответствуют стандартам ТЗ.
                </div>
                <div className="text-xs text-slate-500 font-medium">После нажатия кнопки деплоя изменения запишутся в живой цикл базы. Клиенты сразу начнут получать обновленные карточки.</div>
                
                <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => setValidationModal(null)}
                    className="px-4 py-2 border border-slate-200 text-slate-600 text-xs font-bold rounded-lg bg-white"
                  >
                    Вернуться к правкам
                  </button>
                  <button
                    onClick={handleDeployDraft}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-lg shadow-sm"
                  >
                    Опубликовать в живой цикл 🚀
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-800 font-bold">
                  ❌ Обнаружено {validationModal.errors.length} логических ошибок. Бот не сможет корректно функционировать с такими настройками. Пожалуйста, исправьте их.
                </div>

                <div className="space-y-2 max-h-[220px] overflow-y-auto divide-y divide-slate-100">
                  {validationModal.errors.map((err, i) => (
                    <div key={i} className="py-2.5 text-xs">
                      <p className="font-black text-rose-800">Ошибка: {err.message}</p>
                      <p className="text-[11px] text-slate-500 font-bold mt-0.5">Решение: {err.recommendation}</p>
                      {err.blockId && (
                        <span className="inline-block mt-1 font-mono text-[10px] text-slate-400">Блок ID: {err.blockId}</span>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex justify-end pt-2 border-t border-slate-100">
                  <button
                    onClick={() => setValidationModal(null)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg"
                  >
                    Понятно, исправить
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* ------------------------------------------- */}
      {/* ИНТЕРАКТИВНОЕ ОБУЧЕНИЕ (ОБВЯЗКА ШАГ-ЗА-ШАГОМ) */}
      {/* ------------------------------------------- */}
      {tutorialStep !== null && (
        <div className="fixed inset-0 z-50 pointer-events-none select-none">
          {/* Полупрозрачная маска-затемнение с вырезом под подсвеченный элемент (spotlight) */}
          <div 
            className="absolute inset-0 bg-slate-950/40 transition-all duration-300 pointer-events-auto"
            onClick={() => setTutorialStep(null)} // Закрыть по клику на фон
          />

          {/* Подсвечивающий контур (Spotlight Aura) */}
          {tooltipPos && (tooltipPos.width !== 0 || tooltipPos.height !== 0) && (
            <div 
              style={{
                position: "fixed",
                top: tooltipPos.top - 6,
                left: tooltipPos.left - 6,
                width: tooltipPos.width + 12,
                height: tooltipPos.height + 12,
              }}
              className="rounded-xl border-[3px] border-emerald-400 shadow-[0_0_25px_rgba(52,211,153,0.7)] bg-transparent transition-all duration-300 pointer-events-none z-50 animate-pulse"
            />
          )}

          {/* Пузырь подсказки (Tooltip Card) */}
          <div 
            style={
              tooltipPos && (tooltipPos.top !== 0 || tooltipPos.left !== 0)
                ? (TUTORIAL_STEPS[tutorialStep].placement === "top"
                  ? {
                      position: "fixed",
                      top: Math.max(16, tooltipPos.top - 12),
                      left: Math.min(window.innerWidth - 340, Math.max(16, tooltipPos.left + (tooltipPos.width / 2) - 160)),
                      transform: "translateY(-100%)",
                    }
                  : {
                      position: "fixed",
                      top: Math.max(16, tooltipPos.top + tooltipPos.height + 12),
                      left: Math.min(window.innerWidth - 340, Math.max(16, tooltipPos.left + (tooltipPos.width / 2) - 160)),
                    })
                : {
                    position: "fixed",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                  }
            }
            className="w-[325px] bg-white text-slate-800 rounded-2xl border border-slate-200/80 p-5 shadow-[0_15px_40px_rgba(0,0,0,0.15)] pointer-events-auto transition-all duration-300 z-50"
          >
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 mb-3">
              <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100 uppercase tracking-widest">
                Тур {tutorialStep + 1} из {TUTORIAL_STEPS.length}
              </span>
              <button 
                onClick={() => setTutorialStep(null)}
                className="text-slate-400 hover:text-slate-600 text-xs font-black transition-colors cursor-pointer"
              >
                ✕ Пропустить
              </button>
            </div>

            <h4 className="text-sm font-black text-slate-900 leading-snug tracking-tight mb-1.5 flex items-center gap-1.5">
              <span>{TUTORIAL_STEPS[tutorialStep].title}</span>
            </h4>
            
            <p className="text-[11px] text-slate-500 font-medium leading-relaxed mb-4 text-justify">
              {TUTORIAL_STEPS[tutorialStep].desc}
            </p>

            <div className="flex justify-between items-center gap-2 pt-2 border-t border-slate-100">
              <button
                disabled={tutorialStep <= 0}
                onClick={() => setTutorialStep(prev => prev !== null ? prev - 1 : null)}
                className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-bold disabled:opacity-30 cursor-pointer shadow-2xs"
              >
                ← Назад
              </button>
              
              <button
                onClick={() => {
                  if (tutorialStep >= TUTORIAL_STEPS.length - 1) {
                    setTutorialStep(null);
                    showToast("🎓 Обучение успешно завершено! Теперь вы готовы управлять ботом.");
                  } else {
                    setTutorialStep(prev => prev !== null ? prev + 1 : null);
                  }
                }}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black cursor-pointer shadow-sm active:scale-95 transition-all text-center"
              >
                {tutorialStep >= TUTORIAL_STEPS.length - 1 ? "Завершить! 🎉" : "Далее →"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------- */}
      {/* ФЛОАТИНГ КНОПКА ГАЕЧНОГО КЛЮЧА НАСТРОЕК (🔧) */}
      {/* ------------------------------------------- */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setPanelMode(panelMode === "admin" ? "developer" : "admin")}
          className={`p-3.5 rounded-full shadow-lg border text-white transition-all transform active:scale-95 cursor-pointer ${
            panelMode === "developer" ? "bg-emerald-600 border-emerald-500 hover:bg-emerald-700" : "bg-slate-800 border-slate-700 hover:bg-slate-900 animate-pulse"
          }`}
          title={panelMode === "admin" ? "Перейти в панель разработчиков" : "Вернуться к основной панели"}
        >
          <Wrench className="h-5 w-5" />
        </button>
      </div>

    </div>
  );
}
