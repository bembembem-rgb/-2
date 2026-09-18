#!/usr/bin/env python3
"""Генератор звуков для NEON TIDES: ZERO.

Каждый звук считается из шума и осцилляторов — чужих сэмплов нет.
Правишь число в рецепте, запускаешь, получаешь новый банк:

    python3 tools/make_sfx.py            # всё
    python3 tools/make_sfx.py dash boom  # только эти

Вариантов у каждого звука несколько: ухо ловит повтор по одинаковой
атаке, и разброс высоты его не прячет — спасает другой файл.
Сид фиксирован, поэтому повторный запуск даёт те же файлы.
"""
import os, sys, math
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from synth import (SR, n_of, noise, sweep, osc, env, lowpass, highpass,
                   sweep_lowpass, bitcrush, softclip, delay, water, save, save_mp3, norm)

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'sfx')

# Целевая громкость по ролям. Нормировка по пику тут не работает: у щелчка
# пик такой же, как у взрыва, а слышно его вдвое тише — ухо считает энергию,
# а не вершину. Без этих чисел разброс между самым тихим и самым громким
# звуком доходил до пяти с половиной раз, и смена ствола тонула в бою.
LEVELS = {
    'boom': 0.50, 'pulse': 0.45,
    'hurt': 0.42, 'parry_hit': 0.40, 'parry_up': 0.38,
    'shot_shotgun': 0.38, 'shot_pistol': 0.36, 'shot_alt': 0.36, 'shot_enemy': 0.32,
    'rocket_launch': 0.34, 'enemy_death': 0.33, 'dash': 0.33,
    'surge': 0.33, 'glitch': 0.32, 'lose': 0.36, 'achievement': 0.32,
    'weapon': 0.28, 'ui': 0.20,
}

def loudness(x, win=0.05):
    """Громкость самого громкого окна. Среднее по всему файлу занижает
    короткие звуки: у щелчка половина длины — тишина после него, и по
    среднему он выходит втрое тише взрыва, хотя слышно его нормально."""
    w = int(SR * win)
    if len(x) <= w:
        return float(np.sqrt((x ** 2).mean()))
    e = np.convolve(x ** 2, np.ones(w) / w, mode='valid')
    return float(np.sqrt(e.max()))

def level(x, target):
    """Выводим на заданную громкость, не выпуская пик за единицу."""
    lo = loudness(x)
    if lo < 1e-9: return x
    y = x * (target / lo)
    pk = float(np.abs(y).max())
    return y * (0.97 / pk) if pk > 0.97 else y

# --- Рецепты. v — номер варианта, r — генератор случайных чисел ---

def shot_pistol(v, r):
    """Короткий разряд. Тело — пила с резким падением частоты."""
    n = n_of(0.13 + 0.02*r.random())
    f0 = 1500 + v*260 + r.integers(-90, 90)
    body = osc(sweep(f0, 190, n, 1.6), 'saw') * env(n, 0.001, curve=3.4)
    tick = noise(n, r) * env(n, 0.0005, curve=22) * 0.5
    x = softclip(body + tick, 1.6)
    return water(sweep_lowpass(x, 6500, 1200, res=0.12), 0.45)

def shot_alt(v, r):
    """Альт-залп: две волны подряд, вторая ниже и шире."""
    n = n_of((0.21, 0.26, 0.32)[v % 3])
    a = osc(sweep(900 + v*120, 150, n, 1.9), 'square') * env(n, 0.002, curve=2.6)
    b = np.zeros(n); off = int(SR*0.035)
    m = n - off
    b[off:] = osc(sweep(560 + v*70, 90, m, 2.2), 'saw') * env(m, 0.003, curve=2.0)
    x = softclip(a*0.7 + b*0.9 + noise(n, r)*env(n, 0.001, curve=16)*0.35, 2.0)
    return water(sweep_lowpass(x, 5200, 700, res=0.18), 0.6)

