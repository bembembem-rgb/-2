// --- КОНСОЛЬ КОМАНД ---
// ПК: клавиша ` (она же Ё). Телефон: удерживать кнопку паузы.
// Пока консоль открыта, игра стоит на паузе. Список — команда help.

// Текст, который игра показывает после победы над финальным боссом (команда final).
const DEV_MESSAGE = {
    title: 'СООБЩЕНИЕ ОТ РАЗРАБОТЧИКА',
    text: 'Спасибо, что играешь в NEON TIDES: ZERO!\n\n'
        + 'Эту игру я сделал сам: код, спрайты, звуки и море нервов.\n'
        + 'Если тебе понравилось — оставь отзыв на странице игры,\n'
        + 'это правда помогает. До встречи в глубине.',
    sign: '— разработчик',
};

(function () {
    const css = `
    #cmd-box { position:fixed; left:50%; top:12px; transform:translateX(-50%); width:min(640px, 94vw);
        z-index:950; display:none; font-family:"Press Start 2P", monospace; font-size:10px;
        background:rgba(5,6,15,.92); border:2px solid #00e0ff; box-shadow:0 0 18px rgba(0,224,255,.45); }
    #cmd-log { max-height:38vh; overflow-y:auto; padding:10px 12px 4px; color:#9fb3c8; line-height:1.7; white-space:pre-wrap; }
    #cmd-log .ok { color:#3fdd4a; } #cmd-log .err { color:#ff2d55; } #cmd-log .me { color:#00e0ff; }
    #cmd-input { width:100%; box-sizing:border-box; background:transparent; border:0; border-top:1px solid #1d3550;
        color:#fff; font:inherit; padding:10px 12px; outline:none; }
    #dev-msg { position:fixed; inset:0; z-index:960; display:none; align-items:center; justify-content:center;
        background:rgba(0,0,0,.72); font-family:"Press Start 2P", monospace; }
    #dev-msg .card { width:min(620px, 92vw); padding:26px 24px; text-align:center; color:#dfe8f5;
        background:#070914; border:2px solid #ff2d55; box-shadow:0 0 40px rgba(255,45,85,.5);
        animation:dev-in .6s cubic-bezier(.2,1.4,.4,1); }
    #dev-msg h2 { margin:0 0 18px; font-size:13px; color:#ff2d55; text-shadow:0 0 10px #ff2d55; }
    #dev-msg p { margin:0; font-size:10px; line-height:2; white-space:pre-wrap; }
    #dev-msg .sign { margin-top:16px; color:#00e0ff; font-size:9px; }
    #dev-msg button { margin-top:22px; font:inherit; font-size:10px; padding:12px 20px; cursor:pointer;
        color:#000; background:#00e0ff; border:0; box-shadow:0 0 14px #00e0ff; }
    @keyframes dev-in { from { transform:scale(.6); opacity:0; } to { transform:scale(1); opacity:1; } }
    `;
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

    const box = document.createElement('div'); box.id = 'cmd-box';
    box.innerHTML = '<div id="cmd-log"></div><input id="cmd-input" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="команда… (help)">';
    document.body.appendChild(box);
    const log = box.querySelector('#cmd-log'), input = box.querySelector('#cmd-input');

    const msg = document.createElement('div'); msg.id = 'dev-msg';
    msg.innerHTML = '<div class="card"><h2></h2><p></p><div class="sign"></div><button>ПРОДОЛЖИТЬ</button></div>';
    document.body.appendChild(msg);

    let open = false, pausedByUs = false;
    const history = []; let hi = 0;

    function print(text, cls = '') {
        const d = document.createElement('div'); if (cls) d.className = cls; d.textContent = text;
        log.appendChild(d); log.scrollTop = log.scrollHeight;
    }
    const inRun = () => typeof player !== 'undefined' && player && (gameState === 'playing' || gameState === 'paused');

    function setOpen(v) {
        open = v;
        box.style.display = v ? 'block' : 'none';
        if (v) {
            if (typeof resetInputState === 'function') resetInputState();
            if (gameState === 'playing') { gameState = 'paused'; pausedByUs = true; }
            if (!log.childElementCount) print('help — список команд');
            setTimeout(() => input.focus(), 0);
        } else {
            input.blur();
            if (pausedByUs && gameState === 'paused') { gameState = 'playing'; lastFrameTime = performance.now(); }
            pausedByUs = false;
        }
    }

    function showDevMessage() {
        msg.querySelector('h2').textContent = DEV_MESSAGE.title;
        msg.querySelector('p').textContent = DEV_MESSAGE.text;
        msg.querySelector('.sign').textContent = DEV_MESSAGE.sign;
        msg.style.display = 'flex';
        if (gameState === 'playing') { gameState = 'paused'; msg._paused = true; }
        if (typeof playSFX === 'function' && typeof sfxAchievement !== 'undefined') playSFX(sfxAchievement, 0.6);
    }
    msg.querySelector('button').addEventListener('click', () => {
        msg.style.display = 'none';
        if (msg._paused && gameState === 'paused') { gameState = 'playing'; lastFrameTime = performance.now(); }
        msg._paused = false;
    });

    // Финал: босс появляется через паузу-предупреждение, после его смерти — письмо.
    let finalWatch = null;
    function startFinal() {
        if (typeof window.spawnBoss !== 'function') return 'нет spawnBoss в этой версии игры';
        setOpen(false);
        shakeTime = Math.max(shakeTime || 0, 1200);
        if (typeof spawnFloatText === 'function') spawnFloatText(player.x, player.y - 90, 'ОНО ИДЁТ…', '#c46dff', 18);
        setTimeout(() => {
            if (!inRun()) return;
            window.spawnBoss(5);
            finalWatch = activeBoss;
        }, 1400);
        return 'финальный босс вызван';
    }

    const COMMANDS = {
        help: { d: 'список команд', f: () => Object.entries(COMMANDS).map(([k, c]) => `${k.padEnd(9)} ${c.d}`).join('\n') },
        final: { d: 'последний босс, после победы — письмо разработчика', run: true, f: startFinal },
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
        devmsg: { d: 'показать письмо разработчика', f: () => { setOpen(false); showDevMessage(); return ''; } },
        clear: { d: 'очистить консоль', f: () => { log.innerHTML = ''; return ''; } },
    };

    function exec(line) {
        const parts = line.trim().replace(/^\//, '').split(/\s+/);
        const name = (parts.shift() || '').toLowerCase();
        if (!name) return;
        print('> ' + line, 'me');
        const c = COMMANDS[name];
        if (!c) { print('нет такой команды. help — список', 'err'); return; }
        if (c.run && !inRun()) { print('сначала начни забег', 'err'); return; }
        try { const r = c.f(parts); if (r) print(r, 'ok'); }
        catch (e) { print('ошибка: ' + e.message, 'err'); }
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
            setTimeout(showDevMessage, 1800);   // дать взрыву отыграть
        }
        if (finalWatch && !inRun()) finalWatch = null;
        requestAnimationFrame(tick);
    })();

    // Клавиши: ` открывает; пока открыто, игра клавиш не получает
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Backquote' && !open) { e.preventDefault(); e.stopImmediatePropagation(); setOpen(true); }
    }, true);
    input.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.code === 'Enter') { const v = input.value; if (v.trim()) { history.push(v); hi = history.length; } input.value = ''; exec(v); }
        else if (e.code === 'Escape' || e.code === 'Backquote') { e.preventDefault(); setOpen(false); }
        else if (e.code === 'ArrowUp' && history.length) { hi = Math.max(0, hi - 1); input.value = history[hi]; e.preventDefault(); }
        else if (e.code === 'ArrowDown' && history.length) { hi = Math.min(history.length, hi + 1); input.value = history[hi] || ''; e.preventDefault(); }
    });
    input.addEventListener('keyup', (e) => e.stopPropagation());

    window.runCommand = exec;
    window.openCommandConsole = () => setOpen(true);
    window.showDevMessage = showDevMessage;
})();
