// --- ОТРИСОВКА ИГРЫ И ФОНА МЕНЮ ---
function getGridColor() { 
    const cycleLength = 7000; const safeTimer = Math.max(0, worldTimer); const progress = (safeTimer % cycleLength) / cycleLength; 
    const idx = Math.floor(safeTimer / cycleLength) % gridColors.length; const nextIdx = (idx + 1) % gridColors.length; 
    const c1 = gridColors[idx], c2 = gridColors[nextIdx]; 
    const r = Math.round(c1.r + (c2.r - c1.r) * progress), g = Math.round(c1.g + (c2.g - c1.g) * progress), b = Math.round(c1.b + (c2.b - c1.b) * progress); 
    return `rgb(${r}, ${g}, ${b})`; 
}

// Голова техника на транспорте. Рисуется ТОЛЬКО верхняя часть кадра —
// из машины торчит голова, а не весь боец: целиком он выглядел бы сидящим
// на крыше. Кадр берётся по направлению ТРАНСПОРТА, а не по движению P2:
// пассажир смотрит туда же, куда едет машина.
const DRIVER_DIR_ROWS = [8, 0, 4, 12];   // восток, юг, запад, север — как directionOffset
function driverFrameRow(angle) {
    // Четыре сектора по π/2 с границей на π/4, отсчёт от «вправо»
    const a = ((angle + Math.PI / 4) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    return DRIVER_DIR_ROWS[Math.floor(a / (Math.PI / 2)) % 4];
}

const DRIVER_HEAD_PART = 0.45;   // доля кадра сверху: ровно голова с плечами

function drawVehicleDriver(v) {
    if (!coopMode || !player2 || player2.currentVehicle !== v) return;
    if (!playerImg.complete || !playerImg.width) return;
    if (v.type !== 'car' && v.type !== 'heli') return;

    // Свой таймер шага на транспорте: player2.animFrame принадлежит пешему
    // и обнулился бы у него под ногами.
    if (v.driverFrame === undefined) { v.driverFrame = 0; v.driverTimer = 0; }
    if (Math.abs(v.speed || 0) > 0.5) {
        v.driverTimer += 16;
        if (v.driverTimer > 110) { v.driverFrame = (v.driverFrame + 1) % 4; v.driverTimer = 0; }
    } else { v.driverFrame = 0; v.driverTimer = 0; }

    const fw = Math.floor(playerImg.width / 16), fh = playerImg.height;
    const sx = (driverFrameRow(v.angle) + v.driverFrame) * fw;
    const sh = Math.floor(fh * DRIVER_HEAD_PART);
    const render = player2.size * 1.35, renderH = render * DRIVER_HEAD_PART;

    // Позицию считаем поворотом, саму голову рисуем вертикально: вместе
    // с корпусом она крутилась бы вверх ногами на развороте.
    // Смещение считалось под перевёрнутый спрайт машины и выносило голову
    // на капот. Люк, из которого она торчит, у новой машины ровно в центре
    // кадра, поэтому смещения нет.
    const px = v.x, py = v.y;

    ctx.save();
    ctx.translate(Math.floor(px), Math.floor(py));
    ctx.filter = 'hue-rotate(45deg) saturate(1.6) brightness(0.95)';
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(playerImg, sx, 0, fw, sh, Math.floor(-render / 2), Math.floor(-renderH / 2), render, renderH);
    ctx.restore();
}

function renderVehicle(v) {
    const vSheet = vehicleSheet();
    if (v.type === 'heli' && isImageLoaded) { 
        ctx.save(); ctx.translate(v.x + 15, v.y + 15); ctx.rotate(v.angle + Math.PI / 2); 
        ctx.globalAlpha = 0.4; ctx.fillStyle = '#000000'; ctx.beginPath(); ctx.ellipse(0, 0, SPRITE_CONFIG.heliBody.w/2, SPRITE_CONFIG.heliBody.h/2, 0, 0, Math.PI*2); ctx.fill(); ctx.restore(); 
    }
    
    if (v.isQuestVehicle && questState === 'seeking') { 
        ctx.save(); ctx.translate(v.x, v.y); ctx.shadowBlur = 20 + Math.sin(performance.now() / 150) * 10; ctx.shadowColor = '#00f0ff'; 
        ctx.strokeStyle = '#00f0ff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, v.size, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); 
    }
    
    ctx.save(); ctx.translate(v.x, v.y);
    // Все спрайты транспорта нарисованы НОСОМ ВВЕРХ, то есть в -Y. Поворот,
    // который переводит -Y в направление v.angle, — это +PI/2, а не -PI/2:
    // с минусом машина показывает корму туда, куда едет.
    if (isImageLoaded) { 
        if (v.type === 'car') { 
            ctx.rotate(v.angle + Math.PI / 2); ctx.drawImage(vSheet, SPRITE_CONFIG.car.sx, SPRITE_CONFIG.car.sy, SPRITE_CONFIG.car.sw, SPRITE_CONFIG.car.sh, -SPRITE_CONFIG.car.w/2, -SPRITE_CONFIG.car.h/2, SPRITE_CONFIG.car.w, SPRITE_CONFIG.car.h); 
        } else if (v.type === 'tank') { 
            ctx.rotate(v.angle + Math.PI / 2); ctx.drawImage(vSheet, SPRITE_CONFIG.tankBody.sx, SPRITE_CONFIG.tankBody.sy, SPRITE_CONFIG.tankBody.sw, SPRITE_CONFIG.tankBody.sh, -SPRITE_CONFIG.tankBody.w/2, -SPRITE_CONFIG.tankBody.h/2, SPRITE_CONFIG.tankBody.w, SPRITE_CONFIG.tankBody.h); 
        } else if (v.type === 'heli') { 
            ctx.rotate(v.angle + Math.PI / 2); ctx.drawImage(vSheet, SPRITE_CONFIG.heliBody.sx, SPRITE_CONFIG.heliBody.sy, SPRITE_CONFIG.heliBody.sw, SPRITE_CONFIG.heliBody.sh, -SPRITE_CONFIG.heliBody.w/2, -SPRITE_CONFIG.heliBody.h/2, SPRITE_CONFIG.heliBody.w, SPRITE_CONFIG.heliBody.h); 
        } 
    } else { 
        ctx.rotate(v.angle); ctx.fillStyle = '#555'; ctx.fillRect(-v.size/2, -v.size/2, v.size, v.size); 
    } 
    ctx.restore();

    drawVehicleDriver(v);

    if (isImageLoaded) { 
        if (v.type === 'tank') { 
            ctx.save(); ctx.translate(v.x, v.y); ctx.rotate(v.turretAngle + Math.PI / 2); ctx.drawImage(vSheet, SPRITE_CONFIG.tankTurret.sx, SPRITE_CONFIG.tankTurret.sy, SPRITE_CONFIG.tankTurret.sw, SPRITE_CONFIG.tankTurret.sh, -SPRITE_CONFIG.tankTurret.w/2, -SPRITE_CONFIG.tankTurret.h / 2, SPRITE_CONFIG.tankTurret.w, SPRITE_CONFIG.tankTurret.h); ctx.restore(); 
        } else if (v.type === 'heli') { 
            ctx.save(); ctx.translate(v.x, v.y); ctx.rotate(v.angle + Math.PI / 2); ctx.translate(0, -SPRITE_CONFIG.heliBody.h * 0.35); ctx.rotate(v.rotorAngle); ctx.globalAlpha = v.rotorSpeed !== undefined ? (v.rotorSpeed > 0.1 ? 0.6 : 1.0) : 0.6; ctx.drawImage(vSheet, SPRITE_CONFIG.heliRotor.sx, SPRITE_CONFIG.heliRotor.sy, SPRITE_CONFIG.heliRotor.sw, SPRITE_CONFIG.heliRotor.sh, -SPRITE_CONFIG.heliRotor.w/2, -SPRITE_CONFIG.heliRotor.h/2, SPRITE_CONFIG.heliRotor.w, SPRITE_CONFIG.heliRotor.h); ctx.restore(); 
            ctx.save(); ctx.translate(v.x, v.y); ctx.rotate(v.angle + Math.PI / 2); ctx.translate(0, SPRITE_CONFIG.heliBody.h * 0.35); ctx.rotate(-v.rotorAngle); ctx.globalAlpha = v.rotorSpeed !== undefined ? (v.rotorSpeed > 0.1 ? 0.6 : 1.0) : 0.6; ctx.drawImage(vSheet, SPRITE_CONFIG.heliRotor.sx, SPRITE_CONFIG.heliRotor.sy, SPRITE_CONFIG.heliRotor.sw, SPRITE_CONFIG.heliRotor.sh, -SPRITE_CONFIG.heliRotor.w/2, -SPRITE_CONFIG.heliRotor.h/2, SPRITE_CONFIG.heliRotor.w, SPRITE_CONFIG.heliRotor.h); ctx.restore(); 
        } 
    }
}

// Спрайт слизня рисовался в 1.5 размера сущности: при size 40 это круг
// радиусом 30 поверх хитбокса радиусом 20. Выстрел в видимый край слизня
// уходил в молоко, и промах читался как баг попаданий. 1.25 оставляет запас
// в 5 px — спрайт всё ещё чуть щедрее хитбокса, но уже не врёт в полтора раза.
const SLIME_RENDER_SCALE = 1.25;

function drawWhiteSlime(ctx, x, y, size, row, animFrame, isSniper, e) {
    ctx.save(); ctx.translate(Math.floor(x), Math.floor(y)); const renderSize = size * SLIME_RENDER_SCALE;
    if (isSlimeWhiteLoaded && slimeWhiteImg.width > 0) { 
        const fw = Math.floor(slimeWhiteImg.width / 4), fh = Math.floor(slimeWhiteImg.height / 4); 
        ctx.imageSmoothingEnabled = false; 
        ctx.drawImage(slimeWhiteImg, animFrame * fw, row * fh, fw, fh, Math.floor(-renderSize / 2), Math.floor(-renderSize / 2), renderSize, renderSize); 
    } else { 
        ctx.shadowBlur = 10; ctx.shadowColor = '#ffffff'; ctx.fillStyle = '#ffffff'; ctx.fillRect(-size / 2, -size / 2, size, size); 
    }
    
    if (isSniper) { 
        const target = e ? getEnemyTarget(e) : (player.inVehicle && player.currentVehicle ? player.currentVehicle : player);
        const aimAngle = Math.atan2(target.y - y, target.x - x); 
        ctx.rotate(aimAngle); ctx.strokeStyle = 'rgba(0, 255, 255, 0.4)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(800, 0); ctx.stroke(); 
    } 
    ctx.restore();
}

function drawSlimeEnemy(ctx, x, y, size, angle, time) {
    ctx.save(); ctx.translate(x, y); let row = 0; 
    if (angle >= -Math.PI/4 && angle < Math.PI/4) row = 1; else if (angle >= Math.PI/4 && angle < 3*Math.PI/4) row = 2; else if (angle >= -3*Math.PI/4 && angle < -Math.PI/4) row = 0; else row = 3; 
    const offset = Math.abs(Math.floor(x / 40)); const frameIndex = (Math.floor(time / 150) + offset) % 4; const renderSize = size * SLIME_RENDER_SCALE; 
    
    if (isSlimeLoaded && slimeRedImg.width > 0) { 
        const fw = Math.floor(slimeRedImg.width / 4), fh = Math.floor(slimeRedImg.height / 4); 
        ctx.shadowBlur = 0; ctx.imageSmoothingEnabled = false; 
        ctx.drawImage(slimeRedImg, frameIndex * fw, row * fh, fw, fh, -renderSize/2, -renderSize/2, renderSize, renderSize); 
    } else { 
        ctx.shadowBlur = 10; ctx.shadowColor = '#00ced1'; ctx.fillStyle = '#00ced1'; ctx.fillRect(-size/2, -size/2, size, size); 
    } 
    ctx.restore();
}

function drawBossCutscene(timeLeft, maxTime) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    const w = canvas.width, h = canvas.height;
    const progress = 1 - (timeLeft / maxTime);

    // Затемнение фона — постоянное, без пульсации
    ctx.fillStyle = 'rgba(5,8,14,0.88)'; ctx.fillRect(0, 0, w, h);

    // Въезд/выезд ступенями: 4 кадра по 150 мс суммарно, дальше баннер стоит
    const IN = 0.05, OUT = 0.95;
    let step = 4;
    if (progress < IN) step = Math.floor((progress / IN) * 4);
    else if (progress > OUT) step = 4 - Math.ceil(((progress - OUT) / (1 - OUT)) * 4);
    if (step <= 0) { ctx.restore(); return; }
    const slideX = -w * 0.06 * (4 - step);

    const bannerHeight = 200, bannerY = Math.round(h / 2 - bannerHeight / 2);
    ctx.save(); ctx.translate(Math.round(slideX), bannerY);

    // Плашка
    ctx.fillStyle = UI.panel; ctx.fillRect(0, 0, w, bannerHeight);
    ctx.fillStyle = UI.red; ctx.fillRect(0, 0, w, 2); ctx.fillRect(0, bannerHeight - 2, w, 2);

    const padX = Math.max(48, (w - 900) / 2);

    // Строка угрозы — статичная, без мигания и без эмодзи
    ctx.font = "10px var(--font-pixel)"; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = UI.amber;
    ctx.fillText('УГРОЗА ОБНАРУЖЕНА', padX, 44);

    // Имя босса — единственный дисплейный размер на экране
    ctx.font = "32px var(--font-pixel)"; ctx.textBaseline = 'middle';
    ctx.fillStyle = UI.txt;
    ctx.fillText(currentBossName, padX, bannerHeight / 2 + 6);

    ctx.font = "12px var(--font-pixel)"; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = UI.txtDim;
    ctx.fillText('НЕЙТРАЛИЗОВАТЬ ЦЕЛЬ', padX, bannerHeight - 42);

    // Портрет: квадратная рамка, фиксированный масштаб
    if (activeBoss && activeBoss.image && activeBoss.image.complete && activeBoss.image.naturalWidth > 0) {
        const box = 132, bx = Math.round(w - padX - box), by = Math.round(bannerHeight / 2 - box / 2);
        ctx.save();
        ctx.fillStyle = UI.panel2; ctx.fillRect(bx, by, box, box);
        ctx.strokeStyle = UI.line; ctx.lineWidth = 1; ctx.strokeRect(bx + 0.5, by + 0.5, box - 1, box - 1);
        ctx.beginPath(); ctx.rect(bx + 1, by + 1, box - 2, box - 2); ctx.clip();
        ctx.translate(bx + box / 2, by + box / 2);
        ctx.scale(2.4, 2.4);
        ctx.imageSmoothingEnabled = false;
        const fw = Math.floor(activeBoss.image.naturalWidth / 5), fh = Math.floor(activeBoss.image.naturalHeight / 4);
        const col = activeBoss.animFrame % 5, row = Math.floor(activeBoss.animFrame / 5);
        ctx.drawImage(activeBoss.image, col * fw, row * fh, fw, fh, -fw / 2, -fh / 2, fw, fh);
        ctx.restore();
    }

    ctx.restore();
    ctx.restore();
}