def shot_shotgun(v, r):
    """Дробовик: широкий шумовой фронт плюс низкий толчок.
    Толчок нарочно тише фронта: в первой версии он забирал 97% энергии,
    и выстрел звучал глухим ударом вместо залпа."""
    n = n_of((0.28, 0.34, 0.41)[v % 3])
    burst = noise(n, r) * env(n, 0.001, curve=5.0 + v*0.6)
    # Срез не уходит в самый низ: середина держит характер выстрела
    burst = sweep_lowpass(burst, 6500 + v*500, 1700, res=0.1)
    crack = highpass(noise(n, r), 2500) * env(n, 0.0006, curve=16) * 0.7
    thump = osc(sweep(150, 48, n, 2.4), 'sine') * env(n, 0.002, curve=3.4) * 0.45
    x = softclip(burst*1.0 + crack + thump, 1.9)
    return water(x, 0.3)

def shot_enemy(v, r):
    """Чужой выстрел: глуше игрока, чтобы не путать на слух."""
    n = n_of((0.14, 0.18, 0.22)[v % 3])
    body = osc(sweep(620 + v*90, 120, n, 1.5), 'tri') * env(n, 0.004, curve=2.8)
    grit = bitcrush(noise(n, r), 5, 4) * env(n, 0.002, curve=9) * 0.4
    x = body + grit
    return water(sweep_lowpass(x, 2600, 600, res=0.2), 0.7)

def rocket_launch(v, r):
    """Пуск: нарастающий шум с уходящим вверх срезом."""
    n = n_of((0.45, 0.62)[v % 2])
    hiss = noise(n, r)
    hiss = sweep_lowpass(hiss, 700, 5200 + v*600, res=0.06)
    ramp = np.linspace(0, 1, n) ** 1.6
    rumble = osc(sweep(70, 130, n, 1.0), 'sine') * ramp
    x = hiss * ramp * 0.9 + rumble * 0.7
    x *= env(n, 0.05, curve=1.1, sustain=0.25)
    return water(x, 0.5)

def boom(v, r):
    """Взрыв: сабовый удар, шумовое тело, осколки в хвосте."""
    n = n_of((0.68, 0.85, 1.02)[v % 3])
    sub = osc(sweep(120, 28, n, 2.8), 'sine') * env(n, 0.002, curve=1.9) * 1.3
    body = sweep_lowpass(noise(n, r), 3400 + v*500, 260, res=0.12) * env(n, 0.003, curve=2.4)
    deb = np.zeros(n)
    for _ in range(9 + v*3):
        p = int(r.uniform(0.06, 0.6) * n); ln = n_of(0.03)
        if p + ln >= n: continue
        deb[p:p+ln] += noise(ln, r) * env(ln, 0.001, curve=12) * r.uniform(0.15, 0.4)
    mid = sweep_lowpass(noise(n, r), 7000, 1800, res=0.18) * env(n, 0.002, curve=4.5) * 0.55
    x = softclip(sub + body*0.95 + mid + highpass(deb, 900), 1.7)
    return water(x, 0.4)

def hurt(v, r):
    """Удар по игроку: глухой толчок и короткий нисходящий тон.
    Варианты разведены и по длине, и по высоте: одинаковая длина —
    первое, по чему ухо узнаёт повтор."""
    dur = (0.22, 0.31, 0.40)[v % 3]
    n = n_of(dur)
    f0 = (330, 250, 190)[v % 3]
    thud = osc(sweep(f0, 62, n, 2.0 + v*0.5), 'sine') * env(n, 0.001, curve=2.2 + v*0.6)
    tear = sweep_lowpass(noise(n, r), 3000 - v*600, 380, res=0.15) * env(n, 0.002, curve=4 + v*2)
    x = softclip(thud*1.2 + tear*(0.75 - v*0.12), 2.0 + v*0.4)
    return water(x, 0.6 + v*0.1)

def enemy_death(v, r):
    """Смерть слизи: мокрый хлопок с пузырями."""
    n = n_of((0.27, 0.34, 0.41, 0.48)[v % 4])
    pop = osc(sweep(420 + v*80, 60, n, 3.0), 'sine') * env(n, 0.001, curve=4.0)
    splat = sweep_lowpass(noise(n, r), 3000, 300, res=0.22) * env(n, 0.002, curve=4.5)
    bub = np.zeros(n)
    for _ in range(4 + v):
        p = int(r.uniform(0.1, 0.7) * n); ln = n_of(0.05)
        if p + ln >= n: continue
        f = r.uniform(500, 1500)
        bub[p:p+ln] += osc(sweep(f, f*2.2, ln, 1.0), 'sine') * env(ln, 0.004, curve=5) * 0.3
    x = pop*0.9 + splat*0.8 + bub
    return water(x, 0.85)

