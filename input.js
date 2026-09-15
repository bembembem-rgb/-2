function initMobileControls() {
    if (!isMobile) return;
    const joyCont = document.getElementById('joystick-container');
    if (joyCont) joyCont.style.display = 'block';
    // Класс на <body>, а не медиазапрос: узкое окно на ноутбуке — это всё ещё
    // клавиатура, и прятать по ширине строки про клавиши там было бы неверно.
    document.body.classList.add('is-mobile');
}

// Alt-Tab не шлёт keyup: без сброса зажатая клавиша остаётся нажатой навсегда.
function resetInputState() {
    for (const k in keys) keys[k] = false;
    isShooting = false;
    leftJoy.active = false; leftJoy.dx = 0; leftJoy.dy = 0; leftJoy.touchId = null; leftJoy.moved = 0;
    rightJoy.active = false; rightJoy.dx = 0; rightJoy.dy = 0; rightJoy.touchId = null; rightJoy.moved = 0;
}

function interactPlayer2() {
    if (!player2 || player2.downed) return;
    if (!player2.inVehicle) {
        let closest = null, minDist = 80;
        for (let v of transports) { if (v === player.currentVehicle) continue; let d = Math.hypot(player2.x - v.x, player2.y - v.y); if (d < minDist) { minDist = d; closest = v; } }
        if (closest) {
            player2.inVehicle = true; player2.currentVehicle = closest; spawnParticles(player2.x, player2.y, '#1e6bff', 10);
            updateVehicleHpUI();
            if (closest === questVehicle && questState === 'seeking') { questState = 'heat'; generateExtraction(); shakeTime = 300; }
        }
    } else if (player2.currentVehicle) {
        player2.x = player2.currentVehicle.x - 50; player2.y = player2.currentVehicle.y; player2.inVehicle = false; player2.currentVehicle = null; player2.iFrames = 500;
        updateVehicleHpUI();
    }
}

function dashPlayer2(dirX, dirY) {
    if (!player2 || player2.downed || player2.inVehicle || player2.dashCooldown > 0) return;
    player2.isDashing = true; player2.dashTimer = 200; player2.dashCooldown = player2.dashCooldownTime || 2000; player2.iFrames = 200;
    playSFX(sfxDash, 0.45, 0, 0.06);
    dailyEvent('dash', 1);
    let dx = dirX || 0, dy = dirY || 0;
    if (dx === 0 && dy === 0) { if (keys.ArrowUp) dy -= 1; if (keys.ArrowDown) dy += 1; if (keys.ArrowLeft) dx -= 1; if (keys.ArrowRight) dx += 1; }
    if (dx === 0 && dy === 0) { dx = Math.cos(player2.directionOffset === 4 ? Math.PI : 0); dy = 0; }
    else { const len = Math.hypot(dx, dy); dx /= len; dy /= len; }
    player2.vx = dx * player2.dashSpeed; player2.vy = dy * player2.dashSpeed; spawnBubbles(player2.x, player2.y, 15);
    spawnSpriteFX(fxDashTrail, player2.x, player2.y, { size: 150, frameInterval: 38, alpha: 0.9, angle: Math.atan2(dy, dx) });
    artOnDash(player2.x, player2.y);
}

let p2PrevButtons = [];

let player1InputMode = 'keyboard'; // 'keyboard' | индекс геймпада
let p1GamepadAimAngle = null, p1GamepadShooting = false, p1AimLockedEnemy = null;
let p1PrevButtons = [];

function splitScreenActive() { return coopMode && player2; }

function getPlayer1Gamepad() {
    if (!navigator.getGamepads || player1InputMode === 'keyboard') return null;
    // Страховка: если тот же геймпад назначен и P2, отдаём его второму игроку,
    // иначе один стик двигал бы обоих персонажей одновременно.
    if (coopMode && player2InputMode === player1InputMode) return null;
    const pads = navigator.getGamepads();
    const gp = pads[player1InputMode];
    return (gp && gp.connected) ? gp : null;
}

function getP1AimAngle() {
    if (p1GamepadAimAngle !== null) return p1GamepadAimAngle;
    if (isMobile && rightJoy.active) return Math.atan2(rightJoy.dy, rightJoy.dx);
    return Math.atan2(mouse.worldY - player.y, mouse.worldX - player.x);
}

// У P2 нет мыши — прицел автоматический, по ближайшему врагу (как и обычный огонь).
function getP2AimAngle() {
    if (!player2) return 0;
    let closest = null, minDist = 750;
    for (const e of enemies) { const d = Math.hypot(e.x - player2.x, e.y - player2.y); if (d < minDist) { minDist = d; closest = e; } }
    if (closest) return Math.atan2(closest.y - player2.y, closest.x - player2.x);
    // Нет врагов рядом — стреляем в сторону, куда смотрит персонаж
    const dirAngles = { 0: Math.PI / 2, 4: Math.PI, 8: 0, 12: -Math.PI / 2 };
    return dirAngles[player2.directionOffset] || 0;
}

// Раскладка способностей на геймпаде (Xbox-style индексы, подходит любому
// standard-mapping контроллеру): грани — способности, курки — движение/огонь.
//   Левый стик — движение     Правый стик — прицел (с магнитным прилипанием)
//   RT (7) — огонь            A (0) — рывок
//   LB (4) — взаимодействие   X (2) — смена оружия
//   B (1) — парирование       Y (3) — импульсная атака
let p1AiIntent = '', p1AiIntentTimer = 0;

