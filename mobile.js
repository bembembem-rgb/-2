// --- КНОПКИ СПОСОБНОСТЕЙ ДЛЯ ТЕЛЕФОНА ---
// Дополнение к сенсорному управлению игры, а не замена ему: стики, автоогонь,
// ряд «импульс / вход / ствол», пауза и настройки (touchsettings.js) остаются
// как есть. Сюда добавлены только рывок, щит и альт-залп — то, что раньше
// делалось лишь двойным тапом. Двойные тапы работают по-прежнему.
//
// Кнопки стоят дугой в нижнем углу со стороны прицела: там лежит большой
// палец, который и так ведёт огонь. Левша (настройка «рука») — угол слева.
// Лежат внутри #joystick-container, поэтому показываются и прячутся вместе
// с остальным сенсорным слоем, а класс touch-btn не даёт касанию запустить стик.
(function () {
    if (typeof isMobile === 'undefined' || !isMobile) return;

    const css = `
    .mc-act { position:absolute; pointer-events:auto; touch-action:none; --s:calc(var(--mc-size) * var(--hud-scale, 1)); }
    body.is-mobile .mc-act.touch-btn { width:var(--s); height:var(--s); font-size:9px; overflow:hidden; }
    .mc-act::after { content:""; position:absolute; inset:0; border-radius:50%; pointer-events:none;
        background:conic-gradient(rgba(0,0,0,.7) calc(var(--cd, 0) * 360deg), transparent 0); }
    .mc-act span { position:relative; z-index:1; pointer-events:none; }
    .mc-act.flash { animation:mcReady 320ms ease-out 1; }
    @keyframes mcReady { from { box-shadow:0 0 0 7px currentColor, 0 0 30px currentColor; } }
    body.is-mobile .mc-act.is-cold { opacity:.5; box-shadow:none; }
    .touch-btn.c-cyan { border-color:var(--cyan); color:var(--cyan); box-shadow:0 0 20px rgba(0,224,255,.35); }
    .touch-btn.c-red  { border-color:var(--red);  color:var(--red);  box-shadow:0 0 20px rgba(255,45,85,.35); }
    .touch-btn.c-gold { border-color:var(--gold); color:var(--gold); box-shadow:0 0 20px rgba(240,196,25,.35); }
    body.map-open .mc-act { opacity:0; pointer-events:none; }
    `;
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

    // Отступы от угла в px (x — от боковой кромки, y — от нижней); для левши зеркалятся.
    const BTN = [
        { id: 'parry', label: 'ЩИТ',   c: 'c-red',  size: 84, x: 18,  y: 20 },
        { id: 'dash',  label: 'РЫВОК', c: 'c-cyan', size: 68, x: 116, y: 16 },
        { id: 'alt',   label: 'АЛЬТ',  c: 'c-gold', size: 60, x: 26,  y: 118 },
    ];

    const el = {};
    const alive = () => typeof player !== 'undefined' && player && !player.downed && !player.inVehicle;
    const ACT = {
        parry: () => tapKey('Space'),
        dash:  () => tapKey('ShiftLeft'),
        alt:   () => {
            if (!alive() || !player.altReady || typeof executeAltAttack !== 'function') return;
            executeAltAttack(player, typeof getP1AimAngle === 'function' ? getP1AimAngle() : null);
        },
    };

    function place() {
        const lefty = document.body.classList.contains('lefty');
        for (const d of BTN) {
            const b = el[d.id]; if (!b) continue;
            const scaled = (v) => `calc(${v}px * var(--hud-scale, 1) + env(safe-area-inset-${lefty ? 'left' : 'right'}))`;
            b.style.left = lefty ? scaled(d.x) : 'auto';
            b.style.right = lefty ? 'auto' : scaled(d.x);
            b.style.bottom = `calc(${d.y}px * var(--hud-scale, 1) + env(safe-area-inset-bottom))`;
        }
    }

    function build() {
        const host = document.getElementById('joystick-container');
        if (!host || el.parry) return !!host;
        for (const d of BTN) {
            const b = document.createElement('div');
            b.id = 'btn-mc-' + d.id;
            b.className = `touch-btn mc-act ${d.c}`;
            b.style.setProperty('--mc-size', d.size + 'px');
            b.innerHTML = `<span>${d.label}</span>`;
            b.addEventListener('touchstart', (e) => {
                e.preventDefault(); e.stopPropagation();
                if (gameState !== 'playing') return;
                if (typeof buzz === 'function') buzz(14);
                try { ACT[d.id](); } catch (err) { console.warn('кнопка', d.id, err); }
            }, { passive: false });
            host.appendChild(b); el[d.id] = b;
        }
        place();
        // Долгое нажатие на паузу открывает консоль команд (commands.js)
        const pause = document.getElementById('btn-pause');
        if (pause) {
            let t = null;
            pause.addEventListener('touchstart', () => {
                t = setTimeout(() => { t = null; window.openCommandConsole && window.openCommandConsole(); }, 700);
            }, { passive: true });
            const cancel = () => { if (t) { clearTimeout(t); t = null; } };
            pause.addEventListener('touchend', cancel); pause.addEventListener('touchcancel', cancel);
        }
        return true;
    }

    // Перезарядка: доля оставшегося времени кольцом, готовность — вспышкой
    const wasReady = {};
    function cooldowns() {
        const p = player;
        const rows = {
            dash:  [p.dashCooldown <= 0, p.dashCooldown, p.dashCooldownTime || 2000],
            parry: [!!p.parryReady, p.parryTimer, p.parryCooldownTime],
            alt:   [!!p.altReady, p.altTimer, p.altCooldownTime],
        };
        for (const k in rows) {
            const [ready, remain, total] = rows[k];
            const b = el[k];
            const frac = ready ? 0 : Math.max(0, Math.min(1, (remain || 0) / (total || 1)));
            b.style.setProperty('--cd', frac.toFixed(3));
            b.classList.toggle('is-cold', !ready || p.inVehicle);
            if (ready && wasReady[k] === false) { b.classList.remove('flash'); void b.offsetWidth; b.classList.add('flash'); }
            wasReady[k] = ready;
        }
    }

    let lefty = null, built = false;
    (function frame() {
        if (!built) built = build();
        if (built && typeof player !== 'undefined' && player && gameState === 'playing') {
            cooldowns();
            const l = document.body.classList.contains('lefty');
            if (l !== lefty) { lefty = l; place(); }
        }
        requestAnimationFrame(frame);
    })();
})();
