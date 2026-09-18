#!/usr/bin/env python3
"""Спрайт-листы эффектов для NEON TIDES: ZERO — пиксель-арт.

Лист — горизонтальная полоса квадратных кадров. Игра режет её сама:
spawnSpriteFX берёт высоту за размер кадра и делит ширину на неё.
Поэтому размер кадра стоит прямо в имени: fx_arc_48x48.png.

    python3 tools/make_vfx.py           # всё
    python3 tools/make_vfx.py arc ink   # только эти

Правила, по которым это нарисовано:
  * прозрачность двоичная, полутонов нет. Затухание делает не альфа,
    а переход вниз по палитре и дизеринг — так гаснут эффекты в играх,
    нарисованных попиксельно;
  * у каждого эффекта своя рампа из 4-5 цветов, не градиент;
  * силуэт держит тёмная обводка: без неё эффект тонет в пёстрой сцене;
  * кадры меняются рывками, а не плавно. Пиксельная анимация живёт
    сменой формы, а не интерполяцией.
"""
import os, sys, math
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pixel import Px, sheet

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'vfx')

# Рампы: [прозрачный, обводка, тень, основной, блик]
P_CYAN  = [None, (6, 26, 40), (0, 120, 160), (0, 224, 255), (208, 254, 255)]
P_VIO   = [None, (28, 10, 46), (122, 56, 186), (196, 109, 255), (240, 214, 255)]
P_MAG   = [None, (40, 6, 32), (168, 24, 130), (255, 47, 208), (255, 190, 240)]
P_GREEN = [None, (6, 36, 24), (20, 150, 96), (43, 255, 158), (198, 255, 228)]
P_AMBER = [None, (44, 18, 2), (176, 96, 10), (255, 159, 28), (255, 226, 170)]
P_INK   = [None, (24, 6, 38), (96, 34, 150), (196, 109, 255), (255, 47, 208)]

OUTL, SHAD, MAIN, HILI = 1, 2, 3, 4


