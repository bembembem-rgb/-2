function resolveAABB(entity, obs) {
    if (obs.isGeyser) return; 
    let eHalf = entity.size / 2, oHalfW = obs.w / 2, oHalfH = obs.h / 2;
    let ox = obs.x + oHalfW, oy = obs.y + oHalfH;
    let dx = entity.x - ox, dy = entity.y - oy;
    let overlapX = eHalf + oHalfW - Math.abs(dx);
    let overlapY = eHalf + oHalfH - Math.abs(dy);
    
    if (overlapX > 0 && overlapY > 0) { 
        if (overlapX < overlapY) { 
            entity.x += dx > 0 ? overlapX : -overlapX; 
            if (entity.vx !== undefined && entity.type !== 'heli') entity.vx *= 0.5; 
        } else { 
            entity.y += dy > 0 ? overlapY : -overlapY; 
            if (entity.vy !== undefined && entity.type !== 'heli') entity.vy *= 0.5; 
        } 
    }
}

// Блок пересекается с круглой запретной зоной?
function blockedByZone(x, y, w, h, z) {
    if (!z) return false;
    const nx = Math.max(x, Math.min(z.x, x + w));
    const ny = Math.max(y, Math.min(z.y, y + h));
    return Math.hypot(z.x - nx, z.y - ny) < z.r;
}

function isNoBuildArea(x, y, w, h) {
    if (blockedByZone(x, y, w, h, questOutpost)) return true;
    if (extractionPoint && blockedByZone(x, y, w, h, { x: extractionPoint.x, y: extractionPoint.y, r: extractionPoint.radius + 120 })) return true;
    if (deepVault && blockedByZone(x, y, w, h, { x: deepVault.x, y: deepVault.y, r: 430 })) return true;
    for (const v of transports) if (blockedByZone(x, y, w, h, { x: v.x, y: v.y, r: v.size + 60 })) return true;
    return false;
}

// Сносит уже сгенерированные блоки, попавшие в новую запретную зону
function purgeObstaclesIn(zone) {
    for (const [key, obs] of obstacles) {
        if (obs && blockedByZone(obs.x, obs.y, obs.w, obs.h, zone)) {
            destroyedObstacles.add(key);
            obstacles.set(key, null);
        }
    }
}

function manageObstacles(cx_base, cy_base) {
    let cx = Math.floor(cx_base / 400), cy = Math.floor(cy_base / 400);
    let newActive = new Map();
    
    for (let i = -3; i <= 3; i++) {
        for (let j = -3; j <= 3; j++) {
            let key = `${cx + i}_${cy + j}`; 
            if (destroyedObstacles.has(key)) continue;
            
            if (obstacles.has(key)) { 
                newActive.set(key, obstacles.get(key)); 
            } else {
                let hash = Math.abs(Math.sin((cx + i) * 12.9898 + (cy + j) * 78.233) * 43758.5453); 
                hash = hash - Math.floor(hash);
                if (hash < 0.25 && (cx+i !== 0 || cy+j !== 0)) { 
                    const bx = (cx + i) * 400 + (hash * 200);
                    const by = (cy + j) * 400 + ((hash * 13 % 1) * 200);
                    const bw = 60 + ((hash * 27 % 1) * 80);
                    const bh = 60 + ((hash * 31 % 1) * 80);
                    if (isNoBuildArea(bx, by, bw, bh)) { newActive.set(key, null); continue; }
                    newActive.set(key, { 
                        key: key, 
                        x: bx, y: by, w: bw, h: bh, 
                        type: hash < 0.12 ? 'triangle' : 'rect', 
                        flashTimer: 0 
                    }); 
                } else { 
                    newActive.set(key, null); 
                }
            }
        }
    }
    obstacles = newActive;
}

function destroyVehicle(v) {
    spawnExplosion(v.x, v.y, 60);
    
    if (v.type === 'tank' || v.type === 'heli') {
        playBoomSFX(0.85);
        spawnSpriteFX(fxWreck, v.x, v.y, { size: 190, frameInterval: 40 });
    }

    if (player.currentVehicle !== v && (!player2 || player2.currentVehicle !== v) && !v.isQuestVehicle) { addScore(50, CREDITS.vehicle); vehicleKillsThisRun++; dailyEvent('vehicle', 1); contractEvent('vehicle', 1); rollDrop('vehicle', v.x, v.y); if (vehicleKillsThisRun >= 15) unlockAchievement('secret_scrapper'); }
    if (player.currentVehicle === v) { 
        player.inVehicle = false; player.currentVehicle = null; 
        player.hp--; updateHpUI(); player.iFrames = 1500; hpLostAny = true;
        updateVehicleHpUI(); 
        if (player.hp <= 0) downEntity(player); 
    }
    if (player2 && player2.currentVehicle === v) {
        player2.inVehicle = false; player2.currentVehicle = null;
        player2.hp--; player2.iFrames = 1500; hpLostAny = true;
        spawnSpriteFX(fxPlayerHit, player2.x, player2.y, { size: 96, frameInterval: 34, alpha: 0.9 });
        if (player2.hp <= 0) downEntity(player2);
        updateVehicleHpUI();
    }
    let idx = transports.indexOf(v); 
    if (idx > -1) transports.splice(idx, 1);
    if (v.isQuestVehicle) { 
        questState = 'none'; clearQuestSite(); 
        scheduleQuestRespawn(); 
    }
}

// Ближайший враг в радиусе. Один поиск на всех автоприцельных стрелков:
// техник пеший, техник за рулём, турель танка, вертолёт. Он же запоминает
// цель и момент захвата в самом источнике — из этого рисуется рамка
// (drawTargetLock в js/render.js), своя на каждого стрелка.
function acquireTarget(source, x, y, range) {
    let best = null, bd = range;
    for (const e of enemies) {
        const d = Math.hypot(e.x - x, e.y - y);
        if (d < bd) { bd = d; best = e; }
    }
    if (source && source.lockedEnemy !== best) source.lockAt = performance.now();
    if (source) source.lockedEnemy = best;
    return best;
}

function getEnemyTarget(e) {
    const candidates = [];
    if (!player.downed) candidates.push(player.inVehicle && player.currentVehicle ? player.currentVehicle : player);
    if (coopMode && player2 && !player2.downed) candidates.push(player2.inVehicle && player2.currentVehicle ? player2.currentVehicle : player2);
    if (candidates.length === 0) return player; // все упали — не даём врагам сломаться на null
    if (candidates.length === 1) return candidates[0];
    let best = candidates[0], bestD = Math.hypot(candidates[0].x - e.x, candidates[0].y - e.y);
    for (let i = 1; i < candidates.length; i++) { const d = Math.hypot(candidates[i].x - e.x, candidates[i].y - e.y); if (d < bestD) { bestD = d; best = candidates[i]; } }
    return best;
}
