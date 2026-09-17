const FX_FRAME = 32;
const FX_MAX = 64;
let _lastHitFx = 0, _hitFxThisFrame = 0;

// По умолчанию кадр квадратный, сторона = высота листа: один ряд любого размера.
// opts.fw / opts.fh задают кадр вручную, opts.cols / opts.frames — сетку из
// нескольких рядов. Порядок кадров всегда слева направо, сверху вниз.
function spawnSpriteFX(sheet, x, y, opts = {}) {
    // tintFx отдаёт canvas, а не Image: у него нет complete/naturalWidth,
    // поэтому готовность проверяем по фактическим размерам.
    if (!sheet) return;
    const sw = sheet.naturalWidth || sheet.width, sh = sheet.naturalHeight || sheet.height;
    if (!sw || !sh) return;
    if (spriteFx.length >= FX_MAX) return;
    const fw = opts.fw || sh || FX_FRAME;
    const fh = opts.fh || fw;
    const cols = Math.max(1, opts.cols || Math.round(sw / fw));
    const rows = Math.max(1, Math.round(sh / fh));
    const frames = Math.max(1, Math.min(opts.frames || cols * rows, cols * rows));
    const frameInterval = opts.frameInterval || 40;
    // opts.size — готовый размер в мировых пикселях, opts.scale — множитель кадра.
    const drawSize = opts.size || fw * (opts.scale || 2);
    const start = Math.min(opts.start || 0, frames - 1);
    spriteFx.push({
        sheet, x, y, fw, fh, cols, drawSize, start,
        frame: start, frameTimer: 0, frameInterval, frames,
        scale: opts.scale || 2,
        angle: opts.angle || 0,
        alpha: opts.alpha !== undefined ? opts.alpha : 1,
        life: (frames - start) * frameInterval,
        maxLife: (frames - start) * frameInterval
    });
}

// Попадания сыплются пачками — порог по образцу playEnemyDeathSFX.
function spawnHitFX(x, y) {
    const now = performance.now();
    // До 3 брызг за кадр (дробовик по толпе читается), но не чаще пачки в 45 мс.
    if (_hitFxThisFrame === 0 && now - _lastHitFx < 45) return;
    if (_hitFxThisFrame >= 3) return;
    if (_hitFxThisFrame === 0) _lastHitFx = now;
    _hitFxThisFrame++;
    spawnSpriteFX(fxHit, x, y, { size: 58, frameInterval: 32, angle: fxRandom() * Math.PI * 2 });
    spawnSparks(x, y, fxRandom() * Math.PI * 2, 3, '#7fe9ff', Math.PI * 2);
}

// Вспышка у дула. Живёт 90 мс, рисуется штрихами из точки выстрела:
// спрайтовый лист пришлось бы троттлить, как spawnHitFX, а пропущенная
// вспышка читается как осечка оружия.
const MUZZLE_LIFE = 90, MUZZLE_MAX = 12;
// Спрайт оружия рисуется с отступом 18 и длиной 32 (см. js/render.js),
// поэтому дуло — примерно 46 пикселей от центра бойца.
const MUZZLE_REACH = 46;
let muzzleFlashes = [];

// Выстрел от бойца: сама считает, где кончается ствол, и вешает туда всё,
// что при выстреле происходит на самом деле — вспышку, гильзу, дым,
// искры несгоревшего заряда.
function flashFromShooter(h, angle, size, color) {
    const mx = h.x + Math.cos(angle) * MUZZLE_REACH, my = h.y + Math.sin(angle) * MUZZLE_REACH;
    spawnMuzzleFlash(mx, my, angle, size, color);
    const heavy = size / 20;                       // дробовик и альт-залп дымят сильнее
    spawnCasing(h.x + Math.cos(angle) * 14, h.y + Math.sin(angle) * 14, angle, Math.min(1.6, heavy));
    spawnSmoke(mx, my, { r0: 2 + heavy, r1: 8 + heavy * 7, life: 300 + heavy * 120, alpha: 0.2 + heavy * 0.06, drift: angle, push: 0.7 });
    spawnSparks(mx, my, angle, 2 + Math.floor(heavy), color, 0.7);
}

