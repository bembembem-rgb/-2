// --- ДЕКА: рамка экрана скафандра поверх интерфейса ---
// Всё, что игрок видит в меню, происходит на одном устройстве. Рамка
// существует, чтобы это устройство было видно: статус сверху, журнал
// сбоку, строка ввода снизу. Без неё экраны меню — это просто панели
// в пустоте, и «дека» остаётся словом из описания, а не тем, на что
// игрок смотрит.
//
// Рамка живёт только над экранами меню. В забеге её место занимает HUD,
// и две рамки одновременно превратили бы край экрана в кашу.

const DECK_ID = 'deck';
let deckEl = null, deckLogEl = null, deckTopEl = null, deckCmdEl = null;
let deckOn = null;
let deckLines = [];
let deckNextLine = 0;

// Журнал врёт ровно настолько, насколько нужно: половина строк собрана
// из настоящего состояния сохранения, поэтому числа в нём совпадают с
// числами на панели рядом. Строка, противоречащая соседней панели, сразу
// читается как декорация.
function deckLogPool() {
    const w = (typeof saveData !== 'undefined' && saveData.wallet) || 0;
    const c = (typeof saveData !== 'undefined' && saveData.cores) || 0;
    const best = (typeof saveData !== 'undefined' && saveData.bestScore) || 0;
    const d = (typeof selectedDepth === 'function') ? selectedDepth() : 1;
    return [
        ['ok',   'uplink ...... стабилен'],
        ['ok',   `кошелёк ..... ${w} CR`],
        ['ok',   `ядра ........ ${c}`],
        ['dim',  `рекорд ...... ${best.toString().padStart(4, '0')}`],
        ['dim',  `глубина ..... ${d}`],
        ['dim',  'сонар ....... холостой ход'],
        ['dim',  'шлюз ........ закрыт'],
        ['warn', 'фон ......... код в воде, 0.4 мг/л'],
        ['warn', 'температура . 3 °C, растёт'],
        ['dim',  'скафандр .... герметичен'],
        ['ok',   'аккумулятор . 34 %'],
        ['err',  'пакет потерян, повтор'],
        ['dim',  'эхо ......... 12 объектов'],
        ['warn', 'чужой трафик на канале 7'],
        ['dim',  'архив ....... доступ только чтение'],
        ['ok',   'связь с орбитой ... нет']
    ];
}

function deckStamp(i) {
    // Часы деки идут от запуска страницы: игровое время тут ни при чём,
    // а настоящее время суток выдало бы, что это браузер, а не скафандр.
    const t = Math.floor(performance.now() / 1000) + i * 7;
    const mm = Math.floor(t / 60) % 100, ss = t % 60;
    return `${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`;
}

function deckPushLine() {
    if (!deckLogEl) return;
    if (!deckLines.length) deckLines = deckLogPool();
    const [kind, text] = deckLines[deckNextLine % deckLines.length];
    deckNextLine++;

    const row = document.createElement('div');
    row.className = 'deck-line k-' + kind;
    row.innerHTML = `<span class="dl-t">${deckStamp(deckNextLine)}</span>`
                  + `<span class="dl-x">${text}</span>`;
    deckLogEl.appendChild(row);

    // Потолок на длину: журнал, который растёт вечно, за десять минут
    // в меню съедает память и начинает тормозить прокрутку.
    while (deckLogEl.children.length > 9) deckLogEl.removeChild(deckLogEl.firstChild);
}