def dissolve(p, k):
    """Съедает пиксели по порядковой матрице. Матрица 4x4 даёт шестнадцать
    ступеней: на 2x2 их всего четыре, и эффект не растворялся, а обрывался,
    оставляя пустые кадры в хвосте листа."""
    if k <= 0: return
    from pixel import BAYER
    s = p.s
    thr = np.tile(BAYER, (s // 4 + 1, s // 4 + 1))[:s, :s]
    p.buf[(p.buf > 0) & (thr < min(k, 0.88))] = 0


def fade_idx(t, lo=SHAD):
    """Чем ближе к концу, тем ниже по рампе уходит основной цвет."""
    if t < 0.45: return HILI
    if t < 0.75: return MAIN
    return lo


# ---------------------------------------------------------------- эффекты

def bubble_burst(s=32, n=10):
    """Гроздь пузырей: растут, потом лопаются на осколки."""
    # Пузыри стоят по кольцу с разным радиусом: при случайных позициях
    # они слипались в одно пятно и гроздь не читалась.
    seeds = []
    for k in range(6):
        ang = k * (2*np.pi/6) + (0.35 if k % 2 else 0)
        seeds.append((ang, 6.0 + (k % 3) * 2.0, 3 + (k % 2)))
    out = []
    for i in range(n):
        t = i / (n - 1); p = Px(s); c = s / 2
        for k, (ang, dist, rad) in enumerate(seeds):
            born = (k % 3) * 0.08
            lt = (t - born) / max(1e-6, 1 - born)
            if lt <= 0: continue
            d = dist * (0.55 + lt * 0.8)
            x, y = c + math.cos(ang)*d, c + math.sin(ang)*d - lt*4
            if lt < 0.62:
                r = rad * (0.6 + lt * 0.7)
                p.ring(x, y, r, MAIN, 1)
                p.dot(x - max(1, r*0.5), y - max(1, r*0.5), HILI)
            else:
                # Лопнул: четыре осколка по диагоналям и всё. Дизеринг
                # тут превращал кадр в поле шума вместо осколков.
                q = (lt - 0.62) / 0.38
                sp = rad * (1.0 + q * 2.0)
                col = HILI if q < 0.5 else SHAD
                for a in (0.8, 2.4, 3.9, 5.5):
                    p.dot(x + math.cos(a)*sp, y + math.sin(a)*sp, col)
        if t < 0.3:
            p.block(c - 1, c - 1, 2, 2, HILI)
        p.outline(None, OUTL)
        out.append(p.to_rgba(P_CYAN))
    return out


def shock_ring(s=64, n=10):
    """Ударное кольцо: жёсткий контур расходится и рассыпается."""
    out = []
    for i in range(n):
        t = i / (n - 1); p = Px(s); c = s / 2
        r = 4 + t * (s * 0.44)
        w = max(1, int(round(3 - t * 2)))
        if t < 0.2:
            p.disc(c, c, 5 * (1 - t*3), HILI)
        # внутренняя рябь: даёт объём, не размывая контур
        p.band_dither(c, c, max(0, r - 7), r - w, SHAD, density=0.55 * (1 - t))
        p.ring(c, c, r, MAIN if t > 0.3 else HILI, w)
        if t > 0.45:
            p.ring(c, c, r * 0.72, SHAD, 1)
        if t > 0.7:
            # рассыпаем контур: сплошное кольцо не должно просто исчезнуть
            k = (t - 0.7) / 0.3
            dissolve(p, k)
        p.outline(None, OUTL)
        out.append(p.to_rgba(P_CYAN))
    return out


def arc(s=48, n=8):
    """Разряд: ломаная с ядром и ветками, каждый кадр рисуется заново."""
    rng = np.random.default_rng(23)
    out = []
    for i in range(n):
        t = i / (n - 1); p = Px(s)
        steps = 7
        pts = [(2, s//2)]
        for k in range(1, steps + 1):
            x = 2 + (s - 4) * k / steps
            spread = (s * 0.28) * math.sin(math.pi * k / steps)
            pts.append((x, s/2 + rng.uniform(-spread, spread)))
        col = fade_idx(t)
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            p.line(x0, y0, x1, y1, SHAD, 3)
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            p.line(x0, y0, x1, y1, col, 1)
        for _ in range(3):
            k = int(rng.integers(1, steps))
            x0, y0 = pts[k]
            a = rng.uniform(0, 2*np.pi); ln = rng.uniform(5, 10)
            p.line(x0, y0, x0 + math.cos(a)*ln, y0 + math.sin(a)*ln, col, 1)
        if t > 0.75:
            k = (t - 0.75) / 0.25
            dissolve(p, k)
        p.outline(None, OUTL)
        out.append(p.to_rgba(P_VIO))
    return out


def ink(s=48, n=12):
    """Клякса пустоты: доли растут вразнобой, край рваный."""
    rng = np.random.default_rng(37)
    lobes = [(rng.uniform(0, 2*np.pi), rng.uniform(0.4, 1.0), rng.uniform(4, 8)) for _ in range(9)]
    out = []
    for i in range(n):
        t = i / (n - 1); p = Px(s); c = s / 2
        # Ноль в начале дал бы пустой первый кадр, и эффект появлялся
        # бы с пропуском длиной в кадр.
        g = max(0.12, t) ** 0.5
        # Доли расставлены по кругу равномерно: при случайных углах
        # силуэт сходился в вытянутую фасолину вместо облака.
        for k, (_, dist, rad) in enumerate(lobes):
            ang = k * (2*np.pi/len(lobes))
            lag = (k % 3) * 0.09
            gk = max(0.0, t - lag) ** 0.5 if t > lag else (0.18 if k % 3 == 0 else 0.0)
            if gk <= 0: continue
            d = dist * gk * s * 0.26
            p.disc(c + math.cos(ang)*d, c + math.sin(ang)*d, rad * (0.5 + gk*0.9), SHAD)
        # Дыра: ядро выбивается в самый тёмный цвет и занимает половину
        # кляксы. Иначе эффект читается как светящийся шар.
        p.disc(c, c, s * 0.26 * g, OUTL)
        p.band_dither(c, c, s*0.26*g, s*0.36*g, OUTL, density=0.55)
        # Ободок только по внешнему силуэту, а не вокруг каждой доли
        filled = p.buf > 0
        rim = np.zeros_like(filled)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dx or dy: rim |= ~np.roll(np.roll(filled, dy, 0), dx, 1)
        p.buf[filled & rim] = MAIN
        if t > 0.6:
            k = (t - 0.6) / 0.4
            dissolve(p, k)
        p.outline(None, OUTL)
        out.append(p.to_rgba(P_INK))
    return out


def spark_burst(s=24, n=8):
    """Искры от брони: короткие лучи уходят наружу и укорачиваются."""
    rng = np.random.default_rng(53)
    rays = [(rng.uniform(0, 2*np.pi), rng.uniform(0.55, 1.0)) for _ in range(9)]
    out = []
    for i in range(n):
        t = i / (n - 1); p = Px(s); c = s / 2
        col = fade_idx(t)
        for ang, ln in rays:
            r0 = 2 + t * s * 0.3
            r1 = r0 + ln * s * 0.24 * (1 - t * 0.5)
            p.line(c + math.cos(ang)*r0, c + math.sin(ang)*r0,
                   c + math.cos(ang)*r1, c + math.sin(ang)*r1, col, 1)
        if t < 0.5:
            p.block(c - 1, c - 1, 2, 2, HILI)
        p.outline(None, OUTL)
        out.append(p.to_rgba(P_AMBER))
    return out


def heal(s=32, n=10):
    """Ремонт: крест и восходящие искры."""
    rng = np.random.default_rng(71)
    motes = [(rng.uniform(5, s-5), rng.uniform(0, 1)) for _ in range(8)]
    out = []
    for i in range(n):
        t = i / (n - 1); p = Px(s); c = s // 2
        for x, ph in motes:
            q = (t * 0.85 + ph) % 1.0
            y = s - 5 - q * (s - 10)
            xo = x + math.sin(q * 6 + ph * 5) * 2
            p.block(xo, y, 2, 2, HILI if q < 0.5 else MAIN)
            p.dot(xo, y + 2, SHAD)
        if t < 0.85:
            arm = int(4 + t * 3)
            col = HILI if t < 0.5 else MAIN
            p.block(c - arm, c - 1, arm*2, 2, col)
            p.block(c - 1, c - arm, 2, arm*2, col)
        p.ring(c, c, 6 + t * 9, SHAD if t > 0.5 else MAIN, 1)
        if t > 0.7:
            k = (t - 0.7) / 0.3
            dissolve(p, k)
        p.outline(None, OUTL)
        out.append(p.to_rgba(P_GREEN))
    return out


def charge(s=48, n=12):
    """Накачка: блоки стягиваются к ядру и разлетаются вспышкой."""
    rng = np.random.default_rng(89)
    parts = [(rng.uniform(0, 2*np.pi), rng.uniform(0.7, 1.0)) for _ in range(12)]
    out = []
    for i in range(n):
        t = i / (n - 1); p = Px(s); c = s / 2
        pull = 1.0 - t ** 1.5
        for ang, dist in parts:
            d = dist * s * 0.44 * pull
            a = ang + t * 2.0
            x, y = c + math.cos(a)*d, c + math.sin(a)*d
            # хвост к ядру: без него блок читается случайной точкой
            tx, ty = c + (x - c) * 0.7, c + (y - c) * 0.7
            p.line(x, y, tx, ty, SHAD, 1)
            p.block(x - 1, y - 1, 2, 2, HILI)
        core = 2 + t * 6
        p.disc(c, c, core, MAIN)
        p.disc(c, c, core * 0.5, HILI)
        if t > 0.78:
            # Вспышка — тонкое кольцо с лучами. Залитая шахматкой середина
            # читалась как розовый шар, а не как выброс.
            k = (t - 0.78) / 0.22
            rr = 6 + k * s * 0.4
            p.ring(c, c, rr, HILI, 2)
            p.ring(c, c, rr * 0.62, MAIN, 1)
            for j in range(8):
                a = j * (2*np.pi/8) + 0.2
                p.line(c + math.cos(a)*rr*0.7, c + math.sin(a)*rr*0.7,
                       c + math.cos(a)*rr*1.12, c + math.sin(a)*rr*1.12, MAIN, 1)
        p.outline(None, OUTL)
        out.append(p.to_rgba(P_MAG))
    return out


RECIPES = {
    'bubble_burst': (bubble_burst, 32), 'shock_ring': (shock_ring, 64),
    'arc': (arc, 48), 'ink': (ink, 48), 'spark_burst': (spark_burst, 24),
    'heal': (heal, 32), 'charge': (charge, 48),
}

def main():
    os.makedirs(OUT, exist_ok=True)
    want = sys.argv[1:] or list(RECIPES)
    for name in want:
        if name not in RECIPES:
            print('нет такого эффекта:', name); continue
        fn, size = RECIPES[name]
        frames = fn()
        img = sheet(frames)
        path = os.path.join(OUT, f'fx_{name}_{size}x{size}.png')
        img.save(path)
        print(f'{os.path.basename(path):<28} кадров {len(frames):>3}  {img.width}x{img.height}')

if __name__ == '__main__':
    main()
