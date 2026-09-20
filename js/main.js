window.addEventListener('resize', resizeCanvas);
// Поворот телефона: Safari шлёт resize не всегда и не сразу, поэтому
// пересчитываем ещё и по самому повороту, с запасом на анимацию.
window.addEventListener('orientationchange', () => {
    resizeCanvas();
    setTimeout(resizeCanvas, 300);
});
resizeCanvas();

// --- ОБРАБОТЧИКИ СОБЫТИЙ МЫШИ И КЛАВИАТУРЫ ---
window.addEventListener('contextmenu', (e) => e.preventDefault());

// === УПРАВЛЕНИЕ НА ДВА ПАЛЬЦА ===
// Левая половина экрана — движение, правая — прицел и огонь. Оба стика
// плавающие: база встаёт там, где палец коснулся. Способности сняты
// с кнопок на жесты, потому что каждая новая кнопка на телефоне отнимает
// у игрока палец, а пальцев всего два.
//
//   левая половина:  вести = идти,  двойной тап = РЫВОК
//   правая половина: вести = целиться и стрелять, двойной тап = ПАРИРОВАНИЕ
//
// На кнопках остаётся только то, что нажимают редко и осознанно:
// импульс, смена ствола и контекстная посадка в транспорт.
function joyDown(joy, t) {
    const now = performance.now();
    const isDouble = now - joy.lastTapAt < DOUBLE_TAP_GAP;
    joy.active = true; joy.touchId = t.identifier;
    joy.originX = t.clientX; joy.originY = t.clientY;
    joy.startX = t.clientX; joy.startY = t.clientY;
    joy.downAt = now; joy.moved = 0; joy.dx = 0; joy.dy = 0;
    return isDouble;
}

function joyMove(joy, t) {
    let dx = t.clientX - joy.originX, dy = t.clientY - joy.originY;
    const dist = Math.hypot(dx, dy);
    joy.moved = Math.max(joy.moved, Math.hypot(t.clientX - joy.startX, t.clientY - joy.startY));
    // База «догоняет» палец, если он ушёл за радиус: иначе при длинном
    // ведении стик упирается в потолок и перестаёт слушаться.
    if (dist > JOY_RADIUS) {
        joy.originX = t.clientX - (dx / dist) * JOY_RADIUS;
        joy.originY = t.clientY - (dy / dist) * JOY_RADIUS;
        dx = (dx / dist) * JOY_RADIUS; dy = (dy / dist) * JOY_RADIUS;
    }
    joy.dx = dx / JOY_RADIUS; joy.dy = dy / JOY_RADIUS;
}

// Касание засчитывается как тап, только если палец почти не сдвинулся
// и быстро отпустил: иначе каждое короткое ведение читалось бы как тап.
function joyUp(joy) {
    const now = performance.now();
    if (joy.moved < TAP_SLOP && now - joy.downAt < TAP_TIME) joy.lastTapAt = now;
    else joy.lastTapAt = 0;
    joy.active = false; joy.dx = 0; joy.dy = 0; joy.touchId = null; joy.moved = 0;
}

window.addEventListener('touchstart', (e) => {
    if (gameState === 'click_to_start') { enterFromStartGate(); return; }
    if (gameState !== 'playing') return;
    for (let t of e.changedTouches) {
        if (t.target.closest && t.target.closest('button, .tap-btn, .touch-btn')) continue;
        if (t.clientX < window.innerWidth / 2 && !leftJoy.active) {
            if (joyDown(leftJoy, t) && player && !player.downed && !player.inVehicle && player.dashCooldown <= 0) tapKey('ShiftLeft');
        } else if (t.clientX >= window.innerWidth / 2 && !rightJoy.active) {
            if (joyDown(rightJoy, t) && player && !player.downed && !player.inVehicle && player.parryReady) tapKey('Space');
            isShooting = true;
        }
    }
}, {passive: false});

window.addEventListener('touchmove', (e) => {
    if (gameState !== 'playing') return; e.preventDefault();
    for (let t of e.changedTouches) {
        if (leftJoy.active && t.identifier === leftJoy.touchId) joyMove(leftJoy, t);
        if (rightJoy.active && t.identifier === rightJoy.touchId) joyMove(rightJoy, t);
    }
}, {passive: false});

