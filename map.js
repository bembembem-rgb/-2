// Одна шкала на обе карты: десять мировых пикселей = метр. Число взято
// с потолка, но оно одно и то же и у линейки масштаба, и у подписей
// дальности — иначе «400 м» на карте и «400 м» у метки значили бы разное.
const MAP_PX_PER_M = 10;
function mapDist(a, b) {
    const m = Math.hypot(a.x - b.x, a.y - b.y) / MAP_PX_PER_M;
    return m >= 1000 ? (m / 1000).toFixed(1) + 'К' : Math.round(m) + 'М';
}

function drawMinimap() {
    const mc = document.getElementById('minimapCanvas');
    if (!mc || !player) return;
    const mctx = mc.getContext('2d');
    const size = mc.width, cx = size / 2, cy = size / 2, radius = size / 2 - 4;
    const range = 1600; // мировых пикселей на радиус карты
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
    mctx.strokeStyle = UI.line; mctx.lineWidth = 1;
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

    for (const e of enemies) { if (e.type === 'boss') continue; plot(e.x, e.y, UI.red, 3); }
    // Транспорт на сонаре был только на большой карте, хотя весь квест
    // именно про то, чтобы до него добежать
    for (const v of transports) plot(v.x, v.y, v.isQuestVehicle ? UI.gold : UI.amber, 4);
    if (typeof questVehicle !== 'undefined' && questVehicle && typeof questState !== 'undefined' && questState === 'seeking') plot(questVehicle.x, questVehicle.y, UI.gold, 5);
    if (typeof extractionPoint !== 'undefined' && extractionPoint) plot(extractionPoint.x, extractionPoint.y, UI.green, 5);
    if (deepVault) plot(deepVault.x, deepVault.y, deepVault.sealed ? UI.txtMute : UI.magenta, deepVault.sealed ? 3 : 5);
    if (coopMode && player2 && !player2.downed) plot(player2.x, player2.y, UI.blue, 5);
    for (const g of groundArtifacts) plot(g.x, g.y, (ARTIFACTS[g.id] || {}).color || UI.gold, 5);
    if (activeBoss) plot(activeBoss.x, activeBoss.y, UI.red, 7);

    // Игрок в центре. Поворот берётся с прицела: поля angle у пешего бойца
    // нет вовсе, и стрелка годами показывала строго вправо.
    mctx.save(); mctx.translate(cx, cy);
    mctx.rotate(player.inVehicle && player.currentVehicle ? player.currentVehicle.angle : getP1AimAngle());
    mctx.fillStyle = UI.cyan;
    mctx.beginPath(); mctx.moveTo(8, 0); mctx.lineTo(-6, -6); mctx.lineTo(-6, 6); mctx.closePath(); mctx.fill();
    mctx.restore();

    mctx.restore();

    mctx.strokeStyle = UI.line; mctx.lineWidth = 2;
    mctx.beginPath(); mctx.arc(cx, cy, radius, 0, Math.PI * 2); mctx.stroke();
    // Радиус сонара цифрой: без него кольца — просто узор
    mctx.font = '8px monospace'; mctx.fillStyle = UI.txtMute; mctx.textAlign = 'center';
    mctx.fillText(Math.round(range / MAP_PX_PER_M) + 'М', cx, size - 2);
}

