// --- ФОН МЕНЮ: неоновая сетка и силуэт города ---
// Переключатели композиции (правь значения, без модулей)
const MENU_BG = { rain: true, grid: true, stars: true, sun: true };

const BG_MAGENTA = '#ff2fd0';
const BG_VIOLET = '#b026ff';
const BG_CYAN = '#00e0ff';

let menuBgCache = null;

function menuRnd(seed) {
    let t = seed >>> 0;
    return function () {
        t += 0x6D2B79F5;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
}

// Звёздное небо с пурпурными облаками — рисуется один раз
function buildSkyLayer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, w);
    c.height = Math.max(1, Math.round(h));
    const g = c.getContext('2d');
    const rnd = menuRnd(2077);

    const sky = g.createLinearGradient(0, 0, 0, c.height);
    sky.addColorStop(0, '#120627');
    sky.addColorStop(0.55, '#2a0b45');
    sky.addColorStop(1, '#4a1263');
    g.fillStyle = sky;
    g.fillRect(0, 0, c.width, c.height);

    // облака пыли: мягкие радиальные пятна
    for (let i = 0; i < 14; i++) {
        const cx = rnd() * c.width, cy = rnd() * c.height * 0.85;
        const r = 90 + rnd() * 220;
        const cloud = g.createRadialGradient(cx, cy, 0, cx, cy, r);
        const tint = rnd() > 0.5 ? '176,38,255' : '255,47,208';
        cloud.addColorStop(0, 'rgba(' + tint + ',0.11)');
        cloud.addColorStop(1, 'rgba(' + tint + ',0)');
        g.fillStyle = cloud;
        g.fillRect(cx - r, cy - r, r * 2, r * 2);
    }

    // звёзды
    for (let i = 0; i < 320; i++) {
        const sx = Math.round(rnd() * c.width), sy = Math.round(rnd() * c.height);
        const b = rnd();
        g.fillStyle = b > 0.93 ? '#ffd9ff' : '#ffffff';
        g.globalAlpha = 0.25 + rnd() * 0.6;
        g.fillRect(sx, sy, b > 0.96 ? 2 : 1, b > 0.96 ? 2 : 1);
    }
    g.globalAlpha = 1;
    return c;
}

// Неоновое солнце: диск с горизонтальными прорезями. Рисуется один раз в кэш.
function buildSunLayer(d) {
    const c = document.createElement('canvas');
    c.width = c.height = Math.max(2, Math.round(d));
    const g = c.getContext('2d');
    const r = c.width / 2;

    const grad = g.createLinearGradient(0, 0, 0, c.height);
    // Градиент сжат кверху: город закрывает низ диска, вся игра цвета
    // должна уместиться в верхнюю треть, иначе солнце читается плоским пятном.
    grad.addColorStop(0, '#f0c419');
    grad.addColorStop(0.20, '#ff9f1c');
    grad.addColorStop(0.48, BG_MAGENTA);
    grad.addColorStop(1, BG_VIOLET);
    g.fillStyle = grad;
    g.beginPath(); g.arc(r, r, r - 1, 0, Math.PI * 2); g.fill();

    // Прорези: ниже по диску — толще и чаще, диск растворяется в горизонте
    g.globalCompositeOperation = 'destination-out';
    // Шаг ограничен снизу: без этого он сходится к нулю и цикл не заканчивается.
    const minGap = c.height * 0.022;
    let y = c.height * 0.20, gap = c.height * 0.062, th = 1;
    while (y < c.height) {
        g.fillRect(0, Math.round(y), c.width, Math.max(1, Math.round(th)));
        y += gap;
        gap = Math.max(minGap, gap * 0.9);
        th += c.height * 0.006;
    }
    g.globalCompositeOperation = 'source-over';

    g.strokeStyle = 'rgba(255,190,245,0.7)';
    g.lineWidth = 2;
    g.beginPath(); g.arc(r, r, r - 1, 0, Math.PI * 2); g.stroke();
    return c;
}

