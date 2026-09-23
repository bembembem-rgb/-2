# Генератор звуков игры: python3 tools/sfx_forge.py sfx/
# Стиль — смесь двух школ: FM-колокольчики и хрусткие взрывы в духе
# Mega Drive (Sonic Mania) плюс квадратные «блипы» и арпеджио в духе
# Deltarune. Всё синтезируется с нуля, чужих сэмплов нет.
import numpy as np, wave, os, sys

SR = 22050
rng = np.random.default_rng(7)

def t_(dur): return np.arange(int(SR * dur)) / SR

def slide(f0, f1, dur, curve=1.0):
    """Частота по экспоненте от f0 к f1."""
    x = np.linspace(0, 1, int(SR * dur)) ** curve
    return f0 * (f1 / f0) ** x

def phase(freq): return 2 * np.pi * np.cumsum(freq) / SR

def square(freq, duty=0.5):
    p = (np.cumsum(freq) / SR) % 1.0
    return np.where(p < duty, 1.0, -1.0)

def tri(freq):
    p = (np.cumsum(freq) / SR) % 1.0
    return 4 * np.abs(p - 0.5) - 1

def sine(freq): return np.sin(phase(freq))

def fm(freq, ratio, index):
    """Два оператора, как у YM2612: модулятор с огибающей индекса."""
    return np.sin(phase(freq) + index * np.sin(phase(freq * ratio)))

def noise(dur): return rng.uniform(-1, 1, int(SR * dur))

def env(n, a=0.002, d=None, power=1.0):
    """Быстрая атака и экспоненциальный спад до нуля к концу."""
    x = np.arange(n) / SR
    att = np.clip(x / max(a, 1e-4), 0, 1)
    dec = (1 - np.arange(n) / n) ** (d if d else 2.0)
    return att * dec ** power

def lowpass(x, cutoff):
    """Однополюсный фильтр; cutoff — число или массив."""
    c = np.broadcast_to(np.asarray(cutoff, float), x.shape)
    a = 1 - np.exp(-2 * np.pi * c / SR)
    y = np.empty_like(x); acc = 0.0
    for i in range(len(x)):
        acc += a[i] * (x[i] - acc); y[i] = acc
    return y

def highpass(x, cutoff): return x - lowpass(x, cutoff)

def crush(x, bits=8, hold=1):
    """Битность и «ступеньки» частоты дискретизации — хруст 16-битных консолей."""
    if hold > 1:
        x = np.repeat(x[::hold], hold)[:len(x)]
    q = 2 ** (bits - 1)
    return np.round(x * q) / q

def echo(x, delay=0.07, fb=0.35, taps=3):
    d = int(SR * delay); out = np.concatenate([x, np.zeros(d * taps)])
    for k in range(1, taps + 1):
        out[d * k:d * k + len(x)] += x * fb ** k
    return out

def pad(x, n):
    return np.concatenate([x, np.zeros(max(0, n - len(x)))])[:n]

def mix(*parts):
    n = max(len(p) for p in parts)
    return sum(pad(p, n) for p in parts)

def notes(seq, step, voice, tail=0.0):
    """Арпеджио: seq — частоты, step — длительность ноты."""
    out = []
    for i, f in enumerate(seq):
        dur = step + (tail if i == len(seq) - 1 else 0)
        n = int(SR * dur)
        out.append(voice(np.full(n, f)) * env(n, 0.001, 1.2))
    return np.concatenate(out)

def N(name):
    """Нота по имени: A4 = 440."""
    names = {'C': -9, 'C#': -8, 'D': -7, 'D#': -6, 'E': -5, 'F': -4, 'F#': -3,
             'G': -2, 'G#': -1, 'A': 0, 'A#': 1, 'B': 2}
    return 440 * 2 ** ((names[name[:-1]] + 12 * (int(name[-1]) - 4)) / 12)

def save(path, x, gain=0.9):
    x = np.asarray(x, float)
    fade = min(len(x), int(SR * 0.004))
    x[-fade:] *= np.linspace(1, 0, fade)
    x = x / (np.max(np.abs(x)) + 1e-9) * gain
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((x * 32767).astype('<i2').tobytes())

# --- Звуки ---

def pistol():
    d = 0.16; n = int(SR * d)
    body = square(slide(1500, 420, d, 0.6), 0.25) * env(n, 0.001, 2.5)
    click = fm(np.full(n, 2200.0), 1.5, 3.0) * env(n, 0.0005, 12)
    snap = highpass(noise(0.02), 3000) * env(int(SR * 0.02), 0.0005, 2)
    return crush(mix(body * 0.6, click * 0.5, snap * 0.4), 8)

