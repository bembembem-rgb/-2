// Одна шкала на обе карты: десять мировых пикселей = метр. Число взято
// с потолка, но оно одно и то же и у линейки масштаба, и у подписей
// дальности — иначе «400 м» на карте и «400 м» у метки значили бы разное.
const MAP_PX_PER_M = 10;
function mapDist(a, b) {
    const m = Math.hypot(a.x - b.x, a.y - b.y) / MAP_PX_PER_M;
    return m >= 1000 ? (m / 1000).toFixed(1) + 'К' : Math.round(m) + 'М';
}

// Сонар перерисовывается не каждый кадр: метки на нём ползут медленно,
// а на телефоне он рисуется поверх боя и стоил три кадра из пятидесяти.
let _minimapTick = 0;
function drawMinimap() {
    const mc = document.getElementById('minimapCanvas');
    if (!mc || !player) return;
    if (isMobile && (_minimapTick++ % 3) !== 0) return;
    const mctx = mc.getContext('2d');
    const size = mc.width, cx = size / 2, cy = size / 2;
    // Метки, шрифт и толщина линий считаются от размера холста: на телефоне
    // он вчетверо меньше, и фиксированные тройки пикселей превращались там
    // в пыль, которую не разглядеть.
    const k = size / (isMobile ? 84 : 160);
    const radius = size / 2 - 4 * k;
    const range = isMobile ? 1100 : 1600;
    const scale = Math.min(1, radius / range);
    mctx.clearRect(0, 0, size, size);
    mctx.save();
    mctx.beginPath(); mctx.arc(cx, cy, radius, 0, Math.PI * 2); mctx.clip();

    // Рельеф под метками: без него сонар показывал пустоту, по которой
    // нельзя понять, откуда враг придёт, а откуда его не пустит стена.
    mctx.fillStyle = 'rgba(33,65,79,0.55)';
    for (const obs of obstacles.values()) {
        if (!obs) continue;
        mctx.fillRect(cx + (obs.x - player.x) * scale, cy + (obs.y - player.y) * scale,
            Math.max(1, obs.w * scale), Math.max(1, obs.h * scale));
    }
    mctx.fillStyle = 'rgba(61,139,255,0.5)';
    for (const obs of customObstacles) {
        if (obs.isGeyser) continue;
        mctx.fillRect(cx + (obs.x - player.x) * scale, cy + (obs.y - player.y) * scale,
            Math.max(1, obs.w * scale), Math.max(1, obs.h * scale));
    }

    // Кольца дальности — шкала, а не декор. Луч-развёртка убран.
    mctx.strokeStyle = UI.line; mctx.lineWidth = k;
    for (let r = radius / 3; r <= radius; r += radius / 3) { mctx.beginPath(); mctx.arc(cx, cy, r, 0, Math.PI * 2); mctx.stroke(); }
    mctx.beginPath(); mctx.moveTo(cx - radius, cy); mctx.lineTo(cx + radius, cy); mctx.moveTo(cx, cy - radius); mctx.lineTo(cx, cy + radius); mctx.stroke();

    // Иерархия задаётся размером метки, а не свечением. Цель за краем
    // сонара превращается в треугольник по краю: точка на ободе врала бы,
    // будто до неё столько же, сколько до соседней точки внутри круга.
    const plot = (wx, wy, color, r) => {
        const dx = wx - player.x, dy = wy - player.y;
        let px = cx + dx * scale, py = cy + dy * scale;
        const d = Math.hypot(px - cx, py - cy);
        if (d > radius - r) {
            const ang = Math.atan2(py - cy, px - cx);
            px = cx + Math.cos(ang) * (radius - r); py = cy + Math.sin(ang) * (radius - r);
            mctx.save(); mctx.translate(px, py); mctx.rotate(ang);
            mctx.fillStyle = color;
            mctx.beginPath(); mctx.moveTo(r, 0); mctx.lineTo(-r, -r * 0.8); mctx.lineTo(-r, r * 0.8);
            mctx.closePath(); mctx.fill();
            mctx.restore();
            return;
        }
        mctx.fillStyle = color;
        mctx.beginPath(); mctx.arc(px, py, r, 0, Math.PI * 2); mctx.fill();
    };

    for (const e of enemies) { if (e.type === 'boss') continue; plot(e.x, e.y, UI.red, 3 * k); }
    // Транспорт на сонаре был только на большой карте, хотя весь квест
    // именно про то, чтобы до него добежать
    for (const v of transports) plot(v.x, v.y, v.isQuestVehicle ? UI.gold : UI.amber, 4 * k);
    if (typeof questVehicle !== 'undefined' && questVehicle && typeof questState !== 'undefined' && questState === 'seeking') plot(questVehicle.x, questVehicle.y, UI.gold, 5 * k);
    if (typeof extractionPoint !== 'undefined' && extractionPoint) plot(extractionPoint.x, extractionPoint.y, UI.green, 5 * k);
    if (deepVault) plot(deepVault.x, deepVault.y, deepVault.sealed ? UI.txtMute : UI.magenta, (deepVault.sealed ? 3 : 5) * k);
    if (coopMode && player2 && !player2.downed) plot(player2.x, player2.y, UI.blue, 5 * k);
    for (const g of groundArtifacts) plot(g.x, g.y, (ARTIFACTS[g.id] || {}).color || UI.gold, 5 * k);
    if (activeBoss) plot(activeBoss.x, activeBoss.y, UI.red, 7 * k);

    // Игрок в центре. Поворот берётся с прицела: поля angle у пешего бойца
    // нет вовсе, и стрелка годами показывала строго вправо.
    mctx.save(); mctx.translate(cx, cy);
    mctx.rotate(player.inVehicle && player.currentVehicle ? player.currentVehicle.angle : getP1AimAngle());
    mctx.fillStyle = UI.cyan;
    mctx.beginPath(); mctx.moveTo(8 * k, 0); mctx.lineTo(-6 * k, -6 * k); mctx.lineTo(-6 * k, 6 * k); mctx.closePath(); mctx.fill();
    mctx.restore();

    mctx.restore();

    mctx.strokeStyle = isMobile ? UI.cyan : UI.line; mctx.lineWidth = 2 * k;
    mctx.globalAlpha = isMobile ? 0.55 : 1;
    mctx.beginPath(); mctx.arc(cx, cy, radius, 0, Math.PI * 2); mctx.stroke();
    mctx.globalAlpha = 1;
    // Радиус сонара цифрой: без него кольца — просто узор. На телефоне
    // подписи нет — на восьмидесяти пикселях её всё равно не прочесть.
    if (!isMobile) {
        mctx.font = '8px monospace'; mctx.fillStyle = UI.txtMute; mctx.textAlign = 'center';
        mctx.fillText(Math.round(range / MAP_PX_PER_M) + 'М', cx, size - 2);
    }
}

