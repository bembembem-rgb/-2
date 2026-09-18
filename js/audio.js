// --- МЕНЕДЖЕР АУДИО ---
const bgmMenu = new Audio('menu_bg.mp3'); bgmMenu.loop = true;
const bgmFight = new Audio('fight.mp3'); bgmFight.loop = true;
const bgmBoss1 = new Audio('boss1.mp3'); bgmBoss1.loop = true;
const bgmBoss2 = new Audio('boss2.mp3'); bgmBoss2.loop = true;
const bgmBoss3 = new Audio('boss3.mp3'); bgmBoss3.loop = true;
const bgmBoss4 = new Audio('boss4.mp3'); bgmBoss4.loop = true;
const bgmBoss5 = new Audio('boss5.mp3'); bgmBoss5.loop = true;
const bgmFinale = new Audio('finale.mp3'); bgmFinale.loop = false;

// Банк вариантов. Игра зовёт звук одним именем, а playSFX сама подставляет
// следующий файл: иначе про варианты пришлось бы знать каждому вызову
// в каждом модуле. Ухо ловит повтор по одинаковой атаке, и разброс высоты
// (vary) её не меняет — спасает именно другой файл.
const SFX_BANKS = new Map();
function sfxBank(files) {
    const list = files.map(f => new Audio(f));
    const b = { list, i: 0 };
    for (const a of list) SFX_BANKS.set(a, b);
    return list[0];
}

// Звуки собраны синтезом, исходник рецептов — tools/make_sfx.py.
// У каждого действия несколько вариантов: ухо ловит повтор по одинаковой
// атаке, и разброс высоты (vary в playSFX) её не прячет — спасает только
// другой файл. Варианты отличаются и длиной, и яркостью, потому что
// одинаковая длина выдаёт повтор быстрее всего остального.
const sfxPistol      = sfxBank(['sfx/shot_pistol_1.mp3', 'sfx/shot_pistol_2.mp3',
                                'sfx/shot_pistol_3.mp3', 'sfx/shot_pistol_4.mp3']);
const sfxShotgun     = sfxBank(['sfx/shot_shotgun_1.mp3', 'sfx/shot_shotgun_2.mp3', 'sfx/shot_shotgun_3.mp3']);
const sfxEnemyShot   = sfxBank(['sfx/shot_enemy_1.mp3', 'sfx/shot_enemy_2.mp3', 'sfx/shot_enemy_3.mp3']);
const sfxAlt         = sfxBank(['sfx/shot_alt_1.mp3', 'sfx/shot_alt_2.mp3', 'sfx/shot_alt_3.mp3']);
const sfxRocket      = sfxBank(['sfx/rocket_launch_1.mp3', 'sfx/rocket_launch_2.mp3']);
const sfxVehicleBoom = sfxBank(['sfx/boom_1.mp3', 'sfx/boom_2.mp3', 'sfx/boom_3.mp3']);

const sfxAchievement = new Audio('sfx/achievement_1.mp3');
const sfxParryShield = sfxBank(['sfx/parry_up_1.mp3', 'sfx/parry_up_2.mp3']);     // щит поднят
const sfxParryDone   = sfxBank(['sfx/parry_hit_1.mp3', 'sfx/parry_hit_2.mp3']);   // удар отражён
const sfxDash        = sfxBank(['sfx/dash_1.mp3', 'sfx/dash_2.mp3', 'sfx/dash_3.mp3']);
const sfxWeapon      = sfxBank(['sfx/weapon_1.mp3', 'sfx/weapon_2.mp3']);
const sfxUiNav       = sfxBank(['sfx/ui_1.mp3', 'sfx/ui_2.mp3', 'sfx/ui_3.mp3']);
const sfxHurt        = sfxBank(['sfx/hurt_1.mp3', 'sfx/hurt_2.mp3', 'sfx/hurt_3.mp3']);
const sfxEnemyDeath  = sfxBank(['sfx/enemy_death_1.mp3', 'sfx/enemy_death_2.mp3',
                                'sfx/enemy_death_3.mp3', 'sfx/enemy_death_4.mp3']);
const sfxLose        = new Audio('sfx/lose_1.mp3');
const sfxSurge       = sfxBank(['sfx/surge_1.mp3', 'sfx/surge_2.mp3']);
const sfxPulse       = sfxBank(['sfx/pulse_1.mp3', 'sfx/pulse_2.mp3']);
const sfxGlitch      = sfxBank(['sfx/glitch_1.mp3', 'sfx/glitch_2.mp3']);

