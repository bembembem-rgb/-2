// --- ИНИЦИАЛИЗАЦИЯ И КВЕСТЫ ---
function initGameCore() {
    beginSeededRun();
    runDepth = selectedDepth();
    if (isMobile) { touchHintUntil = performance.now() + TOUCH_HINT_MS; document.body.classList.remove('hint-done'); }
    player = { 
        x: 0, y: 0, size: 40, speed: 5, color: '#00f0ff', 
        hp: maxHp(), iFrames: 0, isDashing: false, dashCooldown: 0, dashCooldownTime: dashCdBase(),
        dashTimer: 0, dashSpeed: 15, altReady: true, altCooldownTime: 3000, 
        altTimer: 0, inVehicle: false, currentVehicle: null, vx: 0, vy: 0, 
        directionOffset: 0, animFrame: 0, frameTimer: 0, frameInterval: 100, 
        currentWeapon: 1, weaponCooldown: 0, gunRecoil: 0,
        pulseReady: true, pulseCooldownTime: 8000, pulseTimer: 0, pulseCharges: 0, pulseChargesMax: 0,
        parryReady: true, parryCooldownTime: 4000, parryTimer: 0, parryWindow: 0, shieldTimer: 0,
        maxHpRun: maxHp(), downed: false, reviveProgress: 0
    };
    if (coopMode) {
        player2 = {
            x: 80, y: 0, size: 40, speed: 5, color: '#1e6bff',
            hp: maxHp(), iFrames: 0, isDashing: false, dashCooldown: 0, dashCooldownTime: dashCdBase(), dashTimer: 0, dashSpeed: 15,
            vx: 0, vy: 0, directionOffset: 0, animFrame: 0, frameTimer: 0, frameInterval: 100,
            weaponCooldown: 0, gunRecoil: 0, downed: false, reviveProgress: 0,
            inVehicle: false, currentVehicle: null,
            pulseReady: true, pulseCooldownTime: 8000, pulseTimer: 0, pulseCharges: 0, pulseChargesMax: 0,
            parryReady: true, parryCooldownTime: 4000, parryTimer: 0, parryWindow: 0, shieldTimer: 0,
            maxHpRun: maxHp()
        };
    } else { player2 = null; }
    
    transports = []; 
    camera = { x: -canvas.width/2, y: -canvas.height/2 };
    camera2 = { x: -canvas.width/4, y: -canvas.height/2 };
    isShooting = false;
    
    for (const p of projectiles) stopSFX(p.sfx, 0);
    projectiles = []; 
    enemyProjectiles = []; 
    enemies = []; 
    particles = []; 
    bubbles = []; 
    trails = []; casings = []; smokePuffs = []; sparks = []; shockRings = []; 
    scorches = []; 
    pulseRingFx = [];
    parryShockwaves = []; parryFlashTimer = 0;
    spriteFx = []; _hitFxThisFrame = 0; _lastHitFx = 0;
    muzzleFlashes = [];
    resetArtifacts();
    resetLevels();
    resetContracts();
    resetDrops();
    runUnlocks = [];
    resetCores();
    resetDive();
    parryHealCount = 0; chainBoltCount = 0;
    runEscaped = false;
    _lastPlayerX = null; _lastPlayerY = null;
    glitchTimer = 0;
    obstacles = new Map(); 
    customObstacles = []; 
    destroyedObstacles = new Set();
    
    shakeTime = 0; 
    hitStopTimer = 0;
    // Кадр после меню приходит с dt в тысячи мс: без этой строки первый же
    // update прогоняет все таймеры забега разом.
    lastFrameTime = performance.now();
    cancelQuestRespawn();
    bigMapOpen = false; mapBtnPrev = false;
    p1PrevButtons = []; p2PrevButtons = [];
    p1GamepadAimAngle = null; p1GamepadShooting = false; p1AimLockedEnemy = null;
    resetInputState();
    const mwInit = document.getElementById('minimap-wrap'), mhInit = document.getElementById('minimap-hint');
    if (mwInit) mwInit.style.display = 'none';
    if (mhInit) mhInit.style.display = 'block';
    vehicleKillsThisRun = 0; hpLostAny = false; bossFightStartHp = null;
    enemySpawnTimer = 0; 
    worldTimer = 0; 
    score = 0; 
    runCredits = 0; _prevCreditsUI = null; updateCreditsUI();
    _prevCoresUI = null; updateCoresUI();
    currentBossIndex = 0; nextBossScore = 3000;
    bossCutsceneTimer = 0; 
    activeBoss = null; 
    questState = 'none'; 
    questVehicle = null; questOutpost = null; deepVault = null;
    extractionPoint = null;
    evacTimer = 0; evacTotal = 0; _evacWarned = false; updateEvacUI(true);
    
    updateHpUI(); 
    updateStyleRank(); 
    
    if(vehicleHpWrap) vehicleHpWrap.style.display = 'none';
    if(dashStatus) { dashStatus.className = 'status-line dash-ready'; dashStatus.innerText = 'DASH: READY'; }
    if(altStatus) { altStatus.className = 'status-line alt-ready'; altStatus.innerText = 'ALT: READY'; }
    const pulseStatusInit = document.getElementById('pulse-status');
    if (pulseStatusInit) { pulseStatusInit.className = 'status-line pulse-ready'; pulseStatusInit.innerText = 'PULSE: READY (Q)'; }
    const parryStatusInit = document.getElementById('parry-status');
    if (parryStatusInit) { parryStatusInit.className = 'status-line parry-ready'; parryStatusInit.innerText = 'PARRY: READY (SPACE)'; }
    _p2TargetOn = null;
    if (p2TargetStatus) { p2TargetStatus.className = 'status-line'; p2TargetStatus.innerText = 'ЦЕЛЬ: НЕТ'; }
    if (p2ParryStatus) { p2ParryStatus.className = 'status-line parry-ready'; p2ParryStatus.innerText = 'PARRY: READY (RCTRL)'; }
    if (p2PulseStatus) { p2PulseStatus.className = 'status-line pulse-ready'; p2PulseStatus.innerText = 'PULSE: READY (.)'; }
    _repairOn = null;
    if (p2RepairStatus) { p2RepairStatus.className = 'status-line repair-idle'; p2RepairStatus.innerText = 'РЕМОНТ: ОЖИДАНИЕ'; }
    if (p1RoleLabel) p1RoleLabel.innerText = coopMode ? 'P1 · ШТУРМ' : 'P1';
    // Пульс в ко-опе принадлежит технику, у штурма карточка убирается
    if (pulseStatusInit) pulseStatusInit.style.display = coopMode ? 'none' : 'block';

    initMobileControls();
    spawnQuest();
    resetChain();
    updateCriticalState();
    
    for (let i = 0; i < 4; i++) {
        enemies.push({ 
            x: player.x + (Math.random() - 0.5) * 800, 
            y: player.y + (Math.random() - 0.5) * 800, 
            type: 'neon', hp: 2, speed: 3.5, size: 40, color: '#00f0ff', 
            angle: 0, turretAngle: 0, rotorAngle: 0, fireTimer: 2000 
        });
    }
}

