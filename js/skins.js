// --- ТЕКСТУРЫ ТРАНСПОРТА ---
// Скин — это тайл 64x64, который натягивается на спрайт-лист транспорта через
// source-atop: красятся только непрозрачные пиксели, силуэт не меняется.
// Альфа ниже единицы намеренно: под текстурой должна просвечивать исходная
// светотень листа, иначе машина превращается в плоскую наклейку.

const SKIN_TILE = 64;

// cost 0 — базовый, он всегда куплен. Порядок в объекте = порядок в магазине.
// drift — на сколько долей тайла текстура уезжает за полный цикл анимации.
// Направление подобрано под рисунок: сетка ползёт по диагонали, хром — строго
// поперёк корпуса (так читается блик), трещины магмы почти стоят и лишь дышат.
const VEHICLE_SKINS = {
    stock:   { title: 'ЗАВОДСКАЯ',  desc: 'Как сошла с конвейера до Потопа.',                 cost: 0,   alpha: 0,    drift: [0, 0] },
    neon:    { title: 'NEON',       desc: 'Сетка контура поверх брони. Ползёт по обшивке.',   cost: 150, alpha: 0.55, drift: [1, 1] },
    circuit: { title: 'CIRCUIT',    desc: 'Дорожки мёртвой платы. Ток по ним всё ещё идёт.',  cost: 250, alpha: 0.6,  drift: [1, 0] },
    ice:     { title: 'ICE',        desc: 'Намёрзший хладагент. Кристаллы медленно растут.',  cost: 300, alpha: 0.6,  drift: [0, -1] },
    magma:   { title: 'MAGMA',      desc: 'Корка сплава, трещины дышат и светятся.',          cost: 400, alpha: 0.65, drift: [0, 1] },
    chrome:  { title: 'CHROME',     desc: 'Полировка. Блик бежит по корпусу поперёк хода.',   cost: 500, alpha: 0.5,  drift: [2, 0] },
    galaxy:  { title: 'GALAXY',     desc: 'Кусок неба, которого со дна не видно. Плывёт.',    cost: 650, alpha: 0.7,  drift: [-1, 1] },
    gold:    { title: 'GOLD',       desc: 'Чистая трата кредитов. Именно поэтому дорого.',    cost: 900, alpha: 0.6,  drift: [1, -1] }
};

// Кадров в цикле и длительность кадра. Шесть — компромисс: меньше заметно
// рывками, больше съедает памяти (каждый кадр это отдельная копия листа 256x256).
const SKIN_PHASES = 6;
const SKIN_FRAME_MS = 120;

// --- Рисование тайлов ---
// Всё по пикселям, imageSmoothingEnabled = false: текстура обязана оставаться
// пиксель-артом и после масштабирования вместе со спрайтом.

function skinPx(g, x, y, color) { g.fillStyle = color; g.fillRect(x, y, 1, 1); }

// Тот же Байер, что в генераторе эффектов: ступени палитры вместо градиента
const SKIN_BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const skinDith = (x, y, t) => (SKIN_BAYER[((y & 3) << 2) + (x & 3)] + 0.5) / 16 < t;
function skinRnd(seed) { const s = Math.sin(seed * 91.7 + 47.3) * 43758.5453; return s - Math.floor(s); }

