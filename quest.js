let questState = 'none', questVehicle = null, extractionPoint = null;
// Отложенный респавн квеста. Считается игровым временем, а не setTimeout:
// на setTimeout колбэк приходил по реальным часам и требовал
// gameState === 'playing'. Пауза, а с появлением экрана уровня — и он,
// съедали респавн молча, и транспорт на карте не появлялся уже никогда.
// Игровой таймер такого состояния просто не видит: он не тикает, пока
// забег стоит, и досчитывает, когда тот продолжается.
let questRespawnTimer = 0;
function scheduleQuestRespawn(delay = 3000) { questRespawnTimer = delay; }
function cancelQuestRespawn() { questRespawnTimer = 0; }
function updateQuestRespawn(dt) {
    if (questRespawnTimer <= 0) return;
    questRespawnTimer -= dt;
    if (questRespawnTimer <= 0) {
        questRespawnTimer = 0;
        if (player) spawnQuest();
    }
}
// Зона аванпоста: внутри неё процедурные блоки не спавнятся, иначе они
// вырастают прямо в воротах и запирают транспорт.
let questOutpost = null;
// Глубокий шлюз: альтернативная точка сдачи. Ставится вместе с аванпостом,
// в противоположной от него стороне, поэтому это выбор маршрута, а не крюк.
let deepVault = null;

function spawnQuest() {
    customObstacles = customObstacles.filter(o => o.isGeyser); 
    let angle = Math.random() * Math.PI * 2;
    let dist = 1500 + Math.random() * 1000;
    let ox = player.x + Math.cos(angle) * dist;
    let oy = player.y + Math.sin(angle) * dist;
    const wallThick = 40, size = 600, half = size / 2, neonColor = '#00f0ff'; 
    
    customObstacles.push({x: ox - half, y: oy - half, w: size, h: wallThick, color: neonColor}); 
    customObstacles.push({x: ox - half, y: oy + half - wallThick, w: size, h: wallThick, color: neonColor}); 
    customObstacles.push({x: ox - half, y: oy - half, w: wallThick, h: size, color: neonColor}); 
    customObstacles.push({x: ox + half - wallThick, y: oy - half, w: wallThick, h: size * 0.35, color: neonColor}); 
    customObstacles.push({x: ox + half - wallThick, y: oy + half - size * 0.35, w: wallThick, h: size * 0.35, color: neonColor});
    
    // Запрещаем застройку всего аванпоста плюс полоса снаружи под выезд
    questOutpost = { x: ox, y: oy, r: half + 260 };
    spawnSpriteFX(fxDeploy, ox, oy, { size: 200, frameInterval: 52, alpha: 0.85 });
    purgeObstaclesIn(questOutpost);

    let vType = ['car', 'tank', 'heli'][Math.floor(Math.random() * 3)];
    let v = { 
        type: vType, x: ox, y: oy, angle: -Math.PI/2, 
        hp: vType === 'tank' ? 40 : vType === 'heli' ? 20 : 15, 
        maxHp: vType === 'tank' ? 40 : vType === 'heli' ? 20 : 15, 
        speed: 0, maxSpeed: vType === 'car' ? 16 : vType === 'heli' ? 12 : 5, 
        acc: vType === 'car' ? 0.5 : 0.2, friction: 0.96, turnSpeed: 0.05, 
        size: vType === 'tank' ? 90 : vType === 'heli' ? 80 : 70, 
        isQuestVehicle: true 
    };
    
    if (vType === 'tank') { v.turretAngle = -Math.PI/2; v.fireTimer = 0; } 
    if (vType === 'heli') { v.rotorAngle = 0; v.rotorSpeed = 0; v.vx = 0; v.vy = 0; v.fireTimer = 0; }
    
    spawnDeepVault(ox, oy);

    transports.push(v); 
    questVehicle = v; 
    questState = 'seeking';
    
    for (let i = 0; i < 8; i++) { 
        enemies.push({ 
            x: ox + (Math.random() - 0.5) * 300, 
            y: oy + (Math.random() - 0.5) * 300, 
            type: 'neon', hp: 2, speed: 4, size: 40, color: '#00f0ff', 
            angle: 0, turretAngle: 0, rotorAngle: 0, fireTimer: 2000 
        }); 
    }
}

// === УЙТИ ИЛИ НЫРНУТЬ ===
// До сих пор единственным выходом из забега была смерть: всё, что накопил,
// сгорало, и «ещё раз» нажимать было незачем. Добровольный выход даёт вторую
// концовку — и вместе с ней настоящее решение.
//
// Груз уже сдан, кошелёк уже пополнен. Ставка не в том, что на столе сейчас,
// а в том, что будет набрано ДО следующей сдачи: множитель растёт, спавн
// растёт вместе с ним, и чем жирнее карман, тем больнее смерть.
const DIVE_DECIDE = 10000;      // сколько висит выбор
const DIVE_STEP = 1.5;          // во сколько раз растёт множитель за «нырнуть»
const DIVE_MAX = 4;             // потолок: дальше жадность перестаёт быть выбором

