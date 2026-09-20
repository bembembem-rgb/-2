const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    || (navigator.maxTouchPoints > 1 && matchMedia('(pointer: coarse)').matches);

// --- ГЛОБАЛЬНЫЕ СОСТОЯНИЯ ---
let gameState = 'loading'; 
let audioUnlocked = false;

// Стик «плавающий»: база появляется там, где палец коснулся экрана.
// Фиксированный стик заставляет искать его вслепую, а на телефоне игрок
// смотрит на бой, а не на свои пальцы.
// startX/startY и tapAt нужны, чтобы отличить ведение от тапа: тап — это
// касание, которое почти не сдвинулось и быстро закончилось.
let leftJoy = { active: false, dx: 0, dy: 0, originX: 0, originY: 0, touchId: null, startX: 0, startY: 0, downAt: 0, lastTapAt: 0, moved: 0 };
let rightJoy = { active: false, dx: 0, dy: 0, originX: 0, originY: 0, touchId: null, startX: 0, startY: 0, downAt: 0, lastTapAt: 0, moved: 0 };
// Порог радиуса стика в пикселях и параметры распознавания тапа
const JOY_RADIUS = 56, TAP_SLOP = 14, TAP_TIME = 260, DOUBLE_TAP_GAP = 320;
// Рядом ли транспорт — от этого зависит контекстная кнопка на телефоне
let nearVehicleNow = false;
let mouse = { screenX: window.innerWidth / 2, screenY: window.innerHeight / 2, worldX: 0, worldY: 0 };
let keys = { KeyW: false, KeyA: false, KeyS: false, KeyD: false };

// На itch и подобных порталах игра живёт в iframe внутри обычной страницы.
// Без preventDefault стрелки и Space скроллят страницу портала, а Slash и
// Quote открывают быстрый поиск в Firefox — то есть управление P2 не работает.
// Tab намеренно не включён: перехват сломал бы навигацию с клавиатуры.
const GAME_KEYS = new Set([
    'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'KeyF', 'KeyC', 'KeyM', 'KeyR',
    'ShiftLeft', 'ShiftRight', 'Space',
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'Enter', 'Quote', 'Backslash', 'Slash', 'Period', 'ControlRight',
    'KeyG', 'KeyH', 'KeyV', 'KeyN'
]);

let SPRITE_CONFIG = {};
const gridColors = [
    {r: 0, g: 255, b: 255}, 
    {r: 0, g: 150, b: 255}, 
    {r: 32, g: 178, b: 170}, 
    {r: 0, g: 206, b: 209}
];

let player, camera, camera2, isShooting = false;
let player2 = null, coopMode = false;
let player2InputMode = 'keyboard'; // 'keyboard' | номер геймпада (index)
let transports = [], projectiles = [], enemies = [], particles = [], trails = [], scorches = [];
let enemyProjectiles = [], bubbles = [], customObstacles = [], obstacles = new Map(), pulseRingFx = [];
let parryShockwaves = [], parryFlashTimer = 0;
let spriteFx = [];
// Мелочь, которая в жизни есть, а в игре не было: гильзы из окна выброса,
// дым и муть после выстрела, искры от попадания в броню, ударная волна
// взрыва. Массивы отдельные, а не флаги на particles: у каждого своя
// физика и свой способ рисования.
let casings = [], smokePuffs = [], sparks = [], shockRings = [];
let glitchTimer = 0; const GLITCH_DURATION = 480;
let glitchSnapCanvas = null, glitchSnapCtx = null;
let glitchChR = null, glitchChG = null, glitchChB = null;
let destroyedObstacles = new Set();

const bossThresholds = [3000, 6000, 9000];
let nextBossScore = 3000;
let currentBossIndex = 0, bossCutsceneTimer = 0, currentBossName = "", activeBoss = null;
// Потолок живых врагов. Выше него кадр проседает: разлипание толпы
// считается попарно, а это O(n²).
const ENEMY_CAP = 50;
let _lastPlayerX = null, _lastPlayerY = null;
let vehicleKillsThisRun = 0, hpLostAny = false, bossFightStartHp = null, hitStopTimer = 0;
let shakeTime = 0, lastFrameTime = 0, enemySpawnTimer = 0, worldTimer = 0, score = 0;
