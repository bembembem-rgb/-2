#!/usr/bin/env python3
"""Генератор звуков для NEON TIDES: ZERO.

Sega Genesis: FM-синтез (YM2612) и шум на сдвиговом регистре (SN76489),
плюс прямоугольные волны на арпеджио. Сухо, без реверба.

    python3 tools/make_sfx.py            # всё
    python3 tools/make_sfx.py dash boom  # только эти

Нужно: pip install numpy lameenc
"""
import os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from synth import (SR, n_of, noise, sweep, osc, env, lowpass, highpass,
                   sweep_lowpass, bitcrush, softclip, save, save_mp3, limit,
                   note, pulse_osc, steps, tone, arp, dry, crush,
                   fm, fm_ph, psg_noise, psg_sweep)

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'sfx')

LEVELS = {
    'boom': 0.50, 'pulse': 0.45,
    'hurt': 0.42, 'parry_hit': 0.40, 'parry_up': 0.36,
    'shot_shotgun': 0.38, 'shot_pistol': 0.36, 'shot_alt': 0.36, 'shot_enemy': 0.32,
    'rocket_launch': 0.34, 'enemy_death': 0.33, 'dash': 0.32,
    'surge': 0.33, 'glitch': 0.32, 'lose': 0.36, 'achievement': 0.34,
    'weapon': 0.28, 'ui': 0.22,
}


def loudness(x, win=0.05):
    w = int(SR * win)
    if len(x) <= w:
        return float(np.sqrt((x ** 2).mean()))
    e = np.convolve(x ** 2, np.ones(w) / w, mode='valid')
    return float(np.sqrt(e.max()))


def level(x, target):
    lo = loudness(x)
    if lo < 1e-9:
        return x
    return limit(x * (target / lo))



def _ph(f0, f1, n, count=10, curve=1.2):
    return steps(f0, f1, n, count, curve)


def shot_pistol(v, r):
    n = n_of((0.10, 0.12, 0.11, 0.13)[v % 4])
    top = (86, 89, 84, 91)[v % 4]
    ph = _ph(note(top), note(top - 22), n, 9, 1.3)
    body = fm_ph(ph, ratio=(2.0, 3.0, 1.5, 3.5)[v % 4], index=(7, 9, 5, 11)[v % 4], idx_curve=5.0, fb=0.4)
    click = psg_noise(n, 4) * env(n, 0.0004, curve=26) * 0.4
    return dry(body * env(n, 0.001, curve=4.0) + click, 1.15)


def shot_alt(v, r):
    n = n_of((0.18, 0.22, 0.26)[v % 3])
    top = (83, 76, 79)[v % 3]
    a = fm_ph(_ph(note(top), note(top - 24), n, 8, 1.2), ratio=(1.0, 2.0, 3.0)[v % 3],
              index=(9, 7, 6)[v % 3], idx_curve=3.4, fb=0.5) * env(n, 0.001, curve=3.2)
    b = np.zeros(n)
    off = n_of(0.045)
    m = n - off
    b[off:] = fm_ph(_ph(note(top - 12), note(top - 34), m, 8, 1.4), ratio=1.0, index=5, idx_curve=2.6) * env(m, 0.002, curve=2.6)
    click = psg_noise(n, 3) * env(n, 0.0005, curve=20) * 0.35
    return dry(softclip(a * 0.8 + b * 0.9 + click, 1.5), 1.05)


def shot_shotgun(v, r):
    n = n_of((0.20, 0.26, 0.32)[v % 3])
    burst = psg_sweep(n, (2, 3, 4)[v % 3], (26, 34, 44)[v % 3]) * env(n, 0.0006, curve=7.0 + v)
    crack = psg_noise(n, 1) * env(n, 0.0003, curve=20) * 0.5
    thump = fm(note(33), n, ratio=0.5, index=8, idx_curve=2.2, fb=0.6) * env(n, 0.001, curve=4.5) * 0.6
    return dry(softclip(burst * 0.85 + crack + thump, 1.7), 1.25)


