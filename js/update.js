// --- ОСНОВНАЯ ЛОГИКА (UPDATE) ---

// Дульный срез танковой пушки в мировых пикселях от центра машины.
// Спрайт башни 96 пикселей рисуется высотой 192, центр вращения в середине,
// сам срез — на шестом пикселе кадра: (48 - 6) / 96 * 192.
const TANK_MUZZLE = 84;

function update(dt) {
    if (gameState !== 'playing') return;
    updateChain(dt);
    updateCriticalState();
    
    if (bossCutsceneTimer > 0) { 
        bossCutsceneTimer -= dt; 
        return; // окно эвакуации на паузе: эти 3 секунды игрок не управляет
    }

    updateEvacTimer(dt); // до хитстопа — окно идёт по реальному времени
    updateQuestRespawn(dt);
    updateDive(dt);
    if (hitStopTimer > 0) { hitStopTimer -= dt; dt *= 0.15; }

    worldTimer += dt;
    if (worldTimer >= 60000 && !hpLostAny) unlockAchievement('secret_pacifist_minute');
    if (shakeTime > 0) shakeTime -= dt;
    if (player.iFrames > 0) player.iFrames -= dt;
    updateMapToggle();
    updateP1Gamepad(dt);
    updatePlayer2(dt);
    if (coopMode) updateRevives(dt);

    if (checkLevelUp()) return;

    if (score >= nextBossScore && !activeBoss) {
        bossCutsceneTimer = 3000; 
        let spawnX = camera.x + canvas.width / 2;
        let spawnY = camera.y + canvas.height / 2 - 200;
        const cycle = currentBossIndex % 5;
        const tier = Math.floor(currentBossIndex / 5); // усложнение с каждым кругом
        
        if (cycle === 0) { activeBoss = new AbyssalWarden(spawnX, spawnY); playBGM(bgmBoss1); }
        else if (cycle === 1) { activeBoss = new TideCaller(spawnX, spawnY); playBGM(bgmBoss2); }
        else if (cycle === 2) { activeBoss = new Leviathan(spawnX, spawnY); playBGM(bgmBoss3); }
        else if (cycle === 3) { activeBoss = new ThornReef(spawnX, spawnY); playBGM(bgmBoss4); }
        else { activeBoss = new VoidWraith(spawnX, spawnY); playBGM(bgmBoss5); }
        playSFX(sfxBossSpawn, 0.8);
        spawnSpriteFX(bossFx(activeBoss, 'rune'), spawnX, spawnY, { size: 230, frameInterval: 36 });

        if (depthBossHpMult() > 1) { activeBoss.hp = Math.round(activeBoss.hp * depthBossHpMult()); activeBoss.maxHp = activeBoss.hp; }
        if (tier > 0) { activeBoss.hp = Math.round(activeBoss.hp * (1 + tier * 0.35)); activeBoss.maxHp = activeBoss.hp; }
        if (currentBossIndex === 0) { activeBoss.hp = Math.round(activeBoss.hp * 0.7); activeBoss.maxHp = activeBoss.hp; }
        bossFightStartHp = player.hp;
        if (currentBossIndex === 0 && worldTimer < 90000) unlockAchievement('secret_speedrunner');
        
        enemies.forEach(e => { if (e.type !== 'boss') spawnExplosion(e.x, e.y, 40); });
        enemies = [activeBoss]; 
        enemyProjectiles = []; 
        
        currentBossName = tier > 0 ? `${activeBoss.name} MK${tier + 1}` : activeBoss.name;
        shakeTime = Math.max(shakeTime, 500);
        currentBossIndex++; 
        nextBossScore += 3000;
        return; 
    }
    
    if (activeBoss && activeBoss.hp <= 0) { 
        recordBossWin(activeBoss.name);
        dropArtifact(activeBoss);
        dailyEvent('boss', 1);
        contractEvent('boss', 1);
        addCores(CORE_PER_BOSS);
        rollDrop('boss', activeBoss.x, activeBoss.y);
        if (bossFightStartHp !== null && player.hp >= bossFightStartHp) unlockAchievement('secret_flawless_boss');
        activeBoss = null; 
        playBGM(bgmFight); 
    }

    if (!player.inVehicle && !player.altReady) { 
        player.altTimer -= dt; 
        if (player.altTimer <= 0) { 
            player.altReady = true;
        } 
    }

    if (!player.pulseReady) {
        player.pulseTimer -= dt;
        if (player.pulseTimer <= 0) {
            player.pulseReady = true;
            player.pulseCharges = player.pulseChargesMax;
        }
    }

    if (!player.parryReady) {
        player.parryTimer -= dt;
        if (player.parryTimer <= 0) {
            player.parryReady = true;
        }
    }
    if (player.parryWindow > 0) player.parryWindow -= dt;
    if (player.shieldTimer > 0) player.shieldTimer -= dt;
    if (parryFlashTimer > 0) parryFlashTimer -= dt;
    for (let i = parryShockwaves.length - 1; i >= 0; i--) { parryShockwaves[i].life -= dt; if (parryShockwaves[i].life <= 0) parryShockwaves.splice(i, 1); }

    if (coopMode && player2) {
        if (!player2.pulseReady) {
            player2.pulseTimer -= dt;
            if (player2.pulseTimer <= 0) {
                player2.pulseReady = true;
                player2.pulseCharges = player2.pulseChargesMax;
            }
        }
        if (!player2.parryReady) {
            player2.parryTimer -= dt;
            if (player2.parryTimer <= 0) {
                player2.parryReady = true;
            }
        }
        updateRepair(dt);
        if (player2.parryWindow > 0) player2.parryWindow -= dt;
        if (player2.shieldTimer > 0) player2.shieldTimer -= dt;
    }

    for (let i = pulseRingFx.length - 1; i >= 0; i--) { pulseRingFx[i].life -= dt; if (pulseRingFx[i].life <= 0) pulseRingFx.splice(i, 1); }

    for (let i = spriteFx.length - 1; i >= 0; i--) {
        const fx = spriteFx[i];
        fx.life -= dt;
        fx.frameTimer += dt;
        while (fx.frameTimer >= fx.frameInterval) { fx.frameTimer -= fx.frameInterval; fx.frame++; }
        if (fx.frame >= fx.frames || fx.life <= 0) spriteFx.splice(i, 1);
    }
    _hitFxThisFrame = 0;
    updateArtifacts(dt);
    updateMuzzleFlashes(dt);
    updateWorldFx(dt);
    updateContracts(dt);
    updateDrops(dt);

    // Метры считаем по фактическому смещению игрока: ядро за путь должно
    // достаться тому, кто двигался, а не тому, кто стоял под спавном.
    if (_lastPlayerX !== null) noteCoreDistance(Math.hypot(player.x - _lastPlayerX, player.y - _lastPlayerY));
    _lastPlayerX = player.x; _lastPlayerY = player.y;

    let targetCamX = player.x, targetCamY = player.y;

    if (!player.inVehicle) {
        if (player.dashTimer > 0) { player.dashTimer -= dt; if (player.dashTimer <= 0) player.isDashing = false; }
        if (player.dashCooldown > 0) player.dashCooldown -= dt;
        
        if (player.isDashing && levelDashDmg() > 0) {
            for (const e of enemies) {
                if (e.dashHitAt === player.dashTimer) continue;
                if (Math.hypot(e.x - player.x, e.y - player.y) < (e.size || 40) / 2 + player.size / 2) {
                    e.hp -= levelDashDmg(); e.dashHitAt = player.dashTimer;
                    spawnHitFX(e.x, e.y);
                }
            }
        }
        if (player.isDashing) { 
            trails.push({ x: player.x, y: player.y, alpha: 1, size: player.size, frame: player.directionOffset + player.animFrame, tint: getCosmeticTrailColor() }); 
        } else {
            const currentSpeed = player.speed; let targetVx = 0, targetVy = 0;
            if (!player.downed) {
                const gp1 = getPlayer1Gamepad();
                const gpX = gp1 && Math.abs(gp1.axes[0]) > 0.2 ? gp1.axes[0] : 0;
                const gpY = gp1 && Math.abs(gp1.axes[1]) > 0.2 ? gp1.axes[1] : 0;
                if (isMobile && leftJoy.active) { 
                    targetVx = leftJoy.dx * currentSpeed; targetVy = leftJoy.dy * currentSpeed; 
                } else if (gpX !== 0 || gpY !== 0) {
                    targetVx = gpX * currentSpeed; targetVy = gpY * currentSpeed;
                } else { 
                    if (keys.KeyW) targetVy -= currentSpeed; 
                    if (keys.KeyS) targetVy += currentSpeed; 
                    if (keys.KeyA) targetVx -= currentSpeed; 
                    if (keys.KeyD) targetVx += currentSpeed; 
                }
            }
            player.vx += (targetVx - player.vx) * 0.2; 
            player.vy += (targetVy - player.vy) * 0.2;
        }
        
        player.x += player.vx; 
        player.y += player.vy;

        let isMoving = Math.abs(player.vx) > 0.5 || Math.abs(player.vy) > 0.5;
        if (isMoving) {
            if (Math.abs(player.vy) > Math.abs(player.vx)) { 
                if (player.vy > 0) player.directionOffset = 0; else player.directionOffset = 12; 
            } else { 
                if (player.vx < 0) player.directionOffset = 4; else player.directionOffset = 8; 
            }
            player.frameTimer += dt; 
            if (player.frameTimer > player.frameInterval) { 
                player.animFrame = (player.animFrame + 1) % 4; player.frameTimer = 0; 
            }
        } else { 
            player.animFrame = 0; player.frameTimer = 0; 
        }

        if (player.gunRecoil > 0) player.gunRecoil -= dt * 0.05; 
        if (player.gunRecoil < 0) player.gunRecoil = 0;
        if (player.weaponCooldown > 0) player.weaponCooldown -= dt;

        if ((isShooting || p1GamepadShooting) && player.weaponCooldown <= 0 && !player.isDashing && !player.downed) {
            let aimAngle = getP1AimAngle();
            if (player.currentWeapon === 1) { 
                for (const ang of overloadAngles(aimAngle)) projectiles.push(overloadArm(artOnShot(new PlayerVFXProjectile(player.x, player.y, ang, 15, 1, p1Dmg()))));
                player.weaponCooldown = 200 * levelReloadMult(); player.gunRecoil = 5; playSFX(sfxPistol, 0.3, 0, 0.07);
                flashFromShooter(player, aimAngle, 18, '#00e0ff');
            } else if (player.currentWeapon === 2) { 
                const bullets = SHOTGUN_PELLETS, spread = SHOTGUN_SPREAD, startAngle = aimAngle - spread / 2; 
                for (let i = 0; i < bullets; i++) { 
                    const bulletAngle = startAngle + (spread / (bullets - 1)) * i; 
                    projectiles.push(overloadArm(artOnShot(new PlayerVFXProjectile(player.x, player.y, bulletAngle, 18, 2, p1Dmg() * SHOTGUN_DMG)))); 
                } 
                player.vx = -Math.cos(aimAngle) * 12; player.vy = -Math.sin(aimAngle) * 12; 
                shakeTime = Math.max(shakeTime, 200); player.weaponCooldown = SHOTGUN_COOLDOWN * levelReloadMult(); player.gunRecoil = 12; playSFX(sfxShotgun, 0.5, 0, 0.05);
                flashFromShooter(player, aimAngle, 34, '#ff9f1c');
            } else if (player.currentWeapon === 3) {
                const b = artOnShot(new PlayerVFXProjectile(player.x, player.y, aimAngle, 13, 1, p1Dmg() * BOOMER_DMG));
                b.piercing = true; b.boomerang = true; b.life = BOOMER_LIFE * levelRangeMult(); b.boomerLife = b.life;
                projectiles.push(overloadArm(b));
                player.weaponCooldown = BOOMER_COOLDOWN * levelReloadMult(); player.gunRecoil = 8; playSFX(sfxAlt, 0.4, 0, 0.06);
                flashFromShooter(player, aimAngle, 22, '#00e0ff');
            } else if (player.currentWeapon === 4) {
                const w = artOnShot(new PlayerVFXProjectile(player.x, player.y, aimAngle, SURGE_SPEED, 1, p1Dmg() * SURGE_DMG));
                w.piercing = true; w.surge = true;
                w.life = SURGE_LIFE * levelRangeMult(); w.surgeLife = w.life;
                w.width = SURGE_W0; w.height = SURGE_W0;
                projectiles.push(overloadArm(w));
                player.vx = -Math.cos(aimAngle) * 9; player.vy = -Math.sin(aimAngle) * 9;
                shakeTime = Math.max(shakeTime, 380);
                player.weaponCooldown = SURGE_COOLDOWN * levelReloadMult(); player.gunRecoil = 18; playSFX(sfxSurge, 0.65, 0, 0.04);
                flashFromShooter(player, aimAngle, 46, '#3d8bff');
            }
        }
    } else if (player.currentVehicle) {
        let v = player.currentVehicle; targetCamX = v.x; targetCamY = v.y;
        if (isNaN(targetCamX) || isNaN(targetCamY)) { 
            v.x = player.x; v.y = player.y; targetCamX = player.x; targetCamY = player.y; 
        } else { 
            player.x = v.x; player.y = v.y; 
        }
        
        if (v.type === 'car' || v.type === 'tank' || v.type === 'heli') {
            let vUp = keys.KeyW, vDown = keys.KeyS, vLeft = keys.KeyA, vRight = keys.KeyD;
            const gp1v = getPlayer1Gamepad();
            if (gp1v) {
                const gx = gp1v.axes[0] || 0, gy = gp1v.axes[1] || 0;
                if (gy < -0.25) vUp = true; if (gy > 0.25) vDown = true;
                if (gx < -0.25) vLeft = true; if (gx > 0.25) vRight = true;
                const gb = (i) => !!(gp1v.buttons[i] && gp1v.buttons[i].pressed);
                if (gb(12)) vUp = true; if (gb(13)) vDown = true;
                if (gb(14)) vLeft = true; if (gb(15)) vRight = true;
            }
            if (vUp) v.speed += v.acc; 
            if (vDown) v.speed -= v.acc; 
            v.speed *= v.friction;
            
            if (vLeft) v.angle -= v.turnSpeed; 
            if (vRight) v.angle += v.turnSpeed;
            
            if (isMobile && leftJoy.active) {
                if (leftJoy.dy < -0.2) v.speed += v.acc; else if (leftJoy.dy > 0.2) v.speed -= v.acc;
                if (leftJoy.dx < -0.2) v.angle -= v.turnSpeed; else if (leftJoy.dx > 0.2) v.angle += v.turnSpeed;
            }
            if (v.speed > v.maxSpeed) v.speed = v.maxSpeed; 
            if (v.speed < -v.maxSpeed/2) v.speed = -v.maxSpeed/2;
            
            v.x += Math.cos(v.angle) * v.speed; 
            v.y += Math.sin(v.angle) * v.speed;
            if (Math.abs(v.speed) > 2 && Math.random() < 0.3) spawnBubbles(v.x, v.y, 2);
        }
        
        // С геймпада мыши нет — турель наводится на ближайшего врага (как и пеший автоприцел)
        const vAim = (p1GamepadAimAngle !== null) ? p1GamepadAimAngle : Math.atan2(mouse.worldY - v.y, mouse.worldX - v.x);
        const vFiring = isShooting || p1GamepadShooting;

        if (v.type === 'tank') {
            let diff = vAim - v.turretAngle;
            while (diff < -Math.PI) diff += Math.PI * 2; 
            while (diff > Math.PI) diff -= Math.PI * 2;
            
            v.turretAngle += diff * 0.1; v.fireTimer -= dt;
            if (vFiring && v.fireTimer <= 0) { 
                const shell = { x: v.x + Math.cos(v.turretAngle)*TANK_MUZZLE, y: v.y + Math.sin(v.turretAngle)*TANK_MUZZLE, vx: Math.cos(v.turretAngle) * 20, vy: Math.sin(v.turretAngle) * 20, angle: v.turretAngle, width: 24, height: 8, color: '#ffaa00', life: 2000, piercing: true, comboBonus: 3, hitEnemies: new Set(), isExplosive: true };
                shell.sfx = playSFX(sfxRocket, 0.55);
                projectiles.push(shell);
                v.fireTimer = 1000; shakeTime = Math.max(shakeTime, 200); 
            }
        } else if (v.type === 'heli') {
            v.fireTimer -= dt;
            if (vFiring && v.fireTimer <= 0) { 
                let aimAngle = (isMobile && rightJoy.active) ? Math.atan2(rightJoy.dy, rightJoy.dx) : vAim; 
                const rk = new HelicopterRocket(v.x, v.y, aimAngle);
                rk.sfx = playSFX(sfxRocket, 0.45);
                projectiles.push(rk);
                v.fireTimer = 800; 
            }
        }
    }

    for (let v of transports) { 
        if (v.type === 'heli') { 
            if (player.currentVehicle === v || (coopMode && player2 && player2.currentVehicle === v)) v.rotorSpeed = Math.min(v.rotorSpeed + 0.01, 0.4); 
            else v.rotorSpeed = Math.max(v.rotorSpeed - 0.005, 0); 
            v.rotorAngle += v.rotorSpeed; 
        } 
    }
    
    manageObstacles(splitScreenActive() ? (targetCamX + player2.x) / 2 : targetCamX, splitScreenActive() ? (targetCamY + player2.y) / 2 : targetCamY);
    if (!player.inVehicle) { 
        for (let obs of obstacles.values()) if (obs) resolveAABB(player, obs); 
        for (let obs of customObstacles) resolveAABB(player, obs); 
    }
    for (let v of transports) { 
        if (v.type !== 'heli') { 
            for (let obs of obstacles.values()) if (obs) resolveAABB(v, obs); 
            for (let obs of customObstacles) resolveAABB(v, obs); 
        } 
    }
    
    const viewW = splitScreenActive() ? canvas.width / 2 : canvas.width;
    camera.x += (targetCamX - viewW / 2 - camera.x) * 0.1; 
    camera.y += (targetCamY - canvas.height / 2 - camera.y) * 0.1;
    if (splitScreenActive()) {
        camera2.x += (player2.x - viewW / 2 - camera2.x) * 0.1;
        camera2.y += (player2.y - canvas.height / 2 - camera2.y) * 0.1;
    }

    for (let i = customObstacles.length - 1; i >= 0; i--) {
        let obs = customObstacles[i];
        if (obs.isGeyser) {
            obs.life -= dt;
            const pulled = [player];
            if (coopMode && player2 && !player2.downed) pulled.push(player2);
            if (obs.isVoid) {
                const cx = obs.x + 60, cy = obs.y + 60;
                for (const pl of pulled) {
                    const target = pl.inVehicle && pl.currentVehicle ? pl.currentVehicle : pl;
                    const dist = Math.hypot(target.x - cx, target.y - cy);
                    if (dist > 20 && dist < 260 && !pl.isDashing) {
                        const pullAngle = Math.atan2(cy - target.y, cx - target.x);
                        target.x += Math.cos(pullAngle) * 1.4; target.y += Math.sin(pullAngle) * 1.4;
                    }
                }
            }
            if (obs.life <= 0) {
                spawnExplosion(obs.x + 50, obs.y + 50, 40); 
                for (const pl of pulled) {
                    const target = pl.inVehicle && pl.currentVehicle ? pl.currentVehicle : pl;
                    if (Math.hypot(target.x - (obs.x+50), target.y - (obs.y+50)) >= 70) continue;
                    if (pl === player) {
                        if (player.iFrames > 0) continue;
                        if (!player.inVehicle) { 
                            if (!artAbsorbHit(player)) {
                            player.hp--; updateHpUI(); player.iFrames = 1500; hpLostAny = true;
                            if (player.hp <= 0) downEntity(player); }
                        } else { 
                            target.hp -= 1; updateVehicleHpUI(); 
                            if (target.hp <= 0) destroyVehicle(target); 
                        } 
                    } else {
                        damagePlayer2(1);
                    }
                }
                customObstacles.splice(i, 1);
            }
        }
    }

    if (!activeBoss) {
        let baseSpawnRate = 1200 - Math.min(800, (score / 10) * 20); 
        if (questState === 'heat') baseSpawnRate = Math.max(300, baseSpawnRate / 3);
        // Каждое «нырнуть» ускоряет спавн: множитель кредитов без платы
        // не был бы решением, а был бы бесплатной кнопкой «дай больше»
        if (diveMult > 1) baseSpawnRate = Math.max(250, baseSpawnRate / (1 + (diveMult - 1) * 0.5));
        baseSpawnRate = Math.max(180, baseSpawnRate / depthSpawnDiv());
        enemySpawnTimer -= dt;
        if (enemySpawnTimer <= 0 && enemies.length < ENEMY_CAP) {
            // Спавн шёл только вокруг камеры P1: разъехавшийся напарник
            // оставался в вакууме. Кадр выбирает камеру случайно, ширина
            // берётся по вьюпорту, а не по всему канвасу.
            const cam = (splitScreenActive() && Math.random() < 0.5) ? camera2 : camera;
            const cw = splitScreenActive() ? canvas.width / 2 : canvas.width;
            let sx, sy; 
            if (Math.random() < 0.5) { 
                sx = cam.x + (Math.random() < 0.5 ? -50 : cw + 50); 
                sy = cam.y + Math.random() * canvas.height; 
            } else { 
                sx = cam.x + Math.random() * cw; 
                sy = cam.y + (Math.random() < 0.5 ? -50 : canvas.height + 50); 
            }
            // Пачка не должна перепрыгнуть потолок: иначе глубина 5 добавляла бы
            // по четыре врага сверх лимита каждым спавном
            const packSize = Math.min(ENEMY_CAP - enemies.length, Math.floor(Math.random() * 4) + 1 + depthPackBonus());
            const huskOn = unlockOwned('enemy_husk') && huskAllowed();
            for (let k = 0; k < packSize; k++) { 
                let ox = sx + (Math.random() - 0.5) * 80, oy = sy + (Math.random() - 0.5) * 80; 
                if (huskOn && Math.random() < 0.18) {
                    enemies.push({ x: ox, y: oy, type: 'husk', hp: 12, speed: 1.6, size: 56, color: '#3d8bff',
                        angle: 0, turretAngle: 0, rotorAngle: 0, fireTimer: 3000 });
                } else if (Math.random() < 0.3) { 
                    enemies.push({ x: ox, y: oy, type: 'sniper', hp: 3, speed: 2, size: 40, color: '#ffffff', angle: 0, animFrame: 0, frameTimer: 0, frameInterval: 120, row: 0, fireTimer: 2000 }); 
                } else { 
                    enemies.push({ x: ox, y: oy, type: 'neon', hp: 1, speed: questState === 'heat' ? 4.5 : 3.5, size: 40, color: '#00ced1', angle: 0, turretAngle: 0, rotorAngle: 0, fireTimer: 2000 }); 
                } 
            }
            enemySpawnTimer = baseSpawnRate * 1.5; 
        }
    }

    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i]; 
        if (p.update) p.update(dt); else { p.x += p.vx; p.y += p.vy; p.life -= dt; }
        
        let hitObs = false;
        for (let obs of customObstacles) { 
            if (obs.isGeyser) continue; 
            if (p.x > obs.x && p.x < obs.x + obs.w && p.y > obs.y && p.y < obs.y + obs.h) { 
                if (p.isExplosive) { spawnExplosion(p.x, p.y, 40); spawnShatterParticles(obs.x, obs.y, obs.w, obs.h, obs.color); } 
                else { spawnParticles(p.x, p.y, obs.color, 3); spawnImpactSparks(p.x, p.y, Math.atan2(p.vy || 0, p.vx || 1), obs.color); } hitObs = true; break; 
            } 
        }
        
        if (!hitObs) { 
            for (let obs of obstacles.values()) { 
                if (obs && p.x > obs.x && p.x < obs.x + obs.w && p.y > obs.y && p.y < obs.y + obs.h) { 
                    if (p.isExplosive) { 
                        destroyedObstacles.add(obs.key); obstacles.delete(obs.key); 
                        spawnExplosion(p.x, p.y, 40); spawnShatterParticles(obs.x, obs.y, obs.w, obs.h, obs.flashTimer > 0 ? '#ffffff' : '#00ffd5'); spawnSpriteFX(fxBoomTank, p.x, p.y, { size: 120, frameInterval: 45 });
                    } else { 
                        obs.flashTimer = 150; spawnParticles(p.x, p.y, '#ffffff', 3); spawnImpactSparks(p.x, p.y, Math.atan2(p.vy || 0, p.vx || 1)); 
                    } 
                    hitObs = true; break; 
                } 
            } 
        }
        
        if (p.life <= 0 || hitObs) { 
            if (p.isRocket) explode(p.x, p.y, 100, 20); 
            else if (p.isExplosive && hitObs) playBoomSFX(0.5);
            stopSFX(p.sfx); 
            projectiles.splice(i, 1); 
        }
    }

    // Ушедшие далеко от ОБОИХ игроков не догонят никогда, но продолжают
    // считаться в O(n^2) разлипании ниже. Двойной спавн без этого — утечка.
    if (enemies.length > ENEMY_CAP * 0.8) {
        const anchors = [player];
        if (coopMode && player2) anchors.push(player2);
        for (let i = enemies.length - 1; i >= 0; i--) {
            const e = enemies[i];
            if (e.type === 'boss') continue;
            let near = false;
            for (const a of anchors) { if (Math.hypot(e.x - a.x, e.y - a.y) < 2600) { near = true; break; } }
            if (!near) enemies.splice(i, 1);
        }
    }

    for (let i = 0; i < enemies.length; i++) { 
        for (let j = i + 1; j < enemies.length; j++) { 
            const e1 = enemies[i], e2 = enemies[j]; 
            if (e1.type === 'boss' || e2.type === 'boss') continue; 
            const dx = e1.x - e2.x, dy = e1.y - e2.y, dist = Math.hypot(dx, dy); 
            if (dist < e1.size && dist > 0) { 
                const overlap = (e1.size - dist) / 2; 
                e1.x += (dx / dist) * overlap; e1.y += (dy / dist) * overlap; 
                e2.x -= (dx / dist) * overlap; e2.y -= (dy / dist) * overlap; 
            } 
        } 
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        if (e.hp <= 0) { 
            if (e.type === 'boss') { 
                spawnExplosion(e.x, e.y, 150); shakeTime = Math.max(shakeTime, 1000); addScore(1000, CREDITS.boss);
                spawnSpriteFX(fxBoomBoss, e.x, e.y, { size: 280, frameInterval: 55, ...FX_BOSS_CUT });
                // Цветной росчерк убран: поверх взрыва читался грязными полосами.
                // Цвет босса несёт руна на появлении. bossFx(e, 'slash') остаётся рабочим.
                if (e.name === 'VOID WRAITH') triggerVictory();
            } else { 
                spawnParticles(e.x, e.y); spawnSpriteFX(fxKill, e.x, e.y, { size: 86, frameInterval: 38 }); addScore(10, CREDITS.enemy); playEnemyDeathSFX();
            } 
            updateStyleRank(); 
            enemies.splice(i, 1); 
            continue; 
        }

        let target = getEnemyTarget(e);
        if (e.type === 'boss') { 
            e.update(dt, target); 
            if (Math.abs(e.vx) > 0.5 || Math.abs(e.vy) > 0.5) if (Math.random() < 0.2) spawnBubbles(e.x, e.y, 1); 
        } else {
            const angleToTarget = Math.atan2(target.y - e.y, target.x - e.x); e.angle = angleToTarget; 
            let moveX = Math.cos(e.angle) * e.speed, moveY = Math.sin(e.angle) * e.speed;
            
            if (e.vx !== undefined && e.vy !== undefined) { 
                e.x += e.vx; e.y += e.vy; e.vx *= 0.9; e.vy *= 0.9; 
                if (Math.abs(e.vx) < 0.1 && Math.abs(e.vy) < 0.1) { delete e.vx; delete e.vy; } 
            } else { 
                e.x += moveX; e.y += moveY; 
            }
            
            if (e.type === 'sniper' || e.type === 'micro') { 
                if (Math.abs(moveX) > Math.abs(moveY)) e.row = moveX > 0 ? 2 : 1; else e.row = moveY > 0 ? 0 : 3; 
                e.frameTimer += dt; 
                if (e.frameTimer > e.frameInterval) { e.animFrame = (e.animFrame + 1) % 4; e.frameTimer = 0; } 
            }
            
            if (e.type === 'sniper') { 
                e.fireTimer -= dt; 
                if (e.fireTimer <= 0) { 
                    enemyProjectiles.push(new EnemyProjectile(e.x, e.y, Math.cos(e.angle), Math.sin(e.angle))); 
                    e.vx = -Math.cos(e.angle) * 8; e.vy = -Math.sin(e.angle) * 8; 
                    e.fireTimer = 2000; playEnemyShotSFX(); 
                } 
            }
            
            if (e.type !== 'heli') { 
                let stuckX = false, stuckY = false; 
                for (let obs of obstacles.values()) { 
                    if (obs) { 
                        let startX = e.x, startY = e.y; resolveAABB(e, obs); 
                        if (e.x !== startX) stuckX = true; if (e.y !== startY) stuckY = true; 
                    } 
                } 
                for (let obs of customObstacles) { 
                    let startX = e.x, startY = e.y; resolveAABB(e, obs); 
                    if (e.x !== startX) stuckX = true; if (e.y !== startY) stuckY = true; 
                } 
                if (stuckX && !stuckY) e.y += Math.sign(moveY || 1) * e.speed * 0.6; 
                if (stuckY && !stuckX) e.x += Math.sign(moveX || 1) * e.speed * 0.6; 
            }
        }

        let hit = false;
        if (!player.inVehicle && player.iFrames <= 0) { 
            if (Math.hypot(player.x - e.x, player.y - e.y) < (e.size/2 + player.size/2)) { 
                if (!artAbsorbHit(player)) {
                    player.hp--; updateHpUI(); shakeTime = e.type === 'boss' ? 600 : 300; player.iFrames = 1500; hit = e.type !== 'boss'; hpLostAny = true;
                    if (player.hp <= 0) downEntity(player); 
                }
            } 
        } else if (player.inVehicle && player.currentVehicle) { 
            let v = player.currentVehicle; 
            if (Math.hypot(v.x - e.x, v.y - e.y) < (e.size/2 + v.size/2)) { 
                if (v.type === 'heli') {} 
                else if (v.type === 'car' && Math.abs(v.speed) > 6 && e.type !== 'boss') { 
                    hit = true; addScore(10, CREDITS.ram); spawnParticles(e.x, e.y); shakeTime = Math.max(shakeTime, 100); 
                } else { 
                    v.hp -= (e.type === 'boss' ? 3 : 1); updateVehicleHpUI(); 
                    if (e.type !== 'boss') hit = true; spawnParticles(e.x, e.y, '#ffaa00'); 
                    if (v.hp <= 0) destroyVehicle(v); 
                } 
            } 
        }
        
        if (!hit && coopMode && player2 && !player2.downed && player2.inVehicle && player2.currentVehicle) {
            let v2 = player2.currentVehicle;
            if (Math.hypot(v2.x - e.x, v2.y - e.y) < (e.size/2 + v2.size/2)) {
                if (v2.type === 'heli') {}
                else if (v2.type === 'car' && Math.abs(v2.speed) > 6 && e.type !== 'boss') {
                    hit = true; addScore(10, CREDITS.ram); spawnParticles(e.x, e.y); shakeTime = Math.max(shakeTime, 100);
                } else {
                    v2.hp -= (e.type === 'boss' ? 3 : 1); updateVehicleHpUI();
                    if (e.type !== 'boss') hit = true; spawnParticles(e.x, e.y, '#ffaa00');
                    if (v2.hp <= 0) destroyVehicle(v2);
                }
            }
        }

        if(!hit && !player.inVehicle) { 
            for(let v of transports) { 
                if (v === player.currentVehicle || (player2 && v === player2.currentVehicle)) continue;
                if(Math.hypot(v.x - e.x, v.y - e.y) < (e.size/2 + v.size/2) && v.type !== 'heli') { 
                    v.hp -= (e.type === 'boss' ? 0.5 : 0.1); 
                    if (e.type !== 'boss') hit = true; spawnParticles(e.x, e.y, '#ffaa00'); 
                    if(v.hp <= 0) destroyVehicle(v); 
                } 
            } 
        }

        if (!hit) {
            for (let j = projectiles.length - 1; j >= 0; j--) {
                const p = projectiles[j];
                if (p.isRocket) { 
                    if (Math.hypot(p.x - e.x, p.y - e.y) < (e.size/2 + 10)) { 
                        explode(p.x, p.y, 100, 20); stopSFX(p.sfx); projectiles.splice(j, 1); 
                    } 
                    continue; 
                }
                if (p.comboBonus === 0 && p.isExplosive && p.life > 2800) continue; 
                
                let hitDist = p.isExplosive ? 40 : (e.size/2 + Math.max(p.width || 0, p.height || 0)/2);
                if (Math.hypot(p.x - e.x, p.y - e.y) < hitDist) { 
                    if (p.hitEnemies && p.hitEnemies.has(e)) continue; 
                    if (p.hitEnemies) p.hitEnemies.add(e); 
                    const dmgMult = e.shelled ? (e.phase === 2 ? 0 : 0.2) : 1;
                    e.hp -= (p.isExplosive ? 5 : 1) * dmgMult * (p.dmg || 1) * artDamageOn(e); 
                    artOnHitEnemy(e);
                    if (p.surge && e.type !== 'boss') {
                        const a = Math.atan2(e.y - p.y, e.x - p.x);
                        e.x += Math.cos(a) * SURGE_PUSH; e.y += Math.sin(a) * SURGE_PUSH;
                    }
                    artOnProjectileHit(p, p.x, p.y);
                    overloadOnHit(p, p.x, p.y, e);
                    if (!p.piercing) projectiles.splice(j, 1); 
                    if (p.isExplosive) { spawnExplosion(e.x, e.y, 40); playBoomSFX(0.5); stopSFX(p.sfx); spawnSpriteFX(fxBoomTank, e.x, e.y, { size: 120, frameInterval: 45 }); }
                    spawnHitFX(p.x, p.y);
                    if (e.type === 'boss') { spawnParticles(e.x, e.y, '#ffffff', 1); hitStopTimer = 40; }
                    if (e.hp <= 0) { 
                        hit = true; 
                        if (p.comboBonus > 0) { if (e.type === 'boss') addScore(1000, CREDITS.boss); else addScore(10, (CREDITS.enemy + levelKillBonus()) * levelKillMult()); } 
                    } 
                    break; 
                }
            }
        }
        
        if (hit) { 
            if (e.type === 'boss') { 
                spawnExplosion(e.x, e.y, 150); shakeTime = Math.max(shakeTime, 1000);
                spawnSpriteFX(fxBoomBoss, e.x, e.y, { size: 280, frameInterval: 55, ...FX_BOSS_CUT });
                // Цветной росчерк убран: поверх взрыва читался грязными полосами.
                // Цвет босса несёт руна на появлении. bossFx(e, 'slash') остаётся рабочим.
                if (e.name === 'VOID WRAITH') triggerVictory();
            } else { 
                spawnParticles(e.x, e.y); spawnSpriteFX(fxKill, e.x, e.y, { size: 86, frameInterval: 38 }); playEnemyDeathSFX();
                dailyEvent('kill', 1);
                contractEvent('kill', 1);
                artOnEnemyKilled(e.x, e.y);
                if (lvl('chainbolt') > 0 && ++chainBoltCount >= 5) {
                    chainBoltCount = 0;
                    const r = 220 + 60 * lvl('chainbolt');
                    for (const t of enemies) if (Math.hypot(t.x - e.x, t.y - e.y) < r) t.hp -= 4 * lvl('chainbolt');
                    spawnSpriteFX(tintFx(fxRingBase, '#f0c419'), e.x, e.y, { size: r * 2, frameInterval: 28, alpha: 0.8 });
                    playSFX(sfxPulse, 0.45, 0, 0.05);
                }
                rollDrop('enemy', e.x, e.y);
                if (e.type === 'husk') {
                    for (let m = 0; m < 2; m++) {
                        const a = Math.random() * Math.PI * 2, f = Math.random() * 5 + 4;
                        enemies.push({ x: e.x, y: e.y, type: 'neon', hp: 3, speed: 4.2, size: 40, color: '#3d8bff',
                            angle: 0, turretAngle: 0, rotorAngle: 0, fireTimer: 1500,
                            vx: Math.cos(a) * f, vy: Math.sin(a) * f });
                    }
                }
                if (e.type === 'sniper') { 
                    const microCount = Math.floor(Math.random() * 2) + 2; 
                    for (let m = 0; m < microCount; m++) { 
                        const randomAngle = Math.random() * Math.PI * 2, randomForce = Math.random() * 6 + 5; 
                        enemies.push({ x: e.x, y: e.y, type: 'micro', hp: 1, speed: e.speed * 1.8, size: e.size * 0.5, color: '#ffffff', angle: 0, vx: Math.cos(randomAngle) * randomForce, vy: Math.sin(randomAngle) * randomForce, animFrame: 0, frameTimer: 0, frameInterval: 80, row: 0 }); 
                    } 
                } 
            } 
            enemies.splice(i, 1); 
        }
    }

    if (questState === 'heat' && extractionPoint) {
        let driver = (player.inVehicle && player.currentVehicle === questVehicle) ? player
                   : (coopMode && player2 && player2.inVehicle && player2.currentVehicle === questVehicle) ? player2
                   : null;
        const atVault = driver && deepVault && !deepVault.sealed
            && Math.hypot(questVehicle.x - deepVault.x, questVehicle.y - deepVault.y) < deepVault.radius;
        if (atVault) runCredits = Math.round(runCredits * VAULT_MULT);
        if (driver && (atVault || Math.hypot(questVehicle.x - extractionPoint.x, questVehicle.y - extractionPoint.y) < extractionPoint.radius)) { 
            driver.hp = driver.maxHpRun || maxHp(); if (driver === player) updateHpUI(); addScore(500, CREDITS.extraction); shakeTime = 1000; 
            const banked = bankCredits();
            if (banked > 0) showAchievementToast(atVault ? `ШЛЮЗ: +${banked} CR (×${VAULT_MULT})` : `+${banked} CR В КОШЕЛЁК`);
            dailyEvent('bank', banked);
            if (atVault) { dailyEvent('vault', 1); contractEvent('vault', 1); }
            
            
            enemies = enemies.filter(e => e.type === 'boss'); 
            
            driver.x = questVehicle.x; driver.y = questVehicle.y; 
            driver.inVehicle = false; driver.currentVehicle = null; 
            updateVehicleHpUI(); 
            driver.iFrames = 2000; spawnExplosion(questVehicle.x, questVehicle.y, 100);
            spawnSpriteFX(atVault ? fxVault : fxExtraction, questVehicle.x, questVehicle.y, { size: 220, frameInterval: 55, alpha: 0.9 }); 
            let idx = transports.indexOf(questVehicle); if (idx > -1) transports.splice(idx, 1); 
            questState = 'none'; clearQuestSite(); 
            scheduleQuestRespawn(); 
            offerDive();
        } 
    }

    for (let i = trails.length - 1; i >= 0; i--) { trails[i].alpha -= dt / 500; if (trails[i].alpha <= 0) trails.splice(i, 1); }
    for (let i = scorches.length - 1; i >= 0; i--) { scorches[i].alpha -= dt * 0.0001; if (scorches[i].alpha <= 0) scorches.splice(i, 1); }
    for (let i = particles.length - 1; i >= 0; i--) { 
        particles[i].x += particles[i].vx; particles[i].y += particles[i].vy; 
        if (particles[i].friction) { particles[i].vx *= particles[i].friction; particles[i].vy *= particles[i].friction; } 
        particles[i].alpha -= particles[i].decay; if (particles[i].alpha <= 0) particles.splice(i, 1); 
    }
    for (let i = bubbles.length - 1; i >= 0; i--) { 
        bubbles[i].x += bubbles[i].vx; bubbles[i].y += bubbles[i].vy; 
        bubbles[i].alpha -= dt * 0.001; if (bubbles[i].alpha <= 0) bubbles.splice(i, 1); 
    }

    for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
        const ep = enemyProjectiles[i]; if (!ep) continue; ep.update(dt); let hit = false;
        for (let obs of customObstacles) { if (obs.isGeyser) continue; if (ep.x > obs.x && ep.x < obs.x + obs.w && ep.y > obs.y && ep.y < obs.y + obs.h) hit = true; }
        for (let obs of obstacles.values()) { if (obs && ep.x > obs.x && ep.x < obs.x + obs.w && ep.y > obs.y && ep.y < obs.y + obs.h) hit = true; }
        
        let target = player.inVehicle && player.currentVehicle ? player.currentVehicle : player;

        if (!hit && !player.inVehicle && player.parryWindow > 0 && Math.hypot(player.x - ep.x, player.y - ep.y) < (ep.radius + player.size / 2 + 20)) {
            hit = true;
            triggerParrySuccess(player);
        }

        if (!hit && coopMode && player2 && !player2.inVehicle && player2.parryWindow > 0 && Math.hypot(player2.x - ep.x, player2.y - ep.y) < (ep.radius + player2.size / 2 + 20)) {
            hit = true;
            triggerParrySuccess(player2);
        }

        if (!hit && player.iFrames <= 0 && Math.hypot(target.x - ep.x, target.y - ep.y) < (ep.radius + target.size / 2)) { 
            hit = true; shakeTime = Math.max(shakeTime, 300); 
            if (!player.inVehicle) { if (!artAbsorbHit(player)) { player.hp--; updateHpUI(); player.iFrames = 1500; hpLostAny = true; if (player.hp <= 0) downEntity(player); } } 
            else { target.hp -= 1; updateVehicleHpUI(); if (target.hp <= 0) destroyVehicle(target); } 
        }
        
        if (!hit && coopMode && player2 && !player2.downed) {
            const t2 = player2.inVehicle && player2.currentVehicle ? player2.currentVehicle : player2;
            const canHit2 = player2.inVehicle ? true : player2.iFrames <= 0;
            if (canHit2 && Math.hypot(t2.x - ep.x, t2.y - ep.y) < (ep.radius + t2.size / 2)) {
                hit = true; shakeTime = Math.max(shakeTime, 300);
                damagePlayer2(1);
            }
        }

        const offCam1 = ep.x < camera.x - 800 || ep.x > camera.x + canvas.width + 800 || ep.y < camera.y - 800 || ep.y > camera.y + canvas.height + 800;
        const offCam2 = !splitScreenActive() || (ep.x < camera2.x - 800 || ep.x > camera2.x + canvas.width + 800 || ep.y < camera2.y - 800 || ep.y > camera2.y + canvas.height + 800);
        if (hit || (offCam1 && offCam2)) { 
            if (hit) spawnBubbles(ep.x, ep.y, 3); 
            enemyProjectiles.splice(i, 1); 
        }
    }
} 
