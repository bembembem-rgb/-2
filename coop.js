// === СИСТЕМА ВОЗРОЖДЕНИЯ (ко-оп) ===
const REVIVE_TIME = 2500;    // мс держаться рядом с павшим
const REVIVE_RADIUS = 90;

function getActiveSquad() {
    const squad = [player];
    if (coopMode && player2) squad.push(player2);
    return squad;
}
function downEntity(entity) {
    if (entity.downed) return;
    // Второе дыхание тратится молча один раз за забег: перк, который спасает
    // дважды, превращает выбор карты в отмену смерти вообще.
    if (entity === player && lvl('secondwind') > 0 && !secondWindUsed) {
        secondWindUsed = true;
        entity.hp = 2; entity.iFrames = 2500;
        updateHpUI();
        spawnSpriteFX(fxRevive, entity.x, entity.y, { size: 160, frameInterval: 50, alpha: 0.95 });
        spawnFloatText(entity.x, entity.y - 60, 'ВТОРОЕ ДЫХАНИЕ', '#ff2d55', 14, 'wind');
        playSFX(sfxAchievement, 0.9);
        shakeTime = Math.max(shakeTime, 600);
        return;
    }
    entity.downed = true;
    entity.hp = 0;
    entity.reviveProgress = 0;
    spawnSpriteFX(fxDown, entity.x, entity.y, { size: 150, frameInterval: 48, alpha: 0.9 });
    entity.vx = 0; entity.vy = 0;
    spawnExplosion(entity.x, entity.y, 50);
    shakeTime = Math.max(shakeTime, 400);
    if (entity === player) { if (typeof updateHpUI === 'function') updateHpUI(); }
    checkSquadWipe();
}
function checkSquadWipe() {
    if (getActiveSquad().every(m => m.downed)) triggerGameOver();
}
function updateRevives(dt) {
    const squad = getActiveSquad();
    for (const fallen of squad) {
        if (!fallen.downed) continue;
        let beingRevived = false;
        for (const helper of squad) {
            if (helper === fallen || helper.downed) continue;
            if (Math.hypot(helper.x - fallen.x, helper.y - fallen.y) < REVIVE_RADIUS) {
                // Техник поднимает вдвое быстрее — это его работа, а не бонус
                fallen.reviveProgress = (fallen.reviveProgress || 0) + dt * (helper === player2 ? 2 : 1);
                beingRevived = true;
                if (fallen.reviveProgress >= REVIVE_TIME) {
                    fallen.downed = false; fallen.hp = 2; fallen.iFrames = 2000; fallen.reviveProgress = 0;
                    if (fallen === player) updateHpUI();
                    spawnParticles(fallen.x, fallen.y, '#39ff14', 25);
                    spawnSpriteFX(fxRevive, fallen.x, fallen.y, { size: 130, frameInterval: 50, alpha: 0.95 });
                    playSFX(sfxAchievement, 0.5);
                }
                break;
            }
        }
        if (!beingRevived) fallen.reviveProgress = Math.max(0, (fallen.reviveProgress || 0) - dt * 2);
    }
}

// Автоогонь из пистолета. Кулдаун и урон приходят снаружи — у техника пешего
// и за рулём они одни и те же, а меняться будут вместе.
function fireAuto(source, cooldown, dmg, volume) {
    if (source.weaponCooldown > 0) return;
    const target = acquireTarget(source, source.x, source.y, 650);
    if (!target) return;
    const aimAngle = Math.atan2(target.y - source.y, target.x - source.x);
    projectiles.push(overloadArm(artOnShot(new PlayerVFXProjectile(source.x, source.y, aimAngle, 15, 1, dmg))));
    source.weaponCooldown = cooldown * levelReloadMult();
    flashFromShooter(source, aimAngle, 16, '#3d8bff');
    playSFX(sfxPistol, volume, 0, 0.07);
}