def dash(v, r):
    """Рывок: вода расступается — шум с уходящим вверх срезом."""
    n = n_of((0.24, 0.3, 0.37)[v % 3])
    sw = sweep_lowpass(noise(n, r), 400, 4000 + v*700, res=0.1)
    sw *= env(n, 0.012, curve=2.2)
    tone = osc(sweep(180, 620 + v*80, n, 1.4), 'sine') * env(n, 0.02, curve=2.6) * 0.5
    return water(sw*0.9 + tone, 0.6)

def parry_up(v, r):
    """Щит поднят: металлический звон вверх."""
    n = n_of((0.28, 0.38)[v % 2])
    x = np.zeros(n)
    base = 520 + v*90
    for k, amp in ((1, 1.0), (2.01, 0.5), (3.02, 0.28), (4.7, 0.16)):
        x += osc(sweep(base*k*0.86, base*k, n, 0.7), 'sine') * amp
    x *= env(n, 0.006, curve=2.4)
    return water(x * 0.5, 0.4)

def parry_hit(v, r):
    """Отражено: яркий удар с обратным нарастанием перед ним."""
    n = n_of((0.35, 0.48)[v % 2]); pre = n_of((0.07, 0.11)[v % 2])
    x = np.zeros(n)
    rev = noise(pre, r) * np.linspace(0, 1, pre) ** 2.5
    x[:pre] += sweep_lowpass(rev, 1200, 6000, res=0.1) * 0.5
    m = n - pre
    clang = np.zeros(m)
    base = 880 + v*140
    for k, amp in ((1, 1.0), (2.4, 0.55), (3.9, 0.3), (5.6, 0.18)):
        clang += osc(np.arange(m) * 2*np.pi*base*k/SR, 'sine') * amp
    clang *= env(m, 0.001, curve=3.2)
    x[pre:] += clang * 0.55
    return water(softclip(x, 1.4), 0.45)

def pulse(v, r):
    """Импульс: саб выталкивает воду, сверху идёт мерцание."""
    dur = (0.62, 0.86)[v % 2]
    n = n_of(dur)
    sub = osc(sweep(110 - v*28, 34, n, 1.9 + v*0.6), 'sine') * env(n, 0.004, curve=2.4 + v*0.5) * 0.85
    shim = np.zeros(n)
    for k in range(4 + v*3):
        f = 620 + k*(380 + v*160)
        shim += osc(sweep(f*0.65, f*(1.4 + v*0.4), n, 1.2), 'sine') * env(n, 0.03 + k*0.012, curve=2.6) * (0.3 - k*0.035)
    ring = sweep_lowpass(noise(n, r), 6000, 1500 + v*500, res=0.2) * env(n, 0.002, curve=3.5) * (0.6 - v*0.15)
    # Саб оставлен взрыву: если низ занимают оба, при одновременном
    # срабатывании они складываются в кашу и оба теряют опознаваемость.
    body = highpass(shim * 1.6 + ring * 1.3, 320)
    return water(softclip(sub * 0.7 + body, 1.4 + v*0.4), 0.25)

def surge(v, r):
    """Накачка: нарастающий гул с биением. Скорость биения у вариантов
    разная — она слышнее, чем сдвиг основного тона."""
    dur = (0.66, 0.95)[v % 2]
    n = n_of(dur)
    ramp = np.linspace(0, 1, n) ** (1.6 - v*0.5)
    beat = 3.0 + v*7.0
    a = osc(sweep(95 + v*40, 380 + v*180, n, 1.3), 'saw')
    b = osc(sweep(95 + v*40 + beat, 380 + v*180 + beat, n, 1.3), 'saw')
    x = (a + b) * 0.5 * ramp
    x += noise(n, r) * ramp * (0.22 - v*0.09)
    x *= env(n, 0.09, curve=1.2, sustain=0.5)
    return water(sweep_lowpass(x, 700 + v*400, 3600 + v*1400, res=0.15), 0.55)

