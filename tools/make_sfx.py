#!/usr/bin/env python3
"""Генератор звуков для NEON TIDES: ZERO.

Чиптюн: прямоугольные волны, шум, сухо, без реверба.

    python3 tools/make_sfx.py            # всё
    python3 tools/make_sfx.py dash boom  # только эти

Нужно: pip install numpy lameenc
"""
import os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from synth import (SR, n_of, noise, sweep, osc, env, lowpass, highpass,
                   sweep_lowpass, bitcrush, softclip, save, save_mp3, limit,
                   note, pulse_osc, steps, tone, arp, dry, crush)

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


def shot_pistol(v, r):
    n = n_of((0.10, 0.12, 0.11, 0.13)[v % 4])
    top = (86, 89, 84, 91)[v % 4]
    body = pulse_osc(steps(note(top), note(top - 24), n, 10, 1.3), (0.5, 0.25, 0.35, 0.125)[v % 4])
    click = noise(n, r) * env(n, 0.0004, curve=26) * 0.55
    return dry(crush(body * env(n, 0.001, curve=4.0) + click, 7), 1.1)


def shot_alt(v, r):
    n = n_of((0.18, 0.22, 0.26)[v % 3])
    top = (83, 76, 79)[v % 3]
    duty = (0.125, 0.25, 0.5)[v % 3]
    a = pulse_osc(steps(note(top), note(top - 24), n, 8, 1.2), duty) * env(n, 0.001, curve=3.2)
    b = np.zeros(n)
    off = n_of(0.045)
    m = n - off
    b[off:] = pulse_osc(steps(note(top - 12), note(top - 36), m, 8, 1.4), 0.5) * env(m, 0.002, curve=2.6)
    click = noise(n, r) * env(n, 0.0005, curve=20) * 0.4
    return dry(crush(softclip(a * 0.8 + b * 0.9 + click, 1.6), 7))


def shot_shotgun(v, r):
    n = n_of((0.20, 0.26, 0.32)[v % 3])
    burst = noise(n, r) * env(n, 0.0006, curve=7.0 + v)
    burst = sweep_lowpass(burst, 13000, (3200, 2400, 1800)[v % 3], res=0.05)
    crack = highpass(noise(n, r), 2500) * env(n, 0.0003, curve=20) * 0.7
    thump = pulse_osc(steps(note(45), note(28), n, 6, 1.6), 0.5) * env(n, 0.001, curve=4.5) * 0.4
    return dry(crush(softclip(burst + crack + thump, 1.7), 7), 1.3)


def shot_enemy(v, r):
    n = n_of((0.12, 0.15, 0.18)[v % 3])
    f = (69, 66, 71)[v % 3]
    body = pulse_osc(steps(note(f), note(f - 19), n, 6, 1.1), 0.125) * env(n, 0.002, curve=3.4)
    grit = crush(noise(n, r), 4, 5) * env(n, 0.001, curve=11) * 0.35
    return dry(body + grit, 0.85)


def rocket_launch(v, r):
    n = n_of((0.38, 0.5)[v % 2])
    ramp = np.linspace(0, 1, n) ** 1.3
    hiss = sweep_lowpass(noise(n, r), (700, 1100)[v % 2], (11000, 8000)[v % 2], res=0.05) * ramp
    rise = pulse_osc(steps(note(40), note((67, 62)[v % 2]), n, 12, 1.0), (0.125, 0.25)[v % 2]) * ramp * 0.45
    return dry(crush(hiss * 0.9 + rise, 7) * env(n, 0.03, curve=1.2, sustain=0.4))


def boom(v, r):
    n = n_of((0.42, 0.55, 0.7)[v % 3])
    body = sweep_lowpass(noise(n, r), (7000, 9000, 12000)[v % 3], (1700, 900, 520)[v % 3],
                         res=0.06) * env(n, 0.001, curve=(4.2, 3.0, 2.2)[v % 3])
    sub = pulse_osc(steps(note((41, 36, 31)[v % 3]), note(19), n, 5, 1.8),
                    (0.25, 0.5, 0.5)[v % 3]) * env(n, 0.001, curve=2.4) * (0.7, 0.9, 1.05)[v % 3]
    deb = np.zeros(n)
    for _ in range(6 + v * 2):
        p = int(r.uniform(0.08, 0.6) * n)
        ln = n_of(0.02)
        if p + ln >= n:
            continue
        deb[p:p + ln] += noise(ln, r) * env(ln, 0.0005, curve=14) * r.uniform(0.2, 0.45)
    return dry(crush(softclip(body + sub + highpass(deb, 1400), 1.8), 6), 1.1)


def hurt(v, r):
    n = n_of((0.16, 0.22, 0.28)[v % 3])
    top = (72, 67, 62)[v % 3]
    zap = pulse_osc(steps(note(top), note(top - 28), n, 7, 1.2), 0.125) * env(n, 0.0008, curve=3.0)
    rasp = highpass(noise(n, r), 700) * env(n, 0.001, curve=6) * 0.7
    return dry(crush(softclip(zap * 1.1 + rasp, 2.1), 6), 1.15)


def enemy_death(v, r):
    n = n_of((0.20, 0.26, 0.32, 0.38)[v % 4])
    top = (76, 72, 79, 69)[v % 4]
    fall = pulse_osc(steps(note(top), note(top - 26), n, 9, 1.5), 0.25) * env(n, 0.001, curve=3.6)
    splat = sweep_lowpass(noise(n, r), 7000, 1200, res=0.12) * env(n, 0.001, curve=5.0) * 0.8
    return dry(crush(fall * 0.9 + splat, 6))


