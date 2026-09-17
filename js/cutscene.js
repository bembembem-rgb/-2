// --- ГЛИТЧ ПРИ ВХОДЕ В ЗАБЕГ ---
// Здесь же лежала финальная катсцена: пятнадцать секунд частиц,
// портала и архивной записи. Её заменил экран победы — обычный
// экран интерфейса, который к тому же закрывает забег по правилам
// (катсцена этого не делала, и кредиты на кону сгорали).

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
