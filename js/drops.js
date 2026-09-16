// === ДРОП СО ШАНСОМ ===
// Артефакты падают с боссов гарантированно — это расписание, а не добыча.
// Редкий дроп даёт то, чего в расписании нет: повод пройти ещё один забег
// ради момента, который может и не случиться.
//
// Легендарка обязана запоминаться. Поэтому хит-стоп, вспышка и имя во весь
// экран: если игрок не может назвать, что ему выпало, дропа как события нет.

const DROP_TIERS = [
    { id: 'common',    chance: 0.65, name: 'ОБЫЧНЫЙ',      color: '#97a7b0' },
    { id: 'rare',      chance: 0.25, name: 'РЕДКИЙ',       color: '#3d8bff' },
    { id: 'epic',      chance: 0.08, name: 'ЭПИЧЕСКИЙ',    color: '#c46dff' },
    { id: 'legendary', chance: 0.02, name: 'ЛЕГЕНДАРНЫЙ',  color: '#f0c419' }
];

// Шанс, что источник вообще что-то роняет. Босс и контракт — всегда.
const DROP_SOURCE_CHANCE = { boss: 1, contract: 1, vehicle: 0.06, enemy: 0.004 };

// Легендарка: модификатор оружия на весь забег. Ставится ПОВЕРХ артефакта,
// не вместо: артефакт — пассивка, перегруз — поведение самого выстрела.
const OVERLOADS = [
    { id: 'pierce',   name: 'ПЕРЕГРУЗ: ПРОШИВКА',  desc: 'СНАРЯДЫ ПРОБИВАЮТ ДВОИХ' },
    { id: 'ricochet', name: 'ПЕРЕГРУЗ: РИКОШЕТ',   desc: 'СНАРЯД ОТСКАКИВАЕТ В БЛИЖАЙШЕГО' },
    { id: 'fan',      name: 'ПЕРЕГРУЗ: ВЕЕР',      desc: 'КАЖДЫЙ 5-Й ВЫСТРЕЛ БЬЁТ ВЕЕРОМ' },
    { id: 'pool',     name: 'ПЕРЕГРУЗ: КИСЛОТА',   desc: 'ВЫСТРЕЛЫ ОСТАВЛЯЮТ ЛУЖУ УРОНА' }
];
const OVERLOAD_BY_ID = {};
for (const o of OVERLOADS) OVERLOAD_BY_ID[o.id] = o;

const POOL_LIFE = 2600, POOL_R = 70, POOL_DPS = 4, RICOCHET_R = 320;

let runOverload = null;       // взятый перегруз (объект из OVERLOADS)
let fanShots = 0;
let acidPools = [];
let bestDropTier = -1, bestDropName = '';
let dropFlash = null;         // { color, name, tier, life }

function resetDrops() {
    runOverload = null;
    fanShots = 0;
    acidPools = [];
    bestDropTier = -1; bestDropName = '';
    dropFlash = null;
}

function rollTier() {
    let r = Math.random(), acc = 0;
    for (let i = DROP_TIERS.length - 1; i >= 0; i--) {
        acc += DROP_TIERS[i].chance;
        if (r < acc) return i;
    }
    return 0;
}

// Единственная точка, откуда падает что угодно. Источник задаёт только шанс
// самого факта дропа; что именно выпадет, решает таблица редкости.
function rollDrop(source, x, y) {
    const chance = DROP_SOURCE_CHANCE[source];
    if (chance === undefined || Math.random() > chance) return;
    if (!player) return;
    const px = x !== undefined ? x : player.x, py = y !== undefined ? y : player.y;

    let tier = rollTier();
    // Эпик без свободного слота оружия деградирует в редкий: выдать «второй
    // артефакт», когда оба слота заняты, значит молча съесть дроп.
    if (tier === 2 && availableWeapons().every(s => weaponArtifacts[s])) tier = 1;
    // Легендарка, когда перегруз уже взят, тоже деградирует
    if (tier === 3 && !legendaryAllowed()) tier = 2;
    if (tier === 3 && runOverload) tier = 2;
    if (tier === 2 && availableWeapons().every(s => weaponArtifacts[s])) tier = 1;

    const def = DROP_TIERS[tier];
    let name = '';

    if (tier === 0) {
        const cr = 15 + Math.floor(Math.random() * 26);
        runCredits += cr;
        updateCreditsUI();
        name = `+${cr} CR`;
    } else if (tier === 1) {
        name = 'СВОБОДНЫЙ УРОВЕНЬ';
        grantFreeLevel();
    } else if (tier === 2) {
        const slot = availableWeapons().find(s => !weaponArtifacts[s]) || 1;
        const owned = Object.values(weaponArtifacts);
        const ids = Object.keys(ARTIFACTS).filter(id =>
            owned.indexOf(id) < 0 && (!ARTIFACTS[id].unlock || unlockOwned(ARTIFACTS[id].unlock)));
        const id = ids[Math.floor(Math.random() * ids.length)] || 'warden';
        name = ARTIFACTS[id].name;
        equipArtifact(slot, id, px, py);
    } else {
        const o = OVERLOADS[Math.floor(Math.random() * OVERLOADS.length)];
        runOverload = o;
        name = o.name;
    }

    announceDrop(tier, def, name, px, py);
}