const SKIN_PAINT = {
    neon(g, S) {
        g.fillStyle = '#123040'; g.fillRect(0, 0, S, S);
        for (let i = 0; i < S; i += 8) {
            g.fillStyle = '#0f7f8c'; g.fillRect(i, 0, 1, S); g.fillRect(0, i, S, 1);
        }
        // Узлы сетки ярче линий — иначе текстура читается как просто клетка
        for (let x = 0; x < S; x += 8) for (let y = 0; y < S; y += 8) {
            skinPx(g, x, y, '#00e0ff');
            if ((x + y) % 16 === 0) { skinPx(g, x + 1, y, '#9df4ff'); skinPx(g, x, y + 1, '#9df4ff'); }
        }
    },
    circuit(g, S) {
        g.fillStyle = '#10361c'; g.fillRect(0, 0, S, S);
        // Дорожки ломаются под прямым углом — это плата, а не змейки
        for (let k = 0; k < 6; k++) {
            let x = Math.floor(skinRnd(k) * S), y = Math.floor(skinRnd(k + 20) * S);
            let horiz = k % 2 === 0;
            for (let s = 0; s < 9; s++) {
                const run = 5 + Math.floor(skinRnd(k * 13 + s) * 8);
                const dx = horiz ? 1 : 0, dy = horiz ? 0 : 1;
                for (let i = 0; i < run; i++) {
                    skinPx(g, (x + dx * i) % S, (y + dy * i) % S, '#3fdd4a');
                    skinPx(g, (x + dx * i + (horiz ? 0 : 1)) % S, (y + dy * i + (horiz ? 1 : 0)) % S, '#14591c');
                }
                x = (x + dx * run) % S; y = (y + dy * run) % S;
                // Поворот только в конце участка — так это дорожка, а не лесенка
                horiz = !horiz;
            }
            // Контактная площадка на конце дорожки
            g.fillStyle = '#b6ffbc'; g.fillRect(x % S, y % S, 2, 2);
        }
    },
    ice(g, S) {
        g.fillStyle = '#123b56'; g.fillRect(0, 0, S, S);
        // Грани кристалла: диагонали разной длины, светлая сторона одна
        for (let k = 0; k < 14; k++) {
            const x0 = Math.floor(skinRnd(k) * S), y0 = Math.floor(skinRnd(k + 11) * S);
            const len = 6 + Math.floor(skinRnd(k + 31) * 14), dir = skinRnd(k + 51) > 0.5 ? 1 : -1;
            for (let i = 0; i < len; i++) {
                skinPx(g, (x0 + i) % S, (y0 + i * dir + S) % S, '#a9ccff');
                skinPx(g, (x0 + i) % S, (y0 + i * dir + 1 + S) % S, '#1e5fbf');
            }
        }
        for (let x = 0; x < S; x++) for (let y = 0; y < S; y++)
            if (skinDith(x, y, 0.12)) skinPx(g, x, y, '#dde6ec');
    },
    magma(g, S) {
        g.fillStyle = '#2e1c1c'; g.fillRect(0, 0, S, S);
        for (let x = 0; x < S; x++) for (let y = 0; y < S; y++)
            if (skinDith(x, y, 0.25)) skinPx(g, x, y, '#43282a');
        // Трещины: случайное блуждание с ярким ядром и тёмной каймой
        for (let k = 0; k < 9; k++) {
            let x = Math.floor(skinRnd(k + 3) * S), y = Math.floor(skinRnd(k + 17) * S);
            for (let s = 0; s < 30; s++) {
                skinPx(g, x, y, s % 5 === 0 ? '#ffe98a' : '#ff9f1c');
                skinPx(g, (x + 1) % S, y, '#a8730c');
                x = (x + (skinRnd(k * 40 + s) > 0.5 ? 1 : 0) + S) % S;
                y = (y + (skinRnd(k * 40 + s + 7) > 0.45 ? 1 : -1) + S) % S;
            }
        }
    },
    chrome(g, S) {
        // Ступенчатые полосы: хром — это резкие переходы, а не мягкий градиент
        const ramp = ['#38424c', '#6d7a86', '#aab6c0', '#dde6ec', '#ffffff', '#aab6c0', '#6d7a86', '#38424c'];
        for (let x = 0; x < S; x++) {
            g.fillStyle = ramp[Math.floor((x / S) * ramp.length) % ramp.length];
            g.fillRect(x, 0, 1, S);
        }
        for (let y = 0; y < S; y += 11) { g.fillStyle = '#11161c'; g.fillRect(0, y, S, 1); }
    },
    galaxy(g, S) {
        g.fillStyle = '#2a1550'; g.fillRect(0, 0, S, S);
        // Туманность — три пятна дизерингом, потом звёзды поверх
        const clouds = [[18, 20, 22, '#7a1fd0'], [44, 40, 18, '#c46dff'], [30, 52, 14, '#3d8bff']];
        for (const [cx, cy, r, col] of clouds)
            for (let x = 0; x < S; x++) for (let y = 0; y < S; y++) {
                const d = Math.hypot(x - cx, y - cy);
                if (d < r && skinDith(x, y, 1 - d / r)) skinPx(g, x, y, col);
            }
        for (let k = 0; k < 46; k++) {
            const x = Math.floor(skinRnd(k + 61) * S), y = Math.floor(skinRnd(k + 91) * S);
            skinPx(g, x, y, k % 6 === 0 ? '#ffffff' : k % 3 === 0 ? '#e8c4ff' : '#aab6c0');
        }
    },
    gold(g, S) {
        g.fillStyle = '#5a3a06'; g.fillRect(0, 0, S, S);
        // Диагональ шириной 8: одна полоса — блик, остальные тело
        for (let x = 0; x < S; x++) for (let y = 0; y < S; y++) {
            const d = (x + y) % 16;
            const col = d < 2 ? '#ffe98a' : d < 4 ? '#f0c419' : d < 9 ? '#a8730c' : '#5a3a06';
            skinPx(g, x, y, col);
        }
        for (let k = 0; k < 10; k++) {
            const x = Math.floor(skinRnd(k + 7) * S), y = Math.floor(skinRnd(k + 23) * S);
            skinPx(g, x, y, '#ffffff');
        }
    }
};

