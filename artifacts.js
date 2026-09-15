// === АРТЕФАКТЫ БОССОВ ===
// Босс роняет артефакт, артефакт садится на то оружие, которое игрок держит
// в момент подбора. Пассивка работает, ПОКА ЭТО ОРУЖИЕ В РУКАХ: переключение
// на F — не косметика, а смена стиля боя. Действует в пределах забега,
// постоянную прокачку держит мастерская.
//
// Это не прибавки к числам, а поведение. Прибавки уже раздают мастерская
// и уровни забега; третий источник «+15% урона» игрок бы просто не заметил.

const ARTIFACTS = {
    warden: {
        boss: 'ABYSSAL WARDEN', name: 'ЯДРО СТРАЖА', color: '#00e0ff',
        desc: 'УБИТЫЙ ВРАГ СХЛОПЫВАЕТСЯ В ВОРОНКУ'
    },
    tide: {
        boss: 'TIDE CALLER', name: 'ПРИЛИВНЫЙ КАМЕРТОН', color: '#f0c419',
        desc: 'КАЖДЫЙ 8-Й ВЫСТРЕЛ БЬЁТ ГЕЙЗЕРОМ, ПО БОССУ ВДВОЕ'
    },
    leviathan: {
        boss: 'LEVIATHAN', name: 'КЛЫК ЛЕВИАФАНА', color: '#ff2d55',
        desc: 'УБИЙСТВА КОПЯТ ГОЛОД: ДО +60% УРОНА'
    },
    reef: {
        boss: 'THORN REEF', name: 'ШИП РИФА', color: '#3fdd4a',
        desc: '5 С БЕЗ УРОНА — ПАНЦИРЬ И ЗАЛП ШИПОВ'
    },
    wraith: {
        boss: 'VOID WRAITH', name: 'ОСКОЛОК ПУСТОТЫ', color: '#c46dff',
        desc: 'РЫВОК ОСТАВЛЯЕТ СХЛОПЫВАЮЩИЙСЯ РАЗРЫВ'
    },
    // Ничейные находки (узел artifacts2). Босса за ними нет — они падают
    // только из редкого дропа, и потому остаются редкостью, а не расписанием.
    beacon: {
        boss: null, name: 'ЧУЖОЙ МАЯК', color: '#3d8bff', unlock: 'artifacts2',
        desc: 'КАЖДЫЕ 12 С ОТМЕЧАЕТ ВРАГА: УРОН ПО НЕМУ ДВОЙНОЙ'
    },
    ember: {
        boss: null, name: 'ТЛЕЮЩЕЕ ЯДРО', color: '#ff9f1c', unlock: 'artifacts2',
        desc: 'ВРАГИ ГОРЯТ ПОСЛЕ ПОПАДАНИЯ: 3 УРОНА ЗА 2 С'
    }
};

const BOSS_ARTIFACT = {
    'ABYSSAL WARDEN': 'warden', 'TIDE CALLER': 'tide', 'LEVIATHAN': 'leviathan',
    'THORN REEF': 'reef', 'VOID WRAITH': 'wraith'
};

const ARTIFACT_PICKUP_R = 64;

// --- ЧИСЛА ПАССИВОК ---
const WELL_R = 170, WELL_LIFE = 700, WELL_PULL = 4.2, WELL_CD = 350;
const TIDE_EVERY = 8, TIDE_R = 130, TIDE_DMG = 3, TIDE_BOSS_MULT = 2;
const HUNGER_MAX = 5, HUNGER_STEP = 0.12, HUNGER_LIFE = 4000;
const SHELL_ARM = 5000, SHELL_R = 280, SHELL_DMG = 5;
const RIFT_DELAY = 450, RIFT_R = 150, RIFT_DMG = 6;
const BEACON_EVERY = 12000, BEACON_MULT = 2;
const BURN_TIME = 2000, BURN_DMG = 3;

// Слоты общие на отряд: 1 — пистолет, 2 — дробовик. P2 стреляет только
// из пистолета, поэтому его подбор всегда ложится в слот 1. См. coop.md.
let weaponArtifacts = { 1: null, 2: null, 3: null, 4: null };
let groundArtifacts = [];
let artWells = [], artRifts = [];
let hungerStacks = 0, hungerTimer = 0;
let shellTimer = 0, shellReady = false;
let tideShots = 0, wellCd = 0;
let beaconTimer = 0, beaconTarget = null;

function resetArtifacts() {
    weaponArtifacts = { 1: null, 2: null, 3: null, 4: null };
    groundArtifacts = [];
    artWells = []; artRifts = [];
    hungerStacks = 0; hungerTimer = 0;
    shellTimer = 0; shellReady = false;
    tideShots = 0; wellCd = 0;
    beaconTimer = 0; beaconTarget = null;
}

