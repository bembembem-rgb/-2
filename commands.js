// --- КОНСОЛЬ КОМАНД ---
// Спрятана за секретным словом. ПК: набрать слово на клавиатуре во время
// забега (раскладка не важна). Телефон: удерживать паузу и ввести слово.
// После первого ввода устройство запоминается: дальше хватает ` (Ё)
// или удержания паузы. Пока консоль открыта, игра стоит на паузе.
// В коде лежит не само слово, а его отпечаток: прочитав файл, слово не узнать.
const CMD_SECRET = { hash: '47bc4ea3', len: 11 };

// Титры после финального босса (команда final, или devmsg — сразу).
// Всё, что здесь написано, можно менять: абзацы, подписи, строки.
// Пустая строка в letter — пауза между абзацами.
const DEV_CREDITS = {
    letter: [
        'Эта игра началась с голубого квадратика, который я гонял по пустому экрану.',
        'Квадратик никуда не делся. Ты им и играл — просто теперь у него есть капюшон, пять боссов и целое затонувшее море вокруг.',
        '',
        'Между тем экраном и этими титрами — мастерская, ко-оп и очень много вечеров. Когда делаешь всё один, в какой-то момент перестаёшь верить, что по ту сторону экрана кто-то есть.',
        '',
        'Но ты дошёл до титров. Значит, есть.',
        '',
        'Скажу честно: если играть подряд, игра приедается. Я это вижу сам. Поэтому вторая часть — не «то же самое, только больше», а работа над ошибками: разобрать, что здесь не работает, и сделать так, чтобы было интересно не только первые полчаса.',
        '',
        'Будет ли она — зависит от того, появятся ли у первой части игроки. Это не упрёк. Просто писать продолжение в пустоту я не вытяну. А если игроков наберётся много — доберусь и до настоящего онлайна.',
        '',
        'Хочешь, чтобы вторая часть была? Покажи игру другу. Или оставь отзыв на странице — я читаю каждый.',
    ],
    sign: '— разработчик',
    roles: [
        ['ИДЕЯ, КОД, ГЕЙМДИЗАЙН', 'разработчик'],
        ['БОССЫ, УРОВНИ, МАСТЕРСКАЯ', 'разработчик'],
        ['ЗВУКИ, СПРАЙТ ГЕРОЯ, ОБЛОЖКА', 'сделаны с помощью ИИ'],
    ],
    note: 'Пара эффектов в игре пока чужие. В следующем обновлении заменю их своими.',
    last: 'ДО ВСТРЕЧИ В ГЛУБИНЕ',
};

