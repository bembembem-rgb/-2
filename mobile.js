// --- СЕНСОРНОЕ УПРАВЛЕНИЕ ---
// Отдельный модуль поверх жестов main.js: стики остаются (лево — ход,
// право — прицел и огонь), а способности получают большие кнопки под
// правым большим пальцем, дугой вокруг угла экрана — как в мобильных
// шутерах. Двойные тапы работают по-прежнему, кнопки их не отменяют.
// Кнопки рисуются своим CSS, чтобы не зависеть от style.css. Шрифт — JetBrains Mono:
// в Press Start 2P нет кириллицы, русские подписи падали бы в системный моноширинный.
(function () {
    const touch = (typeof isMobile !== 'undefined' && isMobile)
        || ('ontouchstart' in window && window.matchMedia && matchMedia('(pointer: coarse)').matches);
    if (!touch) return;

    const css = `
    #mc-layer { position:fixed; inset:0; pointer-events:none; z-index:250; display:none;
        font-family:"JetBrains Mono", monospace; font-weight:700; -webkit-user-select:none; user-select:none; }
    #mc-layer .mc-btn { position:absolute; pointer-events:auto; border-radius:50%;
        display:flex; align-items:center; justify-content:center; text-align:center;
        color:#fff; font-size:11px; line-height:1.2; letter-spacing:.02em;
        background:rgba(8,10,24,.55); border:2px solid var(--c); box-shadow:0 0 12px var(--c), inset 0 0 10px rgba(0,0,0,.6);
        text-shadow:0 0 6px var(--c); touch-action:none; -webkit-tap-highlight-color:transparent; overflow:hidden; }
    #mc-layer .mc-btn::before { content:""; position:absolute; inset:0; border-radius:50%;
        background:conic-gradient(rgba(0,0,0,.72) calc(var(--cd,0) * 360deg), transparent 0); }
    #mc-layer .mc-btn span { position:relative; pointer-events:none; }
    #mc-layer .mc-btn.ready { animation:mc-ready .35s ease-out; }
    #mc-layer .mc-btn.down { transform:scale(.9); background:var(--c); color:#000; text-shadow:none; }
    #mc-layer .mc-btn.off { opacity:.45; }
    #mc-layer .mc-small { font-size:10px; border-radius:10px; }
    @keyframes mc-ready { 0% { box-shadow:0 0 32px var(--c), 0 0 0 6px var(--c); } 100% { box-shadow:0 0 12px var(--c); } }
    #mc-rotate { position:fixed; inset:0; z-index:900; display:none; background:#05060f;
        color:#00e0ff; font-family:"JetBrains Mono", monospace; font-weight:700; font-size:16px; line-height:2;
        align-items:center; justify-content:center; text-align:center; padding:24px; }
    @media (orientation: portrait) { body.in-run #mc-rotate { display:flex; } }
    body.is-mobile #touch-pad { display:none !important; }
    `;
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

    const layer = document.createElement('div'); layer.id = 'mc-layer';
    document.body.appendChild(layer);
    const rot = document.createElement('div'); rot.id = 'mc-rotate';
    rot.innerHTML = 'ПОВЕРНИ ТЕЛЕФОН<br>ГОРИЗОНТАЛЬНО ↻';
    document.body.appendChild(rot);

    // Раскладка: правый нижний угол — главные кнопки, дугой; верх по центру — служебные.
    // Размеры и отступы в px от правого/нижнего края; safe-area добавляется к отступам.
    const BTN = [
        { id: 'parry',  label: 'ЩИТ',    c: '#ff2d55', r: 18,  b: 18,  s: 86 },
        { id: 'dash',   label: 'РЫВОК',  c: '#00e0ff', r: 118, b: 14,  s: 70 },
        { id: 'alt',    label: 'АЛЬТ',   c: '#f0c419', r: 102, b: 100, s: 60 },
        { id: 'pulse',  label: 'ИМП',    c: '#c46dff', r: 18,  b: 118, s: 62 },
        { id: 'swap',   label: 'СТВОЛ',  c: '#ffa51f', r: 188, b: 86,  s: 50 },
        { id: 'use',    label: 'ВХОД',   c: '#3fdd4a', r: 176, b: 160, s: 64 },
    ];
    const TOP = [
        { id: 'pause', label: 'II',   c: '#00e0ff', x: -64 },
        { id: 'map',   label: 'КАРТА', c: '#00e0ff', x: 0 },
        { id: 'auto',  label: 'АВТО', c: '#3fdd4a', x: 64 },
    ];
    const el = {};
    for (const d of BTN) {
        const b = document.createElement('div');
        b.className = 'mc-btn'; b.id = 'btn-mc-' + d.id;
        b.style.cssText = `--c:${d.c}; width:${d.s}px; height:${d.s}px;
            right:calc(${d.r}px + env(safe-area-inset-right)); bottom:calc(${d.b}px + env(safe-area-inset-bottom));`;
        b.innerHTML = `<span>${d.label}</span>`;
        layer.appendChild(b); el[d.id] = b;
    }
    for (const d of TOP) {
        const b = document.createElement('div');
        b.className = 'mc-btn mc-small'; b.id = 'btn-mc-' + d.id;
        b.style.cssText = `--c:${d.c}; width:56px; height:30px; top:calc(8px + env(safe-area-inset-top)); left:calc(50% + ${d.x}px - 28px);`;
        b.innerHTML = `<span>${d.label}</span>`;
        layer.appendChild(b); el[d.id] = b;
    }
    el.use.style.display = 'none';

    let autoFire = true;
    try { autoFire = localStorage.getItem('ntz_autofire') !== '0'; } catch (e) {}

    let lastAim = null;   // последнее направление правого стика — для альт-атаки
    const alive = () => typeof player !== 'undefined' && player && !player.downed;
    const buzz = () => { try { navigator.vibrate && navigator.vibrate(12); } catch (e) {} };

    function facingAngle() {
        const m = { 0: Math.PI / 2, 4: Math.PI, 8: 0, 12: -Math.PI / 2 };
        return m[player.directionOffset] || 0;
    }

    const ACT = {
        parry: () => tapKey('Space'),
        dash:  () => tapKey('ShiftLeft'),
        pulse: () => tapKey('KeyQ'),
        swap:  () => tapKey('KeyF'),
        use:   () => tapKey('KeyE'),
        alt:   () => {
            if (!alive() || player.inVehicle || !player.altReady || typeof executeAltAttack !== 'function') return;
            const t = nearestEnemy(700);
            const a = rightJoy.active && (rightJoy.dx || rightJoy.dy) ? Math.atan2(rightJoy.dy, rightJoy.dx)
                : t ? Math.atan2(t.y - player.y, t.x - player.x) : (lastAim ?? facingAngle());
            executeAltAttack(player, a);
        },
        pause: () => { if (typeof pauseGame === 'function') pauseGame(); },
        map:   () => { if (typeof bigMapOpen !== 'undefined') bigMapOpen = !bigMapOpen; },
        auto:  () => {
            autoFire = !autoFire;
            try { localStorage.setItem('ntz_autofire', autoFire ? '1' : '0'); } catch (e) {}
            if (!autoFire && !rightJoy.active) isShooting = false;
        },
    };

    // Пауза срабатывает на отпускании: удержание 0.7 с открывает консоль команд
    let holdTimer = null, held = false;
    for (const id in el) {
        const b = el[id];
        // stopPropagation: касание кнопки не должно запускать стик в main.js
        b.addEventListener('touchstart', (e) => {
            e.preventDefault(); e.stopPropagation();
            if (gameState !== 'playing') return;
            b.classList.add('down'); buzz();
            if (id === 'pause') {
                held = false;
                holdTimer = setTimeout(() => { held = true; buzz(); window.openCommandConsole && window.openCommandConsole(); }, 700);
                return;
            }
            try { ACT[id](); } catch (err) { console.warn('mobile btn', id, err); }
        }, { passive: false });
        const up = (e) => {
            e.preventDefault(); e.stopPropagation(); b.classList.remove('down');
            if (id === 'pause' && holdTimer) { clearTimeout(holdTimer); holdTimer = null; if (!held && e.type === 'touchend') ACT.pause(); }
        };
        b.addEventListener('touchend', up, { passive: false });
        b.addEventListener('touchcancel', up, { passive: false });
    }

    function nearestEnemy(range) {
        if (typeof enemies === 'undefined' || !alive()) return null;
        let best = null, bd = range;
        for (const e of enemies) {
            if (!e || e.hp <= 0) continue;
            const d = Math.hypot(e.x - player.x, e.y - player.y);
            if (d < bd) { bd = d; best = e; }
        }
        return best;
    }

    // Кольцо перезарядки: доля оставшегося времени. total запоминаем в момент
    // ухода на перезарядку — так не нужно знать имя поля с полным временем.
    const cd = { dash: 0, parry: 0, pulse: 0, alt: 0 }, wasReady = {};
    function cooldowns() {
        const p = player;
        const rows = {
            dash:  [p.dashCooldown <= 0, p.dashCooldown, p.dashCooldownTime],
            parry: [!!p.parryReady, p.parryTimer, p.parryCooldownTime],
            pulse: [!!p.pulseReady, p.pulseTimer, p.pulseCooldownTime],
            alt:   [!!p.altReady, p.altTimer, p.altCooldownTime],
        };
        for (const k in rows) {
            const [ready, remain, total] = rows[k];
            if (!ready && remain > (cd[k] || 0)) cd[k] = remain;
            const frac = ready ? 0 : Math.max(0, Math.min(1, (remain || 0) / (total || cd[k] || 1)));
            el[k].style.setProperty('--cd', frac.toFixed(3));
            if (ready && wasReady[k] === false) {
                el[k].classList.remove('ready'); void el[k].offsetWidth; el[k].classList.add('ready');
                cd[k] = 0;
            }
            wasReady[k] = ready;
        }
    }

    function frame() {
        const playing = typeof gameState !== 'undefined' && gameState === 'playing';
        layer.style.display = playing ? 'block' : 'none';
        if (playing && alive()) {
            cooldowns();
            if (rightJoy.active && (rightJoy.dx || rightJoy.dy)) lastAim = Math.atan2(rightJoy.dy, rightJoy.dx);
            // Кнопка входа появляется там же, где её показывает игра
            const old = document.getElementById('btn-interact');
            el.use.style.display = old && old.style.display !== 'none' ? 'flex' : 'none';
            el.auto.classList.toggle('off', !autoFire);
            // Автоогонь: пока палец не на правом стике, стреляем по ближайшей цели
            if (!rightJoy.active) {
                const t = autoFire ? nearestEnemy(650) : null;
                if (t && typeof mouse !== 'undefined') {
                    mouse.worldX = t.x; mouse.worldY = t.y; isShooting = true;
                } else if (autoFire) isShooting = false;
            }
        }
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
})();