// Цвет рамки говорит, КТО держит цель на прицеле. Одна и та же метка
// разными цветами читается быстрее любой подписи.
const LOCK_COLORS = { p1: '#ff003c', p2: '#3d8bff', turret: '#ff9f1c' };

// Скобки по углам хитбокса. При смене цели они приезжают снаружи за 150 мс —
// без этого рамка телепортируется между слаймами и читается как мерцание.
// pad разводит рамки по радиусу: слайм под прицелом двоих должен показывать
// оба фокуса, а не одну рамку поверх другой.
function drawTargetLock(enemy, color, lockAt, pad = 0) {
    if (!enemy) return;
    const prog = Math.min(1, (performance.now() - (lockAt || 0)) / 150);
    const ease = prog * prog * (3 - 2 * prog);
    const r = (enemy.size || 40) * 0.7 + 8 + pad + (1 - ease) * 44;
    const arm = 10;
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.globalAlpha = 0.35 + 0.65 * ease;
    ctx.strokeStyle = color; ctx.lineWidth = 2.5;
    ctx.shadowBlur = 12; ctx.shadowColor = color;
    ctx.beginPath();
    ctx.moveTo(-r, -r + arm); ctx.lineTo(-r, -r); ctx.lineTo(-r + arm, -r);
    ctx.moveTo(r - arm, -r); ctx.lineTo(r, -r); ctx.lineTo(r, -r + arm);
    ctx.moveTo(r, r - arm); ctx.lineTo(r, r); ctx.lineTo(r - arm, r);
    ctx.moveTo(-r + arm, r); ctx.lineTo(-r, r); ctx.lineTo(-r, r - arm);
    ctx.stroke();
    ctx.restore();
}

