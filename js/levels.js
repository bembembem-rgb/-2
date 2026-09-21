// === УРОВНИ ЗА ЗАБЕГ ===
// Рогалик внутри забега: набрал порог очков — забег останавливается, игрок
// берёт одно улучшение из трёх. Мастерская качает игрока МЕЖДУ забегами,
// уровни — ВНУТРИ, поэтому два забега подряд перестают быть одинаковыми.
// Всё, что здесь набрано, умирает вместе с забегом.

// Пороги стоят не на глаз, а по замеру. Прогон «идеального игрока»
// (бессмертен, авто-прицел, не выпускает гашетку) даёт ~38 очков в секунду,
// то есть 2300 в минуту. На прежних 400/900/1500 карточка выпрыгивала каждые
// 15-25 секунд, а одна сдача груза (+500) перелетала первый порог целиком.
// Эти числа дают идеальному игроку уровень на 23-й, 57-й, 104-й, 161-й
// и 229-й секунде; живой игрок медленнее примерно в полтора раза.
const LEVEL_THRESHOLDS = [900, 2200, 4000, 6200, 8800];
const LEVEL_STEP = 3000;   // дальше ровным шагом

// Улучшение — одна-две строки в точке применения. Половина правит поля
// игрока прямо при взятии, половина живёт множителем, который читают
// выстрел и начисление. Третьего способа тут нет намеренно.
const LEVEL_PERKS = [
    { id: 'hp',      max: 2, color: '#3fdd4a', title: 'УСИЛЕННЫЙ КОРПУС', desc: '+1 HP И +1 К МАКСИМУМУ',
      apply: h => { h.maxHpRun++; h.hp++; } },
    { id: 'heal',    max: 1, color: '#3fdd4a', title: 'РЕМКОМПЛЕКТ',      desc: 'ВОССТАНОВИТЬ 2 HP СЕЙЧАС',
      apply: h => { h.hp = Math.min(h.maxHpRun, h.hp + 2); } },
    { id: 'speed',   max: 3, color: '#00e0ff', title: 'ПОДВОДНАЯ ТЯГА',   desc: 'СКОРОСТЬ +8%',
      apply: h => { h.speed *= 1.08; } },
    { id: 'dash',    max: 3, color: '#00e0ff', title: 'ХОЛОДНЫЙ КОНТУР',  desc: 'ПЕРЕЗАРЯДКА РЫВКА −15%',
      apply: h => { h.dashCooldownTime = Math.round(h.dashCooldownTime * 0.85); } },
    { id: 'parry',   max: 3, color: '#f0c419', title: 'ШИРОКИЙ ЗАМАХ',    desc: 'ОКНО ПАРИРОВАНИЯ +40 МС',
      apply: null },
    { id: 'pulse',   max: 2, color: '#c46dff', title: 'ВТОРОЙ КОНДЕНСАТОР', desc: 'ЛИШНИЙ ЗАРЯД ИМПУЛЬСА',
      apply: h => { h.pulseChargesMax++; h.pulseCharges++; } },
    { id: 'pulsecd', max: 3, color: '#c46dff', title: 'БЫСТРАЯ НАКАЧКА',  desc: 'ПЕРЕЗАРЯДКА ИМПУЛЬСА −20%',
      apply: h => { h.pulseCooldownTime = Math.round(h.pulseCooldownTime * 0.8); } },
    { id: 'alt',     max: 3, color: '#ff9f1c', title: 'СДВОЕННЫЙ ЗАЛП',   desc: 'ПЕРЕЗАРЯДКА АЛЬТ-ЗАЛПА −20%',
      apply: h => { h.altCooldownTime = Math.round(h.altCooldownTime * 0.8); } },
    { id: 'dmg',     max: 4, color: '#ff2d55', title: 'РАЗРЫВНОЙ КОД',    desc: 'УРОН +15%',    apply: null },
    { id: 'reload',  max: 3, color: '#ff2d55', title: 'СУХОЙ ЗАТВОР',     desc: 'ПЕРЕЗАРЯДКА ОРУЖИЯ −10%', apply: null },
    { id: 'range',   max: 3, color: '#ff2d55', title: 'ПЛОТНАЯ СРЕДА',    desc: 'ДАЛЬНОСТЬ ВЫСТРЕЛА +25%', apply: null },
    { id: 'credits', max: 3, color: '#f0c419', title: 'МАРОДЁР',          desc: '+1 КРЕДИТ ЗА УБИЙСТВО',   apply: null },

    // --- ШКОЛА ДВИЖЕНИЯ (узел perks_move) ---
    { id: 'dashdmg', max: 2, color: '#00e0ff', title: 'ТАРАННЫЙ РЫВОК',  desc: 'РЫВОК БЬЁТ ВСЕХ НА ПУТИ', unlock: 'perks_move', apply: null },
    { id: 'parrypulse', max: 1, color: '#c46dff', title: 'ОТДАЧА ЩИТА',  desc: 'ПАРИРОВАНИЕ ДАЁТ ЗАРЯД ИМПУЛЬСА', unlock: 'perks_move', apply: null },

    // --- ЦЕПНАЯ ЛОГИКА (узел perks_chain) ---
    { id: 'chainbolt', max: 2, color: '#f0c419', title: 'РАЗРЯД',        desc: 'КАЖДОЕ 5-Е УБИЙСТВО БЬЁТ МОЛНИЕЙ', unlock: 'perks_chain', apply: null },
    { id: 'parryheal', max: 2, color: '#3fdd4a', title: 'ОТВЕТНЫЙ РЕМОНТ', desc: 'КАЖДОЕ 3-Е ПАРИРОВАНИЕ ЛЕЧИТ 1 HP', unlock: 'perks_chain', apply: null },

    // --- ПРЕДЕЛ СИСТЕМЫ (узел perks_late) ---
    { id: 'secondwind', max: 1, color: '#ff2d55', title: 'ВТОРОЕ ДЫХАНИЕ', desc: 'ОДИН РАЗ ЗА ЗАБЕГ ПЕРЕЖИВЁШЬ СМЕРТЬ', unlock: 'perks_late', apply: null },
    { id: 'greed', max: 2, color: '#f0c419', title: 'ЖАДНОСТЬ',         desc: 'КРЕДИТЫ ЗА УБИЙСТВО УДВАИВАЮТСЯ', unlock: 'perks_late', apply: null }
];
const LEVEL_PERK_BY_ID = {};
for (const p of LEVEL_PERKS) LEVEL_PERK_BY_ID[p.id] = p;