const skinTileCache = {};
function getSkinTile(id) {
    if (skinTileCache[id]) return skinTileCache[id];
    const paint = SKIN_PAINT[id];
    if (!paint) return null;
    const cv = document.createElement('canvas');
    cv.width = SKIN_TILE; cv.height = SKIN_TILE;
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    paint(g, SKIN_TILE);
    skinTileCache[id] = cv;
    return cv;
}

// --- Применение к листу транспорта ---

// Ключ кэша — «скин:фаза». При смене скина кэш чистится целиком: держать
// в памяти шесть копий листа от каждого купленного скина незачем.
let skinnedSheetCache = {};

function activeVehicleSkin() {
    const id = saveData.cosmetics && saveData.cosmetics.vehicle;
    return (id && VEHICLE_SKINS[id]) ? id : 'stock';
}

function bakeSkinPhase(id, phase) {
    const skin = VEHICLE_SKINS[id];
    const tile = getSkinTile(id);
    if (!skin || !tile) return vehiclesImg;
    const w = vehiclesImg.naturalWidth || vehiclesImg.width;
    const h = vehiclesImg.naturalHeight || vehiclesImg.height;
    if (!w || !h) return vehiclesImg;

    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(vehiclesImg, 0, 0);

    // Текстура ложится только на непрозрачные пиксели: силуэт не меняется
    const t = phase / SKIN_PHASES;
    const ox = Math.round(skin.drift[0] * SKIN_TILE * t);
    const oy = Math.round(skin.drift[1] * SKIN_TILE * t);
    g.globalCompositeOperation = 'source-atop';
    g.globalAlpha = skin.alpha;
    g.save();
    g.translate(ox, oy);
    g.fillStyle = g.createPattern(tile, 'repeat');
    g.fillRect(-ox, -oy, w + Math.abs(ox) * 2, h + Math.abs(oy) * 2);
    g.restore();

    // Линии и светотень возвращаются умножением на исходный лист: чёрный
    // контур умножает текстуру в ноль и остаётся чистым, а панели сохраняют
    // рисунок. Без этого шага машина превращается в наклейку без деталей.
    g.globalCompositeOperation = 'multiply';
    g.globalAlpha = 0.75;
    g.drawImage(vehiclesImg, 0, 0);

    // Умножение притемняет всё разом — возвращаем светлоту исходником сверху
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.3;
    g.drawImage(vehiclesImg, 0, 0);

    return cv;
}

// Лист транспорта под текущей текстурой на текущем кадре анимации.
// Каждая фаза печётся один раз и живёт в кэше: перекрашивать весь лист
// каждый кадр — это гарантированные просадки.
function vehicleSheet() {
    const id = activeVehicleSkin();
    const skin = VEHICLE_SKINS[id];
    if (!skin || !skin.alpha) return vehiclesImg;
    if (!isImageLoaded) return vehiclesImg;   // лист ещё не догрузился

    const moving = skin.drift[0] !== 0 || skin.drift[1] !== 0;
    const phase = moving ? Math.floor(performance.now() / SKIN_FRAME_MS) % SKIN_PHASES : 0;
    const key = id + ':' + phase;
    if (!skinnedSheetCache[key]) skinnedSheetCache[key] = bakeSkinPhase(id, phase);
    return skinnedSheetCache[key];
}

function clearSkinCache() { skinnedSheetCache = {}; }

// --- Кошелёк и владение ---

function skinOwned(id) {
    if (!VEHICLE_SKINS[id] || VEHICLE_SKINS[id].cost === 0) return true;
    return !!(saveData.cosmetics && saveData.cosmetics.skins && saveData.cosmetics.skins[id]);
}

function buyVehicleSkin(id) {
    const skin = VEHICLE_SKINS[id];
    if (!skin || skinOwned(id)) return false;
    const w = saveData.wallet || 0;
    if (w < skin.cost) return false;
    saveData.wallet = w - skin.cost;
    saveData.cosmetics = saveData.cosmetics || {};
    saveData.cosmetics.skins = saveData.cosmetics.skins || {};
    saveData.cosmetics.skins[id] = true;
    writeSave();
    return true;
}

function equipVehicleSkin(id) {
    if (!VEHICLE_SKINS[id] || !skinOwned(id)) return false;
    saveData.cosmetics = saveData.cosmetics || {};
    saveData.cosmetics.vehicle = id;
    clearSkinCache();
    writeSave();
    return true;
}
