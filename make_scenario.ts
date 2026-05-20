import fs from 'fs';
import { encryptToken, ScenarioConfig, ScenarioMenuButton, ScenarioBlock } from './src/scenarioManager';

   const config: ScenarioConfig = {
     telegramBotToken: "",
     contactLink: "https://t.me/ibanezebi64", // or whatever
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
         nextBlockId: "pause_1"
       },
       "pause_1": {
         id: "pause_1",
         type: "pause",
         seconds: 15,
         nextBlockId: "welcome_2_txt"
       },
       "welcome_2_txt": {
         id: "welcome_2_txt",
         type: "text",
         text: "Скажи честно — что из этого сейчас про тебя?",
         nextBlockId: "wb_q1_b1"
       },
       "wb_q1_b1": { id: "wb_q1_b1", type: "button", text: "😮‍💨 Устала, но продолжаю тянуть", isOnce: true, rightBlockId: "welcome_3_txt", nextBlockId: "wb_q1_b2" },
       "wb_q1_b2": { id: "wb_q1_b2", type: "button", text: "😶 Всё серое — и не знаю почему", isOnce: true, rightBlockId: "welcome_3_txt", nextBlockId: "wb_q1_b3" },
       "wb_q1_b3": { id: "wb_q1_b3", type: "button", text: "😰 Тревога, которая не отпускает", isOnce: true, rightBlockId: "welcome_3_txt", nextBlockId: "wb_q1_b4" },
       "wb_q1_b4": { id: "wb_q1_b4", type: "button", text: "💭Не понимаю себя и что со мной", isOnce: true, rightBlockId: "welcome_3_txt", nextBlockId: "wb_q1_b5" },
       "wb_q1_b5": { id: "wb_q1_b5", type: "button", text: "🌀 Всё сразу", isOnce: true, rightBlockId: "welcome_3_txt" },

       "welcome_3_txt": {
         id: "welcome_3_txt",
         type: "text",
         text: "А внутри чаще всего звучит что-то из этого?",
         nextBlockId: "wb_q2_b1"
       },
       "wb_q2_b1": { id: "wb_q2_b1", type: "button", text: "Я просто ленивая", isOnce: true, rightBlockId: "welcome_4_txt", nextBlockId: "wb_q2_b2" },
       "wb_q2_b2": { id: "wb_q2_b2", type: "button", text: "Надо взять себя в руки", isOnce: true, rightBlockId: "welcome_4_txt", nextBlockId: "wb_q2_b3" },
       "wb_q2_b3": { id: "wb_q2_b3", type: "button", text: "У других всё норм — только у меня", isOnce: true, rightBlockId: "welcome_4_txt", nextBlockId: "wb_q2_b4" },
       "wb_q2_b4": { id: "wb_q2_b4", type: "button", text: "Я не знаю, чего хочу", isOnce: true, rightBlockId: "welcome_4_txt" },

       "welcome_4_txt": {
         id: "welcome_4_txt",
         type: "text",
         text: "Слышу тебя 🩶\nВсё это — не слабость и не лень. Это сигнал. Тело и душа просят опоры.\nВыбери, с чего хочешь начать ⬇️",
         nextBlockId: "wb_q3_b1"
       },
       "wb_q3_b1": { id: "wb_q3_b1", type: "button", text: "ДНЕВНИК МИКРО-ПОБЕД — Гайд", rightBlockId: "branch_1_diary", nextBlockId: "wb_q3_b2" },
       "wb_q3_b2": { id: "wb_q3_b2", type: "button", text: "АУДИО ВРЕМЯ — музыка", rightBlockId: "branch_2_audio", nextBlockId: "wb_q3_b3" },
       "wb_q3_b3": { id: "wb_q3_b3", type: "button", text: "УПРАЖНЕНИЕ   —  техники", rightBlockId: "branch_3_exercises", nextBlockId: "wb_q3_b4" },
       "wb_q3_b4": { id: "wb_q3_b4", type: "button", text: "ОПОРА", rightBlockId: "branch_4_support", nextBlockId: "wb_q3_b5" },
       "wb_q3_b5": { id: "wb_q3_b5", type: "button", text: "ХОЧУ — Челленджи", rightBlockId: "branch_5_challenge", nextBlockId: "wb_q3_b6" },
       "wb_q3_b6": { id: "wb_q3_b6", type: "button", text: "🩶 ГРУППА «ПЕРЕРОЖДЕНИЕ»", rightBlockId: "branch_6_group" },


       // BRANCH 1
       "branch_1_diary": {
         id: "branch_1_diary",
         type: "text",
         text: "ДНЕВНИК МИКРО-ПОБЕД — Гайд",
         nextBlockId: "br1_b1"
       },
       "br1_b1": { id: "br1_b1", type: "button", text: "1 - Гайд легализации бездействия🩶", rightBlockId: "br1_txt1" },
       "br1_txt1": {
         id: "br1_txt1",
         type: "text",
         text: "Сначала — одна мысль.\nБездействие это не провал. Иногда это кажется большим, на то, что хватает силы. И это честно.\nВнутри дневника — маленькие шаги. Таких, чтобы не надо было «брать себя в руки».\nПросто — чуть бережнее к себе. День за днём.",
         nextBlockId: "br1_link"
       },
       "br1_link": {
         id: "br1_link",
         type: "file",
         text: "Дневник",
         url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
         nextBlockId: "br1_pause"
       },
       "br1_pause": {
         id: "br1_pause",
         type: "pause",
         seconds: 10,
         nextBlockId: "br1_end"
       },
       "br1_end": {
         id: "br1_end",
         type: "text",
         text: "Надеюсь, он станет твоим маленьким другом \nЕсли почувствуешь, что хочется глубже — я рядом. В июне открываю живую группу «Перерождение». Напиши мне — поговорим подробнее.",
         nextBlockId: "br1_end_b1"
       },
       "br1_end_b1": { id: "br1_end_b1", type: "link", text: "Написать", url: "https://t.me/placeholder", nextBlockId: "br1_end_b2" },
       "br1_end_b2": { id: "br1_end_b2", type: "button", text: "Вернуться в меню", rightBlockId: "menu_return_msg" },

       // BRANCH 2
       "branch_2_audio": {
         id: "branch_2_audio",
         type: "audio",
         text: "<b>Аудио библиотека</b>\nВключай — и просто побудь. Ничего делать не нужно.\nЭто твои несколько минут только для тебя.",
         url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
         nextBlockId: "branch_2_pause"
       },
       "branch_2_pause": {
         id: "branch_2_pause",
         type: "pause",
         seconds: 10,
         nextBlockId: "branch_2_end"
       },
       "branch_2_end": {
         id: "branch_2_end",
         type: "text",
         text: "Побудь в этом состоянии чуть дольше \nА если захочешь — загляни в другие материалы. Там есть реальность, дневник и кое-что ещё ⬇️",
         nextBlockId: "br2_end_b1"
       },
       "br2_end_b1": { id: "br2_end_b1", type: "button", text: "Вернуться в меню", rightBlockId: "menu_return_msg" },

       // BRANCH 3
       "branch_3_exercises": {
         id: "branch_3_exercises",
         type: "text",
         text: "<b>УПРАЖНЕНИЕ   —  техники</b>",
         nextBlockId: "br3_b1"
       },
       "br3_b1": { id: "br3_b1", type: "button", text: "«Квадрат Дыхания»  аудио", rightBlockId: "br3_audio" },
       "br3_audio": {
         id: "br3_audio",
         type: "file",
         text: "Упражнение за 2 минуты успокаивает нервную систему.\nВключай прямо сейчас. Можно лёжа.",
         url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
         nextBlockId: "branch_3_pause"
       },
       "branch_3_pause": {
         id: "branch_3_pause",
         type: "pause",
         seconds: 7,
         nextBlockId: "branch_3_end"
       },
       "branch_3_end": {
         id: "branch_3_end",
         type: "text",
         text: "Как ты? \nСохрани аудио — и возвращайся каждый раз, когда найдешь. Это работает.\nЕсли хочешь понять глубже — почему тревога возвращается снова и снова — напиши мне. Поговорим.",
         nextBlockId: "br3_end_b1"
       },
       "br3_end_b1": { id: "br3_end_b1", type: "link", text: "Написать", url: "https://t.me/placeholder", nextBlockId: "br3_end_b2" },
       "br3_end_b2": { id: "br3_end_b2", type: "button", text: "Вернуться в меню", rightBlockId: "menu_return_msg" },

       // BRANCH 4 
       "branch_4_support": {
         id: "branch_4_support",
         type: "text",
         text: "<b>ОПОРА</b>",
         nextBlockId: "br4_b1"
       },
       "br4_b1": { id: "br4_b1", type: "button", text: "1 - Маркер Тревоги", rightBlockId: "br4_marker", nextBlockId: "br4_b2" },
       "br4_b2": { id: "br4_b2", type: "button", text: "2 - Фразы Поддержка", rightBlockId: "br4_phrases" },
       "br4_marker": {
         id: "br4_marker",
         type: "file",
         text: "<b>Маркер Тревоги</b>\nЭтот простой инструмент — поможет понять, что сейчас происходит внутри. Тревога ,страх или апатия.\nКогда узнаешь — становится чуть легче. Уже не «со мной что-то не так», а просто — вот что сейчас есть.",
         url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
         nextBlockId: "branch_4_pause_1"
       },
       "branch_4_pause_1": {
         id: "branch_4_pause_1",
         type: "pause",
         seconds: 10,
         nextBlockId: "branch_4_end_1"
       },
       "branch_4_end_1": {
         id: "branch_4_end_1",
         type: "text",
         text: "Теперь ты знаешь чуть больше о себе. \nЭто уже немаловажно. Если хочешь — следующий шаг: реальный Квадрат. Оно помогает прямо в данный момент.",
         nextBlockId: "br4_end1_b1"
       },
       "br4_end1_b1": { id: "br4_end1_b1", type: "button", text: "Вернуться в меню", rightBlockId: "menu_return_msg" },

       "br4_phrases": {
         id: "br4_phrases",
         type: "file",
         text: "<b>Фразы Поддержка</b>\nСтань переводчиком для своего ребенка.\n12 фраз которые открывают диалог без давления и осуждения.",
         url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
         nextBlockId: "br4_pause_2"
       },
       "br4_pause_2": {
         id: "br4_pause_2",
         type: "pause",
         seconds: 10,
         nextBlockId: "br4_end_2"
       },
       "br4_end_2": {
         id: "br4_end_2",
         type: "text",
         text: "Возвращайся к ним в любой момент \nИ помни — слова работают, когда мы готовы их услышать. Сегодня ты была готова.\nЕсли захочется большего — я здесь. Живая группа «Перерождение» всегда открыта.",
         nextBlockId: "br4_end2_b1"
       },
       "br4_end2_b1": { id: "br4_end2_b1", type: "button", text: "Вернуться в меню", rightBlockId: "menu_return_msg" },

       // BRANCH 5
       "branch_5_challenge": {
         id: "branch_5_challenge",
         type: "text",
         text: "<b>ХОЧУ — Челленджи</b>",
         nextBlockId: "br5_b1"
       },
       "br5_b1": { id: "br5_b1", type: "button", text: "7 дней к себе", rightBlockId: "br5_7days", nextBlockId: "br5_b2" },
       "br5_b2": { id: "br5_b2", type: "button", text: "14 дней к себе", rightBlockId: "br5_14days" },
       "br5_7days": {
         id: "br5_7days",
         type: "text",
         text: "<b>7 дней к себе</b>\nОтлично, что ты здесь \nЧеллендж — это не «заставить себя». Это маленькое приключение к себе.\nКаждый день — одно простое действие. Без давления. Без оценок. Просто попробуй — каково это, когда к себе по-доброму.",
         nextBlockId: "br5_pause_1"
       },
       "br5_pause_1": {
         id: "br5_pause_1",
         type: "pause",
         seconds: 5,
         nextBlockId: "br5_link_7d"
       },
       "br5_link_7d": {
         id: "br5_link_7d",
         type: "link",
         text: "Доступ к челленджу",
         url: "https://example.com/7days",
         nextBlockId: "br5_pause_2"
       },
       "br5_pause_2": {
         id: "br5_pause_2",
         type: "pause",
         seconds: 10,
         nextBlockId: "br5_end_1"
       },
       "br5_end_1": {
         id: "br5_end_1",
         type: "text",
         text: "Ты решилась — и это уже шаг 🤍\nВеди дневник рядом — так будет виднее, как ты меня. Даже когда кажется, что ничего не происходит.",
         nextBlockId: "br5_end1_b1"
       },
       "br5_end1_b1": { id: "br5_end1_b1", type: "button", text: "Вернуться в меню", rightBlockId: "menu_return_msg" },

       "br5_14days": {
         id: "br5_14days",
         type: "text",
         text: "<b>14 дней к себе</b>\nОтлично, что ты здесь \nЧеллендж — это не «заставить себя». Это маленькое приключение к себе.\nКаждый день — одно простое действие. Без давления. Без оценок. Просто попробуй — каково это, когда к себе по-доброму.",
         nextBlockId: "br5_pause_3"
       },
       "br5_pause_3": {
         id: "br5_pause_3",
         type: "pause",
         seconds: 5,
         nextBlockId: "br5_link_14d"
       },
       "br5_link_14d": {
         id: "br5_link_14d",
         type: "link",
         text: "Доступ к челленджу",
         url: "https://example.com/14days",
         nextBlockId: "br5_pause_4"
       },
       "br5_pause_4": {
         id: "br5_pause_4",
         type: "pause",
         seconds: 10,
         nextBlockId: "br5_end_2"
       },
       "br5_end_2": {
         id: "br5_end_2",
         type: "text",
         text: "Ты решилась — и это уже шаг 🤍\nВеди дневник рядом — так будет виднее, как ты меня. Даже когда кажется, что ничего не происходит.",
         nextBlockId: "br5_end2_b1"
       },
       "br5_end2_b1": { id: "br5_end2_b1", type: "button", text: "Вернуться в меню", rightBlockId: "menu_return_msg" },


       // BRANCH 6
       "branch_6_group": {
         id: "branch_6_group",
         type: "text",
         text: "Рада, что ты здесь \n«Перерождение» — это живая группа. Всего 10 мест. \nЗдесь не будет лекций и домашних занятий. Только живая работа — мягко, в своем темпе, с обратной связью от меня.\nДля тех, кто давно думал: что-то должно измениться. Но непонятно — с чего начать и хватит ли сил.\nХочешь узнать подробнее — напиши мне лично. Расскажу всё.",
         nextBlockId: "br6_b1"
       },
       "br6_b1": { id: "br6_b1", type: "link", text: "Написать", url: "https://t.me/placeholder", nextBlockId: "branch_6_pause" },
       "branch_6_pause": {
         id: "branch_6_pause",
         type: "pause",
         seconds: 10,
         nextBlockId: "branch_6_end"
       },
       "branch_6_end": {
         id: "branch_6_end",
         type: "text",
         text: "Буду ждать твоих сообщений 🤍\nНе торопись — просто знай, что место есть. И оно может быть твоим.",
         nextBlockId: "br6_end_b1"
       },
       "br6_end_b1": { id: "br6_end_b1", type: "link", text: "Написать", url: "https://t.me/placeholder", nextBlockId: "br6_end_b2" },
       "br6_end_b2": { id: "br6_end_b2", type: "button", text: "Вернуться в меню", rightBlockId: "menu_return_msg" },
       
       // RETURN MENU
       "menu_return_msg": {
         id: "menu_return_msg",
         type: "text",
         text: "Сделай свой выбор ⬇️",
         nextBlockId: "ret_b1"
       },
       "ret_b1": { id: "ret_b1", type: "button", text: "ДНЕВНИК МИКРО-ПОБЕД — Гайд", rightBlockId: "branch_1_diary", nextBlockId: "ret_b2" },
       "ret_b2": { id: "ret_b2", type: "button", text: "АУДИО ВРЕМЯ — музыка", rightBlockId: "branch_2_audio", nextBlockId: "ret_b3" },
       "ret_b3": { id: "ret_b3", type: "button", text: "УПРАЖНЕНИЕ   —  техники", rightBlockId: "branch_3_exercises", nextBlockId: "ret_b4" },
       "ret_b4": { id: "ret_b4", type: "button", text: "ОПОРА", rightBlockId: "branch_4_support", nextBlockId: "ret_b5" },
       "ret_b5": { id: "ret_b5", type: "button", text: "ХОЧУ — Челленджи", rightBlockId: "branch_5_challenge", nextBlockId: "ret_b6" },
       "ret_b6": { id: "ret_b6", type: "button", text: "🩶 ГРУППА «ПЕРЕРОЖДЕНИЕ»", rightBlockId: "branch_6_group" }
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
