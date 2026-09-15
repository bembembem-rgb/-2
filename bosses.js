// --- КЛАССЫ БОССОВ ---

// Вторая фаза: один раз при HP ниже половины. Повторно не срабатывает, даже
// если HP вернётся наверх, — за это отвечает поле phase, а не сравнение HP.
const BOSS_PHASE2_SPEED = 1.25;
const BOSS_PHASE2_TICK = 260;   // мс между частицами-индикаторами

function bossEnterPhaseTwo(boss) {
    boss.phase = 2;
    boss.speed *= BOSS_PHASE2_SPEED;
    // Сброс в chase, иначе переход посреди залпа оставляет висящий таймер
    boss.state = 'chase';
    boss.timer = 0;
    shakeTime = Math.max(shakeTime, 700);
    hitStopTimer = 90;
    spawnSpriteFX(bossFx(boss, 'ring'), boss.x, boss.y, { size: 300, frameInterval: 52, alpha: 0.75 });
    playSFX(sfxBossSpawn, 0.5);
}

// Индикация фазы — редкие частицы цвета босса по его контуру. Пульсация
// яркости спрайта не годится: она спорит с белой вспышкой попадания.
function bossPhaseTick(boss, dt) {
    if (boss.phase !== 2) return;
    boss.phaseFxTimer -= dt;
    if (boss.phaseFxTimer > 0) return;
    boss.phaseFxTimer = BOSS_PHASE2_TICK;
    const a = Math.random() * Math.PI * 2, r = boss.size * 0.7;
    spawnParticles(boss.x + Math.cos(a) * r, boss.y + Math.sin(a) * r, boss.phaseColor, 1);
}

function bossCheckPhase(boss, dt) {
    if (boss.phase === 1 && boss.hp <= boss.maxHp / 2) bossEnterPhaseTwo(boss);
    bossPhaseTick(boss, dt);
}

class AbyssalWarden {
    constructor(x, y) {
        this.x = x; this.y = y; this.type = 'boss'; this.name = 'ABYSSAL WARDEN';
        this.hp = 100; this.maxHp = 100; this.size = 64; this.speed = 2;
        this.state = 'chase'; this.timer = 0; this.spiralAngle = 0;
        this.vx = 0; this.vy = 0; this.image = boss1Img;
        this.animFrame = 0; this.frameTimer = 0; this.frameInterval = 60;
        this.phase = 1; this.phaseColor = '#00ffff'; this.phaseFxTimer = 0;
    }
    update(dt, target) {
        bossCheckPhase(this, dt);
        this.timer += dt; this.frameTimer += dt;
        if (this.frameTimer > this.frameInterval) { this.animFrame = (this.animFrame + 1) % 20; this.frameTimer = 0; }
        if (this.state === 'chase') {
            const angle = Math.atan2(target.y - this.y, target.x - this.x);
            this.vx = Math.cos(angle) * this.speed; this.vy = Math.sin(angle) * this.speed;
            if (this.timer > 4000) { this.state = 'whirlpool'; this.timer = 0; }
        } else if (this.state === 'whirlpool') {
            this.vx = 0; this.vy = 0; const dist = Math.hypot(target.x - this.x, target.y - this.y);
            if (dist > 60 && dist < 700 && (target === player || target === player2) && !target.isDashing && !target.inVehicle) {
                const pullAngle = Math.atan2(this.y - target.y, this.x - target.x); target.x += Math.cos(pullAngle) * 3; target.y += Math.sin(pullAngle) * 3;
            }
            if (Math.floor(this.timer / 50) % 2 === 0) {
                this.spiralAngle += 0.3;
                // Фаза 2 — три луча вместо двух. Лучи остаются равноудалёнными,
                // поэтому просветы между ними сужаются, но не исчезают.
                const beams = this.phase === 2 ? 3 : 2;
                const step = (Math.PI * 2) / beams;
                for (let i = 0; i < beams; i++) {
                    const a = this.spiralAngle + step * i;
                    enemyProjectiles.push(new EnemyProjectile(this.x, this.y, Math.cos(a), Math.sin(a), '#00ffff', 6));
                }
            }
            if (this.timer > 3000) { this.state = 'chase'; this.timer = 0; }
        }
        this.x += this.vx; this.y += this.vy;
    }
}