// Подмена на случай отсутствующего файла. Немая способность читается как
// поломка: игрок жмёт Q, экран дрожит, а звука нет. Ошибку загрузки ловим
// один раз и дальше играем заменой с пониженной высотой.
const SFX_FALLBACK = new Map();
function sfxFallback(src, alt, rate = 1) {
    const a = new Audio(src);
    a.addEventListener('error', () => SFX_FALLBACK.set(a, { alt, rate }), { once: true });
    return a;
}
// Единственный звук, оставшийся от прежнего набора. Подмена тут только на
// случай, если файла не окажется рядом: сам звук не тронут.
const sfxBossSpawn = sfxFallback('bossspawn.mp3', sfxSurge, 0.8);

let currentBGM = null;

function unlockAudio() {
    if (audioUnlocked) return;
    audioUnlocked = true;
    const silentPlay = (audio) => {
        audio.volume = 0;
        let p = audio.play();
        if (p !== undefined) p.then(() => audio.pause()).catch(() => {});
    };
    // Прогреваем каждый файл банка, а не только первый: непрогретый вариант
    // на мобильном молчит ровно один раз — и это слышно как пропуск выстрела.
    SFX_BANKS.forEach(b => b.list.forEach(silentPlay));
    silentPlay(sfxPistol); silentPlay(sfxShotgun);
    silentPlay(sfxVehicleBoom); silentPlay(sfxRocket); silentPlay(sfxAlt);
    silentPlay(sfxDash); silentPlay(sfxWeapon); silentPlay(sfxUiNav);
    silentPlay(sfxParryShield); silentPlay(sfxParryDone);
}

function playBGM(track) {
    if (!audioUnlocked || !track) return;
    if (currentBGM === track) {
        if (currentBGM.paused) currentBGM.play().catch(() => {});
        return;
    }
    if (currentBGM) { currentBGM.pause(); currentBGM.currentTime = 0; }
    currentBGM = track;
    currentBGM.volume = 0.5;
    currentBGM.play().catch(e => console.warn("Audio error:", e));
}

// startAt — с какой секунды файла играть. Клон не наследует буфер оригинала,
// поэтому до loadedmetadata присвоение currentTime молча игнорируется.
// vary — разброс высоты в долях от единицы. Один и тот же файл, пущенный
// подряд десять раз, ухо ловит именно по одинаковой высоте и слышит как
// заедание. Полпроцента не спасают, больше 8% превращают выстрел в мультик.
// preservesPitch обязателен: без него браузер меняет только темп.
function playSFX(sound, volume = 0.5, startAt = 0, vary = 0) {
    if (!audioUnlocked || !sound) return;
    let rate = 1;
    const fb = SFX_FALLBACK.get(sound);
    if (fb) { sound = fb.alt; rate = fb.rate; }
    const b = SFX_BANKS.get(sound);
    if (b) { sound = b.list[b.i]; b.i = (b.i + 1) % b.list.length; }
    const clone = sound.cloneNode();
    clone.volume = volume;
    if (vary > 0 || rate !== 1) {
        if ('preservesPitch' in clone) clone.preservesPitch = false;
        if ('mozPreservesPitch' in clone) clone.mozPreservesPitch = false;
        // fxRandom, а не Math.random: разброс высоты звука на игру не влияет,
        // но звуков за забег сотни, и один пропущенный из-за просадки кадров
        // сдвигал бы весь игровой поток случайных чисел вслед за собой.
        clone.playbackRate = Math.max(0.25, rate * (1 + (fxRandom() * 2 - 1) * vary));
    }
    if (!startAt) { clone.play().catch(() => {}); return clone; }
    const start = () => {
        try { clone.currentTime = startAt; } catch (e) {}
        clone.play().catch(() => {});
    };
    if (clone.readyState >= 1) start();
    else clone.addEventListener('loadedmetadata', start, { once: true });
    return clone;
}

// Обрывает залипший звук полёта: короткий фейд, иначе слышен щелчок.
function stopSFX(handle, fadeMs = 70) {
    if (!handle || handle._stopping) return;
    handle._stopping = true;
    const step = 20, dv = handle.volume / Math.max(1, fadeMs / step);
    const t = setInterval(() => {
        handle.volume = Math.max(0, handle.volume - dv);
        if (handle.volume <= 0.001) {
            clearInterval(t);
            try { handle.pause(); handle.currentTime = 0; } catch (e) {}
        }
    }, step);
}

// Взрыв снаряда. Порог, чтобы залп не складывался в кашу.
let _lastBoomSfx = 0;
function playBoomSFX(volume = 0.6) {
    const now = performance.now();
    if (now - _lastBoomSfx < 90) return;
    _lastBoomSfx = now;
    playSFX(sfxVehicleBoom, volume);
}

function playEnemyShotSFX() {
    playSFX(sfxEnemyShot, 0.2, 0, 0.07);
}

// Смерти врагов идут пачками — без порога это каша вместо звука
let _lastDeathSfx = 0;
function playEnemyDeathSFX() {
    const now = performance.now();
    if (now - _lastDeathSfx < 70) return;
    _lastDeathSfx = now;
    playSFX(sfxEnemyDeath, 0.35, 0, 0.07);
}
