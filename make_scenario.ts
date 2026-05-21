import fs from 'fs';
import { encryptToken, ScenarioConfig, ScenarioMenuButton, ScenarioBlock } from './src/scenarioManager';

const navButtons = ["nav_btn_1", "nav_btn_2", "nav_btn_3", "nav_btn_4", "nav_btn_5", "nav_btn_6"];

function createMenuBlock(id: string): ScenarioBlock {
  return {
    id,
    type: "menu",
    text: "Вернуться в меню",
    menuMessageText: "Сделай свой выбор ⬇️",
    menuAttachedBlocks: navButtons
  };
}

const config: ScenarioConfig = {
  telegramBotToken: "",
  contactLink: "https://t.me/ibanezebi64",
  startBlockId: "welcome_1",
  menu: [
    { id: "menu_start", text: "Старт", startBlockId: "welcome_1" },
    { id: "menu_return", text: "Вернуться в меню", startBlockId: "menu_return_msg" }
  ],
  blocks: {
    "welcome_1": {
      id: "welcome_1",
      type: "text",
      text: "Привет. Рада, что ты здесь🤍\n\nЯ Алёна — психолог-СоПутница. Помогаю мягко распутать то, что внутри давно накопилось. Без давления и осуждения.\n\nПрежде чем отдам тебе шаги - инструменты, я хочу понять, что сейчас происходит внутри. Два ключевых вопроса, которые помогут подобрать решение именно под тебя.\n\nЭто место — безопасное. Можно выдохнуть.",
      nextBlockId: "welcome_pause_1"
    },
    "welcome_pause_1": {
      id: "welcome_pause_1",
      type: "pause",
      seconds: 15,
      nextBlockId: "question_1"
    },
    "question_1": {
      id: "question_1",
      type: "text",
      text: "Скажи честно — что из этого сейчас про тебя?",
      nextBlockId: "q1_btn_1"
    },
    "q1_btn_1": { id: "q1_btn_1", type: "button", text: "😮‍💨 Устала, но продолжаю тянуть", isOnce: true, nextBlockId: "q1_btn_2" },
    "q1_btn_2": { id: "q1_btn_2", type: "button", text: "😶 Всё серое — и не знаю почему", isOnce: true, nextBlockId: "q1_btn_3" },
    "q1_btn_3": { id: "q1_btn_3", type: "button", text: "😰 Тревога, которая не отпускает", isOnce: true, nextBlockId: "q1_btn_4" },
    "q1_btn_4": { id: "q1_btn_4", type: "button", text: "💭Не понимаю себя и что со мной", isOnce: true, nextBlockId: "q1_btn_5" },
    "q1_btn_5": { id: "q1_btn_5", type: "button", text: "🌀 Всё сразу", isOnce: true, nextBlockId: "q1_wait" },
    "q1_wait": {
      id: "q1_wait",
      type: "wait_button",
      nextBlockId: "question_2"
    },

    "question_2": {
      id: "question_2",
      type: "text",
      text: "А внутри чаще всего звучит что-то из этого?",
      nextBlockId: "q2_btn_1"
    },
    "q2_btn_1": { id: "q2_btn_1", type: "button", text: "«Я просто ленивая»", isOnce: true, nextBlockId: "q2_btn_2" },
    "q2_btn_2": { id: "q2_btn_2", type: "button", text: "«Надо взять себя в руки»", isOnce: true, nextBlockId: "q2_btn_3" },
    "q2_btn_3": { id: "q2_btn_3", type: "button", text: "«У других всё нормально — только у меня так»", isOnce: true, nextBlockId: "q2_btn_4" },
    "q2_btn_4": { id: "q2_btn_4", type: "button", text: "«Я не знаю, чего хочу»", isOnce: true, nextBlockId: "q2_wait" },
    "q2_wait": {
      id: "q2_wait",
      type: "wait_button",
      nextBlockId: "welcome_final"
    },

    "welcome_final": {
      id: "welcome_final",
      type: "text",
      text: "Слышу тебя 🩶\nВсё это — не слабость и не лень. Это сигнал. Тело и душа просят опоры.\nВыбери, с чего хочешь начать ⬇️",
      nextBlockId: "nav_btn_1"
    },
    "nav_btn_1": { id: "nav_btn_1", type: "button", text: "ДНЕВНИК МИКРО-ПОБЕД — Гайд", rightBlockId: "branch_1_start", nextBlockId: "nav_btn_2" },
    "nav_btn_2": { id: "nav_btn_2", type: "button", text: "АУДИО ВРЕМЯ — музыка", rightBlockId: "branch_2_start", nextBlockId: "nav_btn_3" },
    "nav_btn_3": { id: "nav_btn_3", type: "button", text: "УПРАЖНЕНИЕ   —  техники", rightBlockId: "branch_3_start", nextBlockId: "nav_btn_4" },
    "nav_btn_4": { id: "nav_btn_4", type: "button", text: "ОПОРА", rightBlockId: "branch_4_start", nextBlockId: "nav_btn_5" },
    "nav_btn_5": { id: "nav_btn_5", type: "button", text: "ХОЧУ — Челленджи", rightBlockId: "branch_5_start", nextBlockId: "nav_btn_6" },
    "nav_btn_6": { id: "nav_btn_6", type: "button", text: "🩶 ГРУППА «ПЕРЕРОЖДЕНИЕ»", rightBlockId: "branch_6_start", nextBlockId: "nav_wait" },
    "nav_wait": {
      id: "nav_wait",
      type: "wait_button",
    },

    // BRANCH 1
    "branch_1_start": {
      id: "branch_1_start",
      type: "text",
      text: "<b>ДНЕВНИК МИКРО-ПОБЕД — Гайд</b>",
      nextBlockId: "b1_btn_1"
    },
    "b1_btn_1": { id: "b1_btn_1", type: "button", text: "1 - Гайд легализации бездействия🩶", rightBlockId: "b1_msg" },
    "b1_msg": {
      id: "b1_msg",
      type: "text",
      text: "Сначала — одна мысль.\nБездействие это не провал. Иногда это кажется большим, на то, что хватает силы. И это честно.\nВнутри дневника — маленькие шаги. Таких, чтобы не надо было «брать себя в руки».\nПросто — чуть бережнее к себе. День за днём.",
      nextBlockId: "b1_doc"
    },
    "b1_doc": {
      id: "b1_doc",
      type: "file",
      text: "Дневник",
      url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
      nextBlockId: "b1_pause"
    },
    "b1_pause": {
      id: "b1_pause",
      type: "pause",
      seconds: 10,
      nextBlockId: "b1_final"
    },
    "b1_final": {
      id: "b1_final",
      type: "text",
      text: "Надеюсь, он станет твоим маленьким другом \nЕсли почувствуешь, что хочется глубже — я рядом. В июне открываю живую группу «Перерождение». Напиши мне — поговорим подробнее.",
      nextBlockId: "b1_link"
    },
    "b1_link": { id: "b1_link", type: "link", text: "Написать", url: "https://t.me/placeholder", nextBlockId: "b1_menu" },
    "b1_menu": createMenuBlock("b1_menu"),

    // BRANCH 2
    "branch_2_start": {
      id: "branch_2_start",
      type: "text",
      text: "<b>Аудио библиотека</b>\nВключай — и просто побудь. Ничего делать не нужно.\nЭто твои несколько минут только для тебя.",
      nextBlockId: "b2_audio"
    },
    "b2_audio": {
      id: "b2_audio",
      type: "audio",
      text: "Аудио медитация",
      url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
      nextBlockId: "b2_pause"
    },
    "b2_pause": {
      id: "b2_pause",
      type: "pause",
      seconds: 10,
      nextBlockId: "b2_final"
    },
    "b2_final": {
      id: "b2_final",
      type: "text",
      text: "Побудь в этом состоянии чуть дольше \nА если захочешь — загляни в другие материалы. Там есть реальность, дневник и кое-что ещё ⬇️",
      nextBlockId: "b2_menu"
    },
    "b2_menu": createMenuBlock("b2_menu"),

    // BRANCH 3
    "branch_3_start": {
      id: "branch_3_start",
      type: "text",
      text: "<b>УПРАЖНЕНИЕ   —  техники</b>",
      nextBlockId: "b3_btn_1"
    },
    "b3_btn_1": { id: "b3_btn_1", type: "button", text: "«Квадрат Дыхания»  аудио", rightBlockId: "b3_msg" },
    "b3_msg": {
      id: "b3_msg",
      type: "text",
      text: "Упражнение за 2 минуты успокаивает нервную систему.\nВключай прямо сейчас. Можно лёжа.",
      nextBlockId: "b3_audio"
    },
    "b3_audio": {
      id: "b3_audio",
      type: "audio",
      text: "Квадрат дыхания",
      url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
      nextBlockId: "b3_pause"
    },
    "b3_pause": {
      id: "b3_pause",
      type: "pause",
      seconds: 7,
      nextBlockId: "b3_final"
    },
    "b3_final": {
      id: "b3_final",
      type: "text",
      text: "Как ты? \nСохрани аудио — и возвращайся каждый раз, когда найдешь. Это работает.\nЕсли хочешь понять глубже — почему тревога возвращается снова и снова — напиши мне. Поговорим.",
      nextBlockId: "b3_link"
    },
    "b3_link": { id: "b3_link", type: "link", text: "Написать", url: "https://t.me/placeholder", nextBlockId: "b3_menu" },
    "b3_menu": createMenuBlock("b3_menu"),

    // BRANCH 4
    "branch_4_start": {
      id: "branch_4_start",
      type: "text",
      text: "<b>ОПОРА</b>",
      nextBlockId: "b4_btn_1"
    },
    "b4_btn_1": { id: "b4_btn_1", type: "button", text: "1 - Маркер Тревоги", rightBlockId: "b4_marker_msg", nextBlockId: "b4_btn_2" },
    "b4_btn_2": { id: "b4_btn_2", type: "button", text: "2 - Фразы Поддержка", rightBlockId: "b4_phrases_msg", nextBlockId: "b4_wait" },
    "b4_wait": { id: "b4_wait", type: "wait_button" },
    
    // 4.1
    "b4_marker_msg": {
      id: "b4_marker_msg",
      type: "text",
      text: "<b>Маркер Тревоги</b>\nЭтот простой инструмент — поможет понять, что сейчас происходит внутри. Тревога ,страх или апатия.\nКогда узнаешь — становится чуть легче. Уже не «со мной что-то не так», а просто — вот что сейчас есть.",
      nextBlockId: "b4_marker_doc"
    },
    "b4_marker_doc": { id: "b4_marker_doc", type: "file", text: "Маркер Тревоги", url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf", nextBlockId: "b4_marker_pause" },
    "b4_marker_pause": { id: "b4_marker_pause", type: "pause", seconds: 10, nextBlockId: "b4_marker_final" },
    "b4_marker_final": { id: "b4_marker_final", type: "text", text: "Теперь ты знаешь чуть больше о себе. \nЭто уже немаловажно. Если хочешь — следующий шаг: реальный Квадрат. Оно помогает прямо в данный момент.", nextBlockId: "b4_marker_menu" },
    "b4_marker_menu": createMenuBlock("b4_marker_menu"),

    // 4.2
    "b4_phrases_msg": {
      id: "b4_phrases_msg",
      type: "text",
      text: "<b>Фразы Поддержка</b>\nСтань переводчиком для своего ребенка.\n12 фраз которые открывают диалог без давления и осуждения.",
      nextBlockId: "b4_phrases_doc"
    },
    "b4_phrases_doc": { id: "b4_phrases_doc", type: "file", text: "Фразы Поддержка", url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf", nextBlockId: "b4_phrases_pause" },
    "b4_phrases_pause": { id: "b4_phrases_pause", type: "pause", seconds: 10, nextBlockId: "b4_phrases_final" },
    "b4_phrases_final": { id: "b4_phrases_final", type: "text", text: "Возвращайся к ним в любой момент \nИ помни — слова работают, когда мы готовы их услышать. Сегодня ты была готова.\nЕсли захочется большего — я здесь. Живая группа «Перерождение» всегда открыта.", nextBlockId: "b4_phrases_menu" },
    "b4_phrases_menu": createMenuBlock("b4_phrases_menu"),

    // BRANCH 5
    "branch_5_start": {
      id: "branch_5_start",
      type: "text",
      text: "<b>ХОЧУ — Челленджи</b>",
      nextBlockId: "b5_btn_1"
    },
    "b5_btn_1": { id: "b5_btn_1", type: "button", text: "7 дней к себе", rightBlockId: "b5_7_msg", nextBlockId: "b5_btn_2" },
    "b5_btn_2": { id: "b5_btn_2", type: "button", text: "14 дней к себе", rightBlockId: "b5_14_msg", nextBlockId: "b5_wait" },
    "b5_wait": { id: "b5_wait", type: "wait_button" },

    // 5.1
    "b5_7_msg": {
      id: "b5_7_msg",
      type: "text",
      text: "<b>7 дней к себе</b>\nОтлично, что ты здесь \nЧеллендж — это не «заставить себя». Это маленькое приключение к себе.\nКаждый день — одно простое действие. Без давления. Без оценок. Просто попробуй — каково это, когда к себе по-доброму.",
      nextBlockId: "b5_7_pause1"
    },
    "b5_7_pause1": { id: "b5_7_pause1", type: "pause", seconds: 5, nextBlockId: "b5_7_link" },
    "b5_7_link": { id: "b5_7_link", type: "link", text: "Доступ к челленджу", url: "https://example.com/7days", nextBlockId: "b5_7_pause2" },
    "b5_7_pause2": { id: "b5_7_pause2", type: "pause", seconds: 10, nextBlockId: "b5_7_final" },
    "b5_7_final": { id: "b5_7_final", type: "text", text: "Ты решилась — и это уже шаг 🤍\nВеди дневник рядом — так будет виднее, как ты меня. Даже когда кажется, что ничего не происходит.", nextBlockId: "b5_7_menu" },
    "b5_7_menu": createMenuBlock("b5_7_menu"),

    // 5.2
    "b5_14_msg": {
      id: "b5_14_msg",
      type: "text",
      text: "<b>14 дней к себе</b>\nОтлично, что ты здесь \nЧеллендж — это не «заставить себя». Это маленькое приключение к себе.\nКаждый день — одно простое действие. Без давления. Без оценок. Просто попробуй — каково это, когда к себе по-доброму.",
      nextBlockId: "b5_14_pause1"
    },
    "b5_14_pause1": { id: "b5_14_pause1", type: "pause", seconds: 5, nextBlockId: "b5_14_link" },
    "b5_14_link": { id: "b5_14_link", type: "link", text: "Доступ к челленджу", url: "https://example.com/14days", nextBlockId: "b5_14_pause2" },
    "b5_14_pause2": { id: "b5_14_pause2", type: "pause", seconds: 10, nextBlockId: "b5_14_final" },
    "b5_14_final": { id: "b5_14_final", type: "text", text: "Ты решилась — и это уже шаг 🤍\nВеди дневник рядом — так будет виднее, как ты меня. Даже когда кажется, что ничего не происходит.", nextBlockId: "b5_14_menu" },
    "b5_14_menu": createMenuBlock("b5_14_menu"),

    // BRANCH 6
    "branch_6_start": {
      id: "branch_6_start",
      type: "text",
      text: "Рада, что ты здесь \n«Перерождение» — это живая группа. Всего 10 мест. \nЗдесь не будет лекций и домашних занятий. Только живая работа — мягко, в своем темпе, с обратной связью от меня.\nДля тех, кто давно думал: что-то должно измениться. Но непонятно — с чего начать и хватит ли сил.\nХочешь узнать подробнее — напиши мне лично. Расскажу всё.",
      nextBlockId: "b6_link1"
    },
    "b6_link1": { id: "b6_link1", type: "link", text: "Написать", url: "https://t.me/placeholder", nextBlockId: "b6_pause" },
    "b6_pause": { id: "b6_pause", type: "pause", seconds: 10, nextBlockId: "b6_final" },
    "b6_final": {
      id: "b6_final",
      type: "text",
      text: "Буду ждать твоих сообщений 🤍\nНе торопись — просто знай, что место есть. И оно может быть твоим.",
      nextBlockId: "b6_link2"
    },
    "b6_link2": { id: "b6_link2", type: "link", text: "Написать", url: "https://t.me/placeholder", nextBlockId: "b6_menu" },
    "b6_menu": createMenuBlock("b6_menu"),

    // RETURN MENU LOGIC (in case menu button triggers return directly from bottom reply kb)
    "menu_return_msg": {
      id: "menu_return_msg",
      type: "menu",
      text: "Вернуться в меню",
      menuMessageText: "Сделай свой выбор ⬇️",
      menuAttachedBlocks: navButtons
    }
  }
};

let currentToken = "";
try {
 const d = fs.readFileSync('scenario-draft.json', 'utf8');
 const p = JSON.parse(d);
 currentToken = p.telegramBotToken || "";
} catch(e) {}

config.telegramBotToken = currentToken;
fs.writeFileSync('scenario-draft.json', JSON.stringify(config, null, 2));
fs.writeFileSync('scenario.json', JSON.stringify(config, null, 2));
console.log("Done");