let runLevel = 0;                 // взятых уровней
let nextLevelScore = LEVEL_THRESHOLDS[0];
let levelTaken = {};              // id → сколько раз взято
let levelChoice = null;           // три карты, пока открыт экран
let freeLevels = 0;               // уровни вне порога: редкий дроп
let secondWindUsed = false;       // «второе дыхание» тратится раз за забег

function resetLevels() {
    // Экран выбора живёт в gameState 'paused'. Сброс, который просто прятал
    // панель, оставлял забег висеть на паузе без единого окна на экране —
    // выхода оттуда уже не было. Открытый экран закрываем штатно.
    if (levelChoice && gameState === 'paused') closeLevelChoice();
    runLevel = 0;
    nextLevelScore = LEVEL_THRESHOLDS[0];
    levelTaken = {};
    levelChoice = null;
    freeLevels = 0;
    secondWindUsed = false;
    const scr = document.getElementById('levelup-screen');
    if (scr) scr.style.display = 'none';
    updateLevelHud();
}

function levelThreshold(n) {
    return n < LEVEL_THRESHOLDS.length
        ? LEVEL_THRESHOLDS[n]
        : LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1] + (n - LEVEL_THRESHOLDS.length + 1) * LEVEL_STEP;
}

function lvl(id) { return levelTaken[id] || 0; }
// Перк из закрытого узла в картах не появляется: показывать то, чего нельзя
// взять, — это реклама, а не выбор.
function levelPool() {
    return LEVEL_PERKS.filter(p => lvl(p.id) < p.max && (!p.unlock || unlockOwned(p.unlock)));
}
function levelDmgMult()    { return 1 + 0.15 * lvl('dmg'); }
function levelReloadMult() { return Math.pow(0.9, lvl('reload')); }
function levelRangeMult()  { return 1 + 0.25 * lvl('range'); }
function levelKillBonus()  { return lvl('credits'); }
function levelParryBonus() { return 40 * lvl('parry'); }
function levelDashDmg()    { return 4 * lvl('dashdmg'); }      // урон тарана на рывке
function levelKillMult()   { return 1 + lvl('greed'); }        // множитель кредитов за убийство

// Улучшение достаётся отряду, а не тому, кто нажал кнопку: экран выбора
// один на двоих, счёт общий. См. .claude/rules/coop.md.
function eachHero(fn) {
    if (player) fn(player);
    if (coopMode && player2) fn(player2);
}

function levelChoiceOpen() { return !!levelChoice; }