// --- БОЛЬШАЯ КАРТА: ГЛУБИННЫЙ СОНАР ---
// Квадратный лист карты здесь врал дважды: по углам он показывал дальше,
// чем по сторонам, и на телефоне от него оставалась полоска. Диск честнее —
// до края одинаково далеко в любую сторону, и он же влезает в любой экран.

const SONAR_GOAL_R = 26;

function sonarGeometry() {
    const w = canvas.width, h = canvas.height;
    const pad = isMobile ? 40 : 56;
    const radius = Math.min(w, h) / 2 - pad;
    return { cx: w / 2, cy: h / 2 + (isMobile ? 10 : 0), radius, w, h };
}

function drawBigMap() {
    if (!player) return;
    const { cx, cy, radius, w, h } = sonarGeometry();
    if (radius < 60) return;
    const range = 5200;
    const scale = radius / range;

    let ccx = player.x, ccy = player.y;
    if (coopMode && player2 && !player2.downed) { ccx = (player.x + player2.x) / 2; ccy = (player.y + player2.y) / 2; }
    const toX = (wx) => cx + (wx - ccx) * scale;
    const toY = (wy) => cy + (wy - ccy) * scale;

    ctx.save();
    ctx.fillStyle = 'rgba(5,8,14,0.94)';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = UI.panel;
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);

    ctx.strokeStyle = 'rgba(33,65,79,0.5)'; ctx.lineWidth = 1;
    const step = 400 * scale;
    const gx0 = toX(Math.floor((ccx - range) / 400) * 400);
    for (let x = gx0; x < cx + radius; x += step) { ctx.beginPath(); ctx.moveTo(x, cy - radius); ctx.lineTo(x, cy + radius); ctx.stroke(); }
    const gy0 = toY(Math.floor((ccy - range) / 400) * 400);
    for (let y = gy0; y < cy + radius; y += step) { ctx.beginPath(); ctx.moveTo(cx - radius, y); ctx.lineTo(cx + radius, y); ctx.stroke(); }

    ctx.fillStyle = 'rgba(33,65,79,0.9)';
    for (const obs of obstacles.values()) if (obs) ctx.fillRect(toX(obs.x), toY(obs.y), Math.max(2, obs.w * scale), Math.max(2, obs.h * scale));
    for (const obs of customObstacles) {
        ctx.fillStyle = obs.isGeyser ? 'rgba(15,127,140,0.9)' : 'rgba(61,139,255,0.8)';
        ctx.fillRect(toX(obs.x), toY(obs.y), Math.max(2, obs.w * scale), Math.max(2, obs.h * scale));
    }

    const dot = (wx, wy, color, r) => {
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(toX(wx), toY(wy), r, 0, Math.PI * 2); ctx.fill();
    };
    const ring = (wx, wy, color, wr, dash) => {
        ctx.strokeStyle = color; ctx.lineWidth = 2;
        if (dash) ctx.setLineDash([5, 5]);
        ctx.beginPath(); ctx.arc(toX(wx), toY(wy), Math.max(6, wr * scale), 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
    };

    for (const e of enemies) { if (e.type !== 'boss') dot(e.x, e.y, UI.red, 3); }
    for (const v of transports) dot(v.x, v.y, v.isQuestVehicle ? UI.gold : UI.amber, 5);
    for (const g of groundArtifacts) dot(g.x, g.y, (ARTIFACTS[g.id] || {}).color || UI.gold, 5);
    if (activeBoss) dot(activeBoss.x, activeBoss.y, UI.red, 9);
    if (extractionPoint) ring(extractionPoint.x, extractionPoint.y, UI.green, extractionPoint.radius);
    if (deepVault) ring(deepVault.x, deepVault.y, deepVault.sealed ? UI.txtMute : UI.magenta, deepVault.radius, deepVault.sealed);
    if (questOutpost) { ctx.strokeStyle = UI.line; ctx.lineWidth = 1; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.arc(toX(questOutpost.x), toY(questOutpost.y), questOutpost.r * scale, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }

    dot(player.x, player.y, UI.cyan, 7);
    ctx.save();
    ctx.translate(toX(player.x), toY(player.y));
    ctx.rotate(player.inVehicle && player.currentVehicle ? player.currentVehicle.angle : getP1AimAngle());
    ctx.fillStyle = UI.cyan;
    ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(7, -5); ctx.lineTo(7, 5); ctx.closePath(); ctx.fill();
    ctx.restore();
    if (coopMode && player2) dot(player2.x, player2.y, player2.downed ? UI.txtMute : UI.blue, 7);
    ctx.restore();

    // Кольца дальности и подписи к ним: без цифр круг остаётся узором.
    ctx.strokeStyle = UI.line; ctx.lineWidth = 1;
    ctx.font = "9px 'JetBrains Mono', monospace"; ctx.textAlign = 'center';
    for (let k = 1; k <= 3; k++) {
        const r = radius * k / 3;
        ctx.globalAlpha = k === 3 ? 1 : 0.45;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = UI.txtMute;
        ctx.fillText(Math.round(range * k / 3 / MAP_PX_PER_M) + 'М', cx, cy - r + 12);
    }
    // Засечки по ободу вместо рамки: они же дают чувство направления.
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
        const long = Math.abs(a % (Math.PI / 2)) < 0.01;
        const r1 = radius, r2 = radius + (long ? 9 : 4);
        ctx.strokeStyle = long ? UI.txtDim : UI.line;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
        ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
        ctx.stroke();
    }

    // Цели: те, что за краем, садятся на обод стрелкой; те, что внутри,
    // получают подпись с дальностью рядом с меткой.
    const goals = [];
    if (extractionPoint) goals.push([extractionPoint, UI.green, 'ЭВАКУАЦИЯ']);
    if (deepVault && !deepVault.sealed) goals.push([deepVault, UI.magenta, 'ШЛЮЗ']);
    if (typeof questVehicle !== 'undefined' && questVehicle && questState === 'seeking') goals.push([questVehicle, UI.gold, 'КВЕСТ']);
    if (activeBoss) goals.push([activeBoss, UI.red, 'БОСС']);
    ctx.font = "9px 'JetBrains Mono', monospace"; ctx.textAlign = 'center';
    for (const [g, color, label] of goals) {
        const gx = toX(g.x), gy = toY(g.y);
        const d = Math.hypot(gx - cx, gy - cy);
        const dist = mapDist(player, g);
        if (d < radius - 10) {
            ctx.fillStyle = color; ctx.fillText(label, gx, gy - 20);
            ctx.fillStyle = UI.txtDim; ctx.fillText(dist, gx, gy - 9);
            continue;
        }
        const a = Math.atan2(gy - cy, gx - cx);
        const ex = cx + Math.cos(a) * (radius - 10), ey = cy + Math.sin(a) * (radius - 10);
        ctx.save();
        ctx.translate(ex, ey); ctx.rotate(a);
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-6, -7); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill();
        ctx.restore();
        const lx = cx + Math.cos(a) * (radius - SONAR_GOAL_R - 12), ly = cy + Math.sin(a) * (radius - SONAR_GOAL_R - 12);
        ctx.fillStyle = color; ctx.fillText(label, lx, ly - 4);
        ctx.fillStyle = UI.txtDim; ctx.fillText(dist, lx, ly + 8);
    }

    ctx.textAlign = 'center';
    ctx.font = (isMobile ? "11px" : "13px") + " 'JetBrains Mono', monospace";
    ctx.fillStyle = UI.txt;
    ctx.fillText('ГЛУБИННЫЙ СОНАР', cx, cy - radius - (isMobile ? 18 : 26));
    ctx.font = "9px 'JetBrains Mono', monospace"; ctx.fillStyle = UI.txtMute;
    ctx.fillText(isMobile ? 'ТАП — ЗАКРЫТЬ' : '[M] — ЗАКРЫТЬ', cx, cy + radius + (isMobile ? 22 : 28));

    if (!isMobile) {
        const legend = [[UI.cyan, 'P1'], [UI.gold, 'КВЕСТ'], [UI.amber, 'ТРАНСПОРТ'], [UI.green, 'ЭВАКУАЦИЯ'], [UI.magenta, 'ШЛЮЗ'], [UI.red, 'ВРАГ']];
        ctx.font = "10px 'JetBrains Mono', monospace"; ctx.textAlign = 'left';
        let lw = 0;
        for (const [, label] of legend) lw += 14 + ctx.measureText(label).width + 22;
        let lx = cx - lw / 2;
        const ly = cy + radius + 46;
        for (const [c, label] of legend) {
            ctx.fillStyle = c; ctx.fillRect(lx, ly - 8, 8, 8);
            ctx.fillStyle = UI.txtDim; ctx.fillText(label, lx + 14, ly);
            lx += 14 + ctx.measureText(label).width + 22;
        }
    }
    ctx.restore();
}
