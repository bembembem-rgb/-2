let parryHealCount = 0, chainBoltCount = 0;

function startParry(entity = player) {
    if (!entity) return;
    entity.parryReady = false;
    entity.parryTimer = entity.parryCooldownTime;
    entity.parryWindow = 260 + levelParryBonus(); // окно активного парирования, мс
    entity.iFrames = Math.max(entity.iFrames, 260);
    const statusEl = entity === player2 ? p2ParryStatus : document.getElementById('parry-status');
    if (statusEl) { statusEl.className = 'status-line parry-cooldown'; statusEl.innerText = 'PARRY: COOLDOWN'; }
    playSFX(sfxParryShield, 0.55, 0, 0.04);
    spawnSpriteFX(fxParryUp, entity.x, entity.y, { size: 120, frameInterval: 30, alpha: 0.9 });
    spawnParticles(entity.x, entity.y, '#ffffff', 6);
}

function triggerParrySuccess(entity = player) {
    if (!entity) return;
    entity.parryWindow = 0;
    entity.shieldTimer = 1500;
    parryFlashTimer = 1000; // ослепляющая вспышка на 1 секунду
    shakeTime = Math.max(shakeTime, 900); // сильная тряска экрана
    playSFX(sfxParryDone, 0.8, 0, 0.04);
    dailyEvent('parry', 1);
    if (lvl('parrypulse') > 0) { entity.pulseReady = true; entity.pulseTimer = 0; }
    if (lvl('parryheal') > 0) {
        parryHealCount++;
        if (parryHealCount >= 3) {
            parryHealCount = 0;
            entity.hp = Math.min(entity.maxHpRun || maxHp(), entity.hp + 1);
            if (entity === player) updateHpUI();
            spawnFloatText(entity.x, entity.y - 50, '+1 HP', '#3fdd4a', 12, 'heal');
            spawnSpriteFX(fxHeal, entity.x, entity.y, { size: 96, frameInterval: 46, alpha: 0.95 });
        }
    }

    parryShockwaves.push({ x: entity.x, y: entity.y, life: 700, maxLife: 700 });
    spawnSpriteFX(fxParryBurst, entity.x, entity.y, { size: 420, frameInterval: 42, alpha: 0.85 });

    const radius = 420;
    for (const e of enemies) {
        const dx = e.x - entity.x, dy = e.y - entity.y;
        const dist = Math.hypot(dx, dy);
        if (dist < radius) {
            const nx = dx / (dist || 1), ny = dy / (dist || 1);
            const force = (1 - dist / radius);
            if (e.type === 'boss') { e.hp -= 12; }
            else { e.hp -= 5; e.x += nx * force * 220; e.y += ny * force * 220; }
            spawnParticles(e.x, e.y, '#ff003c', 8);
        }
    }
    for (let j = enemyProjectiles.length - 1; j >= 0; j--) {
        if (Math.hypot(enemyProjectiles[j].x - entity.x, enemyProjectiles[j].y - entity.y) <= radius) enemyProjectiles.splice(j, 1);
    }
}

function executePulse(entity = player) {
    if (!entity) return;
    // Лишний заряд тратится вместо ухода в перезарядку: пока заряды есть,
    // импульс остаётся READY. Пул восстанавливается в update вместе с готовностью.
    if (entity.pulseCharges > 0) { entity.pulseCharges--; }
    else { entity.pulseReady = false; entity.pulseTimer = entity.pulseCooldownTime; }
    const pulseStatus = document.getElementById(entity === player2 ? 'p2-pulse-status' : 'pulse-status');
    if (pulseStatus) { pulseStatus.className = 'status-line pulse-cooldown'; pulseStatus.innerText = 'PULSE: COOLDOWN'; }
    playSFX(sfxPulse, 0.6, 0, 0.03);
    spawnSpriteFX(fxShockRing, entity.x, entity.y, { size: 700, frameInterval: 34, alpha: 0.8 });
    dailyEvent('pulse', 1);
    contractEvent('pulse', 1);

    const radius = 320;
    for (const e of enemies) {
        const dx = e.x - entity.x, dy = e.y - entity.y;
        const dist = Math.hypot(dx, dy);
        if (dist < radius) {
            const force = (1 - dist / radius);
            const nx = dx / (dist || 1), ny = dy / (dist || 1);
            if (e.type === 'boss') { e.hp -= 8; }
            else { e.hp -= 3; e.x += nx * force * 140; e.y += ny * force * 140; }
            spawnParticles(e.x, e.y, '#00ffff', 6);
        }
    }
    for (let j = enemyProjectiles.length - 1; j >= 0; j--) {
        if (Math.hypot(enemyProjectiles[j].x - entity.x, enemyProjectiles[j].y - entity.y) <= radius) enemyProjectiles.splice(j, 1);
    }
    pulseRingFx.push({ x: entity.x, y: entity.y, life: 500, maxLife: 500 });
    spawnSpriteFX(fxPulseWave, entity.x, entity.y, { size: 400, frameInterval: 40, alpha: 0.8 });
    playSFX(sfxShotgun, 0.7, 0, 0.05);
    shakeTime = Math.max(shakeTime, 250);
}

function executeAltAttack(entity = player, aimAngle = null) {
    if (!entity) return;
    entity.altReady = false; 
    entity.altTimer = entity.altCooldownTime; 
    // Альт-залп остался только у штурма: у техника его нет вовсе
    const statusEl = altStatus;
    if (statusEl) { 
        statusEl.className = 'status-line alt-cooldown'; 
        statusEl.innerText = 'ALT: COOLDOWN'; 
    }
    if (aimAngle === null) aimAngle = getP1AimAngle();
    const count = 6, spread = Math.PI / 3, startAngle = aimAngle - spread / 2, angleStep = spread / (count - 1);
    const dmg = entity === player2 ? p2Dmg() : p1Dmg();
    for (let i = 0; i < count; i++) { 
        projectiles.push(new PlayerVFXProjectile(entity.x, entity.y, startAngle + angleStep * i, 18, 3, dmg)); 
    } 
    spawnSpriteFX(fxAltBlast, entity.x, entity.y, { size: 150, frameInterval: 30, alpha: 0.9, angle: aimAngle });
    flashFromShooter(entity, aimAngle, 40, '#ff9f1c');
    playSFX(sfxAlt, 0.6, 0, 0.05); 
    shakeTime = Math.max(shakeTime, 100);
}