// touchcancel обязателен наравне с touchend: систему интересует свой
// сценарий (звонок, шторка, ладонь на экране), и тогда touchend не придёт
// вовсе — палец «залипает», герой бежит и стреляет сам по себе.
function releaseTouches(e) {
    for (let t of e.changedTouches) {
        if (leftJoy.active && t.identifier === leftJoy.touchId) joyUp(leftJoy);
        if (rightJoy.active && t.identifier === rightJoy.touchId) { joyUp(rightJoy); isShooting = false; }
    }
}
window.addEventListener('touchend', releaseTouches);
window.addEventListener('touchcancel', releaseTouches);

window.addEventListener('mousedown', (e) => { 
    if (gameState === 'click_to_start') { enterFromStartGate(); return; }
    if (gameState === 'loading' || gameState === 'menu' || gameState === 'lore' || gameState === 'gameover') return; 
    if (e.button === 0) isShooting = true; 
    if (e.button === 2 && player && !player.inVehicle && player.altReady) executeAltAttack(); 
});

window.addEventListener('mouseup', (e) => { if (e.button === 0) isShooting = false; });

window.addEventListener('blur', resetInputState);
// Свернули игру — забег встаёт на паузу. На телефоне уведомление или
// звонок иначе возвращают игрока в бой, который шёл без него.
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        resetInputState();
        if (gameState === 'playing') pauseGame();
        if (currentBGM) currentBGM.pause();
    } else if (currentBGM && audioUnlocked) {
        currentBGM.play().catch(() => {});
    }
});

window.addEventListener('mousemove', (e) => { 
    mouse.screenX = e.clientX; mouse.screenY = e.clientY; 
    if(gameState === 'playing' && camera) { const rect = canvas.getBoundingClientRect(); mouse.worldX = (e.clientX - rect.left) + camera.x; mouse.worldY = (e.clientY - rect.top) + camera.y; }
});

window.addEventListener('keydown', (e) => {
    // Модификаторы пропускаем, иначе сломается Ctrl+R и прочие горячие клавиши браузера
    if (GAME_KEYS.has(e.code) && !e.ctrlKey && !e.metaKey && !e.altKey) e.preventDefault();
    keys[e.code] = true;
    if (e.code === 'Escape' && gameState === 'playing') { pauseGame(); return; }
    // Меню забирает стрелки и Enter себе — в игре они значат другое,
    // поэтому handleMenuKeys молчит, пока gameState === 'playing'.
    if (handleMenuKeys(e)) return;
    if (e.code === 'KeyC') {
        const mw = document.getElementById('minimap-wrap'), mh = document.getElementById('minimap-hint');
        if (mw) mw.style.display = 'block';
        if (mh) mh.style.display = 'none';
    }
    if (e.code === 'KeyM' && gameState === 'playing') bigMapOpen = !bigMapOpen;
    if (e.code === 'KeyR' && gameState === 'gameover') { window.startGameBtn(); }
    if (gameState === 'playing' && player) {
        if (e.code === 'KeyV') diveLeave();
        if (e.code === 'KeyN') diveStay();
        if (e.code === 'KeyG') acceptContract();
        if (e.code === 'KeyH') declineContract();
        if (e.code === 'KeyF' || e.code === 'Keyf') { if (!player.inVehicle) { player.currentWeapon = nextWeapon(player.currentWeapon); playSFX(sfxWeapon, 0.5, 0, 0.05); spawnFloatText(player.x, player.y - 50, WEAPONS[player.currentWeapon].name, '#00e0ff', 12, 'weapon'); } }
        if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !player.inVehicle && !player.downed && player.dashCooldown <= 0) {
            player.isDashing = true; player.dashTimer = 200; player.dashCooldown = player.dashCooldownTime || 2000; player.iFrames = 200; 
            playSFX(sfxDash, 0.45, 0, 0.06);
            saveData.stats.dashCount++; writeSave();
            dailyEvent('dash', 1);
            if (saveData.stats.dashCount >= 200) unlockAchievement('secret_dasher');
            let dx = 0, dy = 0;
            const gp1ForDash = getPlayer1Gamepad();
            if (keys.KeyW) dy -= 1; if (keys.KeyS) dy += 1; if (keys.KeyA) dx -= 1; if (keys.KeyD) dx += 1;
            if (dx === 0 && dy === 0 && gp1ForDash && (Math.abs(gp1ForDash.axes[0]) > 0.2 || Math.abs(gp1ForDash.axes[1]) > 0.2)) { dx = gp1ForDash.axes[0]; dy = gp1ForDash.axes[1]; }
            if (dx === 0 && dy === 0) { const angle = getP1AimAngle(); dx = Math.cos(angle); dy = Math.sin(angle); } else { const len = Math.hypot(dx, dy); dx /= len; dy /= len; }
            player.vx = dx * player.dashSpeed; player.vy = dy * player.dashSpeed; spawnBubbles(player.x, player.y, 15);
            spawnSpriteFX(fxDashTrail, player.x, player.y, { size: 150, frameInterval: 38, alpha: 0.9, angle: Math.atan2(dy, dx) });
            artOnDash(player.x, player.y);
        }
        // Пульс — инструмент техника. В ко-опе штурм его лишается.
        if (e.code === 'KeyQ' && !coopMode) { if (!player.inVehicle && player.pulseReady) executePulse(); }
        if (e.code === 'Space') { if (!player.inVehicle && player.parryReady) startParry(); }
        if (e.code === 'KeyE') {
            if (!player.inVehicle) {
                let closest = null, minDist = 80;
                for (let v of transports) { if (coopMode && v === player2.currentVehicle) continue; let d = Math.hypot(player.x - v.x, player.y - v.y); if (d < minDist) { minDist = d; closest = v; } }
                if (closest) {
                    player.inVehicle = true; player.currentVehicle = closest; if(vehicleHpWrap) vehicleHpWrap.style.display = 'block'; updateVehicleHpUI(); spawnParticles(player.x, player.y, '#00ffff', 10);
                    if (closest === questVehicle && questState === 'seeking') { questState = 'heat'; generateExtraction(); shakeTime = 300; }
                }
            } else if (player.inVehicle && player.currentVehicle) { 
                player.x = player.currentVehicle.x - 50; player.y = player.currentVehicle.y; player.inVehicle = false; player.currentVehicle = null; player.iFrames = 500; updateVehicleHpUI(); 
            }
        }
        if (coopMode && player2 && !player2.downed && e.code === 'Enter' && player2.dashCooldown <= 0) {
            dashPlayer2();
        }
        if (coopMode && player2 && !player2.downed && e.code === 'Backslash') {
            interactPlayer2();
        }
        if (coopMode && player2 && !player2.downed && !player2.inVehicle && e.code === 'ControlRight' && player2.parryReady) {
            startParry(player2);
        }
        if (coopMode && player2 && !player2.downed && !player2.inVehicle && e.code === 'Period' && player2.pulseReady) {
            executePulse(player2);
        }
    }
});