def shot_enemy(v, r):
    n = n_of((0.12, 0.15, 0.18)[v % 3])
    f = (69, 66, 71)[v % 3]
    body = fm_ph(_ph(note(f), note(f - 17), n, 6, 1.1), ratio=(4.0, 5.0, 7.0)[v % 3],
                 index=(6, 8, 5)[v % 3], idx_curve=3.0) * env(n, 0.002, curve=3.4)
    grit = psg_noise(n, (8, 12, 6)[v % 3]) * env(n, 0.001, curve=11) * 0.3
    return dry(body + grit, 0.9)


def rocket_launch(v, r):
    n = n_of((0.38, 0.5)[v % 2])
    ramp = np.linspace(0, 1, n) ** 1.3
    hiss = psg_sweep(n, (34, 16)[v % 2], (2, 6)[v % 2]) * ramp * (0.55, 0.4)[v % 2]
    rise = fm_ph(_ph(note(40), note((72, 59)[v % 2]), n, 14, 1.0), ratio=(2.0, 1.0)[v % 2],
                 index=(7, 4)[v % 2], idx_curve=1.4) * ramp * (0.5, 0.65)[v % 2]
    return dry(hiss + rise, 1.0) * env(n, 0.03, curve=1.2, sustain=0.4)


def boom(v, r):
    n = n_of((0.42, 0.55, 0.7)[v % 3])
    body = psg_sweep(n, (1, 1, 2)[v % 3], (24, 32, 44)[v % 3]) * env(n, 0.001, curve=(4.2, 3.0, 2.2)[v % 3]) * 0.55
    # Индекс низкий и без обратной связи: иначе боковые полосы уносят
    # энергию наверх, и от взрыва остаётся треск без удара в грудь.
    sub = fm_ph(_ph(note((36, 31, 28)[v % 3]), note(19), n, 5, 1.8), ratio=1.0, index=(2.0, 1.6, 1.2)[v % 3], idx_curve=2.4)
    sub = sub * env(n, 0.001, curve=2.2) * (1.1, 1.25, 1.35)[v % 3]
    deb = np.zeros(n)
    for _ in range(6 + v * 2):
        pos = int(r.uniform(0.08, 0.6) * n)
        ln = n_of(0.02)
        if pos + ln >= n:
            continue
        deb[pos:pos + ln] += psg_noise(ln, 2, seed=int(r.integers(1, 30000))) * env(ln, 0.0005, curve=14) * r.uniform(0.2, 0.45)
    return dry(softclip(body * 0.8 + sub + highpass(deb, 1400), 1.8), 1.05)


def hurt(v, r):
    n = n_of((0.16, 0.22, 0.28)[v % 3])
    top = (72, 67, 62)[v % 3]
    # Нецелая кратность даёт негармоничный, злой тембр: это и есть «больно».
    zap = fm_ph(_ph(note(top), note(top - 26), n, 7, 1.2), ratio=(2.41, 3.17, 1.73)[v % 3],
                index=11, idx_curve=2.6, fb=0.6) * env(n, 0.0008, curve=3.0)
    rasp = highpass(psg_noise(n, 5), 700) * env(n, 0.001, curve=6) * 0.55
    return dry(softclip(zap * 1.1 + rasp, 2.0), 1.1)


def enemy_death(v, r):
    n = n_of((0.20, 0.26, 0.32, 0.38)[v % 4])
    top = (76, 72, 79, 69)[v % 4]
    fall = fm_ph(_ph(note(top), note(top - 26), n, 9, 1.5), ratio=(2.0, 1.5, 3.0, 2.5)[v % 4],
                 index=8, idx_curve=3.0, fb=0.3) * env(n, 0.001, curve=3.6)
    splat = psg_sweep(n, 3, 20) * env(n, 0.001, curve=5.0) * 0.55
    return dry(fall * 0.9 + splat, 1.0)


def dash(v, r):
    n = n_of((0.16, 0.2, 0.25)[v % 3])
    sw = psg_sweep(n, (26, 30, 34)[v % 3], (3, 2, 2)[v % 3]) * env(n, 0.008, curve=2.4) * 0.8
    up = fm_ph(_ph(note(50), note((71, 76, 81)[v % 3]), n, 10, 1.1), ratio=1.0, index=4, idx_curve=2.0) * env(n, 0.012, curve=3.0) * 0.4
    return dry(sw + up, 1.15)


