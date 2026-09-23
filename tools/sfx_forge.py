# Генератор звуков игры: python3 tools/sfx_forge.py sfx/
# Стиль — звуковой чип Mega Drive, как в Sonic 3 / Sonic 3 A.I.R.:
# FM-операторы с обратной связью, зернистый шум PSG, шаги громкости
# и высоты раз в кадр. Всё синтезируется с нуля, чужих сэмплов нет.
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

# --- Приёмы звукового драйвера Mega Drive (Sonic 3 / Sonic 3 A.I.R.) ---
# Драйвер меняет громкость и высоту не плавно, а раз в кадр (1/60 с):
# отсюда характерные «ступенчатые» спады и трели. Шум — не белый шум
# компьютера, а сдвиговый регистр PSG, который тикает на низкой частоте
# и потому звучит зернисто, «хрустко».
TICK = 1 / 60

def per_tick(values, dur):
    """Растягивает значения по кадрам на всю длину: одно значение на тик."""
    n = int(SR * dur); per = int(SR * TICK)
    v = np.repeat(np.asarray(values, float), per)
    return pad(v, n) if len(v) < n else v[:n]

def tick_env(dur, db_per_tick=1.5, hold=0):
    """Ступенчатый спад громкости: каждые 1/60 с минус db_per_tick, шаг PSG — 2 дБ."""
    k = int(dur / TICK) + 1
    att = np.maximum(0, np.arange(k) - hold) * db_per_tick
    att = np.round(att / 2) * 2
    return per_tick(10 ** (-att / 20), dur)

def tick_slide(f0, f1, dur, ticks=None):
    """Высота меняется ступеньками раз в кадр."""
    k = ticks or max(1, int(dur / TICK))
    return per_tick(f0 * (f1 / f0) ** np.linspace(0, 1, k), dur)

def psg_noise(dur, clock=3495):
    """Шум PSG: 16-битный регистр с отводами 0 и 3, тикает с частотой clock."""
    n = int(SR * dur); steps = int(dur * clock) + 2
    reg = 0x8000; bits = np.empty(steps)
    for i in range(steps):
        bit = (reg ^ (reg >> 3)) & 1
        reg = (reg >> 1) | (bit << 15)
        bits[i] = 1.0 if reg & 1 else -1.0
    idx = (np.arange(n) * clock / SR).astype(int)
    return bits[idx]

def fmfb(freq, ratio=1.0, index=2.0, fb=0.0):
    """Два оператора с обратной связью модулятора — «пила» и металл YM2612."""
    n = len(freq); idx = np.broadcast_to(np.asarray(index, float), (n,))
    pm = phase(freq * ratio); pc = phase(freq)
    out = np.empty(n); m1 = m2 = 0.0
    for i in range(n):
        m = np.sin(pm[i] + fb * (m1 + m2) * 0.5)
        m2, m1 = m1, m
        out[i] = np.sin(pc[i] + idx[i] * m)
    return out

def dac(x):
    """8-битный ЦАП: лёгкий хруст всего звука."""
    return crush(x, 8)

def blast(dur=0.5, clock=3495, db=1.2, kick=(160, 40)):
    """Один взрыв: зернистый шум PSG плюс FM-удар с падающей высотой."""
    nz = psg_noise(dur, clock) * tick_env(dur, db)
    k = fmfb(tick_slide(kick[0], kick[1], dur * 0.6), 0.5, 3, 0.8) * tick_env(dur * 0.6, db * 1.6)
    return mix(nz * 0.8, k * 0.7)

# --- Звуки ---

def pistol():
    d = 0.14
    las = fmfb(tick_slide(1900, 520, d), 1.0, np.linspace(4, 1, int(SR * d)), 0.7) * tick_env(d, 3)
    clk = psg_noise(0.034, 6991) * tick_env(0.034, 6)
    return dac(mix(las * 0.7, clk * 0.3))

def shotgun():
    d = 0.45
    return dac(mix(psg_noise(d, 6991) * tick_env(d, 1.8) * 0.8, blast(0.35, 3495, 2.2, (220, 50)) * 0.8))

def enemy_shot(v):
    d = 0.1
    f = tick_slide(1200, 700, d) if v == 0 else tick_slide(800, 1250, d)
    return dac(fmfb(f, 2.0, 1.4, 0.3) * tick_env(d, 4))

def alt():
    d = 0.34
    f = tick_slide(420, 1700, d) * per_tick([1, 1.06] * 20, d)       # трель раз в кадр
    return dac(fmfb(f, 1.0, 2.5, 0.9) * tick_env(d, 1.6, 3))

def rocket():
    d = 0.6
    nz = mix(psg_noise(d, 1747) * np.linspace(0.3, 1, int(SR * d)), psg_noise(d, 6991) * 0.4) * tick_env(d, 1.0, 4)
    hum = fmfb(tick_slide(90, 60, d), 0.5, 2.5, 0.6) * tick_env(d, 1.2)
    return dac(mix(nz * 0.7, hum * 0.5))

def boom():
    return dac(echo(blast(0.9, 3495, 1.0, (140, 35)), 0.1, 0.2, 2))

def achievement():
    bell = lambda f: fmfb(f, 3.0, np.linspace(2.5, 0.8, len(f)), 0.2)
    d = 0.12
    run = np.concatenate([bell(np.full(int(SR * d), N(k))) * tick_env(d, 1.5) for k in ('B5', 'E6', 'G#6')])
    tail = 1.0
    top = mix(bell(np.full(int(SR * tail), N('B6'))), bell(np.full(int(SR * tail), N('E7'))) * 0.5) * tick_env(tail, 0.7)
    return dac(echo(np.concatenate([run, top]), 0.1, 0.25, 2))