// Пассивка жива, если её артефакт стоит в слоте, который кто-то держит.
// Слот 1 всегда держит техник (у него только пистолет), слот 2 — штурм
// с дробовиком. Отсюда и цена артефакта: он занимает ствол.
function artLive(id) {
    if (!player) return false;
    // Слот 1 в ко-опе держит техник всегда — у него только пистолет
    if (weaponArtifacts[1] === id && (player.currentWeapon === 1 || (coopMode && player2))) return true;
    return weaponArtifacts[player.currentWeapon] === id;
}

function artDamageMult() { return artLive('leviathan') ? 1 + HUNGER_STEP * hungerStacks : 1; }

function artWeaponSheet(slot, sheet) {
    const a = ARTIFACTS[weaponArtifacts[slot]];
    return a ? tintFx(sheet, a.color) : sheet;
}

// --- СОБЫТИЯ ---

// Каждый 8-й выстрел помечается приливным. Счётчик один на отряд:
// иначе «каждый восьмой» превращался бы в «каждый восьмой у каждого».
function artOnShot(p) {
    if (!artLive('tide')) return p;
    if (++tideShots >= TIDE_EVERY) { tideShots = 0; p.tideBurst = true; }
    return p;
}

// Урон по отмеченному маяком — вдвое. Зовётся из цикла столкновений
// до вычитания HP, чтобы множитель применялся к тому же снаряду.
function artDamageOn(e) {
    return (artLive('beacon') && e === beaconTarget) ? BEACON_MULT : 1;
}

function artOnHitEnemy(e) {
    if (artLive('ember') && e && e.type !== 'boss') { e.burn = BURN_TIME; e.burnTick = 0; }
}

function artOnProjectileHit(p, x, y) {
    if (!p || !p.tideBurst) return;
    p.tideBurst = false;
    for (const e of enemies) {
        if (Math.hypot(e.x - x, e.y - y) > TIDE_R + (e.size || 40) / 2) continue;
        // По боссу вдвое: площадь против одиночной цели не работает вовсе,
        // и без этого Камертон был артефактом «только на толпу».
        e.hp -= e.type === 'boss' ? TIDE_DMG * TIDE_BOSS_MULT : TIDE_DMG;
    }
    spawnSpriteFX(fxGeyser, x, y, { size: TIDE_R * 2, frameInterval: 34, alpha: 0.9 });
    spawnBubbles(x, y, 10);
    shakeTime = Math.max(shakeTime, 120);
}

function artOnEnemyKilled(x, y) {
    if (artLive('leviathan')) {
        hungerStacks = Math.min(HUNGER_MAX, hungerStacks + 1);
        hungerTimer = HUNGER_LIFE;
    }
    // Троттлинг: без него залп дробовика по толпе рождает шесть воронок
    // в одной точке и стягивает всю карту в пиксель.
    if (artLive('warden') && wellCd <= 0) {
        wellCd = WELL_CD;
        artWells.push({ x, y, life: WELL_LIFE });
        spawnSpriteFX(tintFx(fxRingBase, ARTIFACTS.warden.color), x, y, { size: WELL_R * 2, frameInterval: 40, alpha: 0.7 });
    }
}

function artOnDash(x, y) {
    if (!artLive('wraith')) return;
    artRifts.push({ x, y, life: RIFT_DELAY });
    spawnSpriteFX(fxVoidRift, x, y, { size: RIFT_R * 1.9, frameInterval: 38, alpha: 0.85 });
}

// Возвращает true, если панцирь съел удар. Зовётся из каждой точки урона
// по бойцу — единой такой точки в игре нет, и заводить её ради артефакта
// значило бы переписать половину update.js.
function artAbsorbHit(h) {
    if (!shellReady || !artLive('reef')) { contractEvent('hit', 1); return false; }
    shellReady = false;
    shellTimer = 0;
    const x = h ? h.x : player.x, y = h ? h.y : player.y;
    for (const e of enemies) {
        if (Math.hypot(e.x - x, e.y - y) <= SHELL_R + (e.size || 40) / 2) e.hp -= SHELL_DMG;
    }
    for (let j = enemyProjectiles.length - 1; j >= 0; j--) {
        if (Math.hypot(enemyProjectiles[j].x - x, enemyProjectiles[j].y - y) <= SHELL_R) enemyProjectiles.splice(j, 1);
    }
    spawnSpriteFX(tintFx(fxRingBase, ARTIFACTS.reef.color), x, y, { size: SHELL_R * 2, frameInterval: 34, alpha: 0.8 });
    playSFX(sfxParryDone, 0.5, 0, 0.04);
    shakeTime = Math.max(shakeTime, 320);
    if (h) h.iFrames = Math.max(h.iFrames, 700);
    spawnFloatText(x, y - 50, 'ПАНЦИРЬ', ARTIFACTS.reef.color, 12, 'shell');
    return true;
}

