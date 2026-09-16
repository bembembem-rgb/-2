// --- ЦЕПЬ, ВСПЛЫВАЮЩИЙ ТЕКСТ И СОСТОЯНИЕ «КРИТИЧНО» ---
// Цепь не трогает баланс: она ничего не умножает, а только показывает,
// насколько плотно игрок держит темп. Всё, что она даёт, — обратная связь
// и строка «лучшая цепь» в итогах забега.

const CHAIN_WINDOW = 2400;   // мс без очков — и цепь рвётся
// Пороги подобраны так, чтобы первый брался почти в каждом забеге,
// а последний — только когда игрок реально не выпускает гашетку.
const CHAIN_TIERS = [
    { at: 45, word: 'ПЕРЕГРУЗКА', color: '#ff2d55', css: 'chain-t4' },
    { at: 25, word: 'РЕЗОНАНС',   color: '#c46dff', css: 'chain-t3' },
    { at: 12, word: 'КАСКАД',     color: '#ff9f1c', css: 'chain-t2' },
    { at: 5,  word: 'ЦЕПЬ',       color: '#00e0ff', css: 'chain-t1' }
];

let chainCount = 0, chainTimer = 0, chainBest = 0, chainTierShown = 0;
let floatTexts = [];

function chainTier(n) {
    for (const t of CHAIN_TIERS) if (n >= t.at) return t;
    return null;
}

// Единственная точка входа: её зовёт addScore, поэтому цепь ловит всё —
// добивание, таран, транспорт, босса, эвакуацию.
function noteScoreEvent(points) {
    if (gameState !== 'playing' || points <= 0) return;
    chainCount++;
    chainTimer = CHAIN_WINDOW;
    if (chainCount > chainBest) chainBest = chainCount;

    const tier = chainTier(chainCount);
    const tierIdx = tier ? CHAIN_TIERS.indexOf(tier) : -1;
    // Порог берётся один раз: без этого каждое убийство после 45-го
    // выплёвывало бы новую надпись.
    if (tier && tierIdx !== chainTierShown && chainCount === tier.at) {
        chainTierShown = tierIdx;
        if (player) spawnFloatText(player.x, player.y - 46, `${tier.word} x${chainCount}`, tier.color, 20, 'chain');
        playSFX(sfxUiNav, 0.35, 0);
        if (tier.at >= 25) { dailyEvent('chain', 1); contractEvent('chain', 1); }
        shakeTime = Math.max(shakeTime, 90);
    }
    updateChainUI();
}

function breakChain() {
    // Молчим про короткие цепи: сообщение о разрыве двойки — это шум.
    if (chainCount >= CHAIN_TIERS[CHAIN_TIERS.length - 1].at && player) {
        spawnFloatText(player.x, player.y - 46, `ЦЕПЬ ОБОРВАНА x${chainCount}`, '#74838c', 14, 'chain');
    }
    chainCount = 0;
    chainTimer = 0;
    chainTierShown = 0;
    updateChainUI();
}

function updateChain(dt) {
    if (chainTimer > 0) {
        chainTimer -= dt;
        if (chainTimer <= 0) breakChain();
        else updateChainUI();
    }
    for (let i = floatTexts.length - 1; i >= 0; i--) {
        const f = floatTexts[i];
        f.life -= dt;
        f.y += f.vy * (dt / 16.67);
        f.vy *= 0.94;
        if (f.life <= 0) floatTexts.splice(i, 1);
    }
}

function resetChain() {
    chainCount = 0; chainTimer = 0; chainBest = 0; chainTierShown = 0;
    floatTexts = [];
    updateChainUI();
}

let _chainShown = null;
function updateChainUI() {
    const wrap = document.getElementById('chain-wrap');
    if (!wrap) return;
    const on = chainCount >= 2;
    if (on !== _chainShown) { wrap.style.display = on ? 'inline-block' : 'none'; _chainShown = on; }
    if (!on) return;
    const num = document.getElementById('chain-count');
    const word = document.getElementById('chain-word');
    const tier = chainTier(chainCount);
    if (num) {
        num.innerText = 'x' + chainCount;
        num.className = tier ? tier.css : '';
    }
    if (word) word.innerText = tier ? tier.word : 'ЦЕПЬ';
    // Полоса — остаток окна: видно, что пора добивать, а не бежать за аптечкой.
    wrap.style.setProperty('--chain', Math.max(0, chainTimer / CHAIN_WINDOW * 100) + '%');
}

// tag === 'chain' держит на экране только одну надпись о цепи: две подряд взятые
// ступени иначе всплывают в одной точке и накладываются друг на друга.
function spawnFloatText(x, y, text, color, size = 16, tag = null) {
    if (tag) {
        for (let i = floatTexts.length - 1; i >= 0; i--) if (floatTexts[i].tag === tag) floatTexts.splice(i, 1);
    }
    // Потолок на случай залпа по толпе: экран не должен превращаться в стену букв.
    if (floatTexts.length > 12) floatTexts.shift();
    floatTexts.push({ x, y, vy: -1.1, text, color, size, tag, life: 1100, maxLife: 1100 });
}

function drawFloatTexts() {
    if (floatTexts.length === 0) return;
    ctx.save();
    ctx.textAlign = 'center';
    for (const f of floatTexts) {
        const t = f.life / f.maxLife;
        ctx.globalAlpha = t > 0.7 ? 1 : t / 0.7;
        ctx.font = `${f.size}px var(--font-pixel)`;
        // Подложка вместо свечения: текст читается на любом фоне и не «мылит».
        ctx.fillStyle = 'rgba(5,8,14,0.85)';
        ctx.fillText(f.text, f.x + 2, f.y + 2);
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, f.x, f.y);
    }
    ctx.restore();
}

// --- СОСТОЯНИЕ «КРИТИЧНО» И ВСПЫШКА УРОНА ---
let _criticalOn = null;

function updateCriticalState() {
    const on = gameState === 'playing' && !!player && !player.downed && player.hp <= 1;
    if (on === _criticalOn) return;
    _criticalOn = on;
    document.body.classList.toggle('is-critical', on);
}

function flashDamage() {
    const el = document.getElementById('hit-flash');
    if (!el) return;
    el.classList.remove('on');
    void el.offsetWidth;
    el.classList.add('on');
}