def parry_up():
    d = 0.3
    f = tick_slide(600, 2400, d) * per_tick([1, 1.12, 1.26] * 12, d)   # быстрое арпеджио по кадрам
    sh = fmfb(f, 2.0, 1.8, 0.4) * tick_env(d, 1.0, 4)
    return dac(echo(sh, 0.05, 0.3, 2))

def parry_done():
    """Отражённый удар: металлический удар и цепочка взрывов на 2.6 с."""
    total = 2.9; n = int(SR * total); out = np.zeros(n)
    hit = 0.5
    clang = fmfb(np.full(int(SR * hit), 1250.0), 3.5, np.linspace(6, 0.5, int(SR * hit)), 0.5) * tick_env(hit, 2.2)
    out[:len(clang)] += clang * 0.7
    first = blast(1.0, 6991, 0.9, (200, 30))
    out[:len(first)] += first * 1.0
    for t0, g, clk in ((0.28, 0.9, 3495), (0.55, 0.85, 6991), (0.85, 0.8, 3495),
                       (1.15, 0.7, 3495), (1.5, 0.65, 6991), (1.85, 0.55, 3495), (2.2, 0.45, 1747)):
        b = blast(0.7, clk, 1.3, (170 * rng.uniform(0.85, 1.15), 35)) * g
        i0 = int(SR * t0); m = min(len(b), n - i0); out[i0:i0 + m] += b[:m]
    rumble = lowpass(psg_noise(total, 1747), 500) * tick_env(total, 0.22, 10)
    return dac(mix(out, rumble * 0.6))

def dash():
    d = 0.42
    rev = fmfb(tick_slide(200, 1400, 0.2), 1.0, 3, 0.9) * tick_env(0.2, 0.8)
    whoosh = psg_noise(0.3, 6991) * tick_env(0.3, 2)
    return dac(mix(rev * 0.6, np.concatenate([np.zeros(int(SR * 0.12)), whoosh * 0.6])))

def equip():
    d = 0.08
    return dac(np.concatenate([fmfb(np.full(int(SR * d), N(k)), 2.0, 1.5, 0.3) * tick_env(d, 1.5) for k in ('C6', 'G6')]))

def ui_nav():
    d = 0.05
    return dac(fmfb(np.full(int(SR * d), 1320.0), 2.0, 1.2, 0.2) * tick_env(d, 5))

def boss_spawn():
    d = 2.0
    siren = fmfb(per_tick([110, 110, 110, 104, 104, 104] * 25, d) * tick_slide(1, 0.6, d), 0.5, 3, 1.0) * tick_env(d, 0.25, 20)
    rum = psg_noise(d, 1747) * np.linspace(0.2, 1, int(SR * d)) * tick_env(d, 0.4, 30)
    return dac(echo(mix(siren * 0.7, rum * 0.4), 0.15, 0.3, 2))

def hurt(v):
    d = 0.4
    f = tick_slide(900 if v == 0 else 780, 180, d) * per_tick([1, 0.9] * 30, d)
    tone = fmfb(f, 1.0, 2.2, 0.8) * tick_env(d, 1.2)
    nz = psg_noise(0.1, 6991) * tick_env(0.1, 4)
    return dac(mix(tone * 0.7, nz * 0.4))

def enemy_death(v):
    d = 0.3
    pop = psg_noise(0.15, 6991 if v == 0 else 3495) * tick_env(0.15, 3)
    blip = fmfb(tick_slide(500 if v == 0 else 640, 1600, 0.12), 1.0, 2, 0.5) * tick_env(0.12, 2)
    return dac(mix(pop * 0.7, blip * 0.5, blast(d, 3495, 3, (180, 60)) * 0.4))

def lose():
    seq = [N('G5'), N('F#5'), N('F5'), N('E5')]
    step = 0.2
    run = np.concatenate([fmfb(np.full(int(SR * step), f) * per_tick([1, 1.012] * 20, step), 1.0, 1.8, 0.4) * tick_env(step, 0.6) for f in seq])
    d = 0.9
    low = fmfb(np.full(int(SR * d), N('C4')) * per_tick([1, 1.015] * 60, d), 0.5, 2, 0.5) * tick_env(d, 0.5, 6)
    return dac(np.concatenate([run, low]))

def surge():
    d = 0.7
    f = tick_slide(150, 2000, d)
    return dac(mix(fmfb(f, 1.0, 3, 1.0) * tick_env(d, 0.6, 8), psg_noise(d, 6991) * tick_env(d, 0.9) * 0.3))

def pulse():
    d = 0.6
    wh = fmfb(tick_slide(180, 50, d), 1.0, np.linspace(6, 0, int(SR * d)), 0.5) * tick_env(d, 0.9)
    return dac(echo(mix(wh, blast(0.4, 1747, 2, (120, 40)) * 0.4), 0.09, 0.3, 2))

def glitch():
    out = []
    for _ in range(18):
        seg = int(SR * TICK * rng.integers(1, 3))
        if rng.random() < 0.4:
            out.append(psg_noise(seg / SR, rng.choice([1747, 3495, 6991])) * rng.uniform(0.3, 1))
        else:
            out.append(fmfb(np.full(seg, rng.choice([220, 660, 1320, 2640])), 1.0, 3, 1.0) * rng.uniform(0.3, 1))
    x = np.concatenate(out)
    return crush(x * tick_env(len(x) / SR, 0.8), 5)

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