function spawnMuzzleFlash(x, y, angle, size, color) {
    if (muzzleFlashes.length >= MUZZLE_MAX) muzzleFlashes.shift();
    muzzleFlashes.push({ x, y, angle, size, color, life: MUZZLE_LIFE, seed: fxRandom() * 6.28 });
}

function updateMuzzleFlashes(dt) {
    for (let i = muzzleFlashes.length - 1; i >= 0; i--) {
        muzzleFlashes[i].life -= dt;
        if (muzzleFlashes[i].life <= 0) muzzleFlashes.splice(i, 1);
    }
}

function drawMuzzleFlashes() {
    for (const m of muzzleFlashes) {
        const t = m.life / MUZZLE_LIFE;
        ctx.save();
        ctx.translate(m.x, m.y);
        ctx.rotate(m.angle);
        ctx.globalAlpha = t;
        ctx.shadowBlur = 16; ctx.shadowColor = m.color;
        ctx.fillStyle = '#ffffff';
        const core = m.size * 0.35 * t;
        ctx.fillRect(-core / 2, -core / 2, core * 1.6, core);
        // Четыре луча разной длины: ровная звёздочка читается как иконка,
        // а не как вспышка
        ctx.strokeStyle = m.color; ctx.lineWidth = 3 * t;
        ctx.beginPath();
        for (let k = 0; k < 4; k++) {
            const a = m.seed + k * 1.57;
            const len = m.size * (0.5 + 0.5 * Math.abs(Math.sin(m.seed + k))) * t;
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(a) * len * 1.5, Math.sin(a) * len * 0.6);
        }
        ctx.stroke();
        ctx.restore();
    }
}

function spawnParticles(x, y, color = '#00ced1', amount = null) { 
    const count = amount || (Math.floor(fxRandom() * 4) + 5); 
    for (let i = 0; i < count; i++) { 
        const angle = fxRandom() * Math.PI * 2, speed = fxRandom() * 4 + 2; 
        particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, size: fxRandom() * 4 + 2, alpha: 1, decay: fxRandom() * 0.02 + 0.01, color }); 
    } 
}

function spawnBubbles(x, y, amount = 5) { 
    for (let i = 0; i < amount; i++) { 
        bubbles.push({ x: x + (fxRandom() - 0.5) * 30, y: y + (fxRandom() - 0.5) * 30, vx: (fxRandom() - 0.5) * 2, vy: -fxRandom() * 3 - 1, size: fxRandom() * 6 + 2, alpha: 0.8, life: fxRandom() * 60 + 40 }); 
    } 
}

function spawnShatterParticles(x, y, width, height, color) { 
    const count = 15 + Math.floor(fxRandom() * 6); 
    for (let i = 0; i < count; i++) { 
        const px = x + fxRandom() * width, py = y + fxRandom() * height;
        const angle = fxRandom() * Math.PI * 2, speed = fxRandom() * 5 + 3; 
        particles.push({ x: px, y: py, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, size: fxRandom() * 8 + 4, alpha: 1, decay: fxRandom() * 0.015 + 0.01, color: color, friction: 0.92 }); 
    } 
}

function spawnExplosion(x, y, size) { 
    shakeTime = Math.max(shakeTime, size * 5); 
    scorches.push({ x, y, size: size * 1.5, alpha: 0.8 }); 
    for(let i = 0; i < 30; i++) spawnParticles(x, y, ['#00ffff', '#1e90ff', '#00ced1', '#ffffff'][Math.floor(fxRandom()*4)], 1); 
    spawnBubbles(x, y, 20); 
    spawnShockRing(x, y, size * 8, { width: 4, life: 380, color: '#ffffff' });
    spawnSparks(x, y, fxRandom() * Math.PI * 2, 14, '#ffd98a', Math.PI * 2);
    for (let i = 0; i < 4; i++) spawnSmoke(x, y, { r0: 6, r1: size * 4, life: 800, alpha: 0.28 });
    // Обломки: тяжёлые, крутятся и тормозят о воду
    for (let i = 0; i < 10; i++) {
        const a = fxRandom() * Math.PI * 2, sp = 3 + fxRandom() * 5;
        particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size: 3 + fxRandom() * 5,
            alpha: 1, decay: 0.008 + fxRandom() * 0.008, color: '#374654', friction: 0.93 });
    }
}