// --- КАДР ---

function updateArtifacts(dt) {
    if (wellCd > 0) wellCd -= dt;

    if (artLive('beacon')) {
        beaconTimer -= dt;
        if (beaconTimer <= 0 || !beaconTarget || enemies.indexOf(beaconTarget) < 0) {
            beaconTimer = BEACON_EVERY;
            // Метка садится на самого живучего в поле зрения: удваивать урон
            // по слизню с одним HP было бы подарком в пустоту.
            let best = null, bestHp = 0;
            for (const e of enemies) {
                if (Math.hypot(e.x - player.x, e.y - player.y) > 900) continue;
                if (e.hp > bestHp) { bestHp = e.hp; best = e; }
            }
            beaconTarget = best;
        }
    } else { beaconTarget = null; }

    if (artLive('ember')) {
        for (const e of enemies) {
            if (!e.burn || e.burn <= 0) continue;
            e.burn -= dt; e.burnTick = (e.burnTick || 0) + dt;
            if (e.burnTick >= 500) { e.burnTick = 0; e.hp -= BURN_DMG * 0.25; spawnParticles(e.x, e.y, '#ff9f1c', 1); }
        }
    }

    if (hungerStacks > 0) {
        hungerTimer -= dt;
        if (hungerTimer <= 0) { hungerStacks--; hungerTimer = HUNGER_LIFE; }
    }

    if (artLive('reef')) {
        if (!shellReady) { shellTimer += dt; if (shellTimer >= SHELL_ARM) shellReady = true; }
    } else { shellTimer = 0; shellReady = false; }

    for (let i = artWells.length - 1; i >= 0; i--) {
        const w = artWells[i];
        w.life -= dt;
        if (w.life <= 0) { artWells.splice(i, 1); continue; }
        for (const e of enemies) {
            if (e.type === 'boss') continue;   // босса воронка не таскает
            const dx = w.x - e.x, dy = w.y - e.y, d = Math.hypot(dx, dy);
            if (d > 4 && d < WELL_R) {
                const force = (1 - d / WELL_R) * WELL_PULL * (dt / 16.67);
                e.x += (dx / d) * force * 10; e.y += (dy / d) * force * 10;
            }
        }
    }

    for (let i = artRifts.length - 1; i >= 0; i--) {
        const r = artRifts[i];
        r.life -= dt;
        if (r.life > 0) continue;
        for (const e of enemies) {
            if (Math.hypot(e.x - r.x, e.y - r.y) <= RIFT_R + (e.size || 40) / 2) e.hp -= RIFT_DMG;
        }
        spawnSpriteFX(tintFx(fxRingBase, ARTIFACTS.wraith.color), r.x, r.y, { size: RIFT_R * 2, frameInterval: 30, alpha: 0.75 });
        spawnParticles(r.x, r.y, ARTIFACTS.wraith.color, 12);
        shakeTime = Math.max(shakeTime, 160);
        artRifts.splice(i, 1);
    }

    if (groundArtifacts.length === 0) return;
    for (let i = groundArtifacts.length - 1; i >= 0; i--) {
        const g = groundArtifacts[i];
        if (player && !player.downed && !player.inVehicle &&
            Math.hypot(player.x - g.x, player.y - g.y) < ARTIFACT_PICKUP_R) {
            equipArtifact(player.currentWeapon, g.id, player.x, player.y);
            groundArtifacts.splice(i, 1);
            continue;
        }
        if (coopMode && player2 && !player2.downed && !player2.inVehicle &&
            Math.hypot(player2.x - g.x, player2.y - g.y) < ARTIFACT_PICKUP_R) {
            equipArtifact(1, g.id, player2.x, player2.y);
            groundArtifacts.splice(i, 1);
        }
    }
}

// --- ПРЕДМЕТЫ В МИРЕ ---

function dropArtifact(boss) {
    const id = BOSS_ARTIFACT[boss && boss.name];
    if (!id) return;
    groundArtifacts.push({ id, x: boss.x, y: boss.y, born: performance.now() });
}