// Порог может перелететь сразу через несколько уровней (босс даёт 1000):
// очередь разбирается по одному экрану за раз, в openLevelChoice.
function checkLevelUp() {
    if (levelChoice || gameState !== 'playing') return false;
    const free = freeLevels > 0;
    if (!free && score < nextLevelScore) return false;
    const pool = levelPool();
    runLevel++;
    // Свободный уровень не двигает порог: он подарок, а не прогресс по счёту
    if (free) freeLevels--; else nextLevelScore = levelThreshold(runLevel);
    updateLevelHud();
    if (pool.length === 0) return false;   // всё выкуплено — уровень идёт молча
    const picks = [];
    const bag = pool.slice();
    while (picks.length < 3 && bag.length) picks.push(bag.splice(Math.floor(Math.random() * bag.length), 1)[0]);
    levelChoice = picks;
    openLevelChoice();
    return true;
}

function takeLevelPerk(i) {
    if (!levelChoice) return;
    const perk = levelChoice[i];
    if (!perk) return;
    levelTaken[perk.id] = lvl(perk.id) + 1;
    if (perk.apply) eachHero(perk.apply);
    if (perk.id === 'hp' || perk.id === 'heal') updateHpUI();
    playSFX(sfxAchievement, 0.6);
    if (player) spawnFloatText(player.x, player.y - 60, perk.title, perk.color, 14, 'level');
    closeLevelChoice();
    // Очередь: один экран за раз, но перелёт через два порога не теряется
    checkLevelUp();
}

// --- ЭКРАН ВЫБОРА ---
// Забег встаёт на паузу: gameState 'paused' уже умеет всё нужное — update
// не идёт, draw продолжает рисовать мир под панелью, HUD остаётся на месте,
// а handleMenuKeys начинает видеть клавиши. Своё состояние завело бы четвёртую
// ветку в gameFrame и ещё одну проверку в каждом `gameState === 'playing'`.
function openLevelChoice() {
    gameState = 'paused';
    resetInputState();
    document.body.classList.remove('is-critical');
    if (currentBGM) currentBGM.volume = 0.15 * musicVolume;
    renderLevelCards();
    const scr = document.getElementById('levelup-screen');
    if (scr) scr.style.display = 'flex';
    resetMenuFocus();
    lvlPadPrev = {};
    playSFX(sfxUiNav, 0.5);
}

function closeLevelChoice() {
    levelChoice = null;
    const scr = document.getElementById('levelup-screen');
    if (scr) scr.style.display = 'none';
    if (currentBGM) currentBGM.volume = 0.5 * musicVolume;
    // Пауза выбора не должна прилететь в физику одним куском
    lastFrameTime = performance.now();
    gameState = 'playing';
    updateCriticalState();
    resetMenuFocus();
}

function renderLevelCards() {
    const head = document.getElementById('levelup-head');
    // runLevel — сколько повышений взято, игрок стоит на следующем: без +1
    // заголовок экрана и строка HUD расходились бы на единицу
    if (head) head.innerText = `УРОВЕНЬ ${runLevel + 1}`;
    const host = document.getElementById('levelup-cards');
    if (!host || !levelChoice) return;
    host.innerHTML = levelChoice.map((p, i) => {
        const have = lvl(p.id);
        const pips = Array.from({ length: p.max }, (_, k) =>
            `<span class="perk-pip${k < have ? ' on' : ''}"></span>`).join('');
        return `<button class="menu-btn perk-card" style="--perk:${p.color}" onclick="takeLevelPerk(${i})">
            <span class="perk-key">${i + 1}</span>
            <span class="perk-emblem"></span>
            <span class="perk-title">${p.title}</span>
            <span class="perk-desc">${p.desc}</span>
            <span class="perk-pips">${pips}</span>
            <span class="perk-level">${have} / ${p.max}</span>
        </button>`;
    }).join('');
}

// Геймпад на экране выбора: D-pad и стик влево-вправо, нижняя кнопка —
// подтверждение. Как и везде, кнопка превращается в клавишу через tapKey,
// поэтому навигация остаётся одна на все экраны.
let lvlPadPrev = {};
function updateLevelGamepad() {
    if (!levelChoice || !navigator.getGamepads) return;
    for (const gp of navigator.getGamepads()) {
        if (!gp || !gp.connected) continue;
        const down = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
        const ax = gp.axes[0] || 0;
        const left = down(14) || ax < -0.5, right = down(15) || ax > 0.5, ok = down(0);
        if (left && !lvlPadPrev.left) tapKey('ArrowLeft');
        if (right && !lvlPadPrev.right) tapKey('ArrowRight');
        if (ok && !lvlPadPrev.ok) tapKey('Enter');
        lvlPadPrev = { left, right, ok };
        return;
    }
}

function updateLevelHud() {
    const el = document.getElementById('level-display');
    if (!el) return;
    el.innerText = `УР. ${runLevel + 1} · ${Math.min(score, nextLevelScore)}/${nextLevelScore}`;
}