function explode(x, y, radius = 100, damage = 15) {
    playBoomSFX(0.6);
    spawnSpriteFX(fxBoomRoc, x, y, { size: 180, frameInterval: 45 });
    spawnSpriteFX(tintFx(fxSlashBase, '#ff9f1c'), x, y, { size: radius * 2.2, frameInterval: 26, angle: fxRandom() * Math.PI * 2, alpha: 0.6 });
    shakeTime = Math.max(shakeTime, radius * 1.5); 
    scorches.push({ x, y, size: radius, alpha: 1.0 }); 
    spawnBubbles(x, y, 15);
    // Два кольца: узкое и быстрое — фронт, широкое и вялое — вытесненная вода
    spawnShockRing(x, y, radius * 1.15, { width: 5, life: 340, color: '#ffd98a' });
    spawnShockRing(x, y, radius * 1.9, { width: 2, life: 560, color: '#9fd6e4' });
    spawnSparks(x, y, fxRandom() * Math.PI * 2, 18, '#ffd98a', Math.PI * 2);
    for (let i = 0; i < 5; i++) spawnSmoke(x, y, { r0: 8, r1: radius * 0.8, life: 700 + fxRandom() * 400, alpha: 0.3 });
    for(let i = 0; i < 20; i++) spawnParticles(x, y, '#ff4400', 3); 
    for(let i = 0; i < 10; i++) spawnParticles(x, y, '#ffffff', 2);
    for (let i = 0; i < enemies.length; i++) { 
        let e = enemies[i]; 
        if (Math.hypot(e.x - x, e.y - y) <= radius + e.size / 2) { e.hp -= damage; } 
    }
}

// ===========================================================================
// МЕЛОЧЬ, КОТОРОЙ НЕ ХВАТАЛО
// Выстрел давал одну вспышку и всё: ни гильзы, ни дыма, ни искр от брони,
// а взрыв расходился только частицами. Всё это физически происходит,
// и без него оружие звучит громче, чем выглядит.
// Под водой ничего не падает вниз: гильза тонет медленно и виляет,
// дым не поднимается столбом, а расплывается мутью. Это и отличает
// здешние эффекты от наземных.
// ===========================================================================
const CASING_MAX = 40, SMOKE_MAX = 64, SPARK_MAX = 140, RING_MAX = 12;

// Гильза вылетает вбок от ствола, крутится и тонет. Выброс всегда вправо
// от направления выстрела — как у настоящего оружия, а не веером.
function spawnCasing(x, y, angle, scale = 1) {
    if (casings.length >= CASING_MAX) casings.shift();
    const side = angle + Math.PI / 2 + (fxRandom() - 0.5) * 0.5;
    const speed = (1.6 + fxRandom() * 1.4) * scale;
    casings.push({
        x, y,
        vx: Math.cos(side) * speed - Math.cos(angle) * 0.6,
        vy: Math.sin(side) * speed - Math.sin(angle) * 0.6,
        angle: fxRandom() * Math.PI * 2,
        spin: (fxRandom() - 0.5) * 0.5,
        len: 5 * scale, wide: 2 * scale,
        life: 900, maxLife: 900
    });
}

// Дымное облако. Под водой это муть и пузырьковая взвесь, поэтому цвет
// не серый, а холодный, и расплывается оно быстрее наземного.
function spawnSmoke(x, y, opts = {}) {
    if (smokePuffs.length >= SMOKE_MAX) smokePuffs.shift();
    const life = opts.life || 520;
    const drift = opts.drift || 0;
    smokePuffs.push({
        x, y,
        vx: (fxRandom() - 0.5) * 0.6 + Math.cos(drift) * (opts.push || 0),
        vy: (fxRandom() - 0.5) * 0.6 + Math.sin(drift) * (opts.push || 0) - 0.25,
        r0: opts.r0 || 5, r1: opts.r1 || 18,
        color: opts.color || '#9fd6e4',
        alpha: opts.alpha !== undefined ? opts.alpha : 0.35,
        life, maxLife: life
    });
}