function buildDeck() {
    if (document.getElementById(DECK_ID)) return;

    deckEl = document.createElement('div');
    deckEl.id = DECK_ID;
    deckEl.setAttribute('aria-hidden', 'true');
    deckEl.innerHTML = `
        <span class="deck-corner c-tl"></span>
        <span class="deck-corner c-tr"></span>
        <span class="deck-corner c-bl"></span>
        <span class="deck-corner c-br"></span>

        <div class="deck-bar deck-top">
            <span class="db-id">AETHERNET // NODE 0</span>
            <span class="db-fill"></span>
            <span class="db-slot" id="deck-status">UPLINK OK</span>
            <span class="db-fill"></span>
            <span class="db-slot" id="deck-clock">00:00</span>
        </div>

        <div class="deck-log" id="deck-log"></div>

        <div class="deck-bar deck-bottom">
            <span class="db-slot" id="deck-cmd">ожидание команды</span>
            <span class="deck-cursor"></span>
            <span class="db-fill"></span>
            <span class="db-slot db-dim">ESC — НАЗАД</span>
        </div>
    `;

    // Внутрь слоя UI, а не в body: так затемнение при старте забега
    // (#fade-overlay, z-index 500) накрывает и рамку тоже. Снаружи она
    // осталась бы висеть поверх черноты.
    const host = document.getElementById('custom-ui-layer') || document.body;
    host.appendChild(deckEl);

    deckLogEl = document.getElementById('deck-log');
    deckTopEl = document.getElementById('deck-status');
    deckCmdEl = document.getElementById('deck-cmd');
}

// Подпись снизу называет открытый экран. Это единственное место, где
// игрок видит, «где он находится», когда экранов открыто несколько подряд.
const DECK_NAMES = {
    'main-menu-screen': 'root@aethernet: ~',
    'part-select-screen': 'выбор точки входа',
    'shop-screen': 'мастерская: доступ на запись',
    'lore-screen': 'архив: доступ только чтение',
    'achievements-screen': 'журнал трофеев',
    'daily-screen': 'сводка за сутки',
    'keys-screen': 'схема управления',
    'coop-device-panel': 'устройства ввода',
    'pause-screen': 'сеанс приостановлен',
    'game-over-screen': 'разбор погружения',
    'coming-soon-screen': 'маршрут не проложен'
};

let _deckLogTimer = 0;
function updateDeck(dtMs) {
    if (!deckEl) return;

    const scr = (typeof activeMenuScreen === 'function') ? activeMenuScreen() : null;
    const on = !!scr;
    if (on !== deckOn) {
        deckOn = on;
        document.body.classList.toggle('deck-on', on);
        if (on) {
            // Журнал набивается сразу, а не по строке в секунду: пустая
            // колонка в первые секунды читается как поломка рамки.
            if (deckLogEl && !deckLogEl.children.length) for (let i = 0; i < 5; i++) deckPushLine();
        }
    }
    if (!on) return;

    // Тосты о трофеях живут в том же левом нижнем углу, и на разборе
    // погружения их выпадает сразу несколько. Журнал там ничего не
    // добавляет, а перекрывает награду — значит, уходит он, а не она.
    if (deckLogEl) deckLogEl.style.display = (scr.id === 'game-over-screen') ? 'none' : 'flex';

    if (deckCmdEl && scr) {
        const name = DECK_NAMES[scr.id] || scr.id;
        if (deckCmdEl.innerText !== name) deckCmdEl.innerText = name;
    }

    const clock = document.getElementById('deck-clock');
    if (clock) {
        const t = Math.floor(performance.now() / 1000);
        const s = `${Math.floor(t / 60).toString().padStart(2, '0')}:${(t % 60).toString().padStart(2, '0')}`;
        if (clock.innerText !== s) clock.innerText = s;
    }

    if (deckTopEl) {
        const depth = (typeof selectedDepth === 'function') ? selectedDepth() : 1;
        const s = `UPLINK OK · DEPTH ${depth}`;
        if (deckTopEl.innerText !== s) deckTopEl.innerText = s;
    }

    _deckLogTimer += dtMs;
    if (_deckLogTimer >= 2600) { _deckLogTimer = 0; deckPushLine(); }
}

// Собственный таймер, а не игровой цикл: в меню gameLoop может стоять,
// а рамка должна жить всегда, пока экран открыт.
function startDeck() {
    buildDeck();
    let last = performance.now();
    setInterval(() => {
        const now = performance.now();
        updateDeck(now - last);
        last = now;
    }, 250);
}