def dash(v, r):
    n = n_of((0.16, 0.2, 0.25)[v % 3])
    sw = sweep_lowpass(noise(n, r), 800, (7000, 9500, 12000)[v % 3], res=0.06) * env(n, 0.008, curve=2.4)
    up = pulse_osc(steps(note(50), note((71, 76, 81)[v % 3]), n, 10, 1.1),
                   (0.5, 0.25, 0.125)[v % 3]) * env(n, 0.012, curve=3.0) * 0.35
    return dry(crush(sw * 0.9 + up, 7), 1.2)


def parry_up(v, r):
    n = n_of((0.22, 0.3)[v % 2])
    a = arp(([71, 78], [74, 83])[v % 2], (0.055, 0.04)[v % 2], n, 'pulse',
            (0.25, 0.125)[v % 2], curve=2.4)
    return dry(crush(a * 0.8, 7), 1.1)


def parry_hit(v, r):
    n = n_of((0.26, 0.34)[v % 2])
    a = arp(([88, 95], [83, 90])[v % 2], (0.035, 0.05)[v % 2], n, 'pulse',
            (0.125, 0.25)[v % 2], curve=3.2)
    mid = tone(note((64, 69)[v % 2]), n, 'pulse', 0.5) * env(n, 0.001, curve=5.0) * 0.45
    clang = highpass(noise(n, r), 3000) * env(n, 0.0004, curve=9) * 0.5
    return dry(crush(softclip(a + mid + clang, 1.4), 7), 1.25)


def pulse(v, r):
    n = n_of((0.5, 0.68)[v % 2])
    sub = pulse_osc(steps(note((41, 33)[v % 2]), note((26, 21)[v % 2]), n, 6, 1.7),
                    (0.25, 0.5)[v % 2]) * env(n, 0.002, curve=2.2) * (0.7, 0.95)[v % 2]
    up = arp(([64, 71, 76, 83], [60, 67, 72, 79, 84])[v % 2], 0.045, n, 'pulse',
             (0.125, 0.25)[v % 2], curve=3.4) * (0.7, 0.5)[v % 2]
    ring = sweep_lowpass(noise(n, r), 9000, 2000, res=0.1) * env(n, 0.001, curve=4.0) * 0.4
    return dry(crush(softclip(sub + up + ring, 1.5), 7))


def surge(v, r):
    n = n_of((0.5, 0.72)[v % 2])
    seq = [48, 52, 55, 60, 64, 67, 72, 76, 79, 84][:6 + v * 2]
    a = arp(seq, (0.07, 0.06)[v % 2], n, 'pulse', 0.25, curve=2.0)
    hiss = sweep_lowpass(noise(n, r), 1200, 7000, res=0.05) * (np.linspace(0, 1, n) ** 1.4) * 0.25
    return dry(crush(a * 0.85 + hiss, 7))


def glitch(v, r):
    n = n_of((0.2, 0.3)[v % 2])
    x = np.zeros(n)
    pos = 0
    while pos < n:
        ln = min(int(SR * r.uniform(0.006, 0.035)), n - pos)
        if ln <= 0:
            break
        if r.random() < 0.8:
            f = note(int(r.integers(60, 96)))
            seg = pulse_osc(np.arange(ln) * 2 * np.pi * f / SR, float(r.choice([0.125, 0.25, 0.5])))
            x[pos:pos + ln] = crush(seg * r.uniform(0.4, 1.0), int(r.integers(3, 6)), int(r.integers(2, 6)))
        pos += ln
    return dry(x * env(n, 0.001, curve=1.5, sustain=0.4), 1.2)


def weapon(v, r):
    n = n_of((0.34, 0.4)[v % 2])
    x = arp(([76, 83, 88], [72, 79, 86])[v % 2], (0.05, 0.06)[v % 2], n, 'pulse',
            (0.25, 0.125)[v % 2], curve=2.0, gap=0.9)
    ln = n_of(0.03)
    x[:ln] += highpass(noise(ln, r), 1800) * env(ln, 0.0003, curve=18) * 0.5
    return dry(crush(x, 7), 1.25)


def ui(v, r):
    n = n_of(0.055)
    f = note((81, 84, 88)[v % 3])
    x = pulse_osc(np.arange(n) * 2 * np.pi * f / SR, 0.25) * env(n, 0.001, curve=5.0)
    return dry(crush(x * 0.7, 7), 1.2)


def achievement(v, r):
    n = n_of(0.62)
    a = arp([72, 76, 79, 84], 0.075, n, 'pulse', 0.25, curve=2.2)
    b = arp([84, 88, 91, 96], 0.075, n, 'pulse', 0.125, curve=3.0) * 0.35
    return dry(crush(a * 0.8 + b, 8), 1.15)


def lose(v, r):
    n = n_of(1.3)
    a = arp([64, 60, 55, 48], 0.18, n, 'pulse', 0.5, curve=1.4, gap=0.9)
    low = tone(note(36), n, 'pulse', 0.5, vib=0.02, vibrate=5.0) * env(n, 0.02, curve=1.6) * 0.5
    return dry(crush(softclip(a * 0.8 + low, 1.3), 6), 0.8)


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