function updatePlayer2(dt) {
    if (!coopMode || !player2) return;

    if (player2.dashCooldown > 0) player2.dashCooldown -= dt;
    if (player2.iFrames > 0) player2.iFrames -= dt;

    if (player2.downed) { player2.x += player2.vx * 0.9; player2.y += player2.vy * 0.9; player2.vx *= 0.9; player2.vy *= 0.9; return; }

    if (player2.inVehicle && player2.currentVehicle) {
        const v = player2.currentVehicle;
        player2.x = v.x; player2.y = v.y;

        if (v.type === 'car' || v.type === 'tank' || v.type === 'heli') {
            const gp2 = getPlayer2Gamepad();
            let up = false, down = false, left = false, right = false;
            if (gp2) {
                const gx = gp2.axes[0] || 0, gy = gp2.axes[1] || 0;
                up = gy < -0.2; down = gy > 0.2; left = gx < -0.2; right = gx > 0.2;
                // D-pad как альтернатива стику
                if (gp2.buttons[12] && gp2.buttons[12].pressed) up = true;
                if (gp2.buttons[13] && gp2.buttons[13].pressed) down = true;
                if (gp2.buttons[14] && gp2.buttons[14].pressed) left = true;
                if (gp2.buttons[15] && gp2.buttons[15].pressed) right = true;
            }
            // Стрелки работают всегда — даже если для P2 выбран геймпад
            up = up || keys.ArrowUp; down = down || keys.ArrowDown;
            left = left || keys.ArrowLeft; right = right || keys.ArrowRight;
            if (up) v.speed += v.acc;
            if (down) v.speed -= v.acc;
            v.speed *= v.friction;
            if (left) v.angle -= v.turnSpeed;
            if (right) v.angle += v.turnSpeed;
            if (v.speed > v.maxSpeed) v.speed = v.maxSpeed;
            if (v.speed < -v.maxSpeed / 2) v.speed = -v.maxSpeed / 2;
            v.x += Math.cos(v.angle) * v.speed; v.y += Math.sin(v.angle) * v.speed;
            if (Math.abs(v.speed) > 2 && Math.random() < 0.3) spawnBubbles(v.x, v.y, 2);
        }

        // За рулём легковой техник продолжает стрелять из пистолета: у неё
        // нет турели, и без этого поездка была бы полной беспомощностью.
        if (v.type === 'car') {
            player2.weaponCooldown -= dt;
            fireAuto(player2, 220, p2Dmg(), 0.2);
        }

        // Турель (если есть) наводится и стреляет по ближайшему врагу автоматически
        if (v.type === 'tank' || v.type === 'heli') {
            v.fireTimer -= dt;
            const closest = acquireTarget(v, v.x, v.y, 650);
            if (closest) {
                const aimAngle = Math.atan2(closest.y - v.y, closest.x - v.x);
                if (v.type === 'tank') v.turretAngle = aimAngle;
                if (v.fireTimer <= 0) {
                    if (v.type === 'tank') {
                        const shell = { x: v.x + Math.cos(v.turretAngle) * 40, y: v.y + Math.sin(v.turretAngle) * 40, vx: Math.cos(v.turretAngle) * 20, vy: Math.sin(v.turretAngle) * 20, angle: v.turretAngle, width: 24, height: 8, color: '#ffaa00', life: 2000, piercing: true, comboBonus: 3, hitEnemies: new Set(), isExplosive: true };
                        shell.sfx = playSFX(sfxRocket, 0.45);
                        projectiles.push(shell);
                        v.fireTimer = 1000;
                    } else {
                        const rk = new HelicopterRocket(v.x, v.y, aimAngle);
                        rk.sfx = playSFX(sfxRocket, 0.4);
                        projectiles.push(rk);
                        v.fireTimer = 800;
                    }
                }
            }
        }
        return;
    }

    if (player2.dashTimer > 0) { player2.dashTimer -= dt; if (player2.dashTimer <= 0) player2.isDashing = false; }
    if (p2DashStatus) {
        if (player2.dashCooldown > 0) { p2DashStatus.className = 'status-line dash-cooldown'; p2DashStatus.innerText = 'DASH: COOLDOWN'; }
        else { p2DashStatus.className = 'status-line dash-ready'; p2DashStatus.innerText = 'DASH: READY'; }
    }

    const gp = getPlayer2Gamepad();
    let stickX = 0, stickY = 0;
    let p2InteractPressed = false;
    if (gp) {
        stickX = Math.abs(gp.axes[0]) > 0.2 ? gp.axes[0] : 0;
        stickY = Math.abs(gp.axes[1]) > 0.2 ? gp.axes[1] : 0;
        if (stickX === 0 && stickY === 0) {
            if (gp.buttons[14] && gp.buttons[14].pressed) stickX = -1; // d-pad left
            if (gp.buttons[15] && gp.buttons[15].pressed) stickX = 1;  // d-pad right
            if (gp.buttons[12] && gp.buttons[12].pressed) stickY = -1; // d-pad up
            if (gp.buttons[13] && gp.buttons[13].pressed) stickY = 1;  // d-pad down
        }
        const profile2 = getGamepadButtonProfile(gp);
        const btnDown2 = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
        if (btnDown2(profile2.dash) && !p2PrevButtons[profile2.dash] && player2.dashCooldown <= 0) {
            dashPlayer2(stickX, stickY);
        }
        if (btnDown2(profile2.interact) && !p2PrevButtons[profile2.interact]) p2InteractPressed = true;
        if (btnDown2(profile2.parry) && !p2PrevButtons[profile2.parry] && !player2.inVehicle && player2.parryReady) {
            startParry(player2);
        }
        if (btnDown2(profile2.pulse) && !p2PrevButtons[profile2.pulse] && !player2.inVehicle && player2.pulseReady) {
            executePulse(player2);
        }
        // Клавиатура остаётся запасным вводом даже когда выбран геймпад:
        // у части джойстиков нужной кнопки просто нет под ожидаемым индексом.
        for (let i = 0; i < gp.buttons.length; i++) p2PrevButtons[i] = btnDown2(i);
    }
    if (p2InteractPressed) interactPlayer2();

    if (player2.isDashing) {
        trails.push({ x: player2.x, y: player2.y, alpha: 1, size: player2.size, frame: player2.directionOffset + player2.animFrame, tint: '#1e6bff' });
    } else {
        const speed = player2.speed; let tvx = 0, tvy = 0;
        if (gp && (stickX !== 0 || stickY !== 0)) {
            tvx = stickX * speed; tvy = stickY * speed;
        } else {
            if (keys.ArrowUp) tvy -= speed; if (keys.ArrowDown) tvy += speed;
            if (keys.ArrowLeft) tvx -= speed; if (keys.ArrowRight) tvx += speed;
        }
        player2.vx += (tvx - player2.vx) * 0.2;
        player2.vy += (tvy - player2.vy) * 0.2;
    }
    player2.x += player2.vx; player2.y += player2.vy;

    const isMoving2 = Math.abs(player2.vx) > 0.5 || Math.abs(player2.vy) > 0.5;
    if (isMoving2) {
        if (Math.abs(player2.vy) > Math.abs(player2.vx)) { player2.directionOffset = player2.vy > 0 ? 0 : 12; }
        else { player2.directionOffset = player2.vx < 0 ? 4 : 8; }
        stepWalkAnim(player2, dt);
    } else { player2.animFrame = 0; player2.frameTimer = 0; }

    for (let obs of obstacles.values()) if (obs) resolveAABB(player2, obs);
    for (let obs of customObstacles) resolveAABB(player2, obs);

    // Огонь техника автоматический: второй мыши нет, а держать клавишу огня
    // одной рукой и стрелки другой — это две работы на одного игрока.
    // Пистолет сам бьёт по ближайшей цели, техник занят машиной и ремонтом.
    player2.weaponCooldown -= dt;
    fireAuto(player2, 220, p2Dmg(), 0.2);

    // Урон по P2 (и пешему, и в транспорте) считается в общем цикле снарядов/врагов —
    // см. damagePlayer2 ниже, иначе P2 в машине оказывался неуязвимым.
    if (player2.iFrames <= 0) {
        for (let e of enemies) {
            const hitDist = (e.size || 40) / 2 + player2.size / 2 - 10;
            if (Math.hypot(e.x - player2.x, e.y - player2.y) < hitDist) {
                player2.hp--; player2.iFrames = 1500; hpLostAny = true; shakeTime = Math.max(shakeTime, 300);
                spawnSpriteFX(fxPlayerHit, player2.x, player2.y, { size: 96, frameInterval: 34, alpha: 0.9 });
                if (player2.hp <= 0) downEntity(player2);
                break;
            }
        }
    }
}