// Силуэт города: чёрные башни с редкими окнами
function buildCityLayer(w, cfg) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, w);
    c.height = Math.max(1, Math.round(cfg.height));
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    const rnd = menuRnd(cfg.seed);
    const base = c.height;

    let x = -cfg.maxW;
    while (x < c.width + cfg.maxW) {
        const bw = Math.round(cfg.minW + rnd() * (cfg.maxW - cfg.minW));
        const bh = Math.round(cfg.minH + rnd() * (cfg.maxH - cfg.minH));
        const top = base - bh;
        const wrap = (x + bw > c.width) ? x - c.width : null;

        const drawBuilding = (bx) => {
            bx = Math.round(bx);
            g.fillStyle = cfg.body;
            g.fillRect(bx, top, bw, bh);

            // окна
            const cw = cfg.cell, rh = cfg.cell + 2;
            const cols = Math.max(1, Math.floor((bw - 6) / cw));
            const rows = Math.max(2, Math.floor((bh - 6) / rh));
            for (let i = 0; i < cols; i++) {
                for (let j = 0; j < rows; j++) {
                    const r = rnd();
                    if (r > cfg.lit) continue;
                    g.fillStyle = r < cfg.lit * 0.25 ? BG_CYAN : (r < cfg.lit * 0.6 ? '#ffd9ff' : BG_MAGENTA);
                    g.globalAlpha = 0.35 + rnd() * 0.5;
                    g.fillRect(bx + 3 + i * cw, top + 3 + j * rh, cw - 2, rh - 3);
                }
            }
            g.globalAlpha = 1;

            // контур крыши подсвечен закатной дымкой
            g.fillStyle = cfg.edge;
            g.globalAlpha = cfg.edgeAlpha;
            g.fillRect(bx, top, bw, 1);
            g.globalAlpha = 1;

            // редкие шпили и мачты
            const shape = rnd();
            if (shape > 0.86) {
                g.fillStyle = cfg.body;
                g.fillRect(bx + Math.floor(bw / 2) - 1, top - Math.round(16 + rnd() * 34), 3, 40);
            } else if (shape > 0.74) {
                const capW = Math.max(6, Math.round(bw * 0.45));
                const capH = Math.round(10 + rnd() * 22);
                g.fillStyle = cfg.body;
                g.fillRect(bx + Math.round((bw - capW) / 2), top - capH, capW, capH);
            }
        };

        drawBuilding(x);
        if (wrap !== null) drawBuilding(wrap);
        x += bw + cfg.gap * (0.2 + rnd() * 0.9);
    }
    return c;
}

function getMenuBg(w, h) {
    if (menuBgCache && menuBgCache.w === w && menuBgCache.h === h) return menuBgCache;
    const horizon = Math.round(h * 0.56);
    menuBgCache = {
        w, h, horizon,
        sky: buildSkyLayer(w, horizon + 40),
        sun: buildSunLayer(Math.min(h * 0.40, w * 0.36)),
        cityFar: buildCityLayer(w, {
            seed: 1337, height: Math.max(90, horizon * 0.3), minW: 12, maxW: 26, minH: 40, maxH: horizon * 0.26,
            gap: 4, body: '#150a2c', edge: BG_MAGENTA, edgeAlpha: 0.25, cell: 4, lit: 0.16
        }),
        cityNear: buildCityLayer(w, {
            seed: 90210, height: Math.max(130, horizon * 0.42), minW: 22, maxW: 52, minH: 60, maxH: horizon * 0.38,
            gap: 7, body: '#07030f', edge: BG_MAGENTA, edgeAlpha: 0.45, cell: 5, lit: 0.3
        })
    };
    return menuBgCache;
}

function drawParallaxLayer(layer, w, baseY, offset, px, py) {
    const off = (((offset + px) % w) + w) % w;
    const y = Math.round(baseY - layer.height + py);
    ctx.drawImage(layer, Math.round(-off), y);
    ctx.drawImage(layer, Math.round(w - off), y);
}

// Перспективная сетка: продольные линии сходятся в точку схода, поперечные набегают
function drawNeonGrid(time, w, h, horizon, vpX) {
    const span = h - horizon;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, horizon, w, span);
    ctx.clip();

    const floor = ctx.createLinearGradient(0, horizon, 0, h);
    floor.addColorStop(0, '#1a0630');
    floor.addColorStop(0.35, '#0d0320');
    floor.addColorStop(1, '#05010d');
    ctx.fillStyle = floor;
    ctx.fillRect(0, horizon, w, span);

    ctx.strokeStyle = BG_MAGENTA;

    // продольные
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    for (let i = -14; i <= 14; i++) {
        ctx.moveTo(vpX + i * 20, horizon);
        ctx.lineTo(vpX + i * 760, h + 60);
    }
    ctx.stroke();

    // поперечные: шаг растёт по степенному закону, фаза даёт движение "на зрителя"
    const rows = 16;
    const phase = (time * 0.00022) % 1;
    ctx.lineWidth = 1.6;
    for (let i = 0; i < rows; i++) {
        const t = (i + phase) / rows;
        const y = horizon + Math.pow(t, 2.6) * span;
        ctx.globalAlpha = 0.08 + t * 0.62;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
}

