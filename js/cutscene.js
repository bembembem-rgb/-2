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

// Финал: хит-стоп -> распад -> тишина -> архивная запись -> подъём.
// Прежняя версия шла пятнадцать секунд через портал, цифровой дождь и
// вспышку. Всё это были абстрактные частицы: дайвер лез вниз за ответом,
// а получал заставку. Теперь в центре финала сама запись из архива —
// она отвечает на вопрос, с которого игра начиналась.

const FIN_A = 900;    // хит-стоп
const FIN_B = 3400;   // распад тела босса на строки
const FIN_C = 5200;   // тишина, оседающие обломки
const FIN_D = 9600;   // запись набирается построчно
const FIN_E = 11600;  // подъём

// Запись читается как выписка из системы, а не как речь автора: должность,
// время последнего входа, права. Ответ в последней строке — сеть держала
// этот аккаунт, потому что права root с него никто не снял.
const FIN_RECORD = [
    ['УЧАСТНИК #0', '#00e0ff'],
    ['ДОЛЖНОСТЬ: ИНЖЕНЕР СМЕНЫ', '#7e9fb0'],
    ['ПОСЛЕДНИЙ ВХОД: ЗА 6 МИНУТ ДО ПОТОПА', '#7e9fb0'],
    ['ПРАВА: ROOT. НЕ ОТОЗВАНЫ.', '#f0c419']
];

function finText(str, x, y, size, color, revealed, glow) {
    const shown = str.slice(0, Math.max(0, Math.floor(revealed * str.length)));
    if (!shown) return;
    ctx.font = size + "px 'JetBrains Mono', monospace";
    ctx.fillStyle = color;
    if (glow) { ctx.shadowBlur = glow; ctx.shadowColor = color; }
    ctx.fillText(shown, x, y);
    ctx.shadowBlur = 0;
}