// Остальные автоприцельные стрелки. Отступы разведены, чтобы совпавшие цели
// показывали обе рамки.
function drawAllTargetLocks() {
    if (coopMode && player2 && !player2.downed && !player2.inVehicle && player2.lockedEnemy) {
        drawTargetLock(player2.lockedEnemy, LOCK_COLORS.p2, player2.lockAt, 7);
    }
    for (const v of transports) {
        if (!v.lockedEnemy) continue;
        if (v.type === 'tank' || v.type === 'heli') drawTargetLock(v.lockedEnemy, LOCK_COLORS.turret, v.lockAt, 14);
        else if (player2 && player2.currentVehicle === v && player2.lockedEnemy) drawTargetLock(player2.lockedEnemy, LOCK_COLORS.p2, player2.lockAt, 7);
    }
}

function drawWorldPass(cam, vx, vy, vw, vh, time) {
    ctx.save(); ctx.beginPath(); ctx.rect(vx, vy, vw, vh); ctx.clip(); ctx.translate(vx, vy);
    let bgColor = '#010a15'; if (score >= 9000) bgColor = '#150005'; else if (score >= 6000) bgColor = '#150a00'; else if (score >= 3000) bgColor = '#000511'; ctx.fillStyle = bgColor; ctx.fillRect(0, 0, vw, vh);
    ctx.save(); if (shakeTime > 0) { const mag = (shakeTime / 300) * 8 + 2; ctx.translate(Math.random() * mag * 2 - mag, Math.random() * mag * 2 - mag); }
    const gridColor = getGridColor(); ctx.strokeStyle = gridColor; ctx.lineWidth = 1; ctx.globalAlpha = 0.3; ctx.beginPath(); const gs = 60, offX = cam.x % gs, offY = cam.y % gs;
    for (let x = -offX - gs; x < vw + gs; x += gs) { ctx.moveTo(x, -gs); ctx.lineTo(x, vh + gs); } for (let y = -offY - gs; y < vh + gs; y += gs) { ctx.moveTo(-gs, y); ctx.lineTo(vw + gs, y); } ctx.stroke(); ctx.globalAlpha = 1.0; ctx.translate(-cam.x, -cam.y);

    if (deepVault) {
        ctx.save(); ctx.translate(deepVault.x, deepVault.y);
        if (deepVault.sealed) {
            ctx.strokeStyle = '#74838c'; ctx.lineWidth = 3; ctx.setLineDash([12, 10]);
            ctx.beginPath(); ctx.arc(0, 0, deepVault.radius, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
            ctx.font = "10px var(--font-pixel)"; ctx.textAlign = 'center'; ctx.fillStyle = '#74838c';
            ctx.fillText('ЗАПЕЧАТАНО', 0, 4);
        } else {
            const live = questState === 'heat';
            ctx.strokeStyle = '#c46dff'; ctx.lineWidth = live ? 5 : 3;
            if (live) { ctx.shadowBlur = 16 + Math.sin(time / 150) * 8; ctx.shadowColor = '#c46dff'; }
            ctx.beginPath(); ctx.arc(0, 0, deepVault.radius, 0, Math.PI * 2); ctx.stroke();
            if (live) { ctx.globalAlpha = 0.18; ctx.fillStyle = '#c46dff'; ctx.fill(); ctx.globalAlpha = 1; }
            ctx.shadowBlur = 0;
            ctx.font = "10px var(--font-pixel)"; ctx.textAlign = 'center'; ctx.fillStyle = '#c46dff';
            ctx.fillText('ШЛЮЗ x2', 0, 4);
        }
        ctx.restore();
    }
    if (questState === 'heat' && extractionPoint) { ctx.save(); ctx.translate(extractionPoint.x, extractionPoint.y); ctx.shadowBlur = 20 + Math.sin(time / 150) * 10; ctx.shadowColor = '#00ffff'; ctx.strokeStyle = '#00ffff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, extractionPoint.radius, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 0.2; ctx.fillStyle = '#00ffff'; ctx.fill(); ctx.restore(); }
    drawSmoke();   // взвесь идёт под всем: она фон для искр и вспышек, а не поверх них
    for (let s of scorches) { ctx.save(); ctx.fillStyle = `rgba(0, 15, 30, ${s.alpha})`; ctx.beginPath(); ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
    for (let obs of customObstacles) { ctx.save(); if (obs.isVoid) { const vp = Math.max(0, obs.life / 1800); ctx.fillStyle = `rgba(128, 0, 255, ${0.35 * vp})`; ctx.shadowBlur = 30; ctx.shadowColor = '#b026ff'; ctx.beginPath(); ctx.arc(obs.x + 60, obs.y + 60, 60 + Math.sin(time/90)*8, 0, Math.PI*2); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(obs.x + 60, obs.y + 60, 20, 0, Math.PI * 2); ctx.stroke(); } else if (obs.isGeyser) { ctx.fillStyle = 'rgba(0, 206, 209, 0.3)'; ctx.shadowBlur = 20; ctx.shadowColor = '#00ffff'; ctx.beginPath(); ctx.arc(obs.x + 50, obs.y + 50, 50 + Math.sin(time/100)*10, 0, Math.PI*2); ctx.fill(); if (Math.random() < 0.2) spawnBubbles(obs.x + 50, obs.y + 50, 1); } else { ctx.strokeStyle = obs.color; ctx.lineWidth = 4; ctx.shadowBlur = 15; ctx.shadowColor = obs.color; ctx.strokeRect(obs.x, obs.y, obs.w, obs.h); } ctx.restore(); }
    for (let obs of obstacles.values()) { if (!obs) continue; if (obs.x + obs.w < cam.x || obs.x > cam.x + vw || obs.y + obs.h < cam.y || obs.y > cam.y + vh) continue; ctx.save(); ctx.strokeStyle = obs.flashTimer > 0 ? '#ffffff' : '#00ffd5'; ctx.lineWidth = 4; ctx.shadowBlur = 10; ctx.shadowColor = ctx.strokeStyle; if (obs.type === 'rect') { ctx.strokeRect(obs.x, obs.y, obs.w, obs.h); } else { ctx.beginPath(); ctx.moveTo(obs.x + obs.w/2, obs.y); ctx.lineTo(obs.x + obs.w, obs.y + obs.h); ctx.lineTo(obs.x, obs.y + obs.h); ctx.closePath(); ctx.stroke(); } ctx.restore(); if (obs.flashTimer > 0) obs.flashTimer -= (lastFrameTime ? 16 : 0); }
    for (const t of trails) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, t.alpha) * 0.5;
        const sheet = getTintedPlayerSheet(t.tint) || (playerImg.complete && playerImg.width ? playerImg : null);
        if (sheet) {
            const fw = Math.floor(sheet.width / 16), render = t.size * 2.0;
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(sheet, (t.frame || 0) * fw, 0, fw, sheet.height,
                Math.floor(t.x - render / 2), Math.floor(t.y - render / 2), render, render);
        } else {
            ctx.fillStyle = t.tint || '#ffffff';
            ctx.fillRect(t.x - t.size / 2, t.y - t.size / 2, t.size, t.size);
        }
        ctx.restore();
    }
    for (let b of bubbles) { ctx.save(); ctx.globalAlpha = Math.max(0, b.alpha); ctx.strokeStyle = '#00ffff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }

    for (const e of enemies) {
        if (e.type === 'boss') { ctx.save(); ctx.translate(e.x, e.y); if (typeof e.blinkAlpha === 'number') ctx.globalAlpha = e.blinkAlpha; if (e.image && e.image.complete && e.image.naturalWidth > 0) { const drawSize = e.size * 2, fw = Math.floor(e.image.naturalWidth / 5), fh = Math.floor(e.image.naturalHeight / 4), col = e.animFrame % 5, row = Math.floor(e.animFrame / 5); ctx.imageSmoothingEnabled = false; ctx.drawImage(e.image, col * fw, row * fh, fw, fh, -drawSize/2, -drawSize/2, drawSize, drawSize); } else { ctx.shadowBlur = 20; ctx.shadowColor = '#00ffff'; ctx.fillStyle = 'darkblue'; ctx.fillRect(-e.size/2, -e.size/2, e.size, e.size); ctx.strokeStyle = '#00ffff'; ctx.lineWidth = 3; ctx.strokeRect(-e.size/2, -e.size/2, e.size, e.size); } if (e.shelled) { ctx.globalAlpha = 0.7; ctx.strokeStyle = '#39ff14'; ctx.lineWidth = 4; ctx.shadowBlur = 25; ctx.shadowColor = '#39ff14'; ctx.beginPath(); ctx.arc(0, 0, e.size * 0.75 + Math.sin(time*0.01)*4, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; } ctx.fillStyle = 'red'; ctx.fillRect(-50, -e.size - 20, 100, 10); ctx.fillStyle = '#00ffff'; ctx.fillRect(-50, -e.size - 20, 100 * (e.hp / e.maxHp), 10); ctx.restore(); } 
        else if (e.type === 'husk') {
            // Своего листа нет: оболочка — тот же слизень крупнее и в синем.
            // Новый спрайт-лист ради одного врага просил бы ассет там, где
            // хватает размера и цвета.
            ctx.save(); ctx.globalAlpha = 0.92; ctx.filter = 'hue-rotate(190deg) saturate(1.4)';
            drawSlimeEnemy(ctx, e.x, e.y, e.size, e.angle, worldTimer);
            ctx.restore();
        }
        else if (e.type === 'sniper' || e.type === 'micro') { drawWhiteSlime(ctx, e.x, e.y, e.size, e.row, e.animFrame, e.type === 'sniper', e); } else { drawSlimeEnemy(ctx, e.x, e.y, e.size, e.angle, worldTimer); }
    }

    let nearestTransport = null, minDist = 80;
    // Контекстная кнопка на телефоне показывается, только когда есть что нажать
    for (const v of transports) { renderVehicle(v); if (!player.inVehicle) { let d = Math.hypot(player.x - v.x, player.y - v.y); if (d < minDist) { minDist = d; nearestTransport = v; } } }
    nearVehicleNow = !!nearestTransport || (!!player && player.inVehicle);

    if (!player.inVehicle) {
        if (player.iFrames <= 0 || Math.floor(time / 100) % 2 === 0) {
            ctx.save(); if (player.downed) ctx.globalAlpha = 0.35;
            if (playerImg.complete && playerImg.width > 0) {
                const totalFrames = 16, frameWidth = Math.floor(playerImg.width / totalFrames), frameX = player.directionOffset + player.animFrame, renderSize = player.size * 2.0; 
                ctx.save(); ctx.translate(Math.floor(player.x), Math.floor(player.y)); if (player.downed) ctx.rotate(Math.PI / 2); ctx.drawImage(playerImg, frameX * frameWidth, 0, frameWidth, playerImg.height, Math.floor(-renderSize / 2), Math.floor(-renderSize / 2), renderSize, renderSize); ctx.restore();
            } else { ctx.save(); ctx.shadowBlur = 15; ctx.shadowColor = player.color; ctx.fillStyle = player.color; ctx.fillRect(player.x - player.size / 2, player.y - player.size / 2, player.size, player.size); ctx.restore(); }
            ctx.restore();

            if (!player.downed) {
            // Своих листов у гарпуна и рельсы нет, и заводить их ради двух
            // стволов значило бы просить ассет там, где хватает цвета:
            // третий ствол — перекрашенный пистолет, четвёртый — дробовик.
            const wSlot = player.currentWeapon;
            const baseWeaponImg = (wSlot === 1 || wSlot === 3) ? pistolImg : shotgunImg;
            if (baseWeaponImg.complete && baseWeaponImg.width > 0) {
                // Цвет артефакта важнее цвета ствола: он говорит о пассивке,
                // а ствол игрок и так знает по тому, чем стреляет.
                const currentWeaponImg = weaponArtifacts[wSlot]
                    ? artWeaponSheet(wSlot, baseWeaponImg)
                    : (wSlot === 3 ? tintFx(baseWeaponImg, '#00e0ff')
                    : wSlot === 4 ? tintFx(baseWeaponImg, '#c46dff') : baseWeaponImg);
                ctx.save(); ctx.translate(Math.floor(player.x), Math.floor(player.y));
                const aimAngle = getP1AimAngle();
                ctx.rotate(aimAngle); if (Math.abs(aimAngle) > Math.PI / 2) ctx.scale(1, -1);
                const wRenderW = 32, wRenderH = 16, baseOrbit = 18, orbitRadius = Math.max(8, baseOrbit - player.gunRecoil); 
                ctx.imageSmoothingEnabled = false; ctx.drawImage(currentWeaponImg, 0, 0, currentWeaponImg.width, currentWeaponImg.height, Math.floor(orbitRadius), Math.floor(-wRenderH / 2), wRenderW, wRenderH); ctx.restore();
            }
            }
        }
        if (nearestTransport) { ctx.save(); ctx.font = "10px 'Press Start 2P'"; ctx.fillStyle = "#ffffff"; ctx.textAlign = "center"; ctx.fillText("[E] ВЗЛОМ", nearestTransport.x, nearestTransport.y - nearestTransport.size + 10); ctx.restore(); }

        if (player.shieldTimer > 0) {
            const sp = player.shieldTimer / 1500;
            ctx.save(); ctx.translate(player.x, player.y);
            ctx.globalAlpha = Math.min(1, sp * 2);
            ctx.strokeStyle = '#ff003c'; ctx.lineWidth = 3; ctx.shadowBlur = 20; ctx.shadowColor = '#ff003c';
            ctx.beginPath(); ctx.arc(0, 0, player.size * 0.9 + Math.sin(time * 0.02) * 3, 0, Math.PI * 2); ctx.stroke();
            ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(0, 0, player.size * 1.1, time * 0.003, time * 0.003 + Math.PI * 1.2); ctx.stroke();
            ctx.restore();
        }
        if (player.parryWindow > 0) {
            ctx.save(); ctx.translate(player.x, player.y);
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.shadowBlur = 15; ctx.shadowColor = '#ffffff';
            ctx.globalAlpha = 0.8;
            ctx.beginPath(); ctx.arc(0, 0, player.size * 0.7, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
        }
    }

    function drawSquadMate(entity, label, hueFilter) {
        if (!entity) return;
        ctx.save();
        if (entity.downed) ctx.globalAlpha = 0.35;
        if (entity.iFrames <= 0 || entity.downed || Math.floor(time / 100) % 2 === 0) {
            if (playerImg.complete && playerImg.width > 0) {
                const totalFrames = 16, frameWidth = Math.floor(playerImg.width / totalFrames), frameX = entity.directionOffset + entity.animFrame, renderSize = entity.size * 2.0;
                ctx.save(); ctx.translate(Math.floor(entity.x), Math.floor(entity.y));
                ctx.filter = hueFilter;
                if (entity.downed) ctx.rotate(Math.PI / 2);
                ctx.drawImage(playerImg, frameX * frameWidth, 0, frameWidth, playerImg.height, Math.floor(-renderSize / 2), Math.floor(-renderSize / 2), renderSize, renderSize);
                ctx.restore();
            } else { ctx.save(); ctx.shadowBlur = 15; ctx.shadowColor = entity.color; ctx.fillStyle = entity.color; ctx.fillRect(entity.x - entity.size / 2, entity.y - entity.size / 2, entity.size, entity.size); ctx.restore(); }
        }
        ctx.restore();

        ctx.save(); ctx.font = "9px 'Press Start 2P'"; ctx.fillStyle = entity.color; ctx.textAlign = "center"; ctx.shadowBlur = 6; ctx.shadowColor = entity.color;
        ctx.fillText(entity.downed ? `${label}: OFFLINE` : label, entity.x, entity.y - entity.size - 6);
        ctx.restore();

        if (!entity.downed && entity.shieldTimer > 0) {
            const sp = entity.shieldTimer / 1500;
            ctx.save(); ctx.translate(entity.x, entity.y);
            ctx.globalAlpha = Math.min(1, sp * 2);
            ctx.strokeStyle = '#ff003c'; ctx.lineWidth = 3; ctx.shadowBlur = 20; ctx.shadowColor = '#ff003c';
            ctx.beginPath(); ctx.arc(0, 0, entity.size * 0.9 + Math.sin(time * 0.02) * 3, 0, Math.PI * 2); ctx.stroke();
            ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(0, 0, entity.size * 1.1, time * 0.003, time * 0.003 + Math.PI * 1.2); ctx.stroke();
            ctx.restore();
        }
        if (!entity.downed && entity.parryWindow > 0) {
            ctx.save(); ctx.translate(entity.x, entity.y);
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.shadowBlur = 15; ctx.shadowColor = '#ffffff';
            ctx.globalAlpha = 0.8;
            ctx.beginPath(); ctx.arc(0, 0, entity.size * 0.7, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
        }

        if (entity.downed) {
            const prog = Math.min(1, (entity.reviveProgress || 0) / REVIVE_TIME);
            ctx.save(); ctx.translate(entity.x, entity.y);
            ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.arc(0, 0, entity.size * 0.8, 0, Math.PI * 2); ctx.stroke();
            if (prog > 0) {
                ctx.strokeStyle = '#39ff14'; ctx.lineWidth = 4; ctx.shadowBlur = 12; ctx.shadowColor = '#39ff14';
                ctx.beginPath(); ctx.arc(0, 0, entity.size * 0.8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * prog); ctx.stroke();
            }
            ctx.restore();
        }
    }

    if (coopMode && player2 && !player2.inVehicle) drawSquadMate(player2, 'P2', 'hue-rotate(45deg) saturate(1.6) brightness(0.95)');
    
    if (player.downed) {
        const prog = Math.min(1, (player.reviveProgress || 0) / REVIVE_TIME);
        ctx.save(); ctx.translate(player.x, player.y);
        ctx.font = "9px 'Press Start 2P'"; ctx.fillStyle = "#00f0ff"; ctx.textAlign = "center"; ctx.shadowBlur = 6; ctx.shadowColor = '#00f0ff';
        ctx.fillText('P1: OFFLINE', 0, -player.size - 6);
        ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(0, 0, player.size * 0.8, 0, Math.PI * 2); ctx.stroke();
        if (prog > 0) {
            ctx.strokeStyle = '#39ff14'; ctx.lineWidth = 4; ctx.shadowBlur = 12; ctx.shadowColor = '#39ff14';
            ctx.beginPath(); ctx.arc(0, 0, player.size * 0.8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * prog); ctx.stroke();
        }
        ctx.restore();
    }

    // Прицел геймпада P1 — крестик по направлению правого стика, фиксируется на враге при захвате
    if (!player.downed && p1GamepadAimAngle !== null) {
        if (p1AimLockedEnemy) {
            drawTargetLock(p1AimLockedEnemy, LOCK_COLORS.p1, p1Lock.lockAt, 0);
        } else {
            const rx = player.x + Math.cos(p1GamepadAimAngle) * 130, ry = player.y + Math.sin(p1GamepadAimAngle) * 130;
            ctx.save(); ctx.translate(rx, ry);
            ctx.strokeStyle = 'rgba(0,240,255,0.7)'; ctx.lineWidth = 2; ctx.shadowBlur = 8; ctx.shadowColor = '#00f0ff';
            ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(-6, 0); ctx.moveTo(6, 0); ctx.lineTo(16, 0);
            ctx.moveTo(0, -16); ctx.lineTo(0, -6); ctx.moveTo(0, 6); ctx.lineTo(0, 16);
            ctx.stroke();
            ctx.restore();
        }
    }

    // Текст-подсказка над игроком, управляемым джойстиком — что сейчас делает ИИ-ассистент
    if (getPlayer1Gamepad() && !player.downed && p1AiIntent) {
        ctx.save(); ctx.translate(player.x, player.y - player.size - 26);
        const intentColor = p1AiIntent === 'ПАРИРУЕТ!' || p1AiIntent === 'ИМПУЛЬС!' ? '#ffd700' : (p1AiIntent === 'УКЛОНЕНИЕ' ? '#ff003c' : '#00f0ff');
        ctx.font = "9px 'Press Start 2P'"; ctx.fillStyle = intentColor; ctx.textAlign = "center"; ctx.shadowBlur = 8; ctx.shadowColor = intentColor;
        ctx.fillText(p1AiIntent, 0, 0);
        ctx.restore();
    }

    drawAllTargetLocks();

    if (gameState === 'playing') {
        let compassTarget = null, compassColor = '';
        if (questState === 'seeking' && questVehicle) { compassTarget = questVehicle; compassColor = '#00ffff'; } else if (questState === 'heat' && extractionPoint) { compassTarget = extractionPoint; compassColor = '#00ffaa'; } else if (activeBoss) { compassTarget = activeBoss; compassColor = '#ff003c'; }
        if (compassTarget) {
            let cx = player.inVehicle && player.currentVehicle ? player.currentVehicle.x : player.x, cy = player.inVehicle && player.currentVehicle ? player.currentVehicle.y : player.y;
            let cAngle = Math.atan2(compassTarget.y - cy, compassTarget.x - cx), cRadius = player.inVehicle && player.currentVehicle ? player.currentVehicle.size + 20 : 60;
            ctx.save(); ctx.translate(cx + Math.cos(cAngle) * cRadius, cy + Math.sin(cAngle) * cRadius); ctx.rotate(cAngle); ctx.fillStyle = compassColor; ctx.shadowBlur = 15; ctx.shadowColor = compassColor; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-12, 10); ctx.lineTo(-12, -10); ctx.closePath(); ctx.fill(); ctx.restore();
        }
        if (coopMode && player2 && !player2.downed && compassTarget) {
            let cx2 = player2.inVehicle && player2.currentVehicle ? player2.currentVehicle.x : player2.x, cy2 = player2.inVehicle && player2.currentVehicle ? player2.currentVehicle.y : player2.y;
            let cAngle2 = Math.atan2(compassTarget.y - cy2, compassTarget.x - cx2), cRadius2 = player2.inVehicle && player2.currentVehicle ? player2.currentVehicle.size + 20 : 60;
            ctx.save(); ctx.translate(cx2 + Math.cos(cAngle2) * cRadius2, cy2 + Math.sin(cAngle2) * cRadius2); ctx.rotate(cAngle2); ctx.fillStyle = compassColor; ctx.shadowBlur = 15; ctx.shadowColor = compassColor; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-12, 10); ctx.lineTo(-12, -10); ctx.closePath(); ctx.fill(); ctx.restore();
        }
    }

    drawWorldFx();
    drawMuzzleFlashes();
    drawAcidPools(time);
    drawArtifactFx(time);

    for (const p of projectiles) {
        if (p.surge) {
            const t = 1 - p.life / p.surgeLife;
            ctx.save();
            ctx.translate(p.x, p.y); ctx.rotate(p.angle);
            ctx.globalAlpha = 0.85 * (1 - t * 0.6);
            ctx.strokeStyle = '#00e0ff'; ctx.lineWidth = 10 - t * 4;
            ctx.shadowBlur = 22; ctx.shadowColor = '#00e0ff';
            ctx.beginPath(); ctx.arc(0, 0, p.width / 2, -Math.PI / 2.6, Math.PI / 2.6); ctx.stroke();
            ctx.globalAlpha = 0.3 * (1 - t);
            ctx.lineWidth = 24 - t * 10;
            ctx.beginPath(); ctx.arc(0, 0, p.width / 2, -Math.PI / 2.8, Math.PI / 2.8); ctx.stroke();
            ctx.restore();
            continue;
        }
        if (p.draw) { p.draw(ctx); } else {
            ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle); ctx.shadowBlur = 10; ctx.shadowColor = p.color; ctx.fillStyle = p.color;
            if (p.piercing) ctx.globalAlpha = Math.max(0, p.life / 300);
            if (p.isExplosive) { ctx.beginPath(); ctx.arc(0, 0, p.width/2, 0, Math.PI*2); ctx.fill(); } else { ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height); }
            ctx.restore();
        }
    }
    
    for (const p of particles) { ctx.save(); ctx.globalAlpha = Math.max(0, p.alpha); ctx.fillStyle = p.color; ctx.shadowBlur = 10; ctx.shadowColor = p.color; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); ctx.restore(); }
    for (const ep of enemyProjectiles) ep.draw();
    for (const ring of pulseRingFx) {
        const prog = 1 - ring.life / ring.maxLife;
        ctx.save(); ctx.globalAlpha = 1 - prog; ctx.strokeStyle = '#00ffff'; ctx.lineWidth = 6 * (1 - prog * 0.6);
        ctx.shadowBlur = 25; ctx.shadowColor = '#00ffff';
        ctx.beginPath(); ctx.arc(ring.x, ring.y, prog * 320, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
    }
    for (const ring of parryShockwaves) {
        const prog = 1 - ring.life / ring.maxLife;
        ctx.save(); ctx.globalAlpha = (1 - prog) * 0.9; ctx.strokeStyle = '#ff003c'; ctx.lineWidth = 14 * (1 - prog * 0.7);
        ctx.shadowBlur = 40; ctx.shadowColor = '#ff003c';
        ctx.beginPath(); ctx.arc(ring.x, ring.y, prog * 420, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = (1 - prog) * 0.3; ctx.lineWidth = 30 * (1 - prog);
        ctx.beginPath(); ctx.arc(ring.x, ring.y, prog * 420, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
    }
    for (const fx of spriteFx) {
        const f = Math.min(fx.frame, fx.frames - 1);
        const size = fx.drawSize;
        // Гасим только длинные листы, где хвост — это дым. У коротких вспышек
        // последние кадры и есть пик, затухание их убивало.
        const tail = fx.frames >= 12 ? Math.max(1, Math.round(fx.frames * 0.3)) : 0;
        const fade = tail > 0 ? Math.min(1, ((fx.frames - 1) - f) / tail) : 1;
        ctx.save();
        ctx.globalAlpha = fx.alpha * fade;
        ctx.translate(fx.x, fx.y);
        if (fx.angle) ctx.rotate(fx.angle);
        const sx = (f % fx.cols) * fx.fw, sy = Math.floor(f / fx.cols) * fx.fh;
        // size — высота в мировых пикселях, ширина держит пропорции кадра.
        const dh = size, dw = size * (fx.fw / fx.fh);
        ctx.drawImage(fx.sheet, sx, sy, fx.fw, fx.fh, -dw / 2, -dh / 2, dw, dh);
        ctx.restore();
    }
    drawFloatTexts();
    ctx.restore(); 
    ctx.restore();
}

function drawWorld(time) {
    if (splitScreenActive()) {
        const half = canvas.width / 2;
        drawWorldPass(camera, 0, 0, half, canvas.height, time);
        drawWorldPass(camera2, half, 0, canvas.width - half, canvas.height, time);
        ctx.save();
        ctx.strokeStyle = UI.bg; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(half, 0); ctx.lineTo(half, canvas.height); ctx.stroke();
        ctx.strokeStyle = UI.line; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(half, 0); ctx.lineTo(half, canvas.height); ctx.stroke();
        ctx.restore();
    } else {
        drawWorldPass(camera, 0, 0, canvas.width, canvas.height, time);
    }
}


// Стик надо ВИДЕТЬ. Раньше касание работало, но на экране не появлялось
// ничего: игрок не понимал, поймал ли его палец игра и куда отклонён стик.
// База рисуется кольцом, ручка — заполненным ромбом (тот же знак, что
// у артефактов), чтобы слой управления читался как часть игры.
function drawJoystick(joy, color) {
    if (!joy.active) return;
    const hx = joy.originX + joy.dx * JOY_RADIUS, hy = joy.originY + joy.dy * JOY_RADIUS;
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = color; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(joy.originX, joy.originY, JOY_RADIUS, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(joy.originX, joy.originY, JOY_RADIUS, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(hx, hy - 14); ctx.lineTo(hx + 14, hy); ctx.lineTo(hx, hy + 14); ctx.lineTo(hx - 14, hy);
    ctx.closePath(); ctx.fill();
    ctx.restore();
}

function drawTouchLayer() {
    if (!isMobile || gameState !== 'playing') return;
    drawJoystick(leftJoy, '#00e0ff');
    drawJoystick(rightJoy, '#ff2d55');
}

function draw() {
    const time = performance.now();
    const menuUI = document.getElementById('main-menu-screen');
    const gameOverUI = document.getElementById('game-over-screen');

    if (gameState === 'loading') {
        ctx.fillStyle = UI.bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.font = "20px var(--font-pixel)"; ctx.fillStyle = UI.cyan; ctx.textAlign = 'center';
        ctx.fillText(`СИНХРОНИЗАЦИЯ БАЗ ДАННЫХ... ${loadedAssets} / ${totalAssets}`, canvas.width / 2, canvas.height / 2);
        return;
    }

    if (gameState === 'click_to_start') {
        ctx.fillStyle = UI.bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.font = "20px var(--font-pixel)"; ctx.fillStyle = UI.cyan; ctx.textAlign = 'center';
        ctx.fillText(isMobile ? "ТАПНИТЕ ДЛЯ ПОДКЛЮЧЕНИЯ" : "КЛИКНИТЕ ДЛЯ ПОДКЛЮЧЕНИЯ", canvas.width / 2, canvas.height / 2);
        return;
    }

    if (gameState === 'menu' || gameState === 'lore') {
        if (menuUI && gameState === 'menu' && menuUI.style.display === 'none') { menuUI.style.display = 'flex'; }
        if (gameState === 'menu') updateMenuStats();
        drawLoreBackground(time);
        return; 
    }

    if (gameState === 'gameover') {
        if (gameOverUI && gameOverUI.style.display === 'none' && !gameOverScreenBlocked()) { gameOverUI.style.display = 'flex'; }
        return;
    }

    if (gameState === 'final_cutscene') {
        drawFinalCutscene(time);
        return;
    }

    if (glitchTimer > 0) { drawChromaticGlitch(time); return; }

    drawWorld(time);


    if (parryFlashTimer > 0) {
        const fp = parryFlashTimer / 1000;
        ctx.save();
        // резкая вспышка в начале, плавное угасание к концу секунды
        const alpha = fp > 0.85 ? 1 : Math.pow(fp / 0.85, 1.6);
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
    }

    if (bossCutsceneTimer > 0) drawBossCutscene(bossCutsceneTimer, 3000);
    drawDropFlash();
    drawTouchLayer();
    drawMinimap();
    if (bigMapOpen) drawBigMap();
}
