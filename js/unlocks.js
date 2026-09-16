// === ДЕРЕВО АНЛОКОВ ===
// Мастерская торгует процентами: «+15% к перезарядке» игрок не видит и через
// забег не вспомнит. Дерево торгует СОДЕРЖИМЫМ: после покупки в забеге
// появляются вещи, которых в нём не было — ствол, перки, артефакты, враг,
// контракты. Именно это отличает двадцатый забег от второго.
//
// Платят ядрами (гарантированная валюта), а не кредитами: узел должен
// открываться даже после провального забега.
//
// ЦЕНЫ В ЯДРАХ И СКОЛЬКО ЭТО ЗАБЕГОВ
// Плохой забег даёт ≈22 ядра, хороший ≈64 (см. калибровку в js/economy.js).
// Числа ниже подобраны так, чтобы первый узел брался за два плохих забега,
// а всё дерево — примерно за 20-25 забегов среднего качества.
const UNLOCK_NODES = {
    boomer: {
        title: 'ОТЛИВ', cost: 45, requires: null,           // ≈2 плохих забега
        desc: 'Третий ствол: диск улетает, разворачивается и возвращается — бьёт дважды',
        pool: 'СТВОЛ ОТЛИВ'
    },
    perks_move: {
        title: 'ШКОЛА ДВИЖЕНИЯ', cost: 70, requires: null,  // ≈3
        desc: 'Два перка уровня: рывок бьёт по траектории, парирование даёт заряд импульса',
        pool: '2 ПЕРКА ДВИЖЕНИЯ'
    },
    contracts2: {
        title: 'ЧЁРНЫЙ РЫНОК', cost: 80, requires: null,    // ≈4
        desc: 'Три новых контракта: дороже ставка, крупнее выплата',
        pool: '3 КОНТРАКТА'
    },
    enemy_husk: {
        title: 'ГЛУБОКОВОДНАЯ ФАУНА', cost: 100, requires: null,  // ≈5
        desc: 'С глубины 2 появляется ОБОЛОЧКА: медленная, живучая, делится при смерти',
        pool: 'ВРАГ ОБОЛОЧКА'
    },
    perks_chain: {
        title: 'ЦЕПНАЯ ЛОГИКА', cost: 120, requires: 'perks_move',  // ≈5
        desc: 'Два перка уровня: каждое 5-е убийство бьёт молнией, парирование лечит',
        pool: '2 ПЕРКА ЦЕПИ'
    },
    artifacts2: {
        title: 'НИЧЕЙНЫЕ НАХОДКИ', cost: 150, requires: 'boomer',  // ≈7
        desc: 'Два артефакта без босса: падают только из редкого дропа',
        pool: '2 АРТЕФАКТА'
    },
    surge: {
        title: 'ПРИБОЙ', cost: 180, requires: 'boomer', minDepth: 4,    // ≈8
        desc: 'Четвёртый ствол: стена воды идёт сквозь толпу, расталкивая всех на пути',
        pool: 'СТВОЛ ПРИБОЙ'
    },
    perks_late: {
        title: 'ПРЕДЕЛ СИСТЕМЫ', cost: 220, requires: 'perks_chain', minDepth: 4,  // ≈10
        desc: 'Два перка уровня: second wind и удвоение кредитов за убийство',
        pool: '2 ПОЗДНИХ ПЕРКА'
    }
};

function unlockOwned(id) { return !!(saveData.unlocks && saveData.unlocks[id]); }

// Узел доступен, когда открыт его родитель. Дерево мелкое намеренно:
// глубокие ветки прячут содержимое за стеной, а прятать здесь нечего —
// каждый узел и есть награда.
// Часть узлов требует не родителя, а ПОБЕДЫ на глубине: иначе «иди глубже»
// осталось бы советом, а не условием. Победа — добровольный выход, а не смерть.
function depthReached(n) {
    if (!n) return true;
    const wins = saveData.depthWins || {};
    for (const d in wins) if (Number(d) >= n && wins[d] > 0) return true;
    return false;
}

function unlockAvailable(id) {
    const n = UNLOCK_NODES[id];
    if (!n || unlockOwned(id)) return false;
    if (n.requires && !unlockOwned(n.requires)) return false;
    return depthReached(n.minDepth);
}

function buyUnlock(id) {
    const n = UNLOCK_NODES[id];
    if (!n || !unlockAvailable(id)) return false;
    if ((saveData.cores || 0) < n.cost) return false;
    saveData.cores -= n.cost;
    saveData.unlocks = saveData.unlocks || {};
    saveData.unlocks[id] = { at: Date.now(), seen: false };
    writeSave();
    playSFX(sfxAchievement, 0.9);
    showAchievementToast(`${n.title} · ${n.pool}`, 'ОТКРЫТО');
    return true;
}

// Что добавилось в пул с прошлого забега. Плашка на старте нужна затем,
// чтобы покупка не растворилась: игрок должен идти в забег, ЗНАЯ, что тот
// будет другим.
function freshUnlocks() {
    const out = [];
    for (const id in (saveData.unlocks || {})) {
        const u = saveData.unlocks[id];
        if (u && !u.seen && UNLOCK_NODES[id]) out.push(UNLOCK_NODES[id]);
    }
    return out;
}

function markUnlocksSeen() {
    let changed = false;
    for (const id in (saveData.unlocks || {})) {
        if (saveData.unlocks[id] && !saveData.unlocks[id].seen) { saveData.unlocks[id].seen = true; changed = true; }
    }
    if (changed) writeSave();
}

// Сколько узлов открыто — для журнала и сводки меню
function unlocksProgress() {
    const ids = Object.keys(UNLOCK_NODES);
    return { have: ids.filter(unlockOwned).length, total: ids.length };
}