function drawLoreBackground(time) {
    const w = canvas.width, h = canvas.height;
    const bg = getMenuBg(w, h);

    // Сцена статична: слежения за курсором больше нет.
    const px = 0, py = 0;
    const horizon = bg.horizon;

    // 1. Небо
    ctx.drawImage(bg.sky, Math.round(-px * 6), Math.round(horizon + 40 - bg.sky.height - py * 4));

    // 2. Мерцание части звёзд поверх статичного неба
    if (MENU_BG.stars) {
        for (let i = 0; i < 50; i++) {
            const sx = (Math.sin(i * 913.7) * 0.5 + 0.5) * w - px * 6;
            const sy = (Math.cos(i * 517.3) * 0.5 + 0.5) * horizon * 0.8 - py * 4;
            ctx.globalAlpha = 0.15 + 0.75 * (Math.sin(time * 0.0016 + i) * 0.5 + 0.5);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(Math.round(sx), Math.round(sy), 1, 1);
        }
        ctx.globalAlpha = 1;
    }

    // 3. Неоновое солнце: садится за горизонт, город накрывает его силуэтом
    if (MENU_BG.sun) {
        const sd = bg.sun.width;
        ctx.drawImage(bg.sun,
            Math.round(w / 2 - sd / 2 - px * 10),
            Math.round(horizon - sd * 0.90 - py * 4));
    }

    // зарево у самой линии горизонта
    const glow = ctx.createLinearGradient(0, horizon - h * 0.12, 0, horizon + 6);
    glow.addColorStop(0, 'rgba(255,47,208,0)');
    glow.addColorStop(1, 'rgba(255,150,235,0.38)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, horizon - h * 0.12, w, h * 0.12 + 6);

    // 4. Город: два слоя параллакса
    drawParallaxLayer(bg.cityFar, w, horizon + 2, time * 0.005, px * 8, py * 4);
    drawParallaxLayer(bg.cityNear, w, horizon + 2, time * 0.012, px * 18, py * 8);

    // сигнальные огни на башнях
    for (let i = 0; i < 6; i++) {
        const bx = ((i * 271 - time * 0.012 - px * 18) % (w + 200) + w + 200) % (w + 200) - 100;
        const by = horizon - bg.cityNear.height * (0.55 + (i % 3) * 0.13) + py * 8;
        const on = Math.floor(time / 640 + i) % 2 === 0;
        ctx.fillStyle = on ? '#ff2d55' : 'rgba(255,45,85,0.16)';
        ctx.fillRect(Math.round(bx), Math.round(by), 3, 3);
    }

    // 5. Неоновая сетка
    const vpX = w / 2 - px * 120;
    if (MENU_BG.grid) drawNeonGrid(time, w, h, horizon, vpX);

    // линия горизонта
    ctx.fillStyle = 'rgba(255,190,245,0.8)';
    ctx.fillRect(0, Math.round(horizon), w, 2);

    // 7. Дождь: два слоя с разной скоростью
    if (MENU_BG.rain) {
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(190,150,255,0.20)';
        ctx.beginPath();
        for (let i = 0; i < 90; i++) {
            const rx = (i * 137.3 + time * 0.35) % (w + 60) - 30;
            const ry = (i * 211.7 + time * 1.1) % h;
            ctx.moveTo(rx, ry);
            ctx.lineTo(rx - 5, ry + 18);
        }
        ctx.stroke();

        ctx.strokeStyle = 'rgba(255,120,230,0.28)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 34; i++) {
            const rx = (i * 271.1 + time * 0.7) % (w + 80) - 40;
            const ry = (i * 331.9 + time * 1.9) % h;
            ctx.moveTo(rx, ry);
            ctx.lineTo(rx - 9, ry + 30);
        }
        ctx.stroke();
    }

    // 8. Развёртка и виньетка
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);

    const vig = ctx.createRadialGradient(w / 2, h * 0.5, h * 0.32, w / 2, h * 0.5, h * 0.85);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(4,0,12,0.6)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);
}