function drawFinalCutscene(time) {
    const elapsed = time - cutsceneStartTime;
    if (elapsed >= CUTSCENE_DURATION) { endFinalCutscene(); return; }
    const w = canvas.width, h = canvas.height, cx = w / 2, cy = h / 2 - 50;
    const seed = (i, salt) => { const s = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453; return s - Math.floor(s); };

    ctx.fillStyle = '#02040a'; ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    if (elapsed < FIN_A) {
        // Хит-стоп: удар уже нанесён, время ещё не пошло дальше
        const t = elapsed / FIN_A;
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, w, h);
        if (boss5Img && boss5Img.complete && boss5Img.naturalWidth > 0) {
            const fw = Math.floor(boss5Img.naturalWidth / 5), fh = Math.floor(boss5Img.naturalHeight / 4);
            const jitter = (1 - t) * 5;
            // Каналы разъезжаются: картинка держится, а сигнал уже рвётся
            for (const [dx, tint] of [[-jitter, '#ff2fd0'], [jitter, '#00e0ff'], [0, null]]) {
                ctx.save();
                ctx.translate(cx + dx, cy);
                ctx.scale(2.6, 2.6);
                ctx.imageSmoothingEnabled = false;
                if (tint) { ctx.globalAlpha = 0.55; ctx.globalCompositeOperation = 'lighter'; ctx.shadowBlur = 18; ctx.shadowColor = tint; }
                ctx.drawImage(boss5Img, 0, 0, fw, fh, -fw / 2, -fh / 2, fw, fh);
                ctx.restore();
            }
        }
        drawCutscenePlayer(cx, cy + 170, 2.6, elapsed);
        if (t < 0.18) { ctx.fillStyle = `rgba(255,255,255,${1 - t / 0.18})`; ctx.fillRect(0, 0, w, h); }

    } else if (elapsed < FIN_B) {
        // Распад: тело расходится не во все стороны, а вниз, столбцами.
        // Змей был свит из кода — он и осыпается строками, а не осколками.
        const t = (elapsed - FIN_A) / (FIN_B - FIN_A);
        ctx.textAlign = 'center';
        for (let i = 0; i < 46; i++) {
            const colX = cx + (seed(i, 1) - 0.5) * 420;
            const delay = seed(i, 3) * 0.35;
            const lt = Math.max(0, (t - delay) / (1 - delay));
            if (lt <= 0) continue;
            const fall = lt * lt * (h * 0.9);
            const alpha = Math.max(0, 1 - lt * 1.1);
            const glyphs = 3 + Math.floor(seed(i, 5) * 6);
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.font = "13px 'JetBrains Mono', monospace";
            for (let j = 0; j < glyphs; j++) {
                const y = cy - 60 + fall + j * 16;
                if (y < -20 || y > h + 20) continue;
                ctx.fillStyle = j === 0 ? '#dbeef7' : (i % 3 === 0 ? '#ff2fd0' : '#00e0ff');
                ctx.fillText(SEED_CHARS[(i * 7 + j * 3 + Math.floor(lt * 20)) % SEED_CHARS.length], colX, y);
            }
            ctx.restore();
        }
        drawCutscenePlayer(cx, cy + 170, 2.6, elapsed, 1 - t);
        if (t < 0.08) { ctx.fillStyle = `rgba(255,255,255,${1 - t / 0.08})`; ctx.fillRect(0, 0, w, h); }

    } else if (elapsed < FIN_C) {
        // Тишина: ни врага, ни звука. Только оседающая взвесь и дайвер,
        // которому впервые за игру некуда двигаться.
        const t = (elapsed - FIN_B) / (FIN_C - FIN_B);
        for (let i = 0; i < 70; i++) {
            const px = seed(i, 11) * w;
            const py = ((seed(i, 12) * h) + t * 40 * (0.4 + seed(i, 13))) % h;
            ctx.globalAlpha = 0.10 + seed(i, 14) * 0.18;
            ctx.fillStyle = '#7e9fb0';
            ctx.fillRect(px, py, 2, 2);
        }
        ctx.globalAlpha = 1;
        drawCutscenePlayer(cx, cy + 120, 2.2, elapsed);

    } else if (elapsed < FIN_D) {
        // Запись: четыре строки набираются по очереди. Смысл финала здесь,
        // поэтому всё остальное на экране выключено.
        const t = (elapsed - FIN_C) / (FIN_D - FIN_C);
        ctx.globalAlpha = 0.5;
        drawCutscenePlayer(cx, h - 110, 1.5, elapsed);
        ctx.globalAlpha = 1;

        const top = cy - 60;
        finText('АРХИВ AETHERNET', cx, top - 42, 11, '#48626f', Math.min(1, t * 6));

        const per = 1 / FIN_RECORD.length;
        FIN_RECORD.forEach(([line, color], i) => {
            const lt = Math.max(0, Math.min(1, (t - i * per) / (per * 0.72)));
            finText(line, cx, top + i * 34, i === 0 ? 20 : 14, color, lt, i === 0 ? 18 : 10);
        });

        // Курсор стоит в конце последней набранной строки
        const lastIdx = Math.min(FIN_RECORD.length - 1, Math.floor(t / per));
        if (Math.floor(elapsed / 400) % 2 === 0) {
            const line = FIN_RECORD[lastIdx][0];
            const size = lastIdx === 0 ? 20 : 14;
            ctx.font = size + "px 'JetBrains Mono', monospace";
            const lt = Math.max(0, Math.min(1, (t - lastIdx * per) / (per * 0.72)));
            const shown = line.slice(0, Math.floor(lt * line.length));
            ctx.fillStyle = '#00e0ff';
            ctx.fillRect(cx + ctx.measureText(shown).width / 2 + 3, top + lastIdx * 34 - size * 0.8, size * 0.5, size);
        }

    } else {
        // Подъём: свет приходит сверху — впервые за всю игру. Слогана нет,
        // финал закрывает одна отправленная команда.
        const t = (elapsed - FIN_D) / (FIN_E - FIN_D);
        const lift = Math.min(1, t);
        const glow = ctx.createLinearGradient(0, 0, 0, h);
        glow.addColorStop(0, `rgba(210,240,255,${0.10 + lift * 0.5})`);
        glow.addColorStop(0.6, 'rgba(210,240,255,0)');
        ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);

        drawCutscenePlayer(cx, h - 110 - lift * (h * 0.75), 1.5 + lift * 0.6, elapsed, lift);

        if (t > 0.45) {
            const ft = Math.min(1, (t - 0.45) / 0.35);
            finText('ЗАПРОС НА ОТКЛЮЧЕНИЕ СЕТИ ОТПРАВЛЕН', cx, cy + 30, 14, '#ff2d55', ft, 16);
        }
        if (t > 1) { ctx.fillStyle = `rgba(0,0,0,${Math.min(1, (t - 1) * 3)})`; ctx.fillRect(0, 0, w, h); }
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