window.addEventListener('keyup', (e) => { 
    if (GAME_KEYS.has(e.code) && !e.ctrlKey && !e.metaKey && !e.altKey) e.preventDefault();
    keys[e.code] = false; 
    if (e.code === 'KeyC') {
        const mw = document.getElementById('minimap-wrap'), mh = document.getElementById('minimap-hint');
        if (mw) mw.style.display = 'none';
        if (mh) mh.style.display = 'block';
    }
});

let _frameErrorsLogged = 0;
function gameLoop(currentTime) {
    try {
        gameFrame(currentTime);
    } catch (e) {
        // Кадр пропускаем, цикл продолжаем. Первые ошибки пишем в консоль,
        // дальше молчим: сыпать одно и то же по 60 раз в секунду бесполезно.
        if (_frameErrorsLogged < 5) { _frameErrorsLogged++; console.error('Ошибка в кадре:', e); }
    }
    requestAnimationFrame(gameLoop);
}

function gameFrame(currentTime) { 
    // Видимость HUD проверяется каждый кадр: состояние меняют и меню, и смерть,
    // и пауза — ловить каждый переход по месту значит однажды пропустить один.
    updateHudVisibility();
    updateLevelGamepad();
    if (gameState === 'playing') {
        let dt = currentTime - lastFrameTime; 
        if (dt < 0) dt = 0; 
        // Потолок кадра: свёрнутая вкладка отдаёт dt в секунды, и физика
        // с таймерами перескакивают шагами вместо плавного хода.
        if (dt > 50) dt = 50;
        lastFrameTime = currentTime; 
        update(dt); 
        updateCooldownBars();
        draw(); 
    } else if (gameState === 'gameover') {
        // Экран поражения показывает draw(). Пока смерть случалась внутри update,
        // его успевал нарисовать тот же кадр; выход из паузы приходит извне цикла,
        // и без этой ветки экран не открывался бы вообще.
        draw();
    } else if (gameState === 'paused') {
        // Кадр перерисовывается, но не обновляется: под панелью паузы
        // остаётся живая картинка мира, а не заморозка последнего кадра.
        draw();
    } else if (gameState === 'loading' || gameState === 'menu' || gameState === 'lore' || gameState === 'click_to_start') {
        draw();
    }
}

