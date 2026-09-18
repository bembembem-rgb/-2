#!/usr/bin/env python3
"""Генератор спрайт-листов эффектов для NEON TIDES: ZERO.

Каждый лист — горизонтальная полоса квадратных кадров. Игра режет её
сама: spawnSpriteFX берёт высоту листа за размер кадра, а число колонок
считает делением ширины. Поэтому имя файла несёт размер кадра —
fx_arc_48x48.png значит кадры 48x48.

    python3 tools/make_vfx.py           # всё
    python3 tools/make_vfx.py arc ink   # только эти

Рисуется в float-буфер аддитивно, как свечение на канвасе: прозрачность
берётся из яркости, поэтому кадры складываются со сценой без тёмной
каймы по краю.
"""
import os, sys, math
import numpy as np
from PIL import Image

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'vfx')

CY = (0.00, 0.88, 1.00)
MG = (1.00, 0.18, 0.82)
VI = (0.77, 0.43, 1.00)
GR = (0.17, 1.00, 0.62)
AM = (1.00, 0.62, 0.11)
WH = (1.00, 1.00, 1.00)


def buf(s): return np.zeros((s, s, 3), dtype=np.float32)

def _grid(s):
    y, x = np.mgrid[0:s, 0:s]
    return x + 0.5, y + 0.5

def glow(b, cx, cy, r, color, k=1.0, hard=0.0):
    """Радиальное пятно. hard=0 — мягкий ореол, hard=1 — почти диск."""
    s = b.shape[0]
    x, y = _grid(s)
    d = np.sqrt((x - cx) ** 2 + (y - cy) ** 2) / max(r, 1e-3)
    f = np.clip(1.0 - d, 0, 1)
    f = f ** (1.0 + 3.0 * (1.0 - hard))
    for i in range(3):
        b[:, :, i] += f * color[i] * k

def ring(b, cx, cy, r, w, color, k=1.0):
    s = b.shape[0]
    x, y = _grid(s)
    d = np.sqrt((x - cx) ** 2 + (y - cy) ** 2)
    f = np.clip(1.0 - np.abs(d - r) / max(w, 1e-3), 0, 1) ** 1.6
    for i in range(3):
        b[:, :, i] += f * color[i] * k

def seg(b, x0, y0, x1, y1, w, color, k=1.0):
    """Отрезок с мягкими краями: расстояние от точки до отрезка."""
    s = b.shape[0]
    x, y = _grid(s)
    dx, dy = x1 - x0, y1 - y0
    L2 = dx * dx + dy * dy
    if L2 < 1e-6:
        glow(b, x0, y0, w, color, k); return
    t = np.clip(((x - x0) * dx + (y - y0) * dy) / L2, 0, 1)
    px, py = x0 + t * dx, y0 + t * dy
    d = np.sqrt((x - px) ** 2 + (y - py) ** 2)
    f = np.clip(1.0 - d / max(w, 1e-3), 0, 1) ** 1.5
    for i in range(3):
        b[:, :, i] += f * color[i] * k

def to_rgba(b, gain=1.0):
    """Свечение в RGBA: альфа — яркость, цвет нормируется, чтобы ядро
    не уходило в грязь при сложении нескольких слоёв."""
    b = np.clip(b * gain, 0, None)
    lum = b.max(axis=2)
    a = np.clip(lum, 0, 1)
    peak = np.maximum(lum, 1e-5)[..., None]
    rgb = np.clip(b / np.maximum(peak, 1.0), 0, 1)
    out = np.zeros((b.shape[0], b.shape[1], 4), dtype=np.uint8)
    out[..., :3] = (rgb * 255).astype(np.uint8)
    out[..., 3] = (a * 255).astype(np.uint8)
    return out