def shotgun():
    d = 0.4; n = int(SR * d)
    nz = lowpass(noise(d), slide(6000, 300, d, 0.5)) * env(n, 0.001, 2.2)
    kick = sine(slide(170, 40, d, 0.4)) * env(n, 0.001, 3)
    zap = square(slide(420, 90, 0.12), 0.5) * env(int(SR * 0.12), 0.001, 2)
    return crush(mix(nz * 0.9, kick * 0.9, zap * 0.35), 6, 2)

def enemy_shot(v):
    d = 0.12; n = int(SR * d)
    f = slide(950, 560, d) if v == 0 else slide(760, 1080, d)
    return crush(tri(f) * env(n, 0.001, 2) * 0.8 + square(f * 2, 0.125) * env(n, 0.001, 4) * 0.2, 7)

def alt():
    d = 0.32; n = int(SR * d)
    idx = np.linspace(5, 0.3, n)
    z = np.sin(phase(slide(500, 1900, d, 0.7)) + idx * np.sin(phase(slide(1000, 3800, d, 0.7)))) * env(n, 0.002, 1.6)
    arp = notes([N('E5'), N('B5'), N('E6')], 0.045, lambda f: square(f, 0.25))
    return crush(mix(z * 0.7, arp * 0.3), 8)

def rocket():
    d = 0.55; n = int(SR * d)
    whoosh = lowpass(highpass(noise(d), slide(300, 2500, d)), 5000) * env(n, 0.03, 1.2)
    rumble = square(slide(90, 55, d), 0.5) * env(n, 0.005, 1.5)
    return crush(mix(whoosh * 0.9, lowpass(rumble, 600) * 0.6), 7, 2)

def boom():
    d = 0.8; n = int(SR * d)
    nz = lowpass(noise(d), slide(5000, 200, d, 0.5)) * env(n, 0.001, 1.8)
    kick = sine(slide(140, 30, d, 0.35)) * env(n, 0.001, 2.2)
    crunch = square(slide(220, 50, 0.2), 0.5) * env(int(SR * 0.2), 0.001, 2)
    return echo(crush(mix(nz, kick * 1.1, crunch * 0.3), 5, 3), 0.09, 0.25, 2)

def achievement():
    bell = lambda f: fm(f, 3.5, 2.2) * 0.6 + square(f, 0.25) * 0.25
    run = notes([N('C6'), N('E6'), N('G6'), N('C7')], 0.055, bell)
    d = 0.7; n = int(SR * d); vib = 1 + 0.006 * np.sin(2 * np.pi * 6 * t_(d))
    chord = sum(fm(np.full(n, N(k)) * vib, 3.5, 1.6) for k in ('E6', 'G6', 'C7')) / 3 * env(n, 0.002, 1.5)
    return echo(crush(np.concatenate([run, chord]), 10), 0.11, 0.3, 3)

def parry_up():
    run = notes([N('A5'), N('C#6'), N('E6'), N('A6')], 0.03, lambda f: square(f, 0.5), tail=0.08)
    shine = fm(np.full(int(SR * 0.2), N('A7')), 2.0, 1.0) * env(int(SR * 0.2), 0.001, 3)
    late = np.concatenate([np.zeros(int(SR * 0.09)), shine * 0.3])
    return echo(crush(mix(run * 0.7, late), 8), 0.06, 0.3, 2)

def parry_done():
    d = 0.6; n = int(SR * d)
    f = np.full(n, 1180.0)   # нецелое отношение 3.51 даёт металл вместо тона
    clang = np.sin(phase(f) + np.linspace(7, 0.5, n) * np.sin(phase(f * 3.51))) * env(n, 0.0005, 2.2)
    ting = square(np.full(n, 2360.0), 0.125) * env(n, 0.0005, 6)
    hit = highpass(noise(0.03), 2500) * env(int(SR * 0.03), 0.0005, 2)
    return echo(crush(mix(clang * 0.7, ting * 0.25, hit * 0.5), 9), 0.08, 0.3, 3)

def dash():
    d = 0.3; n = int(SR * d)
    sweep = highpass(noise(d), slide(400, 5000, d)) * env(n, 0.005, 1.5)
    rise = square(slide(180, 1400, 0.12, 0.6), 0.5) * env(int(SR * 0.12), 0.001, 1.2)
    return crush(mix(sweep * 0.7, rise * 0.45), 7, 2)

def equip():
    return echo(crush(notes([N('E6'), N('B6')], 0.06, lambda f: square(f, 0.5), tail=0.05) * 0.8, 8), 0.05, 0.25, 2)

def ui_nav():
    n = int(SR * 0.045)
    return crush(square(np.full(n, 1760.0), 0.125) * env(n, 0.0005, 3), 6)

