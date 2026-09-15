// === КОНТРАКТЫ ===
// Забег был однообразен: квест «сядь в машину — довези» повторяется без
// вариаций, а весь риск — пассивный «на кону». Контракт делает риск активным:
// игрок сам ставит уже заработанные кредиты против своего умения.
//
// Карточка не останавливает бой. Пауза на каждое предложение превратила бы
// погоню в череду диалогов; восемь секунд на решение под огнём — и есть
// содержание выбора.

const CONTRACT_OFFER_EVERY = 90000;   // пауза между предложениями
const CONTRACT_DECIDE = 8000;         // сколько висит карточка

const CONTRACT_POOL = [
    { id: 'kills40',  title: 'УБЕЙ 40 ВРАГОВ',        goal: 40, limit: 60000, stake: 30, mult: 4, kind: 'kill'   },
    { id: 'noHit45',  title: 'НЕ ПОЛУЧАЙ УРОН',       goal: 45, limit: 45000, stake: 40, mult: 5, kind: 'nohit'  },
    { id: 'bossNoQ',  title: 'СВАЛИ БОССА БЕЗ ИМПУЛЬСА', goal: 1, limit: 0,   stake: 60, mult: 4, kind: 'bossNoPulse' },
    { id: 'vault',    title: 'СДАЙ ГРУЗ ЧЕРЕЗ ШЛЮЗ',  goal: 1,  limit: 0,     stake: 50, mult: 5, kind: 'vault'  },
    { id: 'chain25',  title: 'ДЕРЖИ ЦЕПЬ x25',        goal: 1,  limit: 0,     stake: 35, mult: 5, kind: 'chain'  },
    // Чёрный рынок (узел contracts2): ставки выше, выплаты крупнее
    { id: 'kills120', title: 'УБЕЙ 120 ВРАГОВ',        goal: 120, limit: 120000, stake: 90, mult: 4, kind: 'kill',  unlock: 'contracts2' },
    { id: 'wrecks6',  title: 'РАЗБЕРИ 6 ТРАНСПОРТОВ',  goal: 6,  limit: 90000,  stake: 70, mult: 5, kind: 'vehicle', unlock: 'contracts2' },
    { id: 'noHit90',  title: 'НЕ ПОЛУЧАЙ УРОН',        goal: 90, limit: 90000,  stake: 110, mult: 6, kind: 'nohit', unlock: 'contracts2' }
];
const CONTRACT_BY_ID = {};
for (const c of CONTRACT_POOL) CONTRACT_BY_ID[c.id] = c;

let contractOffer = null;     // предложенная карточка: { def, left }
let contractActive = null;    // принятый: { def, have, left }
let contractTimer = CONTRACT_OFFER_EVERY;
let contractBestPay = 0;

function resetContracts() {
    contractOffer = null;
    contractActive = null;
    contractBestPay = 0;
    // Первое предложение приходит не сразу: сначала дай игроку заработать
    // ставку, иначе карточка появится серой и научит её игнорировать.
    contractTimer = 25000;
    renderContractUI();
}

function contractAffordable(def) { return runCredits >= def.stake; }

function offerContract() {
    const pool = CONTRACT_POOL.filter(c => (!c.unlock || unlockOwned(c.unlock))
        && !(contractActive && contractActive.def.id === c.id));
    if (!pool.length) return;
    contractOffer = { def: pool[Math.floor(Math.random() * pool.length)], left: CONTRACT_DECIDE };
    playSFX(sfxUiNav, 0.4);
}

function acceptContract() {
    if (!contractOffer) return false;
    const def = contractOffer.def;
    if (!contractAffordable(def)) return false;
    runCredits -= def.stake;
    updateCreditsUI();
    contractActive = { def, have: 0, left: def.limit || 0, pulseUsed: false };
    contractOffer = null;
    playSFX(sfxWeapon, 0.6, 0, 0.05);
    if (player) spawnFloatText(player.x, player.y - 60, `КОНТРАКТ ПРИНЯТ · −${def.stake} CR`, '#ff9f1c', 12, 'contract');
    return true;
}

function declineContract() {
    if (!contractOffer) return;
    contractOffer = null;
    playSFX(sfxUiNav, 0.25);
}

