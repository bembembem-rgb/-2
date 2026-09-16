let _prevCreditsUI = null;
function updateCreditsUI() {
    const el = document.getElementById('credits');
    if (!el) return;
    el.innerHTML = `<span class="stake-label">НА КОНУ</span> ${runCredits.toString().padStart(4, '0')} CR`;
    el.classList.toggle('empty', runCredits === 0);
    if (_prevCreditsUI !== null && runCredits > _prevCreditsUI) pulseEl(el, 'bump');
    _prevCreditsUI = runCredits;
}

// Ядра видно всегда: это единственная шкала, которая не обнулится смертью,
// и именно её игрок проверяет, решая, стоил ли забег чего-нибудь.
let _prevCoresUI = null;
function updateCoresUI() {
    if (!coresDisplay) return;
    const total = saveData.cores || 0;
    coresDisplay.innerHTML = `ЯДРА ${total} <span class="core-gain">+${runCores}</span>`;
    if (_prevCoresUI !== null && total > _prevCoresUI) pulseEl(coresDisplay, 'bump');
    _prevCoresUI = total;
}

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ И ЭФФЕКТЫ ---
let _prevHpUI = null;

function updateHpUI() {
    if (!hpContainer || !player) return;
    hpContainer.innerHTML = '';
    for (let i = 0; i < player.hp; i++) {
        const sq = document.createElement('div');
        sq.className = 'hp-square';
        hpContainer.appendChild(sq);
    }
    if (_prevHpUI !== null && player.hp < _prevHpUI) {
        playSFX(sfxHurt, 0.6, 0, 0.05);
        flashDamage();
        spawnSpriteFX(fxPlayerHit, player.x, player.y, { size: 96, frameInterval: 34, alpha: 0.9 });
        const panel = hpContainer.parentElement;
        hpContainer.classList.remove('hp-hit');
        if (panel) panel.classList.remove('panel-hit');
        void hpContainer.offsetWidth;
        hpContainer.classList.add('hp-hit');
        if (panel) panel.classList.add('panel-hit');
    }
    _prevHpUI = player.hp;
}

function updateVehicleHpUI() { 
    if (!vehicleHpUI) return;
    // Показываем машину того, кто в ней сидит: приоритет у P1, иначе — у P2
    const v = (player && player.inVehicle && player.currentVehicle) ? player.currentVehicle
            : (player2 && player2.inVehicle && player2.currentVehicle) ? player2.currentVehicle : null;
    if (vehicleHpWrap) vehicleHpWrap.style.display = v ? 'block' : 'none';
    if (!v) return;
    const percent = Math.max(0, Math.round((v.hp / v.maxHp) * 100)); 
    vehicleHpUI.innerText = `${v.type.toUpperCase()} HP: ${percent}%${v === (player2 && player2.currentVehicle) && !(player && player.inVehicle) ? ' [P2]' : ''}`; 
    vehicleHpUI.style.color = percent > 30 ? 'var(--amber)' : 'var(--red)';
    if (vehicleHpBar) { vehicleHpBar.style.width = percent + '%'; vehicleHpBar.classList.toggle('low', percent <= 30); }
}

let _prevScoreUI = null, _prevRankUI = null, _prevZoneUI = null;
function pulseEl(el, cls) {
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
}
function updateStyleRank() {
    if (scoreDisplay) {
        scoreDisplay.innerText = `SCORE: ${score.toString().padStart(4, '0')}`;
        if (_prevScoreUI !== null && score > _prevScoreUI) pulseEl(scoreDisplay, 'bump');
        _prevScoreUI = score;
    }
    let rank = 'D', rankClass = 'rank-d';

    if (score >= 2000) { rank = 'P'; rankClass = 'rank-p'; unlockAchievement('rank_p'); }
    else if (score >= 1000) { rank = 'S'; rankClass = 'rank-s'; }
    else if (score >= 600) { rank = 'A'; rankClass = 'rank-a'; }
    else if (score >= 300) { rank = 'B'; rankClass = 'rank-b'; }
    else if (score >= 100) { rank = 'C'; rankClass = 'rank-c'; }
    
    if (rankDisplay) {
        rankDisplay.innerText = rank;
        rankDisplay.className = rankClass;
        if (_prevRankUI !== null && _prevRankUI !== rank) pulseEl(rankDisplay, 'bump');
        _prevRankUI = rank;
    }
    // Цвет ранга несёт ранг; счёт остаётся максимально читаемым белым.
    
    updateLevelHud();
    const dEl = document.getElementById('depth-display');
    if (dEl) dEl.innerText = `ГЛУБИНА ${runDepth} · ${DEPTH_NAMES[runDepth]}`;
    if (score >= 5000) unlockAchievement('survivor_5000');

    if (zoneDisplay) {
        if (score >= 9000) { zoneDisplay.innerText = "ZONE: BLOOD OCEAN"; zoneDisplay.style.color = "var(--red)"; }
        else if (score >= 6000) { zoneDisplay.innerText = "ZONE: BOILING TIDES"; zoneDisplay.style.color = "var(--amber)"; }
        else if (score >= 3000) { zoneDisplay.innerText = "ZONE: ABYSSAL DEPTHS"; zoneDisplay.style.color = "var(--blue)"; }
        else { zoneDisplay.innerText = "ZONE: SHALLOW WATERS"; zoneDisplay.style.color = "var(--cyan)"; }
        if (_prevZoneUI !== null && _prevZoneUI !== zoneDisplay.innerText) pulseEl(zoneDisplay, 'bump');
        _prevZoneUI = zoneDisplay.innerText;
    }
}