def boss_spawn():
    d = 1.8; n = int(SR * d); f = slide(70, 38, d, 0.6)
    saws = sum(lowpass(square(f * k, 0.5), 900) for k in (1.0, 1.013, 0.5)) / 3 * env(n, 0.02, 1.2)
    growl = fm(f * 2, 1.005, 4) * env(n, 0.1, 1.5)
    swell = lowpass(noise(d), slide(200, 3000, d)) * np.linspace(0, 1, n) ** 2 * env(n, 0.001, 0.8)
    stab = notes([N('D4'), N('G#3')], 0.12, lambda q: square(q, 0.25))
    return echo(crush(mix(saws, growl * 0.5, swell * 0.4, stab * 0.5), 6, 2), 0.14, 0.3, 3)

def hurt(v):
    d = 0.3; n = int(SR * d)
    f = slide(760 if v == 0 else 640, 140, d, 0.8) * (1 + 0.06 * np.sin(2 * np.pi * 34 * t_(d)))
    tone = square(f, 0.5) * env(n, 0.001, 1.8)
    nz = lowpass(noise(0.08), 2500) * env(int(SR * 0.08), 0.001, 2)
    return crush(mix(tone * 0.6, nz * 0.6), 5, 3)

def enemy_death(v):
    d = 0.24; n = int(SR * d)
    pop = lowpass(noise(0.05), 4000) * env(int(SR * 0.05), 0.0005, 2)
    blip = square(slide(420, 1300, 0.09) if v == 0 else slide(520, 1600, 0.08), 0.25) * env(int(SR * (0.09 if v == 0 else 0.08)), 0.001, 1.5)
    ring = fm(np.full(n, 1567.0 if v == 0 else 1760.0), 2.0, 1.2) * env(n, 0.001, 4)
    return crush(mix(pop * 0.7, blip * 0.5, np.concatenate([np.zeros(int(SR * 0.05)), ring * 0.25])), 7)

def lose():
    run = notes([N('G5'), N('E5'), N('C5'), N('G4')], 0.16, lambda f: square(f * (1 + 0.01 * np.sin(2 * np.pi * 7 * np.arange(len(f)) / SR)), 0.5))
    d = 0.9; n = int(SR * d)
    low = tri(np.full(n, N('C4')) * (1 + 0.012 * np.sin(2 * np.pi * 5 * t_(d)))) * env(n, 0.01, 1.4)
    bass = tri(np.full(n, N('C3'))) * env(n, 0.01, 1.2)
    return echo(crush(np.concatenate([run * 0.6, mix(low * 0.6, bass * 0.5)]), 7), 0.12, 0.25, 2)

def surge():
    d = 0.65; n = int(SR * d)
    whine = np.sin(phase(slide(180, 2200, d, 1.4)) + 3 * np.sin(phase(slide(360, 4400, d, 1.4)))) * env(n, 0.01, 1.2)
    nz = highpass(noise(d), 1500) * np.linspace(0.2, 1, n) * env(n, 0.01, 1.5)
    return crush(mix(whine * 0.7, nz * 0.3), 7, 2)

def pulse():
    d = 0.55; n = int(SR * d)
    whomp = np.sin(phase(slide(160, 55, d, 0.5)) + np.linspace(6, 0, n) * np.sin(phase(slide(160, 55, d, 0.5)))) * env(n, 0.002, 1.6)
    ring = square(np.full(n, N('E6')), 0.25) * env(n, 0.001, 5)
    return echo(crush(mix(whomp, ring * 0.2), 7), 0.09, 0.3, 2)

def glitch():
    out = []
    for _ in range(14):
        seg = int(SR * rng.uniform(0.012, 0.035))
        f = rng.choice([180, 440, 900, 1800, 3100]) * rng.uniform(0.9, 1.1)
        out.append(square(np.full(seg, f), rng.choice([0.125, 0.5])) * rng.uniform(0.3, 1))
    x = np.concatenate(out)
    return crush(x * env(len(x), 0.001, 1.0), 4, 4)

SOUNDS = {
    'sfx_pistol': pistol, 'sfx_shotgun': shotgun,
    'sfx_enemyshot_a': lambda: enemy_shot(0), 'sfx_enemyshot_b': lambda: enemy_shot(1),
    'sfx_alt': alt, 'sfx_rocket': rocket, 'sfx_boom': boom,
    'sfx_achievement': achievement, 'sfx_parry_up': parry_up, 'sfx_parry_done': parry_done,
    'sfx_dash': dash, 'sfx_equip': equip, 'sfx_ui_nav': ui_nav, 'sfx_boss_spawn': boss_spawn,
    'sfx_hurt_a': lambda: hurt(0), 'sfx_hurt_b': lambda: hurt(1),
    'sfx_enemy_death_a': lambda: enemy_death(0), 'sfx_enemy_death_b': lambda: enemy_death(1),
    'sfx_lose': lose, 'sfx_surge': surge, 'sfx_pulse': pulse, 'sfx_glitch': glitch,
}

if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'sfx'
    os.makedirs(out, exist_ok=True)
    for name, fn in SOUNDS.items():
        save(os.path.join(out, name + '.wav'), fn())
        print(name)
