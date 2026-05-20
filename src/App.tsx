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
  AlertCircle
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
  type: "text" | "button" | "link" | "back" | "menu" | "pause" | "wait_button";
  text?: string;
  url?: string;
  seconds?: number;
  nextBlockId?: string | null;
  rightBlockId?: string | null;
}

interface ScenarioMenuButton {
  id: string;
  text: string;
  startBlockId?: string | null;
}

interface ScenarioConfig {
  telegramBotToken: string;
  contactLink: string;
  menu: ScenarioMenuButton[];
  blocks: Record<string, ScenarioBlock>;
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
        setScenario(conf);
        
        // Установка токена и ссылки для формы настроек
        setBotTokenInput(conf.telegramBotToken || "");
        setContactLinkInput(conf.contactLink || "");
        
        // Инициализируем историю
        setHistory([conf]);
        setHistoryIndex(0);
        setHasUnsavedChanges(data.hasDraft);

        if (conf.menu && conf.menu.length > 0) {
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
      text: type === "pause" ? "" : "Новая карточка. Отредактируйте текст...",
      seconds: type === "pause" ? 5 : undefined,
      url: type === "link" ? "https://" : undefined
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
    Object.values(blocksCopy).forEach((b) => {
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
    let parentRel: "next" | "right" | "menu" = "menu";

    // Пытаемся найти родительский блок
    Object.values(scenario.blocks).forEach((b) => {
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
      let grandRel: "next" | "right" | "menu" = "menu";

      Object.values(scenario.blocks).forEach((b) => {
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

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
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                  
                  {/* Левая боковая панель: Вкладки меню */}
                  <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-4">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                      <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide">Главное меню бота</h3>
                      <button 
                        onClick={() => setAddingMenuBtn(!addingMenuBtn)}
                        className="text-slate-400 hover:text-emerald-600 transition-colors"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Поле добавления новой инлайн кнопки меню */}
                    {addingMenuBtn && (
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/60 text-xs space-y-2">
                        <input
                          type="text"
                          placeholder="Название кнопки меню..."
                          value={newMenuBtnText}
                          onChange={(e) => setNewMenuBtnText(e.target.value)}
                          className="w-full px-2 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-emerald-400 focus:outline-none"
                        />
                        <div className="flex justify-end space-x-1">
                          <button
                            onClick={() => setAddingMenuBtn(false)}
                            className="px-2 py-1 border border-slate-200 text-slate-600 rounded bg-white"
                          >
                            Отмена
                          </button>
                          <button
                            onClick={handleAddMenuButton}
                            className="px-2 py-1 bg-emerald-600 text-white font-bold rounded"
                          >
                            Создать
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      {scenario.menu.map((btn) => {
                        const isSel = btn.id === selectedMenuId;
                        return (
                          <div 
                            key={btn.id}
                            className={`flex justify-between items-center group px-3 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              isSel ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "hover:bg-slate-50 text-slate-600"
                            }`}
                            onClick={() => setSelectedMenuId(btn.id)}
                          >
                            <span className="truncate max-w-[150px]">{btn.text}</span>
                            
                            {/* Удалить кнопку меню */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteMenuButton(btn.id);
                              }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-rose-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Правая рабочая область: Водопад Сценария */}
                  <div className="lg:col-span-3 space-y-4">
                    {selectedMenuBtn ? (
                      <div>
                        
                        {/* Изменение названия вкладки меню */}
                        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs mb-4 flex justify-between items-center">
                          <div className="flex-1 max-w-sm">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Редактируемый раздел меню:</label>
                            <input
                              type="text"
                              value={selectedMenuBtn.text}
                              onChange={(e) => {
                                const updated = scenario.menu.map((b) => 
                                  b.id === selectedMenuId ? { ...b, text: e.target.value } : b
                                );
                                updateScenarioState({ ...scenario, menu: updated });
                              }}
                              className="w-full font-bold text-md text-slate-800 border-none px-0 py-0 focus:ring-0 focus:outline-none"
                            />
                          </div>
                          
                          <div className="text-[11px] text-slate-400 font-medium">
                            Для этого раздела запущено прохождение сценария
                          </div>
                        </div>

                        {/* Список карточек водопада */}
                        <div className="space-y-4 relative pl-4 border-l border-slate-250">
                          {getOrderedWaterfall(selectedMenuBtn.startBlockId).map((blockId, index, array) => {
                            const block = scenario.blocks[blockId];
                            if (!block) return null;

                            return (
                              <div key={blockId} className="relative group">
                                <span className="absolute -left-[20px] top-4 w-2.5 h-2.5 rounded-full bg-slate-300 border-2 border-slate-50"></span>
                                
                                {/* ТИПИЗАЦИЯ КАРТОЧЕК */}
                                <div className={`p-4 bg-white rounded-xl border shadow-xs transition-all ${
                                  block.type === "text" ? "border-slate-200 hover:border-slate-300" :
                                  block.type === "button" ? "border-blue-200 bg-blue-50/10 hover:border-blue-300" :
                                  block.type === "link" ? "border-cyan-200 bg-cyan-50/10 hover:border-cyan-300" :
                                  block.type === "pause" ? "border-purple-200 bg-purple-50/10 hover:border-purple-300" :
                                  block.type === "wait_button" ? "border-rose-200 bg-rose-50/10 hover:border-rose-300" :
                                  "border-amber-200 bg-amber-50/10"
                                }`}>
                                  
                                  {/* Заголовок карточки с типом и экшенами */}
                                  <div className="flex justify-between items-center mb-3">
                                    <div className="flex items-center space-x-2">
                                      <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded tracking-widest ${
                                        block.type === "text" ? "bg-slate-100 text-slate-700 border border-slate-200" :
                                        block.type === "button" ? "bg-blue-100 text-blue-700 border border-blue-200" :
                                        block.type === "link" ? "bg-cyan-100 text-cyan-700 border border-cyan-200" :
                                        block.type === "pause" ? "bg-purple-100 text-purple-700 border border-purple-200" :
                                        block.type === "wait_button" ? "bg-rose-100 text-rose-700 border border-rose-200" :
                                        "bg-amber-100 text-amber-700 border border-amber-200"
                                      }`}>
                                        {block.type === "text" && "📝 Текст"}
                                        {block.type === "button" && "🔘 Кнопка-выбор"}
                                        {block.type === "link" && "🔗 Ссылка"}
                                        {block.type === "back" && "↩️ Назад"}
                                        {block.type === "menu" && "🏠 В главное меню"}
                                        {block.type === "pause" && "⏳ Пауза задержки"}
                                        {block.type === "wait_button" && "🚦 Ожидание действия"}
                                      </span>
                                      
                                      <span className="text-[10px] font-mono text-slate-400">ID: {block.id}</span>
                                    </div>

                                    {/* Action-кнопки управления карточкой */}
                                    <div className="flex items-center space-x-1">
                                      
                                      {/* Стрелочка вверх */}
                                      <button 
                                        onClick={() => handleMoveBlock(blockId, "up")}
                                        disabled={index === 0}
                                        className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded disabled:opacity-30"
                                      >
                                        <ArrowUp className="h-3.5 w-3.5" />
                                      </button>

                                      {/* Стрелочка вниз */}
                                      <button 
                                        onClick={() => handleMoveBlock(blockId, "down")}
                                        disabled={index === array.length - 1}
                                        className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded disabled:opacity-30"
                                      >
                                        <ArrowDown className="h-3.5 w-3.5" />
                                      </button>

                                      <div className="w-[1px] h-3 bg-slate-200" />

                                      {/* Удалить элемент */}
                                      <button 
                                        onClick={() => handleDeleteBlock(blockId)}
                                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </div>

                                  </div>

                                  {/* Специфические поля карточки */}
                                  <div className="space-y-3">
                                    
                                    {/* Текст / Описание / Кнопка */}
                                    {(block.type === "text" || block.type === "button" || block.type === "link" || block.type === "back" || block.type === "menu") && (
                                      <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                                          {block.type === "button" ? "Текст на кнопке" : "Текст сообщения"}
                                        </label>
                                        {block.type === "text" ? (
                                          <textarea
                                            value={block.text || ""}
                                            onChange={(e) => handleUpdateBlockField(blockId, { text: e.target.value })}
                                            rows={2}
                                            className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-400 leading-relaxed font-sans"
                                          />
                                        ) : (
                                          <input
                                            type="text"
                                            value={block.text || ""}
                                            onChange={(e) => handleUpdateBlockField(blockId, { text: e.target.value })}
                                            className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-400 font-bold"
                                          />
                                        )}
                                      </div>
                                    )}

                                    {/* Ссылка URL */}
                                    {block.type === "link" && (
                                      <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Ссылка для перехода (URL)</label>
                                        <input
                                          type="text"
                                          placeholder="https://example.com/file.pdf"
                                          value={block.url || ""}
                                          onChange={(e) => handleUpdateBlockField(blockId, { url: e.target.value })}
                                          className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-400 font-mono text-indigo-600"
                                        />
                                      </div>
                                    )}

                                    {/* Пауза в секундах */}
                                    {block.type === "pause" && (
                                      <div className="flex items-center space-x-3 bg-purple-50/40 p-2.5 rounded-lg border border-purple-100">
                                        <Clock className="h-5 w-5 text-purple-600 shrink-0" />
                                        <div className="flex-1 flex items-center space-x-2">
                                          <span className="text-xs font-bold text-purple-900">Задержка на:</span>
                                          <input
                                            type="number"
                                            min={1}
                                            value={block.seconds || 5}
                                            onChange={(e) => handleUpdateBlockField(blockId, { seconds: parseInt(e.target.value) || 5 })}
                                            className="w-16 text-xs text-center px-1 py-1 border border-purple-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-400 font-black text-purple-900"
                                          />
                                          <span className="text-xs text-purple-900 font-bold">сек</span>
                                        </div>
                                      </div>
                                    )}

                                  </div>

                                  {/* ПЛАШКА: Если кнопка разветвляется ВПРАВО (Button → rightBlockId) */}
                                  {block.type === "button" && (
                                    <div className="mt-3.5 pt-3 boundary-dashed-top border-t border-blue-100 flex flex-col md:flex-row gap-4 items-stretch">
                                      
                                      <div className="flex items-center space-x-1.5 shrink-0">
                                        <ChevronRight className="h-4 w-4 text-blue-500" />
                                        <span className="text-[10px] font-black text-blue-700 tracking-wider">ПЕРЕХОД НАПРАВО:</span>
                                      </div>

                                      <div className="flex-1 bg-white p-3 rounded-xl border border-blue-100/80 shadow-xs">
                                        {block.rightBlockId ? (
                                          <div className="flex justify-between items-center text-xs">
                                            <div className="flex items-center space-x-1.5 font-bold text-blue-900">
                                              <span>👉 Ветка ID:</span>
                                              <span className="font-mono bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded">{block.rightBlockId}</span>
                                            </div>
                                            <button
                                              onClick={() => {
                                                if (window.confirm("Удалить горизонтальную связь со списком правых элементов? Сценарии не удалятся, они останутся висеть в БД.")) {
                                                  handleUpdateBlockField(blockId, { rightBlockId: null });
                                                }
                                              }}
                                              className="text-[10px] font-black text-rose-600 hover:underline"
                                            >
                                              Разорвать
                                            </button>
                                          </div>
                                        ) : (
                                          <div className="flex justify-between items-center text-[11px] text-slate-400 font-medium">
                                            <span>Кнопка работает как Чекбокс-галочка.</span>
                                            <button
                                              onClick={() => setActiveAddPopover({ blockId: block.id, relation: "right" })}
                                              className="text-xs font-black text-blue-600 hover:underline inline-flex items-center"
                                            >
                                              <Plus className="h-3 w-3 mr-1" /> Присоединить ветку
                                            </button>
                                          </div>
                                        )}
                                      </div>

                                    </div>
                                  )}

                                </div>

                                {/* ПОДВЕСКА ДОБАВЛЕНИЯ БЛОКА ВНИЗУ (МЕЖДУ КАРТОЧКАМИ) */}
                                <div className="h-8 flex justify-center items-center relative">
                                  <div className="w-[1px] h-full bg-slate-300"></div>
                                  <button
                                    className="absolute p-1 bg-white hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 border border-slate-300 hover:border-emerald-300 rounded-full shadow-xs transition-all opacity-0 group-hover:opacity-100 z-10 cursor-pointer"
                                    onClick={() => setActiveAddPopover({ blockId: block.id, relation: "next" })}
                                  >
                                    <Plus className="h-3 w-3" />
                                  </button>
                                </div>

                              </div>
                            );
                          })}
                        </div>

                      </div>
                    ) : (
                      <div className="p-12 text-center bg-white border border-slate-200 rounded-xl">
                        Создайте или выберите вкладку главного меню слева.
                      </div>
                    )}
                  </div>

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
                onClick={() => handleAddBlock(activeAddPopover.blockId, activeAddPopover.relation, "wait_button")}
                className="flex items-center space-x-2.5 p-2 bg-slate-50 hover:bg-rose-50 text-slate-700 hover:text-rose-700 font-bold rounded-lg transition-colors border border-slate-200"
              >
                <span>🚦</span>
                <span>Ожидание нажатия кнопок</span>
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