class TideCaller {
    constructor(x, y) {
        this.x = x; this.y = y; this.type = 'boss'; this.name = 'TIDE CALLER';
        this.hp = 180; this.maxHp = 180; this.size = 64; this.speed = 3;
        this.state = 'chase'; this.timer = 0; this.vx = 0; this.vy = 0;
        this.image = boss2Img; this.animFrame = 0; this.frameTimer = 0; this.frameInterval = 60;
        this.phase = 1; this.phaseColor = '#00ced1'; this.phaseFxTimer = 0;
        this.dashChain = 0;
    }
    update(dt, target) {
        bossCheckPhase(this, dt);
        this.timer += dt; this.frameTimer += dt;
        if (this.frameTimer > this.frameInterval) { this.animFrame = (this.animFrame + 1) % 20; this.frameTimer = 0; }
        if (this.state === 'chase') {
            const angle = Math.atan2(target.y - this.y, target.x - this.x);
            this.vx = Math.cos(angle) * this.speed; this.vy = Math.sin(angle) * this.speed;
            if (this.timer > 3000) { this.state = 'geyser'; this.timer = 0; }
        } else if (this.state === 'geyser') {
            this.vx = 0; this.vy = 0;
            if (this.timer <= dt) {
                for(let i = 0; i < 4; i++) {
                    let gx = target.x + (Math.random() - 0.5) * 500; let gy = target.y + (Math.random() - 0.5) * 500;
                    customObstacles.push({x: gx - 50, y: gy - 50, w: 100, h: 100, color: '#00ced1', isGeyser: true, life: 1200});
                    spawnSpriteFX(fxGeyser, gx, gy, { size: 104, frameInterval: 42, alpha: 0.9 });
                }
            }
            if (this.timer > 1200) { this.state = 'dash'; this.timer = 0; this.dashChain = 0; }
        } else if (this.state === 'dash') {
            if (this.timer <= dt) {
                const angle = Math.atan2(target.y - this.y, target.x - this.x); this.vx = Math.cos(angle) * 16; this.vy = Math.sin(angle) * 16;
            }
            if (this.timer > 600) {
                // Фаза 2 — второй рывок сразу, с новым прицеливанием. Росчерк на
                // старте нужен, чтобы разгон читался как намеренный, а не как рывок
                // «из ниоткуда» после первого промаха.
                if (this.phase === 2 && this.dashChain < 1) {
                    this.dashChain++; this.timer = 0;
                    spawnSpriteFX(bossFx(this, 'slash'), this.x, this.y, { size: 170, frameInterval: 24, alpha: 0.85, angle: Math.atan2(this.vy, this.vx) });
                } else {
                    this.state = 'chase'; this.timer = 0; this.dashChain = 0;
                }
            }
        }
        this.x += this.vx; this.y += this.vy;
    }
}

class Leviathan {
    constructor(x, y) {
        this.x = x; this.y = y; this.type = 'boss'; this.name = 'LEVIATHAN';
        this.hp = 300; this.maxHp = 300; this.size = 80; this.speed = 2.5;
        this.state = 'chase'; this.timer = 0; this.vx = 0; this.vy = 0;
        this.image = boss3Img; this.animFrame = 0; this.frameTimer = 0; this.frameInterval = 60;
        this.phase = 1; this.phaseColor = '#1e90ff'; this.phaseFxTimer = 0;
        this.tsunamiChain = 0;
    }
    update(dt, target) {
        bossCheckPhase(this, dt);
        this.timer += dt; this.frameTimer += dt;
        if (this.frameTimer > this.frameInterval) { this.animFrame = (this.animFrame + 1) % 20; this.frameTimer = 0; }
        if (this.state === 'chase') {
            const angle = Math.atan2(target.y - this.y, target.x - this.x);
            this.vx = Math.cos(angle) * this.speed; this.vy = Math.sin(angle) * this.speed;
            if (this.timer > 4000) { this.state = 'tsunami'; this.timer = 0; this.tsunamiChain = 0; }
        } else if (this.state === 'tsunami') {
            this.vx = 0; this.vy = 0;
            if (this.timer <= dt || Math.abs(this.timer - 1000) <= dt) {
                const angle = Math.atan2(target.y - this.y, target.x - this.x); const perp = angle + Math.PI / 2; const gapIndex = Math.floor(Math.random() * 6) - 3;
                for (let i = -6; i <= 6; i++) {
                    if (i === gapIndex || i === gapIndex + 1) continue;
                    let px = this.x + Math.cos(perp) * (i * 45); let py = this.y + Math.sin(perp) * (i * 45);
                    enemyProjectiles.push(new EnemyProjectile(px, py, Math.cos(angle), Math.sin(angle), '#1e90ff', 10));
                }
            }
            if (this.timer > 2000) {
                // Фаза 2 — цунами прокручивается дважды подряд. Босс всё это время
                // стоит на месте: окно на урон остаётся, платой идёт теснота прохода.
                if (this.phase === 2 && this.tsunamiChain < 1) { this.tsunamiChain++; this.timer = 0; }
                else { this.state = 'chase'; this.timer = 0; this.tsunamiChain = 0; }
            }
        }
        this.x += this.vx; this.y += this.vy;
    }
}

