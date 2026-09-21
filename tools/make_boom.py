#!/usr/bin/env python3
"""Взрывы снаряда и босса для NEON TIDES: ZERO.

Лежат в корне рядом с index.html, потому что оттуда их грузит assets.js.
Кадр квадратный, лист — горизонтальная полоса.

    python3 tools/make_boom.py

Взрыв под водой — это не огонь. Вспышка, ударная волна, и следом
пузыри: воде есть что показать там, где на суше был бы дым.
"""
import os, sys, math
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pixel import Px, sheet, BAYER

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')

OUTL, SHAD, MAIN, HILI, SPARK = 1, 2, 3, 4, 5

P_BOSS = [None, (4, 14, 30), (0, 96, 150), (0, 224, 255), (236, 255, 255), (255, 47, 208)]
P_TANK = [None, (30, 10, 2), (168, 72, 6), (255, 159, 28), (255, 236, 190), (255, 90, 40)]


def dissolve(p, k):
    if k <= 0:
        return
    thr = np.tile(BAYER, (p.s // 4 + 1, p.s // 4 + 1))[:p.s, :p.s]
    p.buf[(p.buf > 0) & (thr < min(k, 0.88))] = 0


def fireball(p, cx, cy, r, core, wobble, seed):
    """Шар с рваным краем: ровный круг читается как мяч, а не как взрыв."""
    rng = np.random.default_rng(seed)
    p.disc(cx, cy, r, MAIN)
    steps = max(8, int(r * 2))
    for i in range(steps):
        a = 2 * math.pi * i / steps
        rr = r + rng.uniform(-wobble, wobble)
        p.line(cx, cy, cx + math.cos(a) * rr, cy + math.sin(a) * rr, MAIN, 2)
    p.band_dither(cx, cy, r * 0.82, r + wobble + 1, MAIN, 0.85)
    if core > 0:
        p.disc(cx, cy, core, HILI)
        p.band_dither(cx, cy, core, core * 1.5, HILI, 0.7)


def shockwave(p, cx, cy, r, w, idx):
    if r <= 0:
        return
    p.ring(cx, cy, r, idx, w)
    p.band_dither(cx, cy, r, r + 2, idx, 0.5)


def debris(p, cx, cy, dist, count, seed, idx, size=1):
    rng = np.random.default_rng(seed)
    for i in range(count):
        a = 2 * math.pi * i / count + rng.uniform(-0.2, 0.2)
        d = dist * rng.uniform(0.75, 1.15)
        x, y = cx + math.cos(a) * d, cy + math.sin(a) * d
        if size <= 1:
            p.dot(x, y, idx)
        else:
            p.block(x - size // 2, y - size // 2, size, size, idx)


def bubbles(p, cx, cy, rise, count, seed, idx):
    rng = np.random.default_rng(seed)
    for i in range(count):
        a = 2 * math.pi * i / count + rng.uniform(-0.4, 0.4)
        d = rng.uniform(0.3, 1.0) * p.s * 0.42
        x = cx + math.cos(a) * d
        y = cy + math.sin(a) * d * 0.7 - rise
        r = 1 if rng.random() < 0.6 else 2
        p.ring(x, y, r + 0.5, idx, 1)


def boss_boom():
    S, N = 96, 14
    c = S / 2 - 0.5
    RMAX = 41
    frames = []
    for f in range(N):
        p = Px(S)
        if f <= 5:
            # Рост: шар и белое ядро, которое садится по мере расширения.
            r = 5 + f * (RMAX - 5) / 5.0
            core = max(0, 8 - f * 1.5)
            fireball(p, c, c, r, core, 2 + f * 0.7, 100 + f)
            if f >= 3:
                p.band_dither(c, c, r * 0.30, r * 0.62, SHAD, 0.45, invert=True)
        else:
            # Спад: радиус держится, редеет плотность и растёт пустая
            # сердцевина. Раздуваться заново взрыв не должен.
            k = f - 5
            r = RMAX + k * 0.6
            dens = max(0.07, 0.72 - k * 0.075)
            hole = min(r * 0.70, 7 + k * 3.4)
            p.band_dither(c, c, hole, r, MAIN, dens)
            p.band_dither(c, c, hole * 0.6, hole * 1.15, SHAD, dens * 0.8)
        # Волна идёт только пока помещается в кадр: за краем от неё
        # остаются дуги по углам, и это читается как брак листа.
        if 2 <= f <= 8:
            sr = 13 + (f - 2) * 5.0
            if sr <= RMAX + 5:
                shockwave(p, c, c, sr, 2 if f < 6 else 1, HILI if f < 6 else MAIN)
        if 3 <= f <= 9:
            debris(p, c, c, 17 + (f - 3) * 4.2, 11, 7 + f, SPARK, 2 if f < 7 else 1)
        if f >= 8:
            bubbles(p, c, c, (f - 8) * 4.0, 10, 40 + f, MAIN)
        if f >= 11:
            dissolve(p, (f - 10) / 6.0)
        p.outline(None, OUTL)
        frames.append(p.to_rgba(P_BOSS))
    return sheet(frames), S, N


def tank_boom():
    S, N = 48, 10
    c = S / 2 - 0.5
    RMAX = 20
    frames = []
    for f in range(N):
        p = Px(S)
        if f <= 4:
            r = 3.5 + f * (RMAX - 3.5) / 4.0
            core = max(0, 5.5 - f * 1.4)
            fireball(p, c, c, r, core, 1.5 + f * 0.5, 300 + f)
            if f >= 2:
                p.band_dither(c, c, r * 0.28, r * 0.60, SHAD, 0.45, invert=True)
        else:
            k = f - 4
            r = RMAX + k * 0.4
            dens = max(0.16, 0.70 - k * 0.085)
            hole = min(r * 0.62, 3 + k * 2.2)
            p.band_dither(c, c, hole, r, MAIN, dens)
            p.band_dither(c, c, hole * 0.6, hole * 1.15, SHAD, dens * 0.8)
        if 1 <= f <= 5:
            sr = 5 + (f - 1) * 3.6
            if sr <= RMAX + 3:
                shockwave(p, c, c, sr, 1, HILI if f < 4 else MAIN)
        if 2 <= f <= 6:
            debris(p, c, c, 9 + (f - 2) * 2.6, 8, 20 + f, SPARK, 1)
        if f >= 7:
            bubbles(p, c, c, (f - 7) * 3.0, 6, 70 + f, MAIN)
            dissolve(p, (f - 6) / 7.0)
        p.outline(None, OUTL)
        frames.append(p.to_rgba(P_TANK))
    return sheet(frames), S, N


def main():
    for name, fn in (('explosion_boss', boss_boom), ('tankballexplode', tank_boom)):
        img, s, n = fn()
        path = os.path.join(ROOT, name + '.png')
        img.save(path)
        print(f'{name}.png — {img.width}x{img.height}, {n} кадров по {s}x{s}')


if __name__ == '__main__':
    main()
