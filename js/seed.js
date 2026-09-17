// --- СИД ЗАБЕГА И ССЫЛКА-ВЫЗОВ ---
// Сид фиксирует то, что раздаёт игра: порядок врагов, дроп, контракты,
// артефакты. Кадр в кадр забеги не совпадут — движение считается от
// реального времени между кадрами, а оно на каждой машине своё. Сид
// уравнивает условия, а не исход: два игрока получают одну и ту же
// раздачу и меряются тем, что с ней сделали.
//
// Ссылка вида index.html?seed=KNRT4 запускает забег сразу, минуя меню.
// Зритель, пришедший из ролика, должен оказаться в воде с одного клика:
// каждый лишний экран между видео и игрой съедает часть пришедших.

// Алфавит без похожих знаков: 0/O, 1/I/L, 5/S, 8/B перепутать на слух
// и при перепечатке из комментария проще всего.
const SEED_CHARS = 'ACDEFGHJKMNPQRTUVWXY2346789';
const SEED_LEN = 5;

let runSeed = '';          // сид текущего забега
let seedFromLink = '';     // сид, пришедший из адреса
let _mathRandom = Math.random;
let _seedActive = false;

function seedHash(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
}

function mulberry32(a) {
    return function () {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), 1 | t);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function seedCodeFrom(n) {
    let out = '';
    for (let i = 0; i < SEED_LEN; i++) {
        out += SEED_CHARS[n % SEED_CHARS.length];
        n = Math.floor(n / SEED_CHARS.length) + 7;
    }
    return out;
}

// Сид дня общий у всех: дата в UTC, чтобы у игроков из разных часовых
// поясов он менялся одновременно и «сид дня» означал один и тот же день.
function todaySeed() {
    const d = new Date();
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
    return seedCodeFrom(seedHash('nt0:' + key));
}

function randomSeed() {
    return seedCodeFrom(seedHash('r' + Date.now() + Math.floor(_mathRandom() * 1e9)));
}

function normalizeSeed(raw) {
    const up = String(raw || '').toUpperCase();
    let out = '';
    for (const ch of up) if (SEED_CHARS.indexOf(ch) >= 0) out += ch;
    return out.slice(0, SEED_LEN);
}

function readLinkSeed() {
    try {
        const p = new URLSearchParams(location.search);
        const s = normalizeSeed(p.get('seed'));
        if (s.length === SEED_LEN) seedFromLink = s;
    } catch (err) { /* адрес без параметров — обычный случай */ }
    return seedFromLink;
}

// Подмена Math.random на время забега. Точка ровно одна, поэтому все
// модули — спавн, дроп, боссы, контракты — садятся на сид без единой
// правки внутри них. Оригинал возвращается по окончании забега: меню
// и фон рисуются своим генератором и сидом связаны быть не должны.
function beginSeededRun() {
    if (_seedActive) endSeededRun();
    runSeed = seedFromLink || todaySeed();
    Math.random = mulberry32(seedHash(runSeed));
    _seedActive = true;
    updateSeedHud();
}

function endSeededRun() {
    if (!_seedActive) return;
    Math.random = _mathRandom;
    _seedActive = false;
}

function updateSeedHud() {
    const el = document.getElementById('seed-display');
    if (!el) return;
    el.innerText = 'СИД ' + (runSeed || '—');
}

function seedLink(code) {
    const base = location.origin === 'null'
        ? 'index.html'                       // открыто с диска: адрес не собрать
        : location.origin + location.pathname;
    return `${base}?seed=${code}`;
}

// Готовый блок для комментария: результат и сид, по которому его можно
// повторить. Без сида это похвальба, с сидом — вызов, на который есть
// чем ответить.
function runCardText() {
    const g = (typeof runGrade === 'function') ? runGrade().letter : '?';
    const lines = [
        `NEON TIDES: ZERO — ${score.toString().padStart(4, '0')} очков, оценка ${g}`,
        `глубина ${runDepth}, цепь x${chainBest}, боссов ${currentBossIndex}`,
        `сид ${runSeed} — попробуй обойти`,
        seedLink(runSeed)
    ];
    return lines.join('\n');
}

function copyRunCard(btn) {
    const text = runCardText();
    const done = () => {
        if (!btn) return;
        const was = btn.innerText;
        btn.innerText = 'СКОПИРОВАНО';
        setTimeout(() => { btn.innerText = was; }, 1600);
    };
    // Буфер обмена недоступен на file:// и без защищённого соединения.
    // Запасной путь через скрытое поле работает и там, поэтому кнопка
    // не превращается в мёртвую на локально открытом файле.
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
    } else {
        fallbackCopy(text, done);
    }
}

function fallbackCopy(text, done) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed; top:-1000px; opacity:0;';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (err) { /* остаётся выделенным */ }
    ta.remove();
}

window.copyRunCardBtn = function (el) { copyRunCard(el); };
