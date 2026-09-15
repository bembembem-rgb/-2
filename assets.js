// --- ЗАГРУЗЧИК АССЕТОВ ---
let totalAssets = 38;
let loadedAssets = 0;
let isImageLoaded = false, isSlimeLoaded = false, isSlimeWhiteLoaded = false;

function assetLoaded() {
    loadedAssets++;
    if (loadedAssets >= totalAssets && gameState === 'loading') {
        gameState = 'click_to_start';
    }
}

function loadImg(src, onloadCallback) {
    const img = new Image();
    img.onload = () => { if (onloadCallback) onloadCallback(); assetLoaded(); };
    img.onerror = () => { console.warn(`Файл не найден: ${src}`); assetLoaded(); };
    img.src = src;
    return img;
}

// Раскладка листа транспорта. Координаты жёсткие, а не доли от размера:
// лист рисуется своим генератором (tools/vehicle-forge.html), и его сетка
// известна заранее. Доли были нужны, пока лист был чужим и мог приехать
// в любом разрешении.
//
// Корпуса рисуются ровно x2 от исходных пикселей: при
// imageSmoothingEnabled = false некратный масштаб рвёт пиксельную сетку —
// одни пиксели выходят вдвое шире соседних, и спрайт выглядит мятым.
// Винт — исключение (120 -> 160, x4/3): он крутится каждый кадр, его сетка
// и так никогда не совпадает с экранной, а диаметр задан не кратностью,
// а расстоянием между пилонами вертолёта.
SPRITE_CONFIG = {
    car:        { sx: 0,   sy: 0,   sw: 48,  sh: 96,  w: 96,  h: 192 },
    tankBody:   { sx: 48,  sy: 0,   sw: 60,  sh: 96,  w: 120, h: 192 },
    tankTurret: { sx: 108, sy: 0,   sw: 48,  sh: 96,  w: 96,  h: 192 },
    heliBody:   { sx: 156, sy: 0,   sw: 48,  sh: 120, w: 96,  h: 240 },
    heliRotor:  { sx: 0,   sy: 120, sw: 120, sh: 120, w: 160, h: 160 }
};
const vehiclesImg = loadImg('Military_vehicles_asset.png', () => { isImageLoaded = true; });

const slimeRedImg = loadImg('enemy_slime_32x32.png', () => isSlimeLoaded = true);
const slimeWhiteImg = loadImg('enemy_slime_pale_32x32.png', () => isSlimeWhiteLoaded = true);
const playerImg = loadImg('xplayer.png');
const pistolImg = loadImg('Sprite-0005.png'); 
const shotgunImg = loadImg('Sprite-0001.png');
const vfxOrange = loadImg('a1.png'); 
const vfxBlue = loadImg('a2.png');   
const vfxPurple = loadImg('a3.png'); 
const boss1Img = loadImg('boss1.png');
const boss2Img = loadImg('boss2.png');
const boss3Img = loadImg('boss3.png');
const boss4Img = loadImg('boss4.png');
const boss5Img = loadImg('boss5.png');

// Сторонний пак убран целиком: всё, что он давал, теперь рисует
// tools/fx-forge.html. Серая база плюс tintFx дают цвет в рантайме, поэтому
// одна руна обслуживает всех пятерых боссов вместо пяти отдельных файлов.

// Собственные листы из tools/fx-forge.html. Один ряд, кадр квадратный —
// spawnSpriteFX режет их без параметров. Слоты описаны в .claude/rules/fx.md.
const fxExtraction = loadImg('fx_extraction_48x48.png');
const fxVault      = loadImg('fx_vault_48x48.png');
const fxRevive     = loadImg('fx_revive_32x32.png');
const fxDashTrail  = loadImg('fx_dash_32x32.png');
const fxGeyser     = loadImg('fx_geyser_32x32.png');
const fxVoidRift   = loadImg('fx_void_48x48.png');
const fxDeploy     = loadImg('fx_deploy_48x48.png');
const fxPlayerHit  = loadImg('fx_playerhit_32x32.png');

// Вторая партия: свои листы вместо стороннего пака плюс два новых слота.
// Один художественный источник на всю игру — эффекты перестают выглядеть
// собранными из разных мест.
const fxHit        = loadImg('fx_hit_24x24.png');
const fxKill       = loadImg('fx_kill_32x32.png');
const fxParryUp    = loadImg('fx_parry_48x48.png');
const fxParryBurst = loadImg('fx_parryburst_64x64.png');
const fxPulseWave  = loadImg('fx_pulse_64x64.png');
const fxAltBlast   = loadImg('fx_alt_48x48.png');
const fxWreck      = loadImg('fx_wreck_48x48.png');
const fxDown       = loadImg('fx_down_48x48.png');

// Серая база под тонировку: цвет накладывается в рантайме
const fxRuneBase  = loadImg('fx_rune_48x48.png');
const fxRingBase  = loadImg('fx_ring_64x64.png');
const fxSlashBase = loadImg('fx_slash_48x48.png');
const fxShellBase = loadImg('fx_shell_48x48.png');
const fxGhostBase = loadImg('fx_ghost_32x32.png');

// Перекраска листа под цвет. source-atop поверх серой базы сохраняет светлоту:
// кадр остаётся объёмным, а не заливается плоским пятном. Кэш по «лист + цвет» —
// перерисовывать лист каждый кадр значит копить мусор в GC.
const tintedFxCache = {};
function tintFx(sheet, color) {
    if (!sheet || !color) return sheet;
    const w = sheet.naturalWidth || sheet.width, h = sheet.naturalHeight || sheet.height;
    if (!w || !h) return sheet;   // лист ещё не догрузился — вернём как есть
    const key = (sheet.src || 'x') + '|' + color;
    if (tintedFxCache[key]) return tintedFxCache[key];
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(sheet, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.globalAlpha = 0.72;
    g.fillStyle = color;
    g.fillRect(0, 0, w, h);
    tintedFxCache[key] = cv;
    return cv;
}

// Собственные взрывы. Кадр квадратный, сторона берётся из высоты листа.
const fxBoomTank  = loadImg('tankballexplode.png');
const fxBoomRoc   = loadImg('helicopterexploderoclet.png');
const fxBoomBoss  = loadImg('explosion_boss.png');

// Лист босса режется не так, как остальные. Правится здесь и больше нигде.
// fw/fh — размер кадра в пикселях, cols — сколько кадров в ряду, frames — всего.
// null = автоопределение (кадр квадратный, сторона = высота листа).
// Лист 1040x48 = 13 кадров по 80x48. Первый кадр пустой, поэтому start: 1.
let FX_BOSS_CUT = { fw: 80, fh: 48, cols: 13, frames: 13, start: 1 };

// Раскладка эффектов по боссам. Ключ — activeBoss.name.
// Цвет босса — единственное, что отличает его эффекты. Формы общие для всех.
const BOSS_FX = {
    'ABYSSAL WARDEN': { color: '#00e0ff' },
    'TIDE CALLER':    { color: '#f0c419' },
    'LEVIATHAN':      { color: '#ff2d55' },
    'THORN REEF':     { color: '#3fdd4a' },
    'VOID WRAITH':    { color: '#c46dff' }
};

function bossFx(boss, kind) {
    const set = boss && BOSS_FX[boss.name];
    const color = set ? set.color : '#c46dff';
    const base = kind === 'rune' ? fxRuneBase : kind === 'ring' ? fxRingBase : fxSlashBase;
    return tintFx(base, color);
}
