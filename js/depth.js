// === ГЛУБИНА ===
// Сложность, которую игрок поднимает сам, потому что иначе не увидит часть
// содержимого. Легендарный дроп и два узла дерева живут только с четвёртой
// глубины — это и есть «погоня»: не «стало труднее», а «стало доступно».
//
// КАЛИБРОВКА
// Множитель ядер: ×1.0 / ×1.4 / ×1.8 / ×2.2 / ×2.6. Первая глубина —
// честная единица, а не штраф: на ней играет тот, кто пришёл первый раз.
// Спавн на пятой втрое чаще первой, врагов в пачке вдвое больше.
const DEPTH_MIN = 1, DEPTH_MAX = 5;
const DEPTH_CORE_STEP = 0.4;     // ядра: ×(1 + 0.4·(N-1))
const DEPTH_SPAWN_STEP = 0.5;    // спавн: делится на (1 + 0.5·(N-1))
const DEPTH_PACK_STEP = 0.35;    // размер пачки врагов
const DEPTH_BOSS_HP_STEP = 0.18; // HP боссов
const DEPTH_LEGENDARY_FROM = 4;  // ниже четвёртой легендарки не падают
const DEPTH_HUSK_FROM = 2;       // с какой глубины в воде водится ОБОЛОЧКА

const DEPTH_NAMES = {
    1: 'МЕЛКОВОДЬЕ', 2: 'ТЕРМОКЛИН', 3: 'СУМЕРЕЧНАЯ ЗОНА', 4: 'БЕЗДНА', 5: 'НУЛЕВОЕ ДНО'
};

let runDepth = 1;   // глубина текущего забега

// Пятая открывается победой на четвёртой: «победа» — это добровольный выход
// (finishRunEscaped), а не смерть. Дойти до конца и уйти живым — разные вещи.
function depthUnlocked(n) {
    if (n <= DEPTH_MAX - 1) return true;
    return !!(saveData.depthWins && saveData.depthWins[DEPTH_MAX - 1]);
}

function selectedDepth() {
    const d = Math.max(DEPTH_MIN, Math.min(DEPTH_MAX, saveData.depth || 1));
    return depthUnlocked(d) ? d : DEPTH_MAX - 1;
}

function setDepth(n) {
    n = Math.max(DEPTH_MIN, Math.min(DEPTH_MAX, n));
    if (!depthUnlocked(n)) return false;
    saveData.depth = n;
    writeSave();
    return true;
}

function depthCoreMult()  { return 1 + DEPTH_CORE_STEP * (runDepth - 1); }
function depthSpawnDiv()  { return 1 + DEPTH_SPAWN_STEP * (runDepth - 1); }
function depthPackBonus() { return Math.round(DEPTH_PACK_STEP * (runDepth - 1) * 3); }
function depthBossHpMult(){ return 1 + DEPTH_BOSS_HP_STEP * (runDepth - 1); }
function legendaryAllowed() { return runDepth >= DEPTH_LEGENDARY_FROM; }
function huskAllowed() { return runDepth >= DEPTH_HUSK_FROM; }

// Рекорд ведётся по каждой глубине отдельно: счёт на первой и на пятой —
// это разные игры, и общая таблица сравнивала бы несравнимое.
function depthBest(n) { return (saveData.depthBest && saveData.depthBest[n]) || 0; }

function recordDepthRun(finalScore, escaped) {
    saveData.depthBest = saveData.depthBest || {};
    const prev = saveData.depthBest[runDepth] || 0;
    const isBest = finalScore > prev;
    if (isBest) saveData.depthBest[runDepth] = finalScore;
    if (escaped) {
        saveData.depthWins = saveData.depthWins || {};
        const first = !saveData.depthWins[runDepth];
        saveData.depthWins[runDepth] = (saveData.depthWins[runDepth] || 0) + 1;
        // Открытие пятой — событие, которое обязано быть замечено
        if (first && runDepth === DEPTH_MAX - 1) {
            showAchievementToast(`ГЛУБИНА ${DEPTH_MAX}: ${DEPTH_NAMES[DEPTH_MAX]}`, 'ОТКРЫТО');
        }
    }
    writeSave();
    return isBest;
}
