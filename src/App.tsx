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
  type: "text" | "button" | "link" | "back" | "menu" | "pause" | "wait_button" | "file" | "audio" | "menu_return";
  text?: string;
  url?: string;
  seconds?: number;
  isOnce?: boolean;
  nextBlockId?: string | null;
  rightBlockId?: string | null;
}

interface MenuReturnSettings {
  text: string;
  buttonBlockIds: string[];
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
  menuReturnSettings?: MenuReturnSettings;
}

interface ScenarioError {
  blockId?: string;
  blockText?: string;
  message: string;
  recommendation: string;
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

  // Режим экрана: "admin" (основная) или "developer" (патчи / логи)
  const [panelMode, setPanelMode] = useState<"admin" | "developer">("admin");
  const [adminTab, setAdminTab] = useState<"constructor" | "settings" | "clients">("constructor");
  const [devTab, setDevTab] = useState<"status" | "logs" | "guide">("status");

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
  const canvasRef = useRef<HTMLDivElement>(null);

  // Обработка Zoom через колесико (с привязкой к курсору)
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      // Предотвращаем стандартный скролл страницы и масштабирование браузера
      e.preventDefault();

      const rect = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const zoomDelta = e.deltaY * -0.0012;

      setZoom((prevZoom) => {
        const newZoom = Math.min(Math.max(0.15, prevZoom + zoomDelta), 2.5);
        if (newZoom === prevZoom) return prevZoom;

        setPan((prevPan) => {
          const canvasX = (mouseX - prevPan.x) / prevZoom;
          const canvasY = (mouseY - prevPan.y) / prevZoom;

          return {
            x: mouseX - canvasX * newZoom,
            y: mouseY - canvasY * newZoom
          };
        });

        return newZoom;
      });
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, []);

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
    const newBlock: ScenarioBlock = {
      id: newId,
      type: type,
      text: type === "pause" ? "" : (type === "file" ? "Прикрепленный файл" : type === "audio" ? "Аудиозапись" : "Новая карточка. Отредактируйте текст..."),
      seconds: type === "pause" ? 5 : undefined,
      url: type === "link" ? "https://" : (type === "file" || type === "audio") ? "" : undefined
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
    updatedBlocks[blockId] = {
      ...updatedBlocks[blockId],
      ...fields
    };

    updateScenarioState({
      ...scenario,
      blocks: updatedBlocks
    });
  };

  // ЗАГРУЗКА МЕДИАФАЙЛОВ И ДОКУМЕНТОВ НА СЕРВЕР И ПРИВЯЗКА К КАРТОЧКЕ
  const handleFileUploadAsync = async (file: File, blockId: string) => {
    try {
      const formData = new FormData();
      formData.append("file", file);

      showToast("Загрузка файла...");
      
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${authToken}`
        },
        body: formData
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "Unknown error" }));
        showToast(`Ошибка загрузки: ${errData.error || res.statusText}`);
        return;
      }

      const result = await res.json();
      if (result.success && result.url) {
        handleUpdateBlockField(blockId, { url: result.url });
        const b = scenario?.blocks?.[blockId];
        if (b && !b.text) {
          handleUpdateBlockField(blockId, { text: result.name });
        }
        showToast("Файл успешно загружен!");
      }
    } catch (e: any) {
      showToast(`Не удалось загрузить файл: ${e.message || e}`);
    }
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
          <div className="flex justify-between h-16 items-center">
            
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
              <div className="hidden md:flex space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  onClick={() => setAdminTab("constructor")}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    adminTab === "constructor" ? "bg-white text-emerald-600 shadow-xs border border-slate-200" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  🧩 Конструктор сценариев
                </button>
                <button
                  onClick={() => setAdminTab("clients")}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    adminTab === "clients" ? "bg-white text-emerald-600 shadow-xs border border-slate-200" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  👥 Клиенты в боте ({status?.sessionCount || 0})
                </button>
                <button
                  onClick={() => setAdminTab("settings")}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    adminTab === "settings" ? "bg-white text-emerald-600 shadow-xs border border-slate-200" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  ⚙️ Настройки системы
                </button>
              </div>
            )}

            {/* Вкладки Режима Разработчика */}
            {panelMode === "developer" && (
              <div className="hidden md:flex space-x-1 bg-slate-900 p-1 rounded-xl border border-slate-950">
                <button
                  onClick={() => setDevTab("status")}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    devTab === "status" ? "bg-slate-800 text-emerald-400 border border-slate-700" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  📊 Статус сервера
                </button>
                <button
                  onClick={() => setDevTab("logs")}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    devTab === "logs" ? "bg-slate-800 text-emerald-400 border border-slate-700" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  💻 Консоль вызовов
                </button>
                <button
                  onClick={() => setDevTab("guide")}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    devTab === "guide" ? "bg-slate-800 text-emerald-400 border border-slate-700" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  📓 Справка Ubuntu 24
                </button>
              </div>
            )}

            {/* Выход */}
            <div className="flex items-center space-x-2">
              <button 
                onClick={handleLogout}
                className="inline-flex items-center px-3 py-1.5 border border-rose-200 text-xs font-bold rounded-lg bg-white hover:bg-rose-50 text-rose-600 focus:outline-none transition-all duration-200 cursor-pointer"
              >
                Выйти
              </button>
            </div>

          </div>
        </div>
      </header>

      <main className={`${adminTab === "constructor" && panelMode === "admin" ? "w-full" : "max-w-7xl mx-auto"} px-4 sm:px-6 lg:px-8 py-6`}>

        {/* ТОСТЕР-УВЕДОМЛЕНИЕ */}
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 bg-slate-900 border border-slate-800 text-slate-100 text-xs font-bold px-6 py-3 rounded-xl shadow-lg flex items-center space-x-2.5"
            >
              <Check className="h-4 w-4 text-emerald-500" />
              <span>{toastMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ОШИБКА TELEGRAM ТОКЕНА */}
        {status && !status.hasToken && (
          <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 mb-6 flex flex-col md:flex-row md:items-center justify-between">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="h-5 w-5 text-rose-500 shrink-0" />
              <div>
                <h4 className="text-xs font-bold text-rose-900">Токен Telegram бота отсутствует!</h4>
                <p className="text-[11px] text-rose-700 mt-0.5">Пожалуйста, ведите ваш Bot Token из @BotFather на вкладке «Настройки системы», чтобы запустить живой цикл бота.</p>
              </div>
            </div>
            <button 
              onClick={() => { setAdminTab("settings"); setPanelMode("admin"); }}
              className="mt-3 md:mt-0 text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold py-1.5 px-3 rounded-lg shadow-xs transition-colors"
            >
              Ввести токен
            </button>
          </div>
        )}

        {/* ------------------------------------------- */}
        {/* РЕЖИМ 1: ОСНОВНАЯ АДМИНКА (АДМИНИСТРАТОР) */}
        {/* ------------------------------------------- */}
        {panelMode === "admin" && (
          <div>
            
            {/* ВКЛАДКА: КОНСТРУКТОР СЦЕНАРИЕВ */}
            {adminTab === "constructor" && scenario && (
              <div className="space-y-6">
                
                {/* Тулбар конструктора */}
                <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="flex items-center space-x-3">
                    <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Инструменты конструктора:</span>
                    {hasUnsavedChanges ? (
                      <span className="inline-flex items-center text-[10px] bg-amber-50 text-amber-700 px-2.5 py-0.5 font-bold rounded-md border border-amber-100">
                        <AlertCircle className="h-3 w-3 mr-1 animate-pulse" /> Несохраненный черновик
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-[10px] bg-emerald-50 text-emerald-700 px-2.5 py-0.5 font-bold rounded-md border border-emerald-100">
                        <Check className="h-3 w-3 mr-1" /> Актуален с боевым
                      </span>
                    )}

                    {isSavingDraft && (
                      <span className="text-[10px] text-slate-400 font-medium animate-pulse">автосохранение...</span>
                    )}
                  </div>

                  {/* Кнопки отката Undo/Redo/Validate/Deploy */}
                  <div className="flex flex-wrap gap-2">
                    
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

                    <button
                      onClick={handleValidateDraft}
                      className="inline-flex items-center px-3 py-1.5 border border-slate-200 text-xs font-bold rounded-lg bg-white hover:bg-slate-50 text-slate-700 cursor-pointer transition-all"
                    >
                      🔍 Проверить черновик
                    </button>

                    <button
                      onClick={handleValidateDraft}
                      className="inline-flex items-center px-4 py-1.5 border border-transparent shadow-xs text-xs font-black rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer transition-all"
                    >
                      🚀 Опубликовать в бот
                    </button>

                  </div>
                </div>

                {/* Основная рабочая сетка */}
                <div className="flex-1 mt-4 relative h-[calc(100vh-180px)]">
                  
                  {(() => {
                    const coords: Record<string, { row: number; col: number }> = {};
                    const visited = new Set<string>();
                    
                    // Находим корневые элементы (на которые никто не ссылается)
                    const inDegree: Record<string, number> = {};
                    Object.keys(scenario.blocks).forEach(id => inDegree[id] = 0);
                    
                    Object.values(scenario.blocks).forEach((b: ScenarioBlock) => {
                      if (b.nextBlockId) inDegree[b.nextBlockId] = (inDegree[b.nextBlockId] || 0) + 1;
                      if (b.rightBlockId) inDegree[b.rightBlockId] = (inDegree[b.rightBlockId] || 0) + 1;
                      if (b.type === 'menu' || b.type === 'menu_return') {
                        scenario.menu.forEach(m => {
                          if (m.startBlockId) {
                            inDegree[m.startBlockId] = (inDegree[m.startBlockId] || 0) + 1;
                          }
                        });
                      }
                    });

                    let currentRow = 0;

                    // Рекурсивный автоматический расчет сетки связей 2D
                    function place(id: string | null | undefined, r: number, c: number) {
                      if (!id || !scenario || visited.has(id)) return;
                      visited.add(id);

                      let finalR = r;
                      let finalC = c;
                      
                      // Защита от наложения карточек друг на друга
                      while (Object.values(coords).some(p => p.row === finalR && p.col === finalC)) {
                        finalC += 1;
                      }

                      coords[id] = { row: finalR, col: finalC };

                      const b = scenario.blocks[id];
                      if (b) {
                        if (b.rightBlockId) {
                          place(b.rightBlockId, finalR, finalC + 1);
                        }
                        if (b.nextBlockId) {
                          place(b.nextBlockId, finalR + 1, finalC);
                        }
                        if (b.type === 'menu' || b.type === 'menu_return') {
                          let menuC = finalC;
                          scenario.menu.forEach(m => {
                            if (m.startBlockId) {
                              place(m.startBlockId, finalR + 1, menuC);
                              menuC += 1;
                            }
                          });
                        }
                      }
                      
                      if (finalR > currentRow) {
                        currentRow = finalR;
                      }
                    }

                    // 1. Сначала размещаем стартовый блок
                    let rootRowOffset = 0;
                    
                    if (scenario.startBlockId && !visited.has(scenario.startBlockId)) {
                      place(scenario.startBlockId, rootRowOffset, 0);
                      rootRowOffset = currentRow + 2;
                    }

                    // 2. Затем размещаем остальные корневые блоки
                    Object.keys(inDegree).forEach(id => {
                      if (inDegree[id] === 0 && !visited.has(id)) {
                        place(id, rootRowOffset, 0);
                        rootRowOffset = currentRow + 2;
                      }
                    });

                    // 3. Выстраиваем оставшиеся потерянные («сиротские») блоки
                    let maxCol = 0;
                    Object.values(coords).forEach(p => {
                      if (p.col > maxCol) maxCol = p.col;
                    });

                    let orphanRow = 0;
                    Object.keys(scenario.blocks).forEach(id => {
                      if (!visited.has(id)) {
                        coords[id] = { row: orphanRow, col: maxCol + 2 };
                        orphanRow += 1;
                      }
                    });

                    // Базовая геометрия
                    const cardWidth = 280;
                    const cardHeight = 135;
                    const colWidth = 370;
                    const rowHeight = 220;

                    return (
                      <div className="flex flex-col lg:flex-row gap-5 items-stretch h-full w-full">
                        
                        {/* ЗАБОР КАНВАСА РИСОВАНИЯ */}
                        <div 
                          ref={canvasRef}
                          className="flex-1 bg-slate-50 relative overflow-hidden border border-slate-200 rounded-2xl select-none touch-none shadow-sm"
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

                                      // Связи ко всем рут-поинтам пунктов меню у блока "menu"
                                      if (block.type === 'menu') {
                                        scenario.menu.forEach((m, idx) => {
                                          if (m.startBlockId && coords[m.startBlockId]) {
                                            const rp = coords[m.startBlockId];
                                            const startX = x + cardWidth / 4 + (cardWidth / 2) * (idx / Math.max(1, scenario.menu.length));
                                            const startY = y + cardHeight;
                                            const endX = rp.col * colWidth + 40 + cardWidth / 2;
                                            const endY = rp.row * rowHeight + 40;
                                            lines.push(
                                              <g key={`${id}-to-menu-${m.id}`} className="opacity-40 hover:opacity-90 transition-opacity">
                                                <path 
                                                  d={getBezierPath(startX, startY, endX, endY, false)} 
                                                  fill="none" 
                                                  stroke="#f59e0b" 
                                                  strokeWidth="2"
                                                  strokeDasharray="6 6"
                                                  markerEnd="url(#arrow-menu)" 
                                                />
                                              </g>
                                            );
                                          }
                                        });
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
                                    const isOrphan = !visited.has(id);

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
                                          block.type === 'menu_return' ? 'bg-emerald-100 border-emerald-200 text-emerald-900 font-black' :
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
                                              {block.type === 'menu_return' && "🔄"}
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
                                              {block.type === 'menu' && "Главное меню"}
                                              {block.type === 'menu_return' && "Настр. Меню"}
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
                                        {block.type !== 'menu_return' && block.type !== 'menu' && block.type !== 'back' && (
                                          <button
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
                                return (
                                  <motion.div 
                                    initial={{ opacity: 0, x: 25 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="w-full lg:w-[320px] bg-white rounded-2xl border border-slate-200 p-4 shrink-0 flex flex-col justify-between overflow-y-auto"
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
                                          onChange={(e) => handleUpdateBlockField(activeBlock.id, { type: e.target.value as ScenarioBlock["type"] })}
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
                                          <option value="menu_return">🔄 Настр. «Вернуться в меню»</option>
                                          <option value="wait_button">🚦 Ожидание клика</option>
                                        </select>
                                      </div>

                                      {/* 2. Текст сообщения / кнопка */}
                                      {(activeBlock.type === "text" || activeBlock.type === "button" || activeBlock.type === "link" || activeBlock.type === "back" || activeBlock.type === "menu" || activeBlock.type === "menu_return") && (
                                        <div>
                                          <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                            {activeBlock.type === "button" ? "Текст кнопки выбора" : (activeBlock.type === "menu_return" ? "Название кнопки" : "Отправляемый текст сообщения")}
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
                                              placeholder={activeBlock.type === "menu_return" ? "Вернуться в меню" : "Текст на кнопке"}
                                              className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-400 text-slate-700 font-bold"
                                            />
                                          )}
                                        </div>
                                      )}

                                      {/* 2.6 Глобальные настройки кнопки Вернуться в меню (singleton) */}
                                      {(activeBlock.type === "menu_return" || activeBlock.type === "menu") && scenario.menuReturnSettings && (
                                        <div className="space-y-3 bg-emerald-50/50 p-3 rounded-xl border border-emerald-100">
                                          <div className="flex items-center justify-between">
                                            <h5 className="text-[10px] font-black text-emerald-800 uppercase tracking-widest leading-none">Общие настройки возврата:</h5>
                                            <Wrench className="w-3 h-3 text-emerald-400" />
                                          </div>
                                          <div>
                                            <label className="block text-[8px] font-bold text-emerald-700 uppercase mb-1">Сообщение пользователю при возврате:</label>
                                            <textarea 
                                              value={scenario.menuReturnSettings.text}
                                              rows={3}
                                              onChange={(e) => {
                                                const newSettings = { ...scenario.menuReturnSettings!, text: e.target.value };
                                                updateScenarioState({ ...scenario, menuReturnSettings: newSettings });
                                              }}
                                              placeholder="Сделай выбор..."
                                              className="w-full text-[10px] px-2 py-1.5 border border-emerald-200 rounded-lg bg-white text-slate-700 font-medium focus:ring-1 focus:ring-emerald-400 focus:outline-none"
                                            />
                                          </div>
                                          <div className="pt-2 border-t border-emerald-100/50">
                                            <label className="block text-[8px] font-bold text-emerald-700 uppercase mb-1.5">ID блоков для кнопок меню (Reply):</label>
                                            <div className="space-y-2">
                                              {scenario.menuReturnSettings.buttonBlockIds.map((idVal, idx) => (
                                                <div key={idx} className="flex items-center space-x-1">
                                                  <input 
                                                    type="text"
                                                    value={idVal}
                                                    onChange={(e) => {
                                                      const newIds = [...scenario.menuReturnSettings!.buttonBlockIds];
                                                      newIds[idx] = e.target.value;
                                                      updateScenarioState({ 
                                                        ...scenario, 
                                                        menuReturnSettings: { ...scenario.menuReturnSettings!, buttonBlockIds: newIds }
                                                      });
                                                    }}
                                                    placeholder="wb_q3_b1"
                                                    className="flex-1 text-[10px] px-2 py-1 border border-emerald-200 rounded bg-white font-mono focus:ring-1 focus:ring-emerald-400 focus:outline-none"
                                                  />
                                                  <button 
                                                    onClick={() => {
                                                      const newIds = scenario.menuReturnSettings!.buttonBlockIds.filter((_, i) => i !== idx);
                                                      updateScenarioState({ 
                                                        ...scenario, 
                                                        menuReturnSettings: { ...scenario.menuReturnSettings!, buttonBlockIds: newIds }
                                                      });
                                                    }}
                                                    className="p-1 text-rose-400 hover:bg-rose-50 hover:text-rose-600 rounded transition-colors"
                                                  >
                                                    <Trash2 className="w-3 h-3" />
                                                  </button>
                                                </div>
                                              ))}
                                              <button 
                                                onClick={() => {
                                                  updateScenarioState({ 
                                                    ...scenario, 
                                                    menuReturnSettings: { 
                                                      ...scenario.menuReturnSettings!, 
                                                      buttonBlockIds: [...scenario.menuReturnSettings!.buttonBlockIds, ""] 
                                                    }
                                                  });
                                                }}
                                                className="w-full py-1.5 border border-dashed border-emerald-300 rounded-lg text-[10px] font-bold text-emerald-600 hover:bg-emerald-100/50 flex items-center justify-center space-x-1.5 cursor-pointer"
                                              >
                                                <Plus className="w-3 h-3" />
                                                <span>Добавить ID блока</span>
                                              </button>
                                            </div>
                                            <p className="text-[8px] text-emerald-600 mt-2 italic font-bold">* Данные настройки применятся ко ВСЕМ блокам этого типа в сценарии</p>
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
                                        <div className="space-y-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                                          <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                            {activeBlock.type === "link" ? "Веб-ссылка перехода (URL):" : "Ссылка или путь к файлу:"}
                                          </label>
                                          <input
                                            type="text"
                                            placeholder={activeBlock.type === "link" ? "https://" : "/uploads/file или https://"}
                                            value={activeBlock.url || ""}
                                            onChange={(e) => handleUpdateBlockField(activeBlock.id, { url: e.target.value })}
                                            className="w-full text-[11px] px-2.5 py-1.5 border border-slate-200 bg-white rounded-lg font-mono text-indigo-650 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                                          />

                                          {(activeBlock.type === "file" || activeBlock.type === "audio") && (
                                            <div className="pt-2 border-t border-slate-200">
                                              <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Загрузить файл с компьютера:</span>
                                              <label className="flex items-center justify-center border border-dashed border-slate-350 bg-white rounded-lg p-2 hover:bg-emerald-50 hover:border-emerald-400 transition-colors cursor-pointer select-none">
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
                                                <div className="flex items-center space-x-1.5 text-[10px] font-extrabold text-slate-650 hover:text-emerald-700">
                                                  <span>📤 Выбрать и загрузить...</span>
                                                </div>
                                              </label>
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
                                      {activeBlock.type !== 'menu_return' && activeBlock.type !== 'menu' && activeBlock.type !== 'back' && (
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
                                      )}

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
                onClick={() => handleAddBlock(activeAddPopover.blockId, activeAddPopover.relation, "menu_return")}
                className="flex items-center space-x-2.5 p-2 bg-slate-50 hover:bg-emerald-100 text-slate-700 hover:text-emerald-800 font-bold rounded-lg transition-colors border border-slate-200"
              >
                <span>🔄</span>
                <span>Настраиваемая «Вернуться в меню»</span>
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