class ThornReef {
    constructor(x, y) {
        this.x = x; this.y = y; this.type = 'boss'; this.name = 'THORN REEF';
        this.hp = 260; this.maxHp = 260; this.size = 70; this.speed = 2.2;
        this.state = 'chase'; this.timer = 0; this.vx = 0; this.vy = 0;
        this.image = boss4Img; this.animFrame = 0; this.frameTimer = 0; this.frameInterval = 60;
        this.shelled = false; this.spikeAngle = 0;
        this.phase = 1; this.phaseColor = '#39ff14'; this.phaseFxTimer = 0;
    }
    update(dt, target) {
        bossCheckPhase(this, dt);
        this.timer += dt; this.frameTimer += dt;
        if (this.frameTimer > this.frameInterval) { this.animFrame = (this.animFrame + 1) % 20; this.frameTimer = 0; }
        if (this.state === 'chase') {
            this.shelled = false;
            const angle = Math.atan2(target.y - this.y, target.x - this.x);
            this.vx = Math.cos(angle) * this.speed; this.vy = Math.sin(angle) * this.speed;
            if (this.timer > 2600) { this.state = 'shell'; this.timer = 0; }
        } else if (this.state === 'shell') {
            // Сворачивается в панцирь и рывком бросается на цель — урон по нему снижен
            this.shelled = true;
            if (this.timer <= dt) {
                const angle = Math.atan2(target.y - this.y, target.x - this.x);
                this.vx = Math.cos(angle) * 11; this.vy = Math.sin(angle) * 11;
                // Фаза 2 — панцирь держит наглухо (множитель урона в update.js).
                // Щит нужен именно здесь: без него игрок видит только то, что
                // выстрелы перестали проходить, и решает, что игра сломалась.
                if (this.phase === 2) spawnSpriteFX(tintFx(fxShellBase, this.phaseColor), this.x, this.y, { size: 150, frameInterval: 82, alpha: 0.8 });
            }
            this.vx *= 0.94; this.vy *= 0.94;
            if (this.timer > 1100) { this.state = 'bloom'; this.timer = 0; }
        } else if (this.state === 'bloom') {
            // Двойной сдвинутый залп шипов — панцирь раскрывается, нужно лавировать между двумя волнами
            this.shelled = false; this.vx = 0; this.vy = 0;
            if (this.timer <= dt || Math.abs(this.timer - 220) <= dt) {
                const spikeCount = 20;
                const offset = this.timer <= dt ? 0 : (Math.PI * 2 / spikeCount) / 2;
                for (let i = 0; i < spikeCount; i++) {
                    const a = (Math.PI * 2 / spikeCount) * i + this.spikeAngle + offset;
                    enemyProjectiles.push(new EnemyProjectile(this.x, this.y, Math.cos(a), Math.sin(a), '#39ff14', 7));
                }
            }
            if (this.timer > 500) { this.state = 'chase'; this.timer = 0; this.spikeAngle += 0.3; }
        }
        this.x += this.vx; this.y += this.vy;
    }
}