// Запуск HTML интерфейса и игрового цикла
// Пришли по ссылке с сидом — первый клик обязан сажать в воду, а не в
// меню. Каждый экран между роликом и игрой отсекает часть зрителей,
// а звук всё равно требует от браузера первого касания, и этот клик
// уже происходит.
function enterFromStartGate() {
    try { window.focus(); } catch (err) {}
    unlockAudio();
    if (readLinkSeed()) { startGameBtn(); return; }
    playBGM(bgmMenu);
    gameState = 'menu';
}

readLinkSeed();
initHTMLUI();
requestAnimationFrame(gameLoop);

// --- DEBUG: КОНСОЛЬНЫЙ СПАВН БОССОВ ---
// В консоли браузера: spawnBoss('reef'), spawnBoss('void'), spawnBoss(3) и т.д.
window.spawnBoss = function(id) {
    if (gameState !== 'playing' || !player) { console.warn('Сначала начни игру.'); return; }
    const map = {
        1: AbyssalWarden, warden: AbyssalWarden,
        2: TideCaller, tide: TideCaller,
        3: Leviathan, leviathan: Leviathan,
        4: ThornReef, reef: ThornReef,
        5: VoidWraith, void: VoidWraith
    };
    const BossClass = map[id];
    if (!BossClass) { console.warn('Неизвестный босс:', id, '— доступно:', Object.keys(map)); return; }

    const spawnX = camera.x + canvas.width / 2;
    const spawnY = camera.y + canvas.height / 2 - 200;

    enemies.forEach(e => { if (e.type !== 'boss') spawnExplosion(e.x, e.y, 40); });
    activeBoss = new BossClass(spawnX, spawnY);
    enemies = [activeBoss];
    enemyProjectiles = [];
    bossCutsceneTimer = 3000;
    currentBossName = activeBoss.name;
    shakeTime = Math.max(shakeTime, 500);

    const bgmMap = { 1: bgmBoss1, 2: bgmBoss2, 3: bgmBoss3, 4: bgmBoss4, 5: bgmBoss5 };
    const key = Object.keys(map).find(k => map[k] === BossClass && !isNaN(k));
    playBGM(bgmMap[key] || bgmBoss1);
    playSFX(sfxBossSpawn, 0.8);
    spawnSpriteFX(bossFx(activeBoss, 'rune'), spawnX, spawnY, { size: 230, frameInterval: 36 });

    console.log('Заспавнен:', activeBoss.name);
};
window.killBoss = function() { if (activeBoss) activeBoss.hp = 0; };

// Размеры листов взрывов — чтобы подобрать нарезку, не открывая редактор.
window.fxInfo = function() {
    [['tankballexplode', fxBoomTank], ['helicopterexploderoclet', fxBoomRoc], ['explosion_boss', fxBoomBoss]]
        .forEach(([n, i]) => {
            const w = i.naturalWidth, h = i.naturalHeight, fits = [];
            for (let fw = 8; fw <= w; fw++) if (w % fw === 0 && w / fw >= 4 && w / fw <= 64) fits.push(fw + 'x' + h + ' = ' + (w / fw) + ' кадр.');
            console.log(n, w + 'x' + h, '| квадратных в ряд:', (w / h).toFixed(2), '| ровные нарезки:', fits.join(', '));
        });
};
// Прокрутить взрыв босса перед игроком, не убивая босса. fxTestBoss(64, 64, 8, 16)
window.fxTestBoss = function(fw, fh, cols, frames, start) {
    if (fw) FX_BOSS_CUT = { fw, fh: fh || fw, cols: cols || null, frames: frames || null, start: start || 0 };
    if (!player) return;
    spawnSpriteFX(fxBoomBoss, player.x, player.y - 220, { size: 280, frameInterval: 90, ...FX_BOSS_CUT });
    console.log('нарезка:', FX_BOSS_CUT);
};
window.giveScore = function(n = 1000) { addScore(n, 0); };
window.giveCredits = function(n = 500) { saveData.wallet = (saveData.wallet || 0) + n; writeSave(); console.log('кошелёк:', saveData.wallet); };
