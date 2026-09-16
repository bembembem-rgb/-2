function triggerFinalCutscene() {
    gameState = 'final_cutscene';
    cutsceneStartTime = performance.now();
    if (currentBGM) currentBGM.pause();
    playBGM(bgmFinale);
    playSFX(sfxGlitch, 0.7);
    shakeTime = 0;
    const skipBtn = document.getElementById('cutscene-skip-btn');
    if (skipBtn) skipBtn.style.display = 'block';
}

function endFinalCutscene() {
    gameState = 'menu';
    const menuScreen = document.getElementById('main-menu-screen');
    if (menuScreen) menuScreen.style.display = 'flex';
    const skipBtn = document.getElementById('cutscene-skip-btn');
    if (skipBtn) skipBtn.style.display = 'none';
    playBGM(bgmMenu);
}

function drawMatrixRain(time, alpha, speedMult) {
    const w = canvas.width, h = canvas.height;
    const seed = (i, salt) => { const s = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453; return s - Math.floor(s); };
    const colW = 18;
    const cols = Math.ceil(w / colW);
    ctx.save();
    ctx.font = "14px monospace"; ctx.textAlign = 'center';
    for (let i = 0; i < cols; i++) {
        const colSeed = seed(i, 21);
        const speed = (140 + colSeed * 260) * speedMult;
        const x = i * colW + colW / 2;
        const headY = (time * speed * 0.001 + colSeed * h * 5) % (h + 220) - 110;
        const len = 6 + Math.floor(colSeed * 10);
        for (let j = 0; j < len; j++) {
            const y = headY - j * 18;
            if (y < -20 || y > h + 20) continue;
            const glyphAlpha = Math.max(0, 1 - j / len) * alpha;
            const isHead = j === 0;
            ctx.globalAlpha = glyphAlpha;
            ctx.fillStyle = isHead ? '#ffffff' : '#00ff99';
            ctx.shadowBlur = isHead ? 10 : 0; ctx.shadowColor = '#00ff99';
            const ch = String.fromCharCode(33 + Math.floor(seed(i * 97 + j, Math.floor(time / 90)) * 90));
            ctx.fillText(ch, x, y);
        }
    }
    ctx.restore();
}