function failContract(why) {
    if (!contractActive) return;
    const def = contractActive.def;
    contractActive = null;
    if (player) spawnFloatText(player.x, player.y - 60, `КОНТРАКТ ПРОВАЛЕН · ${def.stake} CR СГОРЕЛИ`, '#ff2d55', 12, 'contract');
    playSFX(sfxLose, 0.35);
    shakeTime = Math.max(shakeTime, 200);
}

function completeContract() {
    if (!contractActive) return;
    const def = contractActive.def;
    const pay = def.stake * def.mult;
    contractActive = null;
    runCredits += pay;
    if (pay > contractBestPay) contractBestPay = pay;
    updateCreditsUI();
    if (player) spawnFloatText(player.x, player.y - 60, `КОНТРАКТ ЗАКРЫТ · +${pay} CR`, '#3fdd4a', 14, 'contract');
    playSFX(sfxAchievement, 0.8);
    shakeTime = Math.max(shakeTime, 200);
    // Гарантированный ролл — вторая половина награды и главный крючок
    rollDrop('contract');
}

// Прогресс считается по событиям, которые игра и так рассылает: отдельного
// счётчика на каждый контракт нет намеренно, иначе их стало бы пять.
function contractEvent(kind, amount = 1) {
    const c = contractActive;
    if (!c) return;
    const def = c.def;

    if (kind === 'pulse') { c.pulseUsed = true; return; }
    if (kind === 'hit' && def.kind === 'nohit') { failContract(); return; }

    if (def.kind === 'bossNoPulse' && kind === 'boss') {
        if (c.pulseUsed) failContract(); else completeContract();
        return;
    }
    if (def.kind !== kind) return;

    c.have = Math.min(def.goal, c.have + amount);
    if (c.have >= def.goal) completeContract();
}

function updateContracts(dt) {
    if (contractOffer) {
        contractOffer.left -= dt;
        if (contractOffer.left <= 0) contractOffer = null;
    } else if (!contractActive) {
        contractTimer -= dt;
        if (contractTimer <= 0) { contractTimer = CONTRACT_OFFER_EVERY; offerContract(); }
    }

    if (contractActive && contractActive.def.limit) {
        contractActive.left -= dt;
        // «Не получай урон» на истёкшем таймере — это успех, а не провал
        if (contractActive.left <= 0) {
            if (contractActive.def.kind === 'nohit') completeContract();
            else failContract();
        }
    }
    renderContractUI();
}

// --- HUD ---
let _contractShown = '';
function renderContractUI() {
    const card = document.getElementById('contract-offer');
    const line = document.getElementById('contract-line');
    if (!card || !line) return;

    if (contractOffer) {
        const def = contractOffer.def, can = contractAffordable(def);
        const secs = Math.ceil(contractOffer.left / 1000);
        const key = `${def.id}|${secs}|${can}`;
        if (key !== _contractShown) {
            _contractShown = key;
            card.innerHTML = `<div class="ct-head">КОНТРАКТ · ${secs} С</div>`
                + `<div class="ct-title">${def.title}${def.limit ? ` ЗА ${Math.round(def.limit / 1000)} С` : ''}</div>`
                + `<div class="ct-stake">СТАВКА ${def.stake} CR · ВЫПЛАТА ${def.stake * def.mult} CR</div>`
                + (can
                    ? `<div class="ct-keys"><button class="tap-btn" onclick="acceptContract()">[G] ПРИНЯТЬ</button>`
                      + `<button class="tap-btn muted" onclick="declineContract()">[H] ОТКАЗ</button></div>`
                    : `<div class="ct-keys">НЕ ХВАТАЕТ КРЕДИТОВ</div>`);
            card.className = can ? '' : 'is-poor';
        }
        card.style.display = 'block';
    } else if (card.style.display !== 'none') {
        card.style.display = 'none';
        _contractShown = '';
    }

    if (contractActive) {
        const c = contractActive, def = c.def;
        const prog = def.goal > 1 ? ` ${c.have}/${def.goal}` : '';
        const time = def.limit ? ` · ${Math.max(0, c.left / 1000).toFixed(0)} С` : '';
        line.innerText = `КОНТРАКТ: ${def.title}${prog}${time}`;
        line.className = (def.limit && c.left <= 10000) ? 'ct-low' : '';
        line.style.display = 'block';
    } else if (line.style.display !== 'none') {
        line.style.display = 'none';
    }
}