def glitch(v, r):
    """Помеха: дроблёный шум рваными кусками."""
    n = n_of((0.26, 0.42)[v % 2])
    x = np.zeros(n); pos = 0
    while pos < n:
        ln = int(SR * r.uniform(0.008, 0.045))
        ln = min(ln, n - pos)
        if ln <= 0: break
        if r.random() < 0.75:
            f = r.uniform(200, 3000)
            seg = osc(np.arange(ln) * 2*np.pi*f/SR, 'square') * r.uniform(0.3, 1.0)
            seg = bitcrush(seg, int(r.integers(3, 6)), int(r.integers(2, 7)))
            x[pos:pos+ln] = seg
        pos += ln
    x *= env(n, 0.001, curve=1.6, sustain=0.35)
    return water(sweep_lowpass(x, 5000, 900, res=0.1) * 0.7, 0.5)

def weapon(v, r):
    """Смена ствола: два механических щелчка. Пауза между ними у вариантов
    разная — именно её ухо и запоминает."""
    n = n_of((0.15, 0.2)[v % 2]); x = np.zeros(n)
    for i, off in enumerate((0.0, (0.038, 0.082)[v % 2])):
        p = int(SR*off); ln = n_of(0.05)
        if p + ln >= n: continue
        clk = noise(ln, r) * env(ln, 0.0004, curve=17)
        clk = highpass(sweep_lowpass(clk, 5200, 1400, res=0.25), 600)
        tone = osc(np.arange(ln) * 2*np.pi*(260 + i*220 + v*190)/SR, 'sine') * env(ln, 0.001, curve=9) * 0.55
        x[p:p+ln] += clk*1.0 + tone
    return water(x, 0.25)

def ui(v, r):
    """Навигация по меню: тихий короткий блип."""
    n = n_of((0.07, 0.09, 0.11)[v % 3])
    f = 780 + v*180
    x = osc(np.arange(n) * 2*np.pi*f/SR, 'sine') * env(n, 0.002, curve=4.5)
    x += osc(np.arange(n) * 2*np.pi*f*2/SR, 'sine') * env(n, 0.002, curve=8) * 0.25
    return water(x * 0.5, 0.3)

def achievement(v, r):
    """Трофей: три ноты вверх, чисто и коротко."""
    n = n_of(0.75); x = np.zeros(n)
    for i, f in enumerate((523.25, 659.25, 987.77)):
        p = int(SR * i * 0.1); ln = n_of(0.42)
        if p + ln > n: ln = n - p
        seg = osc(np.arange(ln) * 2*np.pi*f/SR, 'sine') * env(ln, 0.005, curve=2.2)
        seg += osc(np.arange(ln) * 2*np.pi*f*2/SR, 'sine') * env(ln, 0.005, curve=4) * 0.3
        x[p:p+ln] += seg * (0.85 - i*0.12)
    return water(x * 0.6, 0.35)

def lose(v, r):
    """Конец забега: всё уходит вниз и глохнет."""
    n = n_of(1.5)
    x = np.zeros(n)
    for k, f in enumerate((220, 277, 330)):
        x += osc(sweep(f, f*0.42, n, 1.5), 'saw') * (0.5 - k*0.12)
    x = sweep_lowpass(x, 2600, 240, res=0.12)
    x *= env(n, 0.02, curve=1.5)
    x += noise(n, r) * env(n, 0.3, curve=2.0) * 0.12
    return water(softclip(x, 1.3), 0.9)


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
            print('нет такого рецепта:', name); continue
        fn, count = RECIPES[name]
        for v in range(count):
            rng = np.random.default_rng(abs(hash((name, v))) % (2**32))
            path = os.path.join(OUT, f'{name}_{v+1}.mp3')
            ok = save_mp3(path, level(fn(v, rng), LEVELS.get(name, 0.2)))
            made.append((path, ok))
    mp3 = sum(1 for _, ok in made if ok)
    print(f'записано файлов: {len(made)} (mp3: {mp3}, wav: {len(made)-mp3})')
    if mp3 < len(made):
        print('lameenc не установлен — вышли WAV. pip install lameenc, и перезапусти.')

if __name__ == '__main__':
    main()