function equipArtifact(slot, id, x, y) {
    const a = ARTIFACTS[id], prev = ARTIFACTS[weaponArtifacts[slot]];
    const where = (WEAPONS[slot] && WEAPONS[slot].name) || 'ОРУЖИЕ';
    weaponArtifacts[slot] = id;
    // Смена артефакта обнуляет его накопленное: голод и панцирь принадлежат
    // артефакту, а не бойцу.
    hungerStacks = 0; shellTimer = 0; shellReady = false; tideShots = 0;
    if (prev && prev !== a) spawnFloatText(x, y - 70, `${prev.name} ЗАМЕНЁН`, '#74838c', 12, 'artifact-swap');
    spawnFloatText(x, y - 50, `${where}: ${a.name}`, a.color, 14, 'artifact');
    spawnFloatText(x, y - 30, a.desc, a.color, 10, 'artifact-desc');
    spawnSpriteFX(tintFx(fxRuneBase, a.color), x, y, { size: 140, frameInterval: 34, alpha: 0.9 });
    playSFX(sfxWeapon, 0.6, 0, 0.05);
    dailyEvent('artifact', 1);
    shakeTime = Math.max(shakeTime, 120);
}

function drawArtifactFx(time) {
    for (const w of artWells) {
        const t = w.life / WELL_LIFE;
        ctx.save();
        ctx.globalAlpha = t * 0.5;
        ctx.strokeStyle = ARTIFACTS.warden.color; ctx.lineWidth = 3;
        ctx.shadowBlur = 14; ctx.shadowColor = ARTIFACTS.warden.color;
        ctx.beginPath(); ctx.arc(w.x, w.y, WELL_R * t, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
    }
    for (const r of artRifts) {
        const t = 1 - r.life / RIFT_DELAY;
        ctx.save();
        ctx.globalAlpha = 0.6;
        ctx.strokeStyle = ARTIFACTS.wraith.color; ctx.lineWidth = 4;
        ctx.shadowBlur = 18; ctx.shadowColor = ARTIFACTS.wraith.color;
        ctx.beginPath(); ctx.arc(r.x, r.y, RIFT_R * (1 - t * 0.85), 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
    }
    if (beaconTarget && artLive('beacon') && enemies.indexOf(beaconTarget) >= 0) {
        ctx.save();
        ctx.strokeStyle = ARTIFACTS.beacon.color; ctx.lineWidth = 2;
        ctx.shadowBlur = 12; ctx.shadowColor = ARTIFACTS.beacon.color;
        const r = (beaconTarget.size || 40) * 0.8;
        ctx.beginPath(); ctx.arc(beaconTarget.x, beaconTarget.y, r, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(beaconTarget.x, beaconTarget.y - r - 10); ctx.lineTo(beaconTarget.x, beaconTarget.y - r - 2); ctx.stroke();
        ctx.restore();
    }

    // Панцирь и голод надо видеть, иначе пассивка читается как случайность
    if (shellReady && player && !player.downed) {
        ctx.save();
        ctx.strokeStyle = ARTIFACTS.reef.color; ctx.lineWidth = 2;
        ctx.globalAlpha = 0.85; ctx.setLineDash([8, 6]);
        ctx.beginPath(); ctx.arc(player.x, player.y, player.size * 0.95, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
    }
    if (hungerStacks > 0 && player) {
        ctx.save();
        ctx.font = "10px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(5,8,14,0.85)'; ctx.fillText(`ГОЛОД x${hungerStacks}`, player.x + 2, player.y + 48);
        ctx.fillStyle = ARTIFACTS.leviathan.color; ctx.fillText(`ГОЛОД x${hungerStacks}`, player.x, player.y + 46);
        ctx.restore();
    }

    for (const g of groundArtifacts) {
        const a = ARTIFACTS[g.id];
        if (!a) continue;
        const bob = Math.sin((time - g.born) / 340) * 5;
        ctx.save();
        ctx.translate(g.x, g.y + bob);
        ctx.shadowBlur = 18; ctx.shadowColor = a.color;
        ctx.strokeStyle = a.color; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(15, 0); ctx.lineTo(0, 20); ctx.lineTo(-15, 0); ctx.closePath(); ctx.stroke();
        ctx.globalAlpha = 0.35; ctx.fillStyle = a.color; ctx.fill();
        ctx.globalAlpha = 1; ctx.shadowBlur = 0;
        ctx.fillStyle = a.color; ctx.fillRect(-4, -4, 8, 8);
        ctx.restore();

        if (player && Math.hypot(player.x - g.x, player.y - g.y) < 320) {
            ctx.save();
            ctx.font = "9px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
            ctx.fillStyle = 'rgba(5,8,14,0.85)'; ctx.fillText(a.name, g.x + 2, g.y - 36);
            ctx.fillStyle = a.color; ctx.fillText(a.name, g.x, g.y - 38);
            ctx.restore();
        }
    }
}