// --- БОЛЬШАЯ КАРТА (R1 / M) ---
function drawBigMap() {
    if (!player) return;
    const time = performance.now();
    const side = Math.min(canvas.width, canvas.height) * 0.9;
    const ox = (canvas.width - side) / 2, oy = (canvas.height - side) / 2;
    const range = 5200; // мировых пикселей от центра до края карты
    const scale = (side / 2) / range;

    let ccx = player.x, ccy = player.y;
    if (coopMode && player2 && !player2.downed) { ccx = (player.x + player2.x) / 2; ccy = (player.y + player2.y) / 2; }

    ctx.save();
    ctx.fillStyle = 'rgba(5,8,14,0.92)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.beginPath(); ctx.rect(ox, oy, side, side); ctx.clip();
    ctx.fillStyle = UI.panel; ctx.fillRect(ox, oy, side, side);

    const toX = (wx) => ox + side / 2 + (wx - ccx) * scale;
    const toY = (wy) => oy + side / 2 + (wy - ccy) * scale;

    // сетка
    ctx.strokeStyle = 'rgba(33,65,79,0.55)'; ctx.lineWidth = 1;
    const gridStep = 400 * scale;
    const gx0 = toX(Math.floor((ccx - range) / 400) * 400);
    for (let x = gx0; x < ox + side; x += gridStep) { ctx.beginPath(); ctx.moveTo(x, oy); ctx.lineTo(x, oy + side); ctx.stroke(); }
    const gy0 = toY(Math.floor((ccy - range) / 400) * 400);
    for (let y = gy0; y < oy + side; y += gridStep) { ctx.beginPath(); ctx.moveTo(ox, y); ctx.lineTo(ox + side, y); ctx.stroke(); }

    // препятствия и стены аванпоста
    ctx.fillStyle = 'rgba(33,65,79,0.9)';
    for (const obs of obstacles.values()) if (obs) ctx.fillRect(toX(obs.x), toY(obs.y), Math.max(2, obs.w * scale), Math.max(2, obs.h * scale));
    for (const obs of customObstacles) {
        ctx.fillStyle = obs.isGeyser ? 'rgba(15,127,140,0.9)' : 'rgba(61,139,255,0.8)';
        ctx.fillRect(toX(obs.x), toY(obs.y), Math.max(2, obs.w * scale), Math.max(2, obs.h * scale));
    }

    // Вес метки = её важность. Свечение не используется.
    const dot = (wx, wy, color, r) => {
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(toX(wx), toY(wy), r, 0, Math.PI * 2); ctx.fill();
    };

    for (const e of enemies) { if (e.type !== 'boss') dot(e.x, e.y, UI.red, 3); }
    for (const v of transports) dot(v.x, v.y, v.isQuestVehicle ? UI.gold : UI.amber, 5);
    if (activeBoss) dot(activeBoss.x, activeBoss.y, UI.red, 9);

    if (extractionPoint) {
        ctx.strokeStyle = UI.green; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(toX(extractionPoint.x), toY(extractionPoint.y), Math.max(6, extractionPoint.radius * scale), 0, Math.PI * 2); ctx.stroke();
    }
    if (deepVault) {
        ctx.strokeStyle = deepVault.sealed ? UI.txtMute : UI.magenta; ctx.lineWidth = 2;
        if (deepVault.sealed) ctx.setLineDash([5, 5]);
        ctx.beginPath(); ctx.arc(toX(deepVault.x), toY(deepVault.y), Math.max(6, deepVault.radius * scale), 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
    }
    if (questOutpost) {
        ctx.strokeStyle = UI.line; ctx.lineWidth = 1; ctx.setLineDash([6, 6]);
        ctx.beginPath(); ctx.arc(toX(questOutpost.x), toY(questOutpost.y), questOutpost.r * scale, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
    }

    dot(player.x, player.y, UI.cyan, 7);
    // Куда смотрит игрок. Точка без направления не говорит, в какую
    // сторону он побежит, если отпустить карту.
    ctx.save();
    ctx.translate(toX(player.x), toY(player.y));
    ctx.rotate(player.inVehicle && player.currentVehicle ? player.currentVehicle.angle : getP1AimAngle());
    ctx.fillStyle = UI.cyan;
    ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(7, -5); ctx.lineTo(7, 5); ctx.closePath(); ctx.fill();
    ctx.restore();
    if (coopMode && player2) dot(player2.x, player2.y, player2.downed ? UI.txtMute : UI.blue, 7);

    ctx.restore();

    // Цели за краем карты. Раньше их просто не было видно: пока эвакуация
    // не попадёт в квадрат, карта молчала о том, что она вообще есть.
    const goals = [];
    if (extractionPoint) goals.push([extractionPoint, UI.green, 'ЭВАКУАЦИЯ']);
    if (deepVault && !deepVault.sealed) goals.push([deepVault, UI.magenta, 'ШЛЮЗ']);
    if (typeof questVehicle !== 'undefined' && questVehicle && questState === 'seeking') goals.push([questVehicle, UI.gold, 'КВЕСТ']);
    if (activeBoss) goals.push([activeBoss, UI.red, 'БОСС']);
    ctx.save();
    ctx.font = "9px var(--font-pixel)"; ctx.textAlign = 'center';
    const mx = ox + side / 2, my = oy + side / 2, lim = side / 2 - 22;
    for (const [g, color, label] of goals) {
        const gx = toX(g.x), gy = toY(g.y);
        const inside = gx > ox + 4 && gx < ox + side - 4 && gy > oy + 4 && gy < oy + side - 4;
        const dist = mapDist(player, g);
        if (inside) {
            ctx.fillStyle = UI.txtDim;
            ctx.fillText(dist, gx, gy - 12);
            continue;
        }
        // Метку кладём на границу квадрата по направлению к цели
        const a = Math.atan2(gy - my, gx - mx);
        const k = Math.min(lim / Math.abs(Math.cos(a) || 1e-6), lim / Math.abs(Math.sin(a) || 1e-6));
        const ex = mx + Math.cos(a) * k, ey = my + Math.sin(a) * k;
        ctx.save();
        ctx.translate(ex, ey); ctx.rotate(a);
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-6, -7); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill();
        ctx.restore();
        ctx.fillStyle = color;
        ctx.fillText(label, ex - Math.cos(a) * 26, ey - Math.sin(a) * 26 - 4);
        ctx.fillStyle = UI.txtDim;
        ctx.fillText(dist, ex - Math.cos(a) * 26, ey - Math.sin(a) * 26 + 8);
    }
    ctx.restore();

    // рамка и подписи
    ctx.save();
    ctx.strokeStyle = UI.line; ctx.lineWidth = 1;
    ctx.strokeRect(ox + 0.5, oy + 0.5, side - 1, side - 1);
    ctx.font = "12px var(--font-pixel)"; ctx.fillStyle = UI.txt; ctx.textAlign = 'left';
    ctx.fillText('ТАКТИЧЕСКАЯ КАРТА', ox, oy - 14);
    ctx.textAlign = 'right'; ctx.fillStyle = UI.txtDim; ctx.font = "10px var(--font-pixel)";
    ctx.fillText('[R1] / [M] — ЗАКРЫТЬ', ox + side, oy - 14);

    // Линейка масштаба: без неё квадрат карты не говорит, далеко ли
    // «вон та точка в углу» — километр или десять шагов.
    const barWorld = 1000;                       // мировых пикселей в линейке
    const barPx = barWorld * scale;
    const bx = ox + side - barPx - 12, by = oy + side - 14;
    ctx.strokeStyle = UI.txtDim; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx, by - 5); ctx.lineTo(bx, by); ctx.lineTo(bx + barPx, by); ctx.lineTo(bx + barPx, by - 5);
    ctx.stroke();
    ctx.textAlign = 'center'; ctx.fillStyle = UI.txtDim; ctx.font = "9px var(--font-pixel)";
    ctx.fillText(Math.round(barWorld / MAP_PX_PER_M) + 'М', bx + barPx / 2, by - 8);

    const legend = [[UI.cyan, 'P1'], [UI.blue, 'P2'], [UI.gold, 'КВЕСТ'], [UI.amber, 'ТРАНСПОРТ'], [UI.green, 'ЭВАКУАЦИЯ'], [UI.magenta, 'ШЛЮЗ'], [UI.red, 'БОСС']];
    ctx.textAlign = 'left'; ctx.font = "10px var(--font-pixel)";
    let lx = ox, ly = oy + side + 22;
    legend.forEach(([c, label]) => {
        ctx.fillStyle = c; ctx.fillRect(lx, ly - 8, 8, 8);
        ctx.fillStyle = UI.txtDim; ctx.fillText(label, lx + 14, ly);
        lx += 14 + ctx.measureText(label).width + 24;
    });
    ctx.restore();
}
