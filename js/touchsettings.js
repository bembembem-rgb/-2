// === НАСТРОЙКИ ДЛЯ ТЕЛЕФОНА ===
// Всё, что на телефоне у всех разное: размер руки, рабочая рука, терпимость
// к самоприцелу и к яркости. Значения живут в сейве и применяются сразу,
// без перезапуска забега.

const TOUCH_DEFAULTS = {
    autoFire: 1,      // 0 — только со стика, 1 — сам бьёт по ближайшему
    lefty: 0,         // 1 — ход справа, прицел слева
    joySize: 1,       // 0 мелкий, 1 обычный, 2 крупный
    hudScale: 1,      // 0 мельче, 1 обычный, 2 крупнее
    vibrate: 1,
    glow: 0,          // свечение мелочи: дорого, по умолчанию выключено
    music: 10,        // 0..10, десятка — штатный баланс игры
    sfx: 10
};

const TOUCH_JOY_RADIUS = [42, 56, 74];
const TOUCH_HUD_SCALE = [0.88, 1, 1.15];

let touchCfg = Object.assign({}, TOUCH_DEFAULTS);

function loadTouchCfg() {
    const src = (saveData && saveData.touch) || {};
    touchCfg = Object.assign({}, TOUCH_DEFAULTS);
    for (const k in TOUCH_DEFAULTS) if (typeof src[k] === 'number') touchCfg[k] = src[k];
    applyTouchCfg();
}

function saveTouchCfg() {
    saveData.touch = Object.assign({}, touchCfg);
    writeSave();
}

function applyTouchCfg() {
    JOY_RADIUS = TOUCH_JOY_RADIUS[touchCfg.joySize] || TOUCH_JOY_RADIUS[1];
    GLOW_MANY = touchCfg.glow ? 1 : (isMobile ? 0 : 1);
    musicVolume = touchCfg.music / 10;
    sfxVolume = touchCfg.sfx / 10;
    if (currentBGM) currentBGM.volume = 0.5 * musicVolume;
    document.documentElement.style.setProperty('--hud-scale', TOUCH_HUD_SCALE[touchCfg.hudScale] || 1);
    document.body.classList.toggle('lefty', !!touchCfg.lefty);
}

// Короткий отклик в руку. Айфон метод игнорирует, андроид — нет,
// поэтому это подарок части игроков, а не обязательная механика.
function buzz(ms) {
    if (!touchCfg.vibrate || !isMobile || !navigator.vibrate) return;
    try { navigator.vibrate(ms); } catch (e) {}
}

// Левая половина экрана не всегда «ход»: левше удобнее наоборот.
function joyForTouch(clientX) {
    const left = clientX < window.innerWidth / 2;
    return (touchCfg.lefty ? !left : left) ? leftJoy : rightJoy;
}

const TOUCH_ROWS = [
    { key: 'autoFire', title: 'АВТООГОНЬ', opts: ['ВЫКЛ', 'ПО БЛИЖАЙШЕМУ'],
      note: 'Стреляет сам, пока правый палец свободен. Стик прицела всё равно главнее.' },
    { key: 'lefty', title: 'РУКА', opts: ['ПРАВАЯ', 'ЛЕВАЯ'],
      note: 'Меняет половины местами: ход справа, прицел слева.' },
    { key: 'joySize', title: 'СТИК', opts: ['МЕЛКИЙ', 'ОБЫЧНЫЙ', 'КРУПНЫЙ'],
      note: 'Насколько далеко вести палец до полного хода.' },
    { key: 'hudScale', title: 'РАЗМЕР HUD', opts: ['МЕЛЬЧЕ', 'ОБЫЧНЫЙ', 'КРУПНЕЕ'] },
    { key: 'glow', title: 'СВЕЧЕНИЕ', opts: ['ВЫКЛ', 'ВКЛ'],
      note: 'Красиво, но на слабом телефоне забирает половину кадров.' },
    { key: 'vibrate', title: 'ВИБРАЦИЯ', opts: ['ВЫКЛ', 'ВКЛ'] },
    { key: 'music', title: 'МУЗЫКА', range: 10 },
    { key: 'sfx', title: 'ЗВУКИ', range: 10 }
];

function renderTouchSettings() {
    const list = document.getElementById('touch-settings-list');
    if (!list) return;
    list.innerHTML = TOUCH_ROWS.map(row => {
        const v = touchCfg[row.key];
        if (row.range) {
            return `<div class="set-row">
                <div class="set-head"><span class="set-title">${row.title}</span><span class="set-val">${v * 10}%</span></div>
                <div class="set-steps">${Array.from({ length: row.range + 1 }, (_, i) =>
                    `<button class="set-step${i === v ? ' is-on' : ''}" onclick="setTouchCfg('${row.key}',${i})" aria-label="${i * 10}%"></button>`).join('')}</div>
            </div>`;
        }
        return `<div class="set-row">
            <div class="set-head"><span class="set-title">${row.title}</span></div>
            <div class="set-opts">${row.opts.map((o, i) =>
                `<button class="set-opt${i === v ? ' is-on' : ''}" onclick="setTouchCfg('${row.key}',${i})">${o}</button>`).join('')}</div>
            ${row.note ? `<div class="set-note">${row.note}</div>` : ''}
        </div>`;
    }).join('');
}

window.setTouchCfg = function (key, value) {
    if (!(key in touchCfg)) return;
    touchCfg[key] = value;
    applyTouchCfg();
    saveTouchCfg();
    renderTouchSettings();
    playSFX(sfxUiNav, 0.4);
    if (key === 'vibrate' && value) buzz(20);
};

window.resetTouchCfg = function () {
    touchCfg = Object.assign({}, TOUCH_DEFAULTS);
    applyTouchCfg();
    saveTouchCfg();
    renderTouchSettings();
};