// Ремонт — единственное, чем чинится транспорт. Штурм этого не умеет,
// поэтому квестовая машина в ко-опе держится на технике.
let _repairOn = null;
function updateRepair(dt) {
    if (!coopMode || !player2) return;
    let working = false;
    if (!player2.downed) {
        for (const v of transports) {
            if (v.hp >= v.maxHp) continue;
            if (Math.hypot(v.x - player2.x, v.y - player2.y) > REPAIR_RADIUS) continue;
            v.hp = Math.min(v.maxHp, v.hp + REPAIR_RATE * dt / 1000);
            working = true;
            if (Math.random() < 0.05) spawnParticles(v.x, v.y, '#3fdd4a', 1);
            const pct = Math.round(v.hp / v.maxHp * 100);
            if (pct !== v._lastPct) { v._lastPct = pct; updateVehicleHpUI(); }
        }
    }
    if (working !== _repairOn) {
        _repairOn = working;
        if (p2RepairStatus) {
            p2RepairStatus.className = 'status-line ' + (working ? 'repair-on' : 'repair-idle');
            p2RepairStatus.innerText = working ? 'РЕМОНТ: ИДЁТ' : 'РЕМОНТ: ОЖИДАНИЕ';
        }
    }
}

// Урон второму игроку: пешему — в HP, в транспорте — по машине.
function damagePlayer2(amount) {
    if (!player2 || player2.downed) return;
    if (player2.inVehicle && player2.currentVehicle) {
        const v = player2.currentVehicle;
        v.hp -= amount; updateVehicleHpUI();
        if (v.hp <= 0) destroyVehicle(v);
        return;
    }
    if (player2.iFrames > 0) return;
    if (artAbsorbHit(player2)) return;
    player2.hp -= amount; player2.iFrames = 1500; hpLostAny = true;
    spawnSpriteFX(fxPlayerHit, player2.x, player2.y, { size: 96, frameInterval: 34, alpha: 0.9 });
    if (player2.hp <= 0) downEntity(player2);
}