def parry_up(v, r):
    n = n_of((0.22, 0.3)[v % 2])
    a = arp(([71, 78], [74, 83])[v % 2], (0.055, 0.04)[v % 2], n, 'pulse', (0.25, 0.125)[v % 2], curve=2.4)
    bell = fm(note((83, 86)[v % 2]), n, ratio=3.5, index=5, idx_curve=4.0) * env(n, 0.002, curve=4.0) * 0.35
    return dry(a * 0.7 + bell, 1.1)


def parry_hit(v, r):
    n = n_of((0.26, 0.34)[v % 2])
    # Колокол: кратность 3.5 и 7 — та самая металлическая «звень» YM2612.
    bell = fm(note((88, 81)[v % 2]), n, ratio=(3.5, 5.0)[v % 2], index=(9, 6)[v % 2], idx_curve=2.4, fb=(0.3, 0.0)[v % 2])
    bell = bell * env(n, 0.0008, curve=2.6)
    mid = fm(note((64, 69)[v % 2]), n, ratio=2.0, index=4, idx_curve=4.0) * env(n, 0.001, curve=5.0) * 0.4
    clang = highpass(psg_noise(n, 1), 3000) * env(n, 0.0004, curve=9) * 0.4
    return dry(softclip(bell + mid + clang, 1.4), 1.2)


def pulse(v, r):
    n = n_of((0.5, 0.68)[v % 2])
    sub = fm_ph(_ph(note((41, 33)[v % 2]), note((26, 21)[v % 2]), n, 6, 1.7), ratio=0.5,
                index=(12, 14)[v % 2], idx_curve=2.0, fb=0.7) * env(n, 0.002, curve=2.2) * (0.75, 0.95)[v % 2]
    up = arp(([64, 71, 76, 83], [60, 67, 72, 79, 84])[v % 2], 0.045, n, 'pulse',
             (0.125, 0.25)[v % 2], curve=3.4) * (0.6, 0.45)[v % 2]
    ring = psg_sweep(n, 2, 22) * env(n, 0.001, curve=4.0) * 0.3
    return dry(softclip(sub + up + ring, 1.5), 1.0)


def surge(v, r):
    n = n_of((0.5, 0.72)[v % 2])
    seq = [48, 52, 55, 60, 64, 67, 72, 76, 79, 84][:6 + v * 2]
    a = arp(seq, (0.07, 0.06)[v % 2], n, 'pulse', 0.25, curve=2.0)
    bell = fm(note(84 + v * 3), n, ratio=2.0, index=3, idx_curve=1.6) * (np.linspace(0, 1, n) ** 1.6) * 0.3
    hiss = psg_sweep(n, 24, 6) * (np.linspace(0, 1, n) ** 1.4) * 0.2
    return dry(a * 0.8 + bell + hiss, 1.05)


def glitch(v, r):
    n = n_of((0.2, 0.3)[v % 2])
    x = np.zeros(n)
    pos = 0
    while pos < n:
        ln = min(int(SR * r.uniform(0.006, 0.035)), n - pos)
        if ln <= 0:
            break
        pick = r.random()
        if pick < 0.55:
            f = note(int(r.integers(60, 96)))
            x[pos:pos + ln] = fm(f, ln, ratio=float(r.choice([1.41, 2.0, 3.17, 5.0])),
                                 index=float(r.uniform(4, 12)), idx_curve=1.0) * r.uniform(0.4, 1.0)
        elif pick < 0.85:
            x[pos:pos + ln] = psg_noise(ln, int(r.integers(1, 20)), seed=int(r.integers(1, 30000))) * r.uniform(0.3, 0.7)
        pos += ln
    return dry(x * env(n, 0.001, curve=1.5, sustain=0.4), 1.15)