function setCdBar(el, ratio) {
    if (!el) return;
    const v = Math.max(0, Math.min(1, ratio || 0));
    el.style.setProperty('--cd', (v * 100) + '%');
}

// HUD принадлежит забегу. Вне его панели висели поверх меню и магазина
// и показывали пустые строки: заполнить их нечем, игрока нет.
let _runUiShown = null;
function updateHudVisibility() {
    const on = gameState === 'playing' || gameState === 'paused';
    if (on === _runUiShown) return;
    _runUiShown = on;
    document.body.classList.toggle('in-run', on);
}

// Одна функция на строку способности: и текст, и класс, и полоса. Раньше
// текст писался в четырёх местах update.js, а полоса — здесь, и строка
// «COOLDOWN» при этом не говорила главного: сколько ещё ждать.
function setAbility(el, label, hint, remain, total, ready) {
    if (!el) return;
    const key = label.toLowerCase();
    if (ready) {
        el.className = `status-line ${key}-ready`;
        el.innerText = hint ? `${label}: READY ${hint}` : `${label}: READY`;
        setCdBar(el, 0);
    } else {
        el.className = `status-line ${key}-cooldown`;
        // Десятые, а не целые секунды: у рывка вся перезарядка две секунды,
        // и целые превращают отсчёт в три состояния вместо шкалы.
        el.innerText = `${label}: ${(Math.max(0, remain) / 1000).toFixed(1)}`;
        setCdBar(el, remain / (total || 1));
    }
}

// Роли видно только в ко-опе: в соло P1 универсал, сообщать нечего.
// Заодно прячем строку импульса у P1 — в ко-опе он отдан технику,
// а неактивная строка в HUD читается как поломка.
let _roleShown = null;
function updateRoleLabel() {
    const on = coopMode && !!player2;
    if (on === _roleShown) return;
    _roleShown = on;
    if (p1RoleLabel) {
        p1RoleLabel.style.display = on ? 'block' : 'none';
        p1RoleLabel.innerText = on ? 'P1 · ШТУРМ' : '';
    }
    const p1Pulse = document.getElementById('pulse-status');
    if (p1Pulse) p1Pulse.style.display = on ? 'none' : 'block';
}

// Техник стреляет сам, и без этой строки непонятно, почему он молчит:
// цели в радиусе просто нет.
let _p2TargetOn = null;
function updateP2TargetLine() {
    if (!p2TargetStatus) return;
    const on = !!(player2 && player2.lockedEnemy);
    if (on === _p2TargetOn) return;
    _p2TargetOn = on;
    p2TargetStatus.innerText = on ? 'ЦЕЛЬ: В ПРИЦЕЛЕ' : 'ЦЕЛЬ: ПУСТО';
    p2TargetStatus.className = on ? 'status-line target-locked' : 'status-line';
}

// Лишние заряды видно в подсказке строки: без числа READY не отличается
// от READY с двумя зарядами в запасе.
function pulseHint(h, key) {
    return h.pulseCharges > 0 ? `${key ? key + ' ' : ''}x${h.pulseCharges + 1}` : key;
}

// Контекстная кнопка: на телефоне место дороже золота, и кнопка, которой
// нечего делать, съедает его просто так.
let _interactShown = null;
// Строка жестов живёт первые секунды забега и гаснет: текст, который висит
// поверх боя весь забег, перестают читать уже на второй минуте.
let touchHintUntil = 0;
const TOUCH_HINT_MS = 14000;
function updateTouchHint() {
    if (!touchHintUntil || performance.now() < touchHintUntil) return;
    touchHintUntil = 0;
    document.body.classList.add('hint-done');
}

function updateTouchButtons() {
    if (!isMobile) return;
    updateTouchHint();
    const btn = document.getElementById('btn-interact');
    if (!btn) return;
    const on = !!nearVehicleNow;
    if (on === _interactShown) return;
    _interactShown = on;
    btn.style.display = on ? 'flex' : 'none';
    btn.innerText = (player && player.inVehicle) ? 'ВЫЙТИ' : 'ВХОД';
}

function updateCooldownBars() {
    updateTouchButtons();
    updateRoleLabel();
    if (!player) return;
    // Клавиша, которой нет на экране, не существует: на телефоне подписи
    // называют жест, а не кнопку клавиатуры.
    setAbility(dashStatus, 'DASH', isMobile ? '(2 ТАПА)' : '', player.dashCooldown, player.dashCooldownTime || 2000, player.dashCooldown <= 0);
    setAbility(altStatus, 'ALT', '', player.altTimer, player.altCooldownTime, player.altReady);
    setAbility(document.getElementById('pulse-status'), 'PULSE', pulseHint(player, isMobile ? '' : '(Q)'), player.pulseTimer, player.pulseCooldownTime, player.pulseReady);
    setAbility(document.getElementById('parry-status'), 'PARRY', isMobile ? '(2 ТАПА)' : '(SPACE)', player.parryTimer, player.parryCooldownTime, player.parryReady);
    if (coopMode && player2) {
        updateP2TargetLine();
        setAbility(p2DashStatus, 'DASH', '', player2.dashCooldown, player2.dashCooldownTime || 2000, player2.dashCooldown <= 0);
        setAbility(p2PulseStatus, 'PULSE', pulseHint(player2, '(.)'), player2.pulseTimer, player2.pulseCooldownTime, player2.pulseReady);
        setAbility(p2ParryStatus, 'PARRY', '(RCTRL)', player2.parryTimer, player2.parryCooldownTime, player2.parryReady);
    }
}