// Единая 15-секундная катсцена: хит-стоп -> аннигиляция -> воронка-портал -> цифровая чистка -> вспышка
function drawFinalCutscene(time) {
    const elapsed = time - cutsceneStartTime;
    if (elapsed >= CUTSCENE_DURATION) { endFinalCutscene(); return; }
    const w = canvas.width, h = canvas.height, cx = w / 2, cy = h / 2 - 50;
    const seed = (i, salt) => { const s = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453; return s - Math.floor(s); };

    ctx.fillStyle = '#02020a'; ctx.fillRect(0, 0, w, h);

    if (elapsed < 1200) {
        // ФАЗА A: ХИТ-СТОП — финальный удар застывает во времени
        const t = elapsed / 1200;
        ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, w, h);
        if (boss5Img && boss5Img.complete && boss5Img.naturalWidth > 0) {
            const fw = Math.floor(boss5Img.naturalWidth / 5), fh = Math.floor(boss5Img.naturalHeight / 4);
            const jitter = (1 - t) * 4;
            ctx.save(); ctx.translate(cx + (Math.random() - 0.5) * jitter, cy + (Math.random() - 0.5) * jitter); ctx.scale(2.6, 2.6);
            ctx.shadowBlur = 25; ctx.shadowColor = '#b026ff'; ctx.imageSmoothingEnabled = false;
            ctx.drawImage(boss5Img, 0, 0, fw, fh, -fw / 2, -fh / 2, fw, fh);
            ctx.restore();
        }
        drawCutscenePlayer(cx, cy + 160, 2.6, elapsed);
        if (t < 0.15) { ctx.fillStyle = `rgba(255,255,255,${1 - t / 0.15})`; ctx.fillRect(0, 0, w, h); }

    } else if (elapsed < 4200) {
        // ФАЗА B: АННИГИЛЯЦИЯ — босс разлетается на осколки, ударные кольца
        const t = (elapsed - 1200) / 3000;
        for (let i = 0; i < 70; i++) {
            const ph = seed(i, 1) * Math.PI * 2;
            const spd = 50 + seed(i, 2) * 260;
            const localT = Math.max(0, t - seed(i, 3) * 0.1);
            const dist = localT * spd * 8;
            const alpha = Math.max(0, 1 - localT * 1.3);
            if (alpha <= 0) continue;
            const sx = cx + Math.cos(ph) * dist, sy = cy + Math.sin(ph) * dist;
            const size = 3 + seed(i, 4) * 10;
            ctx.save(); ctx.translate(sx, sy); ctx.rotate(ph + localT * 8);
            ctx.fillStyle = i % 2 === 0 ? '#b026ff' : '#39ff14'; ctx.globalAlpha = alpha; ctx.shadowBlur = 10; ctx.shadowColor = ctx.fillStyle;
            ctx.fillRect(-size / 2, -size / 2, size, size);
            ctx.restore();
        }
        for (let r = 0; r < 4; r++) {
            const ringT = (t * 4 - r * 0.35);
            if (ringT <= 0 || ringT >= 1) continue;
            ctx.save(); ctx.globalAlpha = (1 - ringT) * 0.6; ctx.strokeStyle = '#b026ff'; ctx.lineWidth = 6; ctx.shadowBlur = 20; ctx.shadowColor = '#b026ff';
            ctx.beginPath(); ctx.arc(cx, cy, ringT * w * 0.55, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        }
        if (t < 0.06) { ctx.fillStyle = `rgba(255,255,255,${1 - t / 0.06})`; ctx.fillRect(0, 0, w, h); }

    } else if (elapsed < 9200) {
        // ФАЗА C: ВОРОНКА — раскрывается портал, осколки закручиваются и втягиваются
        const t = (elapsed - 4200) / 5000;
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.sin(t * Math.PI) * 0.03); ctx.translate(-cx, -cy);

        const portalR = 6 + t * 140;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, portalR);
        grad.addColorStop(0, 'rgba(255,255,255,0.9)'); grad.addColorStop(0.4, 'rgba(140,80,255,0.6)'); grad.addColorStop(1, 'rgba(140,80,255,0)');
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = grad;
        ctx.beginPath(); ctx.ellipse(cx, cy, portalR * 0.4, portalR, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2; ctx.stroke();
        ctx.restore();

        for (let i = 0; i < 70; i++) {
            const ph = seed(i, 1) * Math.PI * 2 + t * 6;
            const baseDist = (1 - t) * (60 + seed(i, 2) * 300);
            const sx = cx + Math.cos(ph) * baseDist, sy = cy + Math.sin(ph) * baseDist;
            const alpha = Math.max(0, 1 - t * 1.2);
            if (alpha <= 0) continue;
            const size = 2 + seed(i, 4) * 7;
            ctx.save(); ctx.translate(sx, sy); ctx.rotate(ph);
            ctx.fillStyle = i % 2 === 0 ? '#b026ff' : '#39ff14'; ctx.globalAlpha = alpha * 0.8; ctx.shadowBlur = 8; ctx.shadowColor = ctx.fillStyle;
            ctx.fillRect(-size / 2, -size / 2, size, size);
            ctx.restore();
        }
        ctx.restore();

    } else if (elapsed < 13200) {
        // ФАЗА D: ЦИФРОВАЯ ЧИСТКА — ускоряющийся дождь символов поглощает портал
        const t = (elapsed - 9200) / 4000;
        drawMatrixRain(time, 0.85, 1 + t * 3);
        const portalR = Math.max(1, 20 * (1 - t));
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath(); ctx.arc(cx, cy, portalR, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        if (t > 0.7) { ctx.fillStyle = `rgba(0,0,0,${(t - 0.7) / 0.3 * 0.6})`; ctx.fillRect(0, 0, w, h); }

    } else {
        // ФАЗА E: ВСПЫШКА — короткая надпись и полный уайтаут-катаут
        const t = (elapsed - 13200) / 1800;
        ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, w, h);
        if (t < 0.6) {
            ctx.save(); ctx.globalAlpha = Math.sin((t / 0.6) * Math.PI); ctx.textAlign = 'center';
            ctx.font = "18px var(--font-pixel)"; ctx.fillStyle = '#00ffff'; ctx.shadowBlur = 20; ctx.shadowColor = '#00ffff';
            ctx.fillText('СИСТЕМА СТАБИЛЬНА', cx, cy);
            ctx.restore();
        }
        const flashA = Math.max(0, (t - 0.6) / 0.4);
        ctx.fillStyle = `rgba(255,255,255,${Math.min(1, flashA)})`; ctx.fillRect(0, 0, w, h);
    }
}