(function () {
    const css = `
    #cmd-box { position:fixed; left:50%; top:12px; transform:translateX(-50%); width:min(640px, 94vw);
        z-index:950; display:none; font-family:"JetBrains Mono", monospace; font-size:13px;
        background:rgba(5,6,15,.92); border:2px solid #00e0ff; box-shadow:0 0 18px rgba(0,224,255,.45); }
    #cmd-close { position:absolute; right:6px; top:6px; width:40px; height:40px; border:0; cursor:pointer;
        background:transparent; color:#00e0ff; font-size:20px; line-height:40px; z-index:1; }
    #cmd-log { max-height:38vh; overflow-y:auto; padding:10px 12px 4px; color:#9fb3c8; line-height:1.7; white-space:pre-wrap; }
    #cmd-log .ok { color:#3fdd4a; } #cmd-log .err { color:#ff2d55; } #cmd-log .me { color:#00e0ff; }
    #cmd-input { width:100%; box-sizing:border-box; background:transparent; border:0; border-top:1px solid #1d3550;
        color:#fff; font:inherit; padding:10px 12px; outline:none; }
    /* Титры. Press Start 2P без кириллицы — им только латинский логотип */
    #ntz-credits { position:fixed; inset:0; z-index:960; display:none; overflow:hidden; cursor:default;
        background:radial-gradient(ellipse at 50% 120%, #2a0716 0%, #05060f 55%, #020208 100%);
        font-family:"JetBrains Mono", monospace; color:#dfe8f5; -webkit-user-select:none; user-select:none; }
    #ntz-credits::before { content:""; position:absolute; inset:0; pointer-events:none; opacity:.25;
        background:repeating-linear-gradient(0deg, rgba(0,0,0,.5) 0 2px, transparent 2px 4px); }
    #ntz-credits .roll { position:absolute; left:50%; width:min(640px, 88vw); transform:translateX(-50%); text-align:center; }
    #ntz-credits .logo { font-family:"Press Start 2P", monospace; font-size:clamp(18px, 4vw, 34px); line-height:1.5;
        color:#fff; text-shadow:0 0 12px #ff2d55, 0 0 30px #ff2d55; margin-bottom:12vh; }
    #ntz-credits .logo span { color:#ff2d55; }
    #ntz-credits h3 { font-size:12px; letter-spacing:.3em; color:#00e0ff; margin:0 0 22px; font-weight:500; }
    #ntz-credits .letter p { font-size:clamp(14px, 1.9vw, 17px); line-height:1.8; margin:0 0 6px; }
    #ntz-credits .letter .gap { height:22px; }
    #ntz-credits .letter .hl { color:#fff; font-weight:700; text-shadow:0 0 10px rgba(255,45,85,.7); }
    #ntz-credits .sign { color:#ff2d55; margin:26px 0 18vh; font-size:14px; }
    #ntz-credits .role { margin:0 0 26px; }
    #ntz-credits .role b { display:block; font-size:11px; letter-spacing:.25em; color:#7d8ba3; font-weight:500; margin-bottom:6px; }
    #ntz-credits .role span { font-size:16px; }
    #ntz-credits .note { margin:14vh 0 0; font-size:12px; color:#7d8ba3; font-style:italic; }
    #ntz-credits .last { margin:30vh 0 0; font-size:15px; letter-spacing:.35em; color:#00e0ff; text-shadow:0 0 12px #00e0ff; }
    #ntz-credits .bar { position:absolute; right:16px; top:14px; display:flex; gap:10px; z-index:2; }
    #ntz-credits button { font:inherit; font-size:12px; font-weight:700; padding:10px 16px; cursor:pointer; border:0;
        color:#000; background:#00e0ff; box-shadow:0 0 14px #00e0ff; }
    #ntz-credits button.ghost { background:transparent; color:#7d8ba3; box-shadow:none; border:1px solid #2a3550; }
    #ntz-credits .done { position:absolute; left:50%; bottom:14vh; transform:translateX(-50%); display:none; }
    #ntz-credits .hint { position:absolute; left:16px; top:24px; font-size:11px; color:#46536b; z-index:2; }
    `;
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

    const box = document.createElement('div'); box.id = 'cmd-box';
    box.innerHTML = '<button id="cmd-close" aria-label="Закрыть">✕</button><div id="cmd-log"></div><input id="cmd-input" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="команда… (help)">';
    document.body.appendChild(box);
    const log = box.querySelector('#cmd-log'), input = box.querySelector('#cmd-input');

    const cr = document.createElement('div'); cr.id = 'ntz-credits';
    const esc = (t) => t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    cr.innerHTML = `
        <div class="bar"><button class="ghost skip">ПРОПУСТИТЬ</button></div>
        <div class="roll">
            <div class="logo">NEON TIDES:<br><span>ZERO</span></div>
            <h3>СООБЩЕНИЕ ОТ РАЗРАБОТЧИКА</h3>
            <div class="letter">${DEV_CREDITS.letter.map((l) => l ? `<p${l.startsWith('Но ты дошёл') ? ' class="hl"' : ''}>${esc(l)}</p>` : '<div class="gap"></div>').join('')}</div>
            <div class="sign">${esc(DEV_CREDITS.sign)}</div>
            ${DEV_CREDITS.roles.map(([r, n]) => `<div class="role"><b>${esc(r)}</b><span>${esc(n)}</span></div>`).join('')}
            <div class="note">${esc(DEV_CREDITS.note)}</div>
            <div class="last">${esc(DEV_CREDITS.last)}</div>
        </div>
        <button class="done">ПРОДОЛЖИТЬ</button>
        <div class="hint">удерживай, чтобы ускорить</div>`;
    document.body.appendChild(cr);

    let open = false, pausedByUs = false, codeMode = false;
    const fnv = (str) => { let h = 0x811c9dc5; for (const ch of str) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); };
    let unlocked = false;
    try { unlocked = localStorage.getItem('ntz_dev') === CMD_SECRET.hash; } catch (e) {}
    function unlock() { unlocked = true; try { localStorage.setItem('ntz_dev', CMD_SECRET.hash); } catch (e) {} }
    const history = []; let hi = 0;

    function print(text, cls = '') {
        const d = document.createElement('div'); if (cls) d.className = cls; d.textContent = text;
        log.appendChild(d); log.scrollTop = log.scrollHeight;
    }
    const inRun = () => typeof player !== 'undefined' && player && (gameState === 'playing' || gameState === 'paused');

    function setOpen(v, asCode = false) {
        open = v; codeMode = v && asCode;
        box.style.display = v ? 'block' : 'none';
        log.style.display = codeMode ? 'none' : '';
        input.type = codeMode ? 'password' : 'text';
        input.placeholder = codeMode ? '•••' : 'команда… (help)';
        if (v) {
            if (typeof resetInputState === 'function') resetInputState();
            if (gameState === 'playing') { gameState = 'paused'; pausedByUs = true; }
            if (!codeMode && !log.childElementCount) print('help — список команд');
            setTimeout(() => input.focus(), 0);
        } else {
            input.blur();
            if (pausedByUs && gameState === 'paused') { gameState = 'playing'; lastFrameTime = performance.now(); }
            pausedByUs = false;
        }
    }

    // Титры едут снизу вверх под finale.mp3. Удержание (мышь, палец, пробел) — ускорение.
    let rollY = 0, rollLast = 0, fast = false, rolling = false, crPaused = false;
    const roll = cr.querySelector('.roll'), doneBtn = cr.querySelector('.done');
    function showDevMessage() {
        if (typeof resetInputState === 'function') resetInputState();
        if (gameState === 'playing') { gameState = 'paused'; crPaused = true; }
        cr.style.display = 'block'; doneBtn.style.display = 'none';
        rollY = window.innerHeight; rollLast = performance.now(); rolling = true;
        roll.style.top = rollY + 'px';
        if (typeof playBGM === 'function' && typeof bgmFinale !== 'undefined') {
            try { bgmFinale.currentTime = 0; } catch (e) {}
            playBGM(bgmFinale);
        }
        requestAnimationFrame(step);
    }
    function step(now) {
        if (!rolling) return;
        const dt = Math.min(50, now - rollLast); rollLast = now;
        rollY -= dt * (fast ? 0.2 : 0.045);
        // Остановка, когда последняя строка доехала до середины экрана
        const lastEl = roll.querySelector('.last');
        const stopAt = window.innerHeight / 2 - (lastEl.offsetTop + lastEl.offsetHeight / 2);
        if (rollY <= stopAt) { rollY = stopAt; rolling = false; doneBtn.style.display = 'block'; }
        roll.style.top = rollY + 'px';
        if (rolling) requestAnimationFrame(step);
    }
    function closeCredits() {
        rolling = false; cr.style.display = 'none';
        if (typeof playBGM === 'function') playBGM(bgmFight);
        if (crPaused && gameState === 'paused') { gameState = 'playing'; lastFrameTime = performance.now(); }
        crPaused = false;
    }
    doneBtn.addEventListener('click', closeCredits);
    cr.querySelector('.skip').addEventListener('click', closeCredits);
    const fastOn = (e) => { if (!e.target.closest('button')) fast = true; }, fastOff = () => { fast = false; };
    cr.addEventListener('mousedown', fastOn); cr.addEventListener('touchstart', fastOn, { passive: true });
    window.addEventListener('mouseup', fastOff); window.addEventListener('touchend', fastOff);
    window.addEventListener('keydown', (e) => {
        if (cr.style.display !== 'block') return;
        e.stopImmediatePropagation();
        if (e.code === 'Space') { fast = true; e.preventDefault(); }
        if ((e.code === 'Enter' || e.code === 'Escape') && !rolling) closeCredits();
    }, true);
    window.addEventListener('keyup', (e) => { if (e.code === 'Space') fast = false; }, true);

    // Финал: босс появляется через паузу-предупреждение, после его смерти — письмо.
    let finalWatch = null;
    function startFinal() {
        if (typeof window.spawnBoss !== 'function') return 'нет spawnBoss в этой версии игры';
        setOpen(false);
        shakeTime = Math.max(shakeTime || 0, 1200);
        if (typeof spawnFloatText === 'function') spawnFloatText(player.x, player.y - 90, 'ОНО ИДЁТ…', '#c46dff', 18);
        // Если игрок успел поставить паузу, spawnBoss молча откажет — ждём забега
        const trySpawn = () => {
            if (!inRun()) return;
            if (gameState !== 'playing') { setTimeout(trySpawn, 300); return; }
            window.spawnBoss(5);
            finalWatch = activeBoss && /VOID/i.test(activeBoss.name) ? activeBoss : null;
        };
        setTimeout(trySpawn, 1400);
        return 'финальный босс вызван';
    }

    const COMMANDS = {
        help: { d: 'список команд', f: () => Object.entries(COMMANDS).map(([k, c]) => `${k.padEnd(9)} ${c.d}`).join('\n') },
        final: { d: 'последний босс, после победы — титры', run: true, f: startFinal },
        boss: { d: 'boss 1-5 — вызвать босса', run: true, f: (a) => {
            if (typeof window.spawnBoss !== 'function') return 'нет spawnBoss';
            const id = isNaN(+a[0]) ? a[0] : +a[0]; window.spawnBoss(id || 1); return 'босс ' + (id || 1);
        } },
        killboss: { d: 'убить текущего босса', run: true, f: () => { if (!activeBoss) return 'босса нет'; activeBoss.hp = 0; return 'готово'; } },
        kill: { d: 'убить всех врагов, кроме босса', run: true, f: () => {
            let n = 0; for (const e of enemies) if (e.type !== 'boss' && e.hp > 0) { e.hp = 0; n++; } return 'убито: ' + n;
        } },
        god: { d: 'бессмертие вкл/выкл', run: true, f: () => { god = !god; return 'бессмертие: ' + (god ? 'ВКЛ' : 'ВЫКЛ'); } },
        heal: { d: 'полное здоровье', run: true, f: () => { player.hp = player.maxHpRun || (typeof maxHp === 'function' ? maxHp() : 3); updateHpUI(); return 'HP: ' + player.hp; } },
        speed: { d: 'speed 5 — скорость (обычная 5)', run: true, f: (a) => { player.speed = Math.max(1, Math.min(20, +a[0] || 5)); return 'скорость ' + player.speed; } },
        credits: { d: 'credits 500 — добавить кредиты', f: (a) => {
            if (typeof window.giveCredits !== 'function') return 'нет giveCredits'; window.giveCredits(+a[0] || 500); return '+' + (+a[0] || 500) + ' CR';
        } },
        score: { d: 'score 1000 — добавить очки', run: true, f: (a) => { window.giveScore && window.giveScore(+a[0] || 1000); return '+' + (+a[0] || 1000); } },
        devmsg: { d: 'сразу показать титры с письмом', f: () => { setOpen(false); showDevMessage(); return ''; } },
        exit: { d: 'закрыть консоль', f: () => { setTimeout(() => setOpen(false), 0); return ''; } },
        clear: { d: 'очистить консоль', f: () => { log.innerHTML = ''; return ''; } },
    };

    function exec(line) {
        if (!unlocked) return;
        const parts = line.trim().replace(/^\//, '').split(/\s+/);
        const name = (parts.shift() || '').toLowerCase();
        if (!name) return;
        print('> ' + line, 'me');
        const c = COMMANDS[name];
        if (!c) { print('нет такой команды. help — список', 'err'); return; }
        if (c.run && !inRun()) { print('сначала начни забег', 'err'); return; }
        // Консоль держит игру на паузе, а spawnBoss и прочие ждут живой забег
        const resume = c.run && pausedByUs && gameState === 'paused';
        if (resume) gameState = 'playing';
        try { const r = c.f(parts); if (r) print(r, 'ok'); }
        catch (e) { print('ошибка: ' + e.message, 'err'); }
        finally { if (resume && open && gameState === 'playing') gameState = 'paused'; }
    }

    // Бессмертие: здоровье держится полным каждый кадр
    let god = false;
    (function tick() {
        if (god && inRun() && player.hp > 0) {
            const mx = player.maxHpRun || (typeof maxHp === 'function' ? maxHp() : player.hp);
            if (player.hp < mx) { player.hp = mx; if (typeof updateHpUI === 'function') updateHpUI(); }
        }
        if (finalWatch && finalWatch.hp <= 0 && !activeBoss) {
            finalWatch = null;
            // дать взрыву отыграть; если игра сама ушла в концовку или меню — не мешаем ей
            setTimeout(() => { if (gameState === 'playing') showDevMessage(); }, 1800);
        }
        if (finalWatch && !inRun()) finalWatch = null;
        requestAnimationFrame(tick);
    })();

    // Клавиши: секретное слово по физическим клавишам, ` — только после разблокировки.
    // Пока консоль открыта, игра клавиш не получает.
    let typed = '';
    window.addEventListener('keydown', (e) => {
        if (open) return;
        if (e.code === 'Backquote' && unlocked) { e.preventDefault(); e.stopImmediatePropagation(); setOpen(true); return; }
        const m = /^Key([A-Z])$/.exec(e.code);
        if (!m || !inRun()) return;
        typed = (typed + m[1].toLowerCase()).slice(-CMD_SECRET.len);
        if (typed.length === CMD_SECRET.len && fnv(typed) === CMD_SECRET.hash) { typed = ''; unlock(); setOpen(true); }
    }, true);
    input.addEventListener('keydown', (e) => {
        e.stopPropagation();
        const enter = e.code === 'Enter' || e.key === 'Enter';   // у экранных клавиатур code пустой
        if (enter && codeMode) {
            // неверное слово — окно молча закрывается, без подсказок
            const ok = fnv(input.value.trim().toLowerCase()) === CMD_SECRET.hash;
            input.value = ''; setOpen(false);
            if (ok) { unlock(); setOpen(true); }
        }
        else if (enter) { const v = input.value; if (v.trim()) { history.push(v); hi = history.length; } input.value = ''; exec(v); }
        else if (e.code === 'Escape' || e.code === 'Backquote') { e.preventDefault(); setOpen(false); }
        else if (e.code === 'ArrowUp' && history.length) { hi = Math.max(0, hi - 1); input.value = history[hi]; e.preventDefault(); }
        else if (e.code === 'ArrowDown' && history.length) { hi = Math.min(history.length, hi + 1); input.value = history[hi] || ''; e.preventDefault(); }
    });
    input.addEventListener('keyup', (e) => e.stopPropagation());
    // На телефоне нет Esc: крестик в углу окна
    const closeBtn = box.querySelector('#cmd-close');
    closeBtn.addEventListener('click', () => setOpen(false));
    closeBtn.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); setOpen(false); }, { passive: false });

    window.runCommand = exec;
    window.openCommandConsole = () => setOpen(true, !unlocked);
})();
