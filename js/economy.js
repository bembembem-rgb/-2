// === КАЛИБРОВКА ЯДЕР ===
// Ядра — гарантированная валюта: капают во время забега, идут в кошелёк
// сразу и НЕ теряются при смерти. Кредиты остаются рискованными (карман,
// сгорает), поэтому две валюты не спорят: ядра — за постоянные анлоки,
// кредиты — за апгрейды мастерской и скины.
//
// Целевая калибровка, под которую подобраны числа ниже:
//   неудачный забег (≈1800 очков, 0-1 босса, ≈4000 метров) ≈ 14-22 ядра,
//   то есть примерно ПОЛОВИНА самого дешёвого анлока: два плохих забега
//   подряд обязаны что-то открыть.
//   хороший забег (≈6000 очков, 2 босса, ≈12000 метров) ≈ 64 ядра —
//   полтора дешёвых анлока за забег.
// Цена дешёвого узла дерева — 45 ядер (ГАРПУН), см. CORE_CHEAPEST_NODE.
const CORE_PER_SCORE = 150;      // очков на одно ядро
const CORE_PER_BOSS = 8;         // ядер за убитого босса
const CORE_PER_DISTANCE = 1500;  // мировых пикселей на одно ядро
const CORE_CHEAPEST_NODE = 45;   // самый дешёвый узел дерева — ГАРПУН, см. js/unlocks.js

let runCores = 0;                // заработано за текущий забег — для экрана смерти
let _coreScoreAcc = 0, _coreDistAcc = 0;

function resetCores() { runCores = 0; _coreScoreAcc = 0; _coreDistAcc = 0; }

// Единственная точка начисления. Кладёт сразу в кошелёк: ядро, которое ещё
// надо довезти до эвакуации, — это уже кредит, а не гарантия.
function addCores(n) {
    if (n <= 0) return;
    n = Math.max(1, Math.round(n * depthCoreMult()));
    saveData.cores = (saveData.cores || 0) + n;
    runCores += n;
    writeSave();
    updateCoresUI();
}

// Остаток копится между вызовами: иначе 149 очков подряд не дали бы ничего.
function noteCoreScore(points) {
    _coreScoreAcc += points;
    const gained = Math.floor(_coreScoreAcc / CORE_PER_SCORE);
    if (gained > 0) { _coreScoreAcc -= gained * CORE_PER_SCORE; addCores(gained); }
}

// Скачок за кадр отбрасываем: посадка в транспорт и выход из него двигают
// игрока мгновенно, и без потолка это платило бы ядрами за телепорт.
// Честный максимум — рывок: dashSpeed 15 за кадр.
const CORE_STEP_MAX = 60;
function noteCoreDistance(px) {
    if (px > CORE_STEP_MAX) return;
    _coreDistAcc += px;
    const gained = Math.floor(_coreDistAcc / CORE_PER_DISTANCE);
    if (gained > 0) { _coreDistAcc -= gained * CORE_PER_DISTANCE; addCores(gained); }
}

// === ЭКОНОМИКА ===
// Кредиты копятся в runCredits («в кармане») и уходят в кошелёк только на
// эвакуации. Смерть обнуляет карман — на этом держится счётчик «на кону».
const CREDITS = { enemy: 1, ram: 1, vehicle: 5, boss: 40, extraction: 25 };
let runCredits = 0;

const UPGRADES = {
    hull:    { title: 'КОРПУС',    desc: '+1 к максимуму HP',                max: 2, cost: [250, 600] },
    coolant: { title: 'ХЛАДАГЕНТ', desc: 'Перезарядка рывка короче на 15%',  max: 3, cost: [180, 400, 850] },
    salvage: { title: 'СБОРЩИК',   desc: '+25% кредитов за всё в забеге',    max: 2, cost: [300, 700] },
    breaker: { title: 'РЕЗАК',     desc: 'Вскрывает ГЛУБОКИЙ ШЛЮЗ — вторая точка сдачи, кредиты ×2', max: 1, cost: [450] }
};
const VAULT_MULT = 2;
// === ДРОБОВИК ===
// Он был строго хуже пистолета: пять дробин по единице урона раз в секунду —
// те же пять урона в секунду, только вдвое меньше дальность (жизнь дробины
// 800 мс против 2000) и конус в 45°, из которого на средней дистанции в цель
// попадала одна дробина. Оружие «на ближней» обязано за этот риск платить.
const SHOTGUN_PELLETS = 6;
const SHOTGUN_SPREAD = Math.PI / 8;   // 22.5° вместо 45°: кучнее, бьёт дальше
const SHOTGUN_DMG = 1.5;              // урон одной дробины
const SHOTGUN_COOLDOWN = 1250;        // было 1000: выстрел стал дороже