def weapon(v, r):
    n = n_of((0.34, 0.4)[v % 2])
    seq = ([76, 83, 88], [67, 74, 81])[v % 2]
    each = (0.05, 0.06)[v % 2]
    x = np.zeros(n)
    ln = n_of(each * 2.2)
    for i, nn in enumerate(seq):
        pos = int(SR * each * i)
        m = min(ln, n - pos)
        if m <= 0:
            break
        # Колокольчик, как подбор кольца: чистая кратность 2 и быстрый спад индекса.
        x[pos:pos + m] += fm(note(nn), m, ratio=(2.0, 3.0)[v % 2], index=(6, 4)[v % 2], idx_curve=4.5) * env(m, 0.002, curve=3.2) * 0.8
    x[:n_of(0.02)] += psg_noise(n_of(0.02), 2) * env(n_of(0.02), 0.0003, curve=18) * 0.3
    return dry(x, 1.15)


def ui(v, r):
    n = n_of(0.055)
    f = note((81, 84, 88)[v % 3])
    x = fm(f, n, ratio=2.0, index=(4, 5, 6)[v % 3], idx_curve=6.0) * env(n, 0.001, curve=5.0)
    return dry(x * 0.75, 1.15)


def achievement(v, r):
    n = n_of(0.62)
    x = np.zeros(n)
    for i, nn in enumerate([72, 76, 79, 84]):
        pos = int(SR * 0.075 * i)
        m = min(n_of(0.3), n - pos)
        if m <= 0:
            break
        x[pos:pos + m] += fm(note(nn), m, ratio=2.0, index=7, idx_curve=3.6) * env(m, 0.002, curve=2.4) * 0.6
    top = fm(note(96), n, ratio=3.5, index=4, idx_curve=2.0) * env(n, 0.05, curve=2.0) * 0.22
    return dry(x + top, 1.1)


def lose(v, r):
    n = n_of(1.3)
    x = np.zeros(n)
    for i, nn in enumerate([64, 60, 55, 48]):
        pos = int(SR * 0.18 * i)
        m = min(n_of(0.5), n - pos)
        if m <= 0:
            break
        x[pos:pos + m] += fm(note(nn), m, ratio=1.0, index=6, idx_curve=2.0, fb=0.5,
                             vib=0.012, vibrate=5.0) * env(m, 0.004, curve=1.8) * 0.7
    low = fm(note(36), n, ratio=0.5, index=8, idx_curve=1.4, vib=0.02, vibrate=5.0) * env(n, 0.02, curve=1.6) * 0.45
    x += fm(note(79), n, ratio=2.0, index=2, idx_curve=1.2) * env(n, 0.08, curve=2.2) * 0.14
    return dry(softclip(x + low, 1.3), 0.8)


RECIPES = {
    'shot_pistol': (shot_pistol, 4), 'shot_alt': (shot_alt, 3),
    'shot_shotgun': (shot_shotgun, 3), 'shot_enemy': (shot_enemy, 3),
    'rocket_launch': (rocket_launch, 2), 'boom': (boom, 3),
    'hurt': (hurt, 3), 'enemy_death': (enemy_death, 4), 'dash': (dash, 3),
    'parry_up': (parry_up, 2), 'parry_hit': (parry_hit, 2),
    'pulse': (pulse, 2), 'surge': (surge, 2), 'glitch': (glitch, 2),
    'weapon': (weapon, 2), 'ui': (ui, 3),
    'achievement': (achievement, 1), 'lose': (lose, 1),
}


def main():
    os.makedirs(OUT, exist_ok=True)
    want = sys.argv[1:] or list(RECIPES)
    made = []
    for name in want:
        if name not in RECIPES:
            print('нет такого рецепта:', name)
            continue
        fn, count = RECIPES[name]
        for v in range(count):
            rng = np.random.default_rng(abs(hash((name, v))) % (2 ** 32))
            path = os.path.join(OUT, f'{name}_{v + 1}.mp3')
            ok = save_mp3(path, level(fn(v, rng), LEVELS.get(name, 0.3)))
            made.append((path, ok))
    mp3 = sum(1 for _, ok in made if ok)
    print(f'записано файлов: {len(made)} (mp3: {mp3}, wav: {len(made) - mp3})')
    if mp3 < len(made):
        print('lameenc не установлен — вышли WAV. pip install lameenc, и перезапусти.')


if __name__ == '__main__':
    main()