// Раскладки кнопок по модели устройства — у разных геймпадов/джойстиков
// физические кнопки лежат под разными индексами в Gamepad API.
const GAMEPAD_BUTTON_PROFILES = [
    // Xbox-совместимые (стандартный маппинг): A=0 rывок, B=1 парирование, X=2 смена оружия, Y=3 импульс, LB=4 транспорт, RT=7 огонь
    { match: /xbox|xinput|045e|xbox 360|xbox one/i, dash: 0, parry: 1, swap: 2, pulse: 3, interact: 4, fire: 7 },
    // PlayStation-совместимые (Cross=0 рывок, Circle=1 парирование, Square=2 смена, Triangle=3 импульс, L1=4 транспорт, R2=7 огонь)
    { match: /054c|dualshock|dualsense|wireless controller|playstation/i, dash: 0, parry: 1, swap: 2, pulse: 3, interact: 4, fire: 7 },
];
function getGamepadButtonProfile(gp) {
    for (const p of GAMEPAD_BUTTON_PROFILES) if (p.match.test(gp.id)) return p;
    // Неизвестное устройство (старые джойстики вроде Saitek и т.п.) — разумный дефолт:
    // первые пять кнопок по порядку. Если раскладка окажется неудобной, номера кнопок
    // можно увидеть в панели устройств (там показывается последняя нажатая кнопка).
    return { dash: 0, parry: 1, swap: 2, pulse: 3, interact: 4, fire: 7 };
}
let lastGamepadButtonIndex = -1; // для диагностики в панели устройств

// Кнопка геймпада эмулирует нажатие клавиши. Обязательно шлём и keyup —
// иначе клавиша навсегда остаётся "зажатой" в объекте keys.
function tapKey(code) {
    window.dispatchEvent(new KeyboardEvent('keydown', { code }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code }));
}

// Источник захвата для P1 с геймпадом: хранит цель и момент её смены,
// как и остальные автоприцельные стрелки.
let p1Lock = { lockedEnemy: null, lockAt: 0 };

let bigMapOpen = false, mapBtnPrev = false;
// R1 / RB (кнопка 5) на ЛЮБОМ подключённом геймпаде открывает и закрывает большую карту
function updateMapToggle() {
    if (!navigator.getGamepads) return;
    let pressed = false;
    for (const gp of navigator.getGamepads()) {
        if (gp && gp.connected && gp.buttons[5] && gp.buttons[5].pressed) { pressed = true; break; }
    }
    if (pressed && !mapBtnPrev) bigMapOpen = !bigMapOpen;
    mapBtnPrev = pressed;
}

function updateP1Gamepad(dt) {
    p1GamepadAimAngle = null; p1GamepadShooting = false;
    const gp = getPlayer1Gamepad();
    if (!gp) { p1AimLockedEnemy = null; p1AiIntent = ''; return; }
    if (player.downed) { p1AiIntent = ''; return; }

    if (p1AiIntentTimer > 0) p1AiIntentTimer -= dt;

    // Прицел и огонь — автоматические (у большинства геймпадов/джойстиков нет
    // удобного способа вручную прицелиться без мыши), кнопки — под способности.
    const closest = acquireTarget(p1Lock, player.x, player.y, 750);
    if (closest) {
        p1GamepadAimAngle = Math.atan2(closest.y - player.y, closest.x - player.x);
        p1AimLockedEnemy = closest;
        p1GamepadShooting = true;
        if (p1AiIntentTimer <= 0) p1AiIntent = 'АТАКУЕТ';
    } else {
        p1AimLockedEnemy = null;
        if (p1AiIntentTimer <= 0) p1AiIntent = 'СПОКОЙНО';
    }

    const profile = getGamepadButtonProfile(gp);
    const btnDown = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
    const pressedIdx = gp.buttons.findIndex(b => b.pressed);
    if (pressedIdx >= 0) lastGamepadButtonIndex = pressedIdx;

    if (btnDown(profile.dash) && !p1PrevButtons[profile.dash] && player.dashCooldown <= 0) {
        tapKey('ShiftLeft');
        p1AiIntent = 'РЫВОК!'; p1AiIntentTimer = 500;
    }
    if (btnDown(profile.parry) && !p1PrevButtons[profile.parry] && player.parryReady) {
        tapKey('Space');
        p1AiIntent = 'ПАРИРОВАНИЕ!'; p1AiIntentTimer = 700;
    }
    if (btnDown(profile.swap) && !p1PrevButtons[profile.swap]) {
        tapKey('KeyF');
        p1AiIntent = 'СМЕНА ОРУЖИЯ'; p1AiIntentTimer = 500;
    }
    if (btnDown(profile.pulse) && !p1PrevButtons[profile.pulse] && player.pulseReady) {
        tapKey('KeyQ');
        p1AiIntent = 'ИМПУЛЬС!'; p1AiIntentTimer = 800;
    }
    if (btnDown(profile.interact) && !p1PrevButtons[profile.interact]) {
        tapKey('KeyE');
        p1AiIntent = player.inVehicle ? 'ВЫХОД ИЗ ТРАНСПОРТА' : 'ТРАНСПОРТ'; p1AiIntentTimer = 700;
    }
    for (let i = 0; i < gp.buttons.length; i++) p1PrevButtons[i] = btnDown(i);
}

function getPlayer2Gamepad() {
    if (!navigator.getGamepads || player2InputMode === 'keyboard') return null;
    const pads = navigator.getGamepads();
    const gp = pads[player2InputMode];
    return (gp && gp.connected) ? gp : null;
}
