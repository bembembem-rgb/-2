// === PROGRESS (localStorage) ===
const SAVE_KEY = 'neonTidesZero_save_v1';

// itch отдаёт игру с домена html-classic.itch.zone — для браузера это сторонний
// источник. Когда стороннее хранилище заблокировано, localStorage молча пуст:
// без этой проверки игрок теряет кошелёк и рекорды и считает игру сломанной.
function probeStorage() {
    try {
        const k = '__nt_probe';
        localStorage.setItem(k, '1');
        const ok = localStorage.getItem(k) === '1';
        localStorage.removeItem(k);
        return ok;
    } catch { return false; }
}
let storageOk = probeStorage();

let _storageWarnShown = null;
function renderStorageWarning() {
    const el = document.getElementById('storage-warning');
    if (!el) return;
    const show = !storageOk;
    if (show === _storageWarnShown) return;
    _storageWarnShown = show;
    el.style.display = show ? 'block' : 'none';
    if (show) {
        el.innerHTML = 'ПРОГРЕСС НЕ СОХРАНЯЕТСЯ'
            + '<span>Браузер закрыл доступ к хранилищу. Открой игру в полноэкранном режиме '
            + 'или в отдельной вкладке — тогда кошелёк, апгрейды и рекорды перестанут теряться.</span>';
    }
}
function loadSave() {
    try {
        const d = JSON.parse(localStorage.getItem(SAVE_KEY));
        if (!d) throw 0;
        return { bestScore: d.bestScore || 0, bossWins: d.bossWins || {}, runs: Array.isArray(d.runs) ? d.runs : [], achievements: d.achievements || {}, stats: d.stats || { dashCount: 0, legendaries: 0 }, cosmetics: d.cosmetics || {}, wallet: d.wallet || 0, cores: d.cores || 0, unlocks: d.unlocks || {}, depth: d.depth || 1, depthBest: d.depthBest || {}, depthWins: d.depthWins || {}, upgrades: d.upgrades || {}, daily: d.daily || null };
    } catch { return { bestScore: 0, bossWins: {}, runs: [], achievements: {}, stats: { dashCount: 0 }, cosmetics: {}, wallet: 0, cores: 0, unlocks: {}, depth: 1, depthBest: {}, depthWins: {}, upgrades: {}, daily: null }; }
}
let achievementsScreenOpen = false;
// Открытое за текущий забег. Чистится в initGameCore, читается экраном смерти.
let runUnlocks = [];
let saveData = loadSave();
function writeSave() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(saveData)); }
    catch { if (storageOk) { storageOk = false; renderStorageWarning(); } }
}
const ACHIEVEMENTS = {
    first_dive: { title: 'ПЕРВОЕ ПОГРУЖЕНИЕ', desc: 'Заверши свой первый забег.' },
    warden_down: { title: 'ЦЕРБЕР ГЛУБИН ПОВЕРЖЕН', desc: 'Победи ABYSSAL WARDEN.' },
    tide_tamed: { title: 'ПРИЗЫВАТЕЛЬ УКРОЩЁН', desc: 'Победи TIDE CALLER.' },
    leviathan_slain: { title: 'ЛЕВИАФАН НИЗВЕРГНУТ', desc: 'Победи LEVIATHAN.' },
    reef_cleared: { title: 'РИФ ЗАЧИЩЕН', desc: 'Победи THORN REEF.' },
    wraith_erased: { title: 'ПРИЗРАК СТЁРТ', desc: 'Победи VOID WRAITH.' },
    rank_p: { title: 'РАНГ P: ИДЕАЛЬНОЕ ПОГРУЖЕНИЕ', desc: 'Набери 2000+ очков за забег.' },
    survivor_5000: { title: 'ВЫЖИВШИЙ: 5000 ОЧКОВ', desc: 'Набери 5000+ очков за забег.' },
    new_best: { title: 'НОВЫЙ РЕКОРД', desc: 'Побей свой лучший счёт.' }
};
const SECRETS = {
    secret_flawless_boss: {
        title: 'ФРАГМЕНТ ПАМЯТИ: ПОСЛЕДНИЙ ИНЖЕНЕР',
        desc: 'Победи любого босса, не потеряв ни HP за весь бой.',
        reward: 'НАГРАДА: скин "ЧИСТЫЙ СИГНАЛ" — след дайвера теперь белый.',
        cutscene: 'Ты не оставил Стражу ни шанса задеть себя. В момент его краха сеть на миг очищается от помех — и ты слышишь голос: "...если ты это читаешь, протокол ещё можно спасти..." Сигнал обрывается.',
        cosmetic: 'clean_signal'
    },
    secret_speedrunner: {
        title: 'ФРАГМЕНТ ПАМЯТИ: НУЛЕВАЯ ЗАДЕРЖКА',
        desc: 'Доберись до первого босса быстрее чем за 90 секунд.',
        reward: 'НАГРАДА: скин "ПРИЗРАЧНЫЙ ДАЙВЕР" — полупрозрачный силуэт.',
        cutscene: 'Твоё сознание проходит сквозь мёртвую сеть быстрее, чем успевают среагировать защитные протоколы. На долю секунды ты видишь то, чего не должен: карту всех серверов AetherNet целиком. Затем — снова темнота.',
        cosmetic: 'ghost_diver'
    },
    secret_dasher: {
        title: 'ФРАГМЕНТ ПАМЯТИ: ЭХО ДВИЖЕНИЯ',
        desc: 'Соверши 200 рывков (суммарно за все забеги).',
        reward: 'НАГРАДА: скин "ГОЛУБОЙ ШЛЕЙФ" — усиленный дэш-трейл.',
        cutscene: '200 рывков сквозь толщу мёртвых данных — и сеть начинает узнавать твой почерк движения. Где-то в архивах открывается файл с меткой "УЧАСТНИК #0". Твоё старое имя. То, что было до Потопа.',
        cosmetic: 'blue_trail'
    },
    secret_scrapper: {
        title: 'ФРАГМЕНТ ПАМЯТИ: КЛАДБИЩЕ МАШИН',
        desc: 'Уничтожь 15 транспортов за один забег.',
        reward: 'НАГРАДА: скин "ЖЕЛЕЗНЫЙ ШТОРМ" — оранжевые искры при уроне.',
        cutscene: 'Обломки пятнадцати машин оседают на дно. Среди искорёженного металла ты замечаешь табличку с полустёртой надписью: "ЭВАКУАЦИОННЫЙ ФЛОТ №7 — НЕ СМОГЛИ ВЫЙТИ". Их путь окончен здесь. Твой — продолжается.',
        cosmetic: 'iron_storm'
    },
    secret_pacifist_minute: {
        title: 'ФРАГМЕНТ ПАМЯТИ: ТИХИЙ ЧАС',
        desc: 'Продержись первую минуту забега, не потеряв ни HP.',
        reward: 'НАГРАДА: скин "ТИХИЕ ВОДЫ" — спокойное свечение брони.',
        cutscene: 'Шестьдесят секунд без единого удара. В этой тишине AetherNet будто выдыхает — на миг гул мёртвой сети стихает, и ты почти веришь, что где-то там, наверху, всё ещё светит настоящее солнце.',
        cosmetic: 'quiet_waters'
    }
};
const BOSS_ACHIEVEMENT = {
    'ABYSSAL WARDEN': 'warden_down', 'TIDE CALLER': 'tide_tamed', 'LEVIATHAN': 'leviathan_slain',
    'THORN REEF': 'reef_cleared', 'VOID WRAITH': 'wraith_erased'
};
function unlockAchievement(id) {
    if (!(ACHIEVEMENTS[id] || SECRETS[id]) || saveData.achievements[id]) return;
    saveData.achievements[id] = Date.now();
    const secret = SECRETS[id];
    runUnlocks.push({ id, title: (ACHIEVEMENTS[id] || secret).title, secret: !!secret, reward: secret ? secret.reward : '' });
    if (secret && secret.cosmetic) { saveData.cosmetics = saveData.cosmetics || {}; saveData.cosmetics.active = secret.cosmetic; }
    writeSave();
    playSFX(sfxAchievement, 0.9);
    if (secret) { showSecretCutscene(secret); } else { showAchievementToast(ACHIEVEMENTS[id].title); }
    if (achievementsScreenOpen) renderAchievementsScreen();
}
function showSecretCutscene(secret) {
    let host = document.getElementById('secret-cutscene-host');
    if (!host) {
        host = document.createElement('div');
        host.id = 'secret-cutscene-host';
        host.style.cssText = 'position:fixed; inset:0; z-index:700; display:flex; align-items:center; justify-content:center; pointer-events:none; background:rgba(0,0,0,0); transition:background 150ms linear;';
        document.body.appendChild(host);
    }
    const box = document.createElement('div');
    box.style.cssText = 'max-width:600px; margin:0 24px; padding:24px; background:var(--panel); border:1px solid var(--gold); box-shadow:var(--shadow); text-align:center; opacity:0; transition:opacity 150ms linear;';
    box.innerHTML = `<div style="font-family:'Press Start 2P'; font-size:10px; color:var(--txt-dim); margin-bottom:16px;">СЕКРЕТНЫЕ ДАННЫЕ ВОССТАНОВЛЕНЫ</div>
        <div style="font-family:'Press Start 2P'; font-size:12px; color:var(--gold); margin-bottom:16px; line-height:1.6;">${secret.title}</div>
        <div style="font-family:system-ui, sans-serif; font-size:15px; color:var(--txt-dim); line-height:1.6; margin-bottom:16px; text-align:left;">${secret.cutscene}</div>
        <div style="font-family:'Press Start 2P'; font-size:10px; color:var(--cyan);">${secret.reward}</div>`;
    host.appendChild(box);
    host.style.background = 'rgba(5,8,14,0.92)';
    requestAnimationFrame(() => { box.style.opacity = '1'; });
    setTimeout(() => {
        box.style.opacity = '0';
        setTimeout(() => { box.remove(); if (!host.children.length) host.style.background = 'rgba(5,8,14,0)'; }, 150);
    }, 6000);
}
function showAchievementToast(text, label = 'ДОСТИЖЕНИЕ') {
    let host = document.getElementById('achievement-toast-host');
    if (!host) {
        host = document.createElement('div');
        host.id = 'achievement-toast-host';
        // Левый нижний угол — единственное место, свободное на всех экранах:
        // сверху по центру тост накрывал таймер эвакуации и заголовок итогов.
        // column-reverse — новый тост появляется снизу и толкает старые вверх.
        host.style.cssText = 'position:fixed; bottom:24px; left:24px; z-index:600; display:flex; flex-direction:column-reverse; gap:10px; pointer-events:none; align-items:flex-start;';
        document.body.appendChild(host);
    }
    const el = document.createElement('div');
    el.className = 'achievement-toast';
    el.innerHTML = `<span class="toast-label">${label}</span>${text}`;
    host.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 150); }, 3500);
}
function recordBossWin(bossName) {
    saveData.bossWins[bossName] = (saveData.bossWins[bossName] || 0) + 1;
    writeSave();
    if (BOSS_ACHIEVEMENT[bossName]) unlockAchievement(BOSS_ACHIEVEMENT[bossName]);
}
function getCosmeticTrailColor() {
    const c = saveData.cosmetics && saveData.cosmetics.active;
    if (c === 'clean_signal') return '#ffffff';
    if (c === 'ghost_diver') return 'rgba(200,220,255,0.6)';
    if (c === 'blue_trail') return '#1e90ff';
    if (c === 'iron_storm') return '#ff8c00';
    if (c === 'quiet_waters') return '#39ff14';
    return '#00ffff';
}
// Копия листа спрайтов, перекрашенная в цвет косметики. Строится один раз
// на цвет: source-atop внутри офскрина красит только непрозрачные пиксели.
const tintedSheetCache = {};
function getTintedPlayerSheet(color) {
    if (!color || !playerImg.complete || !playerImg.width) return null;
    if (tintedSheetCache[color]) return tintedSheetCache[color];
    const c = document.createElement('canvas');
    c.width = playerImg.width; c.height = playerImg.height;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(playerImg, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.globalAlpha = 0.6;
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
    tintedSheetCache[color] = c;
    return c;
}

function recordRunEnd(finalScore, escaped = false) {
    saveData.runs.unshift({ score: finalScore, date: Date.now(), escaped });
    saveData.runs = saveData.runs.sort((a, b) => b.score - a.score).slice(0, 10);
    const isNewBest = finalScore > saveData.bestScore;
    if (isNewBest) saveData.bestScore = finalScore;
    writeSave();
    unlockAchievement('first_dive');
    if (isNewBest) unlockAchievement('new_best');
    return isNewBest;
}