class VoidWraith {
    constructor(x, y) {
        this.x = x; this.y = y; this.type = 'boss'; this.name = 'VOID WRAITH';
        this.hp = 340; this.maxHp = 340; this.size = 66; this.speed = 2.6;
        this.state = 'chase'; this.timer = 0; this.vx = 0; this.vy = 0;
        this.image = boss5Img; this.animFrame = 0; this.frameTimer = 0; this.frameInterval = 60;
        this.blinkAlpha = 1; this.chainBlinks = 0;
        this.phase = 1; this.phaseColor = '#b026ff'; this.phaseFxTimer = 0;
        this.ghostX = null; this.ghostY = null;
    }
    update(dt, target) {
        bossCheckPhase(this, dt);
        this.timer += dt; this.frameTimer += dt;
        if (this.frameTimer > this.frameInterval) { this.animFrame = (this.animFrame + 1) % 20; this.frameTimer = 0; }
        this.blinkAlpha = 1;
        if (this.state === 'chase') {
            const angle = Math.atan2(target.y - this.y, target.x - this.x);
            this.vx = Math.cos(angle) * this.speed; this.vy = Math.sin(angle) * this.speed;
            if (this.timer > 2600) { this.state = 'blink'; this.timer = 0; this.chainBlinks = 0; }
        } else if (this.state === 'blink') {
            // Телепорт рывком рядом с целью + разрыв пустоты на старой позиции
            if (this.timer <= dt) {
                customObstacles.push({ x: this.x - 60, y: this.y - 60, w: 120, h: 120, color: '#8000ff', isGeyser: true, isVoid: true, life: 1200 });
                spawnSpriteFX(fxVoidRift, this.x, this.y, { size: 140, frameInterval: 45, alpha: 0.9 });
                this.blinkAlpha = 0;
                // Точка, откуда ушёл: в фазе 2 из неё бьёт второй поток
                this.ghostX = this.x; this.ghostY = this.y;
                const ang = Math.random() * Math.PI * 2;
                this.x = target.x + Math.cos(ang) * (320 + Math.random() * 90); this.y = target.y + Math.sin(ang) * (320 + Math.random() * 90);
                this.vx = 0; this.vy = 0;
                // Метка прибытия — игрок успевает найти босса до залпа
                spawnSpriteFX(bossFx(this, 'rune'), this.x, this.y, { size: 150, frameInterval: 22, alpha: 0.9 });
            }
            if (this.timer > 500) { this.state = 'barrage'; this.timer = 0; }
        } else if (this.state === 'barrage') {
            this.vx = 0; this.vy = 0;
            const spread = 0.34;
            // Фаза 2 — второй поток из покинутой точки. Она помечается брызгами
            // в начале барража: перекрёстный огонь честен, только если видно оба
            // источника. Коридор по центру сохраняется у обоих — дэш всегда есть куда.
            const ghost = this.phase === 2 && this.ghostX !== null;
            if (ghost && this.timer <= dt) {
                spawnSpriteFX(tintFx(fxGhostBase, '#ff9f1c'), this.ghostX, this.ghostY, { size: 110, frameInterval: 52, alpha: 0.9 });
            }
            if (this.timer <= dt || Math.abs(this.timer - 260) <= dt || Math.abs(this.timer - 520) <= dt) {
                const angle = Math.atan2(target.y - this.y, target.x - this.x);
                for (let i = -2; i <= 2; i++) {
                    if (i === 0) continue; // коридор по центру: есть куда дэшить
                    enemyProjectiles.push(new EnemyProjectile(this.x, this.y, Math.cos(angle + i * spread), Math.sin(angle + i * spread), '#b026ff', 7));
                }
                if (ghost) {
                    const gAngle = Math.atan2(target.y - this.ghostY, target.x - this.ghostX);
                    for (let i = -2; i <= 2; i++) {
                        if (i === 0) continue;
                        enemyProjectiles.push(new EnemyProjectile(this.ghostX, this.ghostY, Math.cos(gAngle + i * spread), Math.sin(gAngle + i * spread), '#b026ff', 7));
                    }
                }
            }
            if (this.timer > 700) {
                if (this.chainBlinks < 1 && Math.random() < 0.3) { this.chainBlinks++; this.state = 'blink'; this.timer = 0; }
                else { this.state = 'chase'; this.timer = 0; this.ghostX = null; this.ghostY = null; }
            }
        }
        this.x += this.vx; this.y += this.vy;
    }
}