function announceDrop(tier, def, name, x, y) {
    if (tier > bestDropTier) { bestDropTier = tier; bestDropName = name; }
    if (tier >= 3) {
        saveData.stats.legendaries = (saveData.stats.legendaries || 0) + 1;
        writeSave();
    }

    spawnFloatText(x, y - 44, `${def.name}: ${name}`, def.color, tier >= 2 ? 14 : 11, 'drop');
    playSFX(tier >= 3 ? sfxBossSpawn : tier >= 2 ? sfxAchievement : sfxWeapon, tier >= 2 ? 0.9 : 0.5, 0, 0.04);

    if (tier >= 3) {
        // Игрок обязан запомнить этот момент: кадр встаёт, экран заливает
        // цветом редкости, имя читается крупно. Обычный дроп такого не получает.
        hitStopTimer = 200;
        shakeTime = Math.max(shakeTime, 600);
        dropFlash = { color: def.color, name, tier: def.name, life: 1500, maxLife: 1500 };
    } else if (tier === 2) {
        shakeTime = Math.max(shakeTime, 250);
    }
}

// --- ЭФФЕКТЫ ПЕРЕГРУЗА ---

function overloadIs(id) { return !!runOverload && runOverload.id === id; }

// Зовётся из точки выстрела вместе с artOnShot. Возвращает список углов:
// веер — единственный перегруз, который меняет само число снарядов.
function overloadAngles(aimAngle) {
    if (!overloadIs('fan')) return [aimAngle];
    if (++fanShots < 5) return [aimAngle];
    fanShots = 0;
    const out = [];
    for (let i = -2; i <= 2; i++) out.push(aimAngle + i * 0.13);
    return out;
}

function overloadArm(p) {
    if (overloadIs('pierce')) { p.piercing = true; p.pierceLeft = 2; }
    if (overloadIs('ricochet')) p.ricochetLeft = 1;
    return p;
}

// Отскок и лужа живут в точке попадания — одной на все стволы.
function overloadOnHit(p, x, y, victim) {
    if (overloadIs('pool')) {
        acidPools.push({ x, y, life: POOL_LIFE });
    }
    if (p && p.ricochetLeft > 0) {
        p.ricochetLeft--;
        let best = null, bd = RICOCHET_R;
        for (const e of enemies) {
            if (e === victim) continue;
            const d = Math.hypot(e.x - x, e.y - y);
            if (d < bd) { bd = d; best = e; }
        }
        if (best) {
            const ang = Math.atan2(best.y - y, best.x - x);
            const r = new PlayerVFXProjectile(x, y, ang, 16, 1, p.dmg);
            r.hitEnemies = new Set([victim]);
            r.ricochetLeft = 0;
            projectiles.push(r);
            spawnParticles(x, y, '#f0c419', 4);
        }
    }
}

function updateDrops(dt) {
    if (dropFlash) {
        dropFlash.life -= dt;
        if (dropFlash.life <= 0) dropFlash = null;
    }
    for (let i = acidPools.length - 1; i >= 0; i--) {
        const pl = acidPools[i];
        pl.life -= dt;
        if (pl.life <= 0) { acidPools.splice(i, 1); continue; }
        for (const e of enemies) {
            if (Math.hypot(e.x - pl.x, e.y - pl.y) <= POOL_R + (e.size || 40) / 2) e.hp -= POOL_DPS * dt / 1000;
        }
    }
}

function drawAcidPools(time) {
    for (const pl of acidPools) {
        const t = pl.life / POOL_LIFE;
        ctx.save();
        ctx.globalAlpha = 0.28 * t;
        ctx.fillStyle = '#3fdd4a';
        ctx.beginPath(); ctx.arc(pl.x, pl.y, POOL_R, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 0.6 * t;
        ctx.strokeStyle = '#3fdd4a'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(pl.x, pl.y, POOL_R, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
    }
}

// Полноэкранная вспышка легендарки. Рисуется в экранных координатах,
// поверх мира, поэтому живёт в draw(), а не в drawWorldPass.
function drawDropFlash() {
    if (!dropFlash) return;
    const t = dropFlash.life / dropFlash.maxLife;
    ctx.save();
    ctx.globalAlpha = Math.min(0.45, t * 0.45);
    ctx.fillStyle = dropFlash.color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = Math.min(1, t * 2.2);
    ctx.textAlign = 'center';
    ctx.font = "10px var(--font-pixel)";
    ctx.fillStyle = '#05080e';
    ctx.fillText(dropFlash.tier, canvas.width / 2 + 2, canvas.height / 2 - 32);
    ctx.fillStyle = dropFlash.color;
    ctx.fillText(dropFlash.tier, canvas.width / 2, canvas.height / 2 - 34);
    ctx.font = "24px var(--font-pixel)";
    ctx.fillStyle = '#05080e';
    ctx.fillText(dropFlash.name, canvas.width / 2 + 3, canvas.height / 2 + 3);
    ctx.fillStyle = '#e4eef2';
    ctx.fillText(dropFlash.name, canvas.width / 2, canvas.height / 2);
    ctx.restore();
}

// Редкий дроп — уровень вне порога. Очередь уровней уже умеет открываться
// подряд, поэтому свободный уровень просто встаёт в неё.
function grantFreeLevel() {
    if (!levelPool().length) { runCredits += 40; updateCreditsUI(); return; }
    freeLevels++;
}
