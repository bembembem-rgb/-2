// === ЗАДАНИЯ ДНЯ ===
// Три задания в сутки, награда — кредиты в кошелёк мастерской. Дейлик не
// трогает силу забега: он даёт повод вернуться завтра, а не преимущество
// сегодня. Поэтому вся награда — валюта, которую всё равно надо потратить.
//
// Набор на день детерминирован датой: ключ дня → сид → перемешивание пула.
// Перезагрузка страницы не даёт новый набор, а смена задания на удобное
// перестаёт быть вопросом F5.

const DAILY_COUNT = 3;
const DAILY_BONUS = 100;          // за все три разом
const DAILY_QUEST_LIST = [
    { id: 'kills',   kind: 'kill',     goal: 120,  reward: 90,  title: 'РАСТВОРИ 120 ФРАГМЕНТОВ' },
    { id: 'boss2',   kind: 'boss',     goal: 2,    reward: 140, title: 'СВАЛИ 2 БОССОВ' },
    { id: 'bank',    kind: 'bank',     goal: 150,  reward: 110, title: 'СДАЙ 150 CR НА ЭВАКУАЦИИ' },
    { id: 'score',   kind: 'score',    goal: 6000, reward: 120, title: 'НАБЕРИ 6000 ОЧКОВ ЗА ДЕНЬ' },
    { id: 'wrecks',  kind: 'vehicle',  goal: 6,    reward: 100, title: 'РАЗБЕРИ 6 ТРАНСПОРТОВ' },
    { id: 'parry',   kind: 'parry',    goal: 10,   reward: 110, title: 'ОТРАЗИ 10 УДАРОВ ПАРИРОВАНИЕМ' },
    { id: 'pulse',   kind: 'pulse',    goal: 8,    reward: 80,  title: 'ПРИМЕНИ ИМПУЛЬС 8 РАЗ' },
    { id: 'dash',    kind: 'dash',     goal: 40,   reward: 70,  title: 'СОВЕРШИ 40 РЫВКОВ' },
    { id: 'relics',  kind: 'artifact', goal: 3,    reward: 130, title: 'ПОДБЕРИ 3 АРТЕФАКТА' },
    { id: 'chain',   kind: 'chain',    goal: 2,    reward: 120, title: 'СОБЕРИ ЦЕПЬ x25 ДВАЖДЫ' },
    { id: 'runs',    kind: 'run',      goal: 3,    reward: 70,  title: 'ЗАВЕРШИ 3 ЗАБЕГА' },
    { id: 'vault',   kind: 'vault',    goal: 1,    reward: 130, title: 'СДАЙ ГРУЗ ЧЕРЕЗ ГЛУБОКИЙ ШЛЮЗ' }
];
const DAILY_QUESTS = {};
for (const q of DAILY_QUEST_LIST) DAILY_QUESTS[q.id] = q;

function dailyDayKey(d = new Date()) {
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Ключ дня → три задания. Xorshift поверх хеша строки: один и тот же день
// у одного и того же игрока всегда даёт один и тот же набор.
function dailyPick(key) {
    let s = 2166136261;
    for (let i = 0; i < key.length; i++) s = (Math.imul(s ^ key.charCodeAt(i), 16777619)) | 0;
    const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
    const ids = DAILY_QUEST_LIST.map(q => q.id);
    for (let i = ids.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        const t = ids[i]; ids[i] = ids[j]; ids[j] = t;
    }
    return ids.slice(0, DAILY_COUNT);
}

function dailyShiftDay(key, days) {
    const [y, m, d] = key.split('-').map(Number);
    const t = new Date(y, m - 1, d + days);
    return dailyDayKey(t);
}

// Единственная точка, где набор дня появляется и сменяется. Зовётся отовсюду:
// дешевле проверить дату лишний раз, чем однажды не заметить полночь.
function ensureDailyDay() {
    const today = dailyDayKey();
    let d = saveData.daily;
    if (d && d.day === today) return d;
    // Серия рвётся, если вчерашний день не был закрыт целиком
    const prevFull = d && d.lastFull;
    const streak = (prevFull === dailyShiftDay(today, -1) || prevFull === today) ? (d.streak || 0) : 0;
    d = { day: today, ids: dailyPick(today), prog: {}, done: {}, bonus: false, streak, lastFull: prevFull || null };
    saveData.daily = d;
    writeSave();
    return d;
}

function dailyList() {
    const d = ensureDailyDay();
    return d.ids.map(id => DAILY_QUESTS[id]).filter(Boolean);
}

function dailyDoneCount() {
    const d = ensureDailyDay();
    return d.ids.filter(id => d.done[id]).length;
}

// Прогресс копится и вне забега тоже (рывки в меню невозможны, но пусть
// правило будет одно): считаем всё, что игра сообщает сама.
function dailyEvent(kind, amount = 1) {
    if (!(amount > 0)) return;
    const d = ensureDailyDay();
    let changed = false;
    for (const id of d.ids) {
        const q = DAILY_QUESTS[id];
        if (!q || q.kind !== kind || d.done[id]) continue;
        d.prog[id] = Math.min(q.goal, (d.prog[id] || 0) + amount);
        changed = true;
        if (d.prog[id] >= q.goal) completeDaily(d, id);
    }
    if (changed) writeSave();
}

function completeDaily(d, id) {
    const q = DAILY_QUESTS[id];
    d.done[id] = true;
    saveData.wallet = (saveData.wallet || 0) + q.reward;
    playSFX(sfxAchievement, 0.7);
    showAchievementToast(`${q.title} · +${q.reward} CR`, 'ЗАДАНИЕ ДНЯ');

    if (d.ids.every(x => d.done[x]) && !d.bonus) {
        d.bonus = true;
        saveData.wallet += DAILY_BONUS;
        if (d.lastFull !== d.day) { d.streak = (d.streak || 0) + 1; d.lastFull = d.day; }
        showAchievementToast(`ВСЕ ТРИ ЗАКРЫТЫ · +${DAILY_BONUS} CR · СЕРИЯ ${d.streak}`, 'ЗАДАНИЯ ДНЯ');
    }
}