// === СТВОЛЫ ===
// Слот 1 и 2 есть всегда, 3 и 4 открываются деревом. Список нужен и выстрелу,
// и переключению по F, и слотам артефактов — держим его в одном месте.
// Отлив: диск уходит вперёд, на середине жизни разворачивается и идёт назад.
// Оба прохода считаются отдельными попаданиями, поэтому стоять на линии
// возврата выгодно — это единственный ствол, который просит думать о позиции.
const BOOMER_DMG = 2.5, BOOMER_COOLDOWN = 800, BOOMER_LIFE = 900;
// Прибой: не пуля, а стена воды. Волна идёт медленно, расширяется на лету,
// проходит сквозь всех и расталкивает их. Единственный ствол, который
// выигрывает время, а не размен урона — за это и платит перезарядкой.
const SURGE_DMG = 5, SURGE_COOLDOWN = 2500, SURGE_SPEED = 8;
const SURGE_W0 = 70, SURGE_W1 = 240, SURGE_LIFE = 1100, SURGE_PUSH = 120;
const WEAPONS = {
    1: { name: 'ПИСТОЛЕТ', unlock: null },
    2: { name: 'ДРОБОВИК',  unlock: null },
    3: { name: 'ОТЛИВ',     unlock: 'boomer' },
    4: { name: 'ПРИБОЙ',    unlock: 'surge' }
};
function availableWeapons() {
    return Object.keys(WEAPONS).map(Number).filter(n => !WEAPONS[n].unlock || unlockOwned(WEAPONS[n].unlock));
}
function nextWeapon(cur) {
    const list = availableWeapons();
    const i = list.indexOf(cur);
    return list[(i + 1) % list.length];
}

// === РОЛИ В КО-ОПЕ ===
// Штурм убивает, техник обслуживает. В соло P1 остаётся универсалом,
// иначе одиночный забег просто стал бы слабее.
const ROLE_DMG_P1 = 1.5;   // множитель урона штурма
const ROLE_DMG_P2 = 0.6;   // техник не выносит волну сам — за этим он и зовёт штурм
const REPAIR_RADIUS = 170;
const REPAIR_RATE = 1.1;   // HP транспорта в секунду
function p1Dmg() { return coopMode ? ROLE_DMG_P1 : 1; }
function p2Dmg() { return ROLE_DMG_P2; }
function upLevel(id) { return (saveData.upgrades && saveData.upgrades[id]) || 0; }
function upCost(id) { const u = UPGRADES[id], l = upLevel(id); return l >= u.max ? null : u.cost[l]; }
function salvageMult() { return 1 + 0.25 * upLevel('salvage'); }
function maxHp() { return 3 + upLevel('hull'); }
function dashCdBase() { return Math.round(2000 * Math.pow(0.85, upLevel('coolant'))); }

// Ближайшая по цене непокупленная позиция — под прогресс-бар «184/250»
function nextGoal() {
    let best = null;
    for (const id in UPGRADES) { const c = upCost(id); if (c !== null && (!best || c < best.cost)) best = { id, cost: c }; }
    return best;
}

// Единственная точка начисления очков. Все прежние score += идут через неё,
// иначе кошелёк расходится со счётом при любой правке.
function addScore(points, credits = 0) {
    score += points;
    if (credits > 0) runCredits += Math.max(1, Math.round(credits * salvageMult() * diveMult));
    noteScoreEvent(points);
    noteCoreScore(points);
    dailyEvent('score', points);
    updateStyleRank();
    updateCreditsUI();
}

function bankCredits() {
    const n = runCredits;
    if (n <= 0) return 0;
    saveData.wallet = (saveData.wallet || 0) + n;
    runCredits = 0;
    writeSave();
    updateCreditsUI();
    return n;
}