let diveMult = 1;               // множитель кредитов текущего цикла
let diveChoice = 0;             // мс до истечения выбора
let diveOpen = false;           // выбор активен. Отдельный флаг, а не diveChoice > 0:
                                // по таймеру решение приходит ровно в тот момент,
                                // когда счётчик уже дотикал до нуля, и проверка
                                // «есть ли время» отбросила бы свой же вызов
let divesTaken = 0;             // сколько раз игрок остался

function resetDive() {
    diveMult = 1; diveChoice = 0; diveOpen = false; divesTaken = 0;
    updateDiveUI();
}

function offerDive() {
    diveChoice = DIVE_DECIDE;
    diveOpen = true;
    playSFX(sfxUiNav, 0.5);
    updateDiveUI();
}

// Молчание — это «остаться»: забег не должен заканчиваться от того,
// что игрок не успел прочитать карточку под огнём.
function diveStay(silent) {
    if (!diveOpen) return;
    diveOpen = false;
    diveChoice = 0;
    divesTaken++;
    diveMult = Math.min(DIVE_MAX, +(diveMult * DIVE_STEP).toFixed(2));
    if (!silent) playSFX(sfxWeapon, 0.6, 0, 0.05);
    if (player) spawnFloatText(player.x, player.y - 60, `ГЛУБЖЕ · КРЕДИТЫ x${diveMult}`, '#ff9f1c', 14, 'dive');
    updateDiveUI();
}

function diveLeave() {
    if (!diveOpen) return;
    diveOpen = false;
    diveChoice = 0;
    updateDiveUI();
    finishRunEscaped();
}

function updateDive(dt) {
    if (!diveOpen) return;
    diveChoice -= dt;
    if (diveChoice <= 0) { diveStay(true); return; }
    updateDiveUI();
}

let _diveShown = '';
function updateDiveUI() {
    const card = document.getElementById('dive-choice');
    const mult = document.getElementById('dive-mult');
    if (mult) {
        const on = diveMult > 1;
        mult.style.display = on ? 'block' : 'none';
        if (on) mult.innerHTML = `<span class="dm-x">x${diveMult}</span><span class="dm-label">КРЕДИТЫ · ГЛУБИН ${divesTaken}</span>`;
    }
    if (!card) return;
    if (diveOpen) {
        const secs = Math.max(1, Math.ceil(diveChoice / 1000));
        const key = `${secs}|${diveMult}`;
        if (key !== _diveShown) {
            _diveShown = key;
            const next = Math.min(DIVE_MAX, +(diveMult * DIVE_STEP).toFixed(2));
            card.innerHTML = `<div class="dv-head">ГРУЗ СДАН · ${secs} С НА РЕШЕНИЕ</div>`
                + `<div class="dv-row"><button class="tap-btn" onclick="diveLeave()">[V] УЙТИ</button><span class="dv-what">ЗАБЕГ ЗАСЧИТАН, КОШЕЛЁК ЦЕЛ</span></div>`
                + `<div class="dv-row"><button class="tap-btn" onclick="diveStay()">[N] НЫРНУТЬ</button><span class="dv-what">КРЕДИТЫ x${next}, НО ВРАГОВ БОЛЬШЕ</span></div>`
                + `<div class="dv-foot">МОЛЧАНИЕ — ЗНАЧИТ НЫРНУТЬ</div>`;
        }
        card.style.display = 'block';
    } else if (card.style.display !== 'none') {
        card.style.display = 'none';
        _diveShown = '';
    }
}

// === ТАЙМЕР ЭВАКУАЦИИ ===
// Окно считается от дистанции и предельной скорости конкретной машины:
// у танка ход впятеро медленнее катера, фиксированное число было бы враньём.
const EVAC_MIN = 30000, EVAC_MAX = 75000, EVAC_SLACK = 3.5;
let evacTimer = 0, evacTotal = 0;

function evacDuration(v, dist) {
    const pxPerSec = (v && v.maxSpeed ? v.maxSpeed : 10) * 60;
    return Math.max(EVAC_MIN, Math.min(EVAC_MAX, (dist / pxPerSec) * EVAC_SLACK * 1000));
}

function failExtraction() {
    if (questVehicle) questVehicle.isQuestVehicle = false;
    questState = 'none';
    clearQuestSite();
    shakeTime = Math.max(shakeTime, 500);
    showAchievementToast('ОКНО ЭВАКУАЦИИ ЗАКРЫТО');
    scheduleQuestRespawn(8000);
}