// Искры: летят конусом по направлению удара, гаснут быстро, рисуются
// штрихом вдоль скорости — точка на их скорости читалась бы пылью.
function spawnSparks(x, y, angle, amount = 6, color = '#ffd98a', spread = 1.2) {
    for (let i = 0; i < amount; i++) {
        if (sparks.length >= SPARK_MAX) sparks.shift();
        const a = angle + (fxRandom() - 0.5) * spread;
        const speed = 3 + fxRandom() * 6;
        const life = 160 + fxRandom() * 220;
        sparks.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, color, life, maxLife: life });
    }
}

// Ударная волна: кольцо, которое расходится и тает. Именно оно читается
// как «рвануло», а не облако частиц.
function spawnShockRing(x, y, r1, opts = {}) {
    if (shockRings.length >= RING_MAX) shockRings.shift();
    const life = opts.life || 420;
    shockRings.push({
        x, y, r0: opts.r0 || 6, r1,
        color: opts.color || '#ffffff',
        width: opts.width || 4,
        life, maxLife: life
    });
}

// Попадание в броню, камень, корпус — не мясо: брызг крови нет, есть
// сноп искр обратно в сторону стрелявшего и облачко пыли.
function spawnImpactSparks(x, y, angle, color = '#ffd98a') {
    spawnSparks(x, y, angle + Math.PI, 5 + Math.floor(fxRandom() * 4), color, 1.6);
    spawnSmoke(x, y, { r0: 3, r1: 11, life: 300, alpha: 0.22 });
}

function updateWorldFx(dt) {
    const k = dt / 16.67;   // всё ниже посчитано на кадр в 60 Гц
    for (let i = casings.length - 1; i >= 0; i--) {
        const c = casings[i];
        c.x += c.vx * k; c.y += c.vy * k;
        c.vx *= 0.94; c.vy = c.vy * 0.94 + 0.05 * k;   // тонет, но медленно
        c.angle += c.spin * k; c.spin *= 0.97;
        c.life -= dt;
        if (c.life <= 0) casings.splice(i, 1);
    }
    for (let i = smokePuffs.length - 1; i >= 0; i--) {
        const s = smokePuffs[i];
        s.x += s.vx * k; s.y += s.vy * k;
        s.vx *= 0.95; s.vy = s.vy * 0.95 - 0.012 * k;  // взвесь всплывает
        s.life -= dt;
        if (s.life <= 0) smokePuffs.splice(i, 1);
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
        const p = sparks[i];
        p.x += p.vx * k; p.y += p.vy * k;
        p.vx *= 0.90; p.vy *= 0.90;
        p.life -= dt;
        if (p.life <= 0) sparks.splice(i, 1);
    }
    for (let i = shockRings.length - 1; i >= 0; i--) {
        shockRings[i].life -= dt;
        if (shockRings[i].life <= 0) shockRings.splice(i, 1);
    }
}

// Дым идёт ПОД всем остальным: он фон для искр и вспышек, а не поверх них.
function drawSmoke() {
    for (const s of smokePuffs) {
        const t = 1 - s.life / s.maxLife;
        ctx.save();
        ctx.globalAlpha = s.alpha * (1 - t) * (1 - t);
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r0 + (s.r1 - s.r0) * t, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

function drawWorldFx() {
    for (const c of casings) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, c.life / 300);
        ctx.translate(c.x, c.y);
        ctx.rotate(c.angle);
        ctx.fillStyle = '#c9a961';
        ctx.fillRect(-c.len / 2, -c.wide / 2, c.len, c.wide);
        ctx.fillStyle = '#f0d9a0';
        ctx.fillRect(-c.len / 2, -c.wide / 2, c.len, Math.max(1, c.wide / 2));
        ctx.restore();
    }
    for (const p of sparks) {
        const t = p.life / p.maxLife;
        ctx.save();
        ctx.globalAlpha = t;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2 * t + 0.5;
        ctx.shadowBlur = 8; ctx.shadowColor = p.color;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 1.6, p.y - p.vy * 1.6);
        ctx.stroke();
        ctx.restore();
    }
    for (const r of shockRings) {
        const t = 1 - r.life / r.maxLife;
        const e = 1 - Math.pow(1 - t, 3);   // резкий старт, мягкий выдох
        ctx.save();
        ctx.globalAlpha = (1 - t) * 0.85;
        ctx.strokeStyle = r.color;
        ctx.lineWidth = Math.max(0.5, r.width * (1 - t));
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * e, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
}