def sheet(frames):
    s = frames[0].shape[0]
    img = Image.new('RGBA', (s * len(frames), s), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        img.paste(Image.fromarray(f, 'RGBA'), (i * s, 0))
    return img


# ---------------------------------------------------------------- эффекты

def bubble_burst(s=32, n=10):
    """Лопнувшая гроздь пузырей. Для попаданий и подбора."""
    out = []
    rng = np.random.default_rng(11)
    seeds = [(rng.uniform(0, 2*np.pi), rng.uniform(2, 9), rng.uniform(2.0, 4.5)) for _ in range(9)]
    for i in range(n):
        t = i / (n - 1)
        b = buf(s); c = s / 2
        for ang, dist, rad in seeds:
            d = dist * (0.25 + t * 1.5)
            x, y = c + math.cos(ang) * d, c + math.sin(ang) * d - t * 3
            r = rad * (1.0 - t * 0.55)
            a = (1 - t) ** 1.3
            ring(b, x, y, r, 1.4, CY, 1.1 * a)
            glow(b, x - r*0.3, y - r*0.3, r * 0.5, WH, 0.5 * a)
        glow(b, c, c, 7 * (1 - t), WH, 0.9 * (1 - t) ** 2)
        out.append(to_rgba(b))
    return out

def shock_ring(s=64, n=10):
    """Расходящееся кольцо давления. Для взрывов и импульса."""
    out = []
    for i in range(n):
        t = i / (n - 1)
        b = buf(s); c = s / 2
        r1 = 3 + t * (s * 0.46)
        ring(b, c, c, r1, 2.6 * (1 - t * 0.6), WH, 1.3 * (1 - t) ** 1.2)
        ring(b, c, c, r1 * 0.97, 5.0 * (1 - t * 0.5), CY, 0.8 * (1 - t) ** 1.4)
        if t > 0.22:
            t2 = (t - 0.22) / 0.78
            ring(b, c, c, 3 + t2 * (s * 0.33), 3.2 * (1 - t2 * 0.6), VI, 0.55 * (1 - t2) ** 1.5)
        glow(b, c, c, 10 * (1 - t) ** 2, WH, 1.1 * (1 - t) ** 2)
        out.append(to_rgba(b))
    return out

def arc(s=48, n=8):
    """Электрический разряд. Для перка РАЗРЯД и добиваний."""
    out = []
    rng = np.random.default_rng(23)
    for i in range(n):
        t = i / (n - 1)
        b = buf(s)
        a = (1 - t) ** 0.8 if t > 0.15 else t / 0.15
        pts = [(2.0, s/2)]
        steps = 7
        for k in range(1, steps + 1):
            x = 2.0 + (s - 4.0) * k / steps
            spread = (s * 0.3) * math.sin(math.pi * k / steps)
            pts.append((x, s/2 + rng.uniform(-spread, spread)))
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            seg(b, x0, y0, x1, y1, 3.2, VI, 0.7 * a)
            seg(b, x0, y0, x1, y1, 1.2, WH, 1.2 * a)
        for _ in range(3):
            k = rng.integers(1, steps)
            x0, y0 = pts[k]
            ang = rng.uniform(0, 2*np.pi); ln = rng.uniform(4, 9)
            seg(b, x0, y0, x0 + math.cos(ang)*ln, y0 + math.sin(ang)*ln, 1.6, CY, 0.8 * a)
        out.append(to_rgba(b))
    return out

def ink(s=48, n=12):
    """Клякса пустоты. Для разрывов VOID WRAITH и телепорта."""
    out = []
    rng = np.random.default_rng(37)
    lobes = [(rng.uniform(0, 2*np.pi), rng.uniform(0.35, 1.0), rng.uniform(4, 9)) for _ in range(11)]
    for i in range(n):
        t = i / (n - 1)
        b = buf(s); c = s / 2
        grow = t ** 0.55
        a = (1 - t) ** 1.1
        # Доли растут вразнобой: с общим темпом силуэт выходит ровным шаром
        for k, (ang, dist, rad) in enumerate(lobes):
            lag = (k % 4) * 0.12
            g2 = max(0.0, (t - lag)) ** 0.5
            if g2 <= 0: continue
            d = dist * g2 * s * 0.34
            glow(b, c + math.cos(ang)*d, c + math.sin(ang)*d, rad * (0.5 + g2 * 1.1), VI, 0.75 * a, hard=0.8)
        # Ядро темнее краёв: клякса должна читаться как дыра, а не как шар
        glow(b, c, c, s * 0.22 * grow, MG, 0.22 * a, hard=0.9)
        for k, (ang, dist, rad) in enumerate(lobes):
            d = dist * grow * s * 0.34
            ring(b, c + math.cos(ang)*d, c + math.sin(ang)*d, rad * (0.5 + grow), 1.3, MG, 0.8 * a)
        out.append(to_rgba(b))
    return out

def spark_burst(s=24, n=8):
    """Искры от брони. Для попаданий, которые не убили."""
    out = []
    rng = np.random.default_rng(53)
    rays = [(rng.uniform(0, 2*np.pi), rng.uniform(0.6, 1.0)) for _ in range(10)]
    for i in range(n):
        t = i / (n - 1)
        b = buf(s); c = s / 2
        a = (1 - t) ** 0.85
        for ang, ln in rays:
            r0 = 1 + t * s * 0.26
            r1 = r0 + ln * s * 0.26 * (1 - t * 0.35)
            seg(b, c + math.cos(ang)*r0, c + math.sin(ang)*r0,
                   c + math.cos(ang)*r1, c + math.sin(ang)*r1, 1.5, AM, 1.4 * a)
        glow(b, c, c, 7 * (1 - t * 0.7), WH, 1.3 * a)
        out.append(to_rgba(b))
    return out

def heal(s=32, n=10):
    """Восходящие искры ремонта. Для лечения и подъёма напарника."""
    out = []
    rng = np.random.default_rng(71)
    motes = [(rng.uniform(6, s-6), rng.uniform(0, 1), rng.uniform(2.4, 4.0)) for _ in range(10)]
    for i in range(n):
        t = i / (n - 1)
        b = buf(s); c = s / 2
        for x, ph, rad in motes:
            p = (t * 0.8 + ph) % 1.0
            y = s - 6 - p * (s - 12)
            a = math.sin(math.pi * p) ** 0.8
            xo = x + math.sin(p * 6.0 + ph * 5) * 2.5
            glow(b, xo, y, rad, GR, 1.7 * a)
            glow(b, xo, y, rad * 0.4, WH, 1.1 * a)
        # Крест — знак ремонта. Держим по центру, а не у нижнего края:
        # у края половина кольца уезжала за кадр и читалась как обрезок.
        k = math.sin(math.pi * min(1.0, 0.15 + t * 0.85)) ** 0.6
        arm = 5 + t * 3
        seg(b, c - arm, c, c + arm, c, 1.8, GR, 1.4 * k)
        seg(b, c, c - arm, c, c + arm, 1.8, GR, 1.4 * k)
        glow(b, c, c, 3.5, WH, 1.2 * k)
        ring(b, c, c, 6 + t * 9, 1.8, GR, 0.8 * (1 - t) ** 1.2)
        out.append(to_rgba(b))
    return out

def charge(s=48, n=12):
    """Накачка: частицы стягиваются к ядру и вспыхивают. Для телеграфа
    боссов и заряда импульса."""
    out = []
    rng = np.random.default_rng(89)
    parts = [(rng.uniform(0, 2*np.pi), rng.uniform(0.7, 1.0), rng.uniform(2.6, 4.4)) for _ in range(16)]
    for i in range(n):
        t = i / (n - 1)
        b = buf(s); c = s / 2
        pull = 1.0 - t ** 1.5
        for ang, dist, rad in parts:
            d = dist * s * 0.46 * pull
            aa = ang + t * 2.2
            px, py = c + math.cos(aa)*d, c + math.sin(aa)*d
            # хвост к ядру: без него частица читается как случайная точка,
            # а не как нечто, что стягивается внутрь
            tx, ty = c + (px - c) * 0.55, c + (py - c) * 0.55
            seg(b, px, py, tx, ty, 1.6, MG, 0.75 * (0.4 + t))
            glow(b, px, py, rad, MG, 1.5 * (0.5 + t * 0.8))
            glow(b, px, py, rad * 0.4, WH, 0.9 * (0.4 + t))
        core = 3 + t * 7
        glow(b, c, c, core, VI, 1.6 + t * 1.6)
        glow(b, c, c, core * 0.45, WH, 1.2 + t * 2.0)
        if t > 0.75:
            f = (t - 0.75) / 0.25
            ring(b, c, c, 5 + f * s * 0.44, 3.0, WH, 1.8 * (1 - f))
            ring(b, c, c, 5 + f * s * 0.34, 2.0, MG, 1.4 * (1 - f))
        out.append(to_rgba(b))
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