// Добровольный выход. Отличается от смерти всем, что игрок видит: карман
// не сгорает (он уже в кошельке), забег помечен успешным и попадает в таблицу
// со своей меткой. Ради этого и стоит уходить вовремя.
let runEscaped = false;
function finishRunEscaped() {
    if (gameState !== 'playing') return;
    endSeededRun();
    runEscaped = true;
    gameState = 'gameover';
    document.body.classList.remove('is-critical');
    cancelQuestRespawn();
    resetInputState();
    if (currentBGM) { currentBGM.pause(); currentBGM.currentTime = 0; currentBGM = null; }
    playSFX(sfxAchievement, 0.9);
    const banked = bankCredits();
    const isNewBest = recordRunEnd(score, true);
    recordDepthRun(score, true);
    renderGameOverStats(isNewBest, 0, banked);
}

// Последний босс повержен. Раньше отсюда стартовала катсцена, и забег
// не закрывался вообще: кредиты на кону сгорали, результат не попадал
// ни в таблицу, ни в статистику глубины, а подменённый сидом Math.random
// оставался подменённым до следующей смерти. Победа идёт тем же путём,
// что и уход через эвакуацию, — с той разницей, что показывает свой экран.
function triggerVictory() {
    if (gameState !== 'playing') return;
    endSeededRun();
    runEscaped = true;
    gameState = 'gameover';
    document.body.classList.remove('is-critical');
    cancelQuestRespawn();
    resetInputState();
    if (currentBGM) { currentBGM.pause(); currentBGM.currentTime = 0; currentBGM = null; }
    playBGM(bgmFinale);
    playSFX(sfxAchievement, 0.9);
    const banked = bankCredits();
    const isNewBest = recordRunEnd(score, true);
    recordDepthRun(score, true);
    dailyEvent('run', 1);
    renderWinScreen(banked, isNewBest);
}

function triggerGameOver() { 
    endSeededRun();
    runEscaped = false;
    gameState = 'gameover'; 
    document.body.classList.remove('is-critical');
    cancelQuestRespawn();
    resetInputState();
    // Без обнуления playBGM(bgmFight) на рестарте видит тот же трек и
    // продолжает его с середины вместо старта.
    if (currentBGM) { currentBGM.pause(); currentBGM.currentTime = 0; currentBGM = null; }
    playSFX(sfxLose, 0.8);
    const lost = runCredits;
    runCredits = 0; updateCreditsUI();
    dailyEvent('run', 1);
    const isNewBest = recordRunEnd(score);
    recordDepthRun(score, false);
    renderGameOverStats(isNewBest, lost);
}