function drawCutscenePlayer(x, y, scale, elapsed, glowBoost) {
    glowBoost = glowBoost || 0;
    if (!(playerImg && playerImg.complete && playerImg.width > 0)) return;
    const totalFrames = 16, frameWidth = Math.floor(playerImg.width / totalFrames);
    const frame = Math.floor(elapsed / 140) % 4; // лёгкий цикл плавания
    ctx.save(); ctx.translate(x, y);
    if (glowBoost > 0) { ctx.shadowBlur = 25 + glowBoost * 20; ctx.shadowColor = '#ffffff'; }
    else { ctx.shadowBlur = 12; ctx.shadowColor = '#00ffff'; }
    const drawSize = 60 * scale;
    ctx.drawImage(playerImg, frame * frameWidth, 0, frameWidth, playerImg.height, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
    ctx.restore();
}

function triggerStartGlitch() {
    glitchTimer = GLITCH_DURATION;
    if (!glitchSnapCanvas) {
        glitchSnapCanvas = document.createElement('canvas'); glitchSnapCtx = glitchSnapCanvas.getContext('2d');
        glitchChR = document.createElement('canvas'); glitchChG = document.createElement('canvas'); glitchChB = document.createElement('canvas');
    }
    const w = canvas.width, h = canvas.height;
    [glitchSnapCanvas, glitchChR, glitchChG, glitchChB].forEach(c => { c.width = w; c.height = h; });
    glitchSnapCtx.drawImage(canvas, 0, 0);

    const makeChannel = (cv, colorRGB) => {
        const cctx = cv.getContext('2d');
        cctx.clearRect(0, 0, w, h);
        cctx.drawImage(glitchSnapCanvas, 0, 0);
        cctx.globalCompositeOperation = 'multiply';
        cctx.fillStyle = colorRGB; cctx.fillRect(0, 0, w, h);
        cctx.globalCompositeOperation = 'source-over';
    };
    makeChannel(glitchChR, 'rgb(255,0,0)');
    makeChannel(glitchChG, 'rgb(0,255,0)');
    makeChannel(glitchChB, 'rgb(0,0,255)');

    playSFX(sfxGlitch, 0.6);
    shakeTime = Math.max(shakeTime, 300);
}

function drawChromaticGlitch(time) {
    const w = canvas.width, h = canvas.height;
    const prog = 1 - (glitchTimer / GLITCH_DURATION); // 0 в начале -> 1 в конце
    const settle = Math.pow(1 - prog, 2); // затухание амплитуды к концу
    const shift = 4 + settle * 22;

    ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, w, h);

    ctx.save(); ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(glitchChR, -shift, 0);
    ctx.drawImage(glitchChG, 0, 0);
    ctx.drawImage(glitchChB, shift, 0);
    ctx.restore();

    // Рваные горизонтальные полосы смещения (классический datamosh-глитч)
    const sliceCount = 6 + Math.floor(settle * 10);
    for (let i = 0; i < sliceCount; i++) {
        const sy = Math.random() * h, sh = 4 + Math.random() * 30 * settle;
        const dx = (Math.random() - 0.5) * shift * 6;
        ctx.drawImage(glitchSnapCanvas, 0, sy, w, sh, dx, sy, w, sh);
    }

    // Мерцающие цветные сканлайны/шум
    ctx.globalAlpha = 0.15 + Math.random() * 0.1 * settle;
    ctx.fillStyle = Math.random() > 0.5 ? '#00ffff' : '#ff003c';
    for (let i = 0; i < 4; i++) { const ny = Math.random() * h; ctx.fillRect(0, ny, w, 2 + Math.random() * 6); }
    ctx.globalAlpha = 1;

    // Виньетка-вспышка в первый момент
    if (prog < 0.2) {
        ctx.fillStyle = `rgba(255,255,255,${(1 - prog / 0.2) * 0.5})`;
        ctx.fillRect(0, 0, w, h);
    }

    glitchTimer -= 16.67;
}