// Тикает по реальному dt и только вне катсцены — см. вызов в update().
function updateEvacTimer(dt) {
    if (questState !== 'heat' || !extractionPoint) return;
    evacTimer -= dt;
    if (evacTimer <= 0) { failExtraction(); return; }
    updateEvacUI();
}

// Панель перерисовывается не чаще раза в секунду: 60 записей в innerText
// на секунду — это инвалидация лейаута каждый кадр ради одной и той же строки.
let _evacWarned = false, _evacShown = null, _evacSec = -1;
function updateEvacUI(force = false) {
    const wrap = document.getElementById('evac-wrap');
    if (!wrap) return;
    const on = !!(questState === 'heat' && extractionPoint && evacTimer > 0);
    if (on !== _evacShown || force) {
        wrap.style.display = on ? 'block' : 'none';
        _evacShown = on;
        _evacSec = -1;
    }
    if (!on) { _evacWarned = false; return; }

    const bar = document.getElementById('evac-bar');
    if (bar) bar.style.width = Math.max(0, Math.min(100, evacTimer / evacTotal * 100)) + '%';

    const secs = Math.max(0, Math.ceil(evacTimer / 1000));
    if (secs === _evacSec) return;
    _evacSec = secs;

    const timeEl = document.getElementById('evac-time');
    if (timeEl) timeEl.innerText = `ЭВАКУАЦИЯ ${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
    const low = evacTimer <= 10000;
    wrap.classList.toggle('low', low);
    if (low && !_evacWarned) { _evacWarned = true; playSFX(sfxBossSpawn, 0.35); }
    const distEl = document.getElementById('evac-dist');
    if (distEl) {
        const from = questVehicle || player;
        const d = Math.round(Math.hypot(extractionPoint.x - from.x, extractionPoint.y - from.y));
        distEl.innerText = d > 999 ? (d / 1000).toFixed(1) + 'K М' : d + ' М';
    }
}

// Камера шлюза: коробка с одним проходом. Без «Резака» проход перекрыт
// створом — это обычное препятствие, машина в него упирается.
function spawnDeepVault(ox, oy) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 2200 + Math.random() * 1000;
    const vx = ox + Math.cos(angle) * dist, vy = oy + Math.sin(angle) * dist;
    const size = 460, half = size / 2, t = 40, gap = size * 0.34;
    const open = upLevel('breaker') > 0;
    const col = open ? '#c46dff' : '#74838c';

    customObstacles.push({ x: vx - half, y: vy - half, w: size, h: t, color: col });
    customObstacles.push({ x: vx - half, y: vy + half - t, w: size, h: t, color: col });
    customObstacles.push({ x: vx - half, y: vy - half, w: t, h: size, color: col });
    customObstacles.push({ x: vx + half - t, y: vy - half, w: t, h: (size - gap) / 2, color: col });
    customObstacles.push({ x: vx + half - t, y: vy + half - (size - gap) / 2, w: t, h: (size - gap) / 2, color: col });
    if (!open) {
        customObstacles.push({ x: vx + half - t, y: vy - gap / 2, w: t, h: gap, color: col, isGate: true });
    }

    deepVault = { x: vx, y: vy, radius: 150, sealed: !open };
    purgeObstaclesIn({ x: vx, y: vy, r: half + 200 });
}

function clearQuestSite() {
    questVehicle = null; questOutpost = null; deepVault = null;
    extractionPoint = null;
    evacTimer = 0; evacTotal = 0;
    updateEvacUI(true);
}

function generateExtraction() { 
    let angle = Math.random() * Math.PI * 2;
    let dist = 2500 + Math.random() * 1500; 
    // Отсчитываем от самой машины: за руль мог сесть и P2, который далеко от P1
    const from = questVehicle || player;
    extractionPoint = { 
        x: from.x + Math.cos(angle) * dist, 
        y: from.y + Math.sin(angle) * dist, 
        radius: 200 
    }; 
    purgeObstaclesIn({ x: extractionPoint.x, y: extractionPoint.y, r: extractionPoint.radius + 120 });
    // Размер под радиус зоны: метка должна совпасть с кругом, а не висеть рядом
    spawnSpriteFX(fxDeploy, extractionPoint.x, extractionPoint.y, { size: extractionPoint.radius * 2, frameInterval: 52, alpha: 0.8 });
    // Со вскрытым шлюзом целей две — окно считаем по дальней, иначе выбор
    // маршрута был бы выбором между «успеть» и «не успеть».
    let planDist = dist;
    if (deepVault && !deepVault.sealed) {
        planDist = Math.max(dist, Math.hypot(deepVault.x - from.x, deepVault.y - from.y));
    }
    evacTotal = evacDuration(questVehicle, planDist);
    evacTimer = evacTotal;
    _evacWarned = false;
    updateEvacUI(true);
}
