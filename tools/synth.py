"""Мини-синтезатор для звуков игры. Всё считается из шума и осцилляторов,
чужого материала нет ни одного сэмпла."""
import numpy as np

SR = 44100

def n_of(sec): return max(1, int(SR * sec))
def tline(n): return np.arange(n) / SR

def noise(n, rng): return rng.uniform(-1, 1, n)

def sweep(f0, f1, n, curve=2.0):
    """Частотная развёртка: фаза копится, иначе на стыке щёлкает."""
    k = np.linspace(0, 1, n) ** curve
    f = f0 + (f1 - f0) * k
    return np.cumsum(2 * np.pi * f / SR)

def osc(phase, kind='sine', detune=0.0):
    if kind == 'sine':  return np.sin(phase)
    if kind == 'saw':   return 2 * ((phase / (2*np.pi)) % 1.0) - 1
    if kind == 'square':return np.sign(np.sin(phase))
    if kind == 'tri':   return 2/np.pi * np.arcsin(np.clip(np.sin(phase), -1, 1))
    return np.sin(phase)

def env(n, attack=0.004, decay=None, curve=2.2, sustain=0.0):
    """Атака-спад. Быстрая атака = щелчок, поэтому минимум 1 мс."""
    a = max(1, int(SR * attack))
    a = min(a, n)
    d = n - a
    e = np.zeros(n)
    e[:a] = np.linspace(0, 1, a)
    if d > 0:
        tail = np.linspace(0, 1, d)
        e[a:] = (1 - tail) ** curve * (1 - sustain) + sustain
    return e

def lowpass(x, cutoff, res=0.0):
    """Резонансный фильтр второго порядка (biquad)."""
    w0 = 2 * np.pi * np.clip(cutoff, 20, SR/2 - 100) / SR
    alpha = np.sin(w0) / (2 * max(0.5, 0.707 + res * 6))
    c = np.cos(w0)
    b0, b1, b2 = (1-c)/2, 1-c, (1-c)/2
    a0, a1, a2 = 1+alpha, -2*c, 1-alpha
    b0, b1, b2, a1, a2 = b0/a0, b1/a0, b2/a0, a1/a0, a2/a0
    y = np.zeros_like(x); x1=x2=y1=y2=0.0
    for i in range(len(x)):
        v = b0*x[i] + b1*x1 + b2*x2 - a1*y1 - a2*y2
        x2, x1 = x1, x[i]; y2, y1 = y1, v; y[i] = v
    return y

def highpass(x, cutoff):
    rc = 1.0 / (2*np.pi*max(10, cutoff)); a = rc / (rc + 1.0/SR)
    y = np.zeros_like(x); prev_x = 0.0; prev_y = 0.0
    for i in range(len(x)):
        prev_y = a * (prev_y + x[i] - prev_x); prev_x = x[i]; y[i] = prev_y
    return y

def sweep_lowpass(x, f0, f1, res=0.0, steps=24):
    """Развёртка среза кусками: переменный фильтр тут не нужен,
    а двадцать четыре ступени ухо уже не различает."""
    n = len(x); out = np.zeros(n); edges = np.linspace(0, n, steps+1).astype(int)
    for i in range(steps):
        a, b = edges[i], edges[i+1]
        if b <= a: continue
        cut = f0 + (f1 - f0) * (i / max(1, steps-1))
        pad = min(a, 256)
        seg = lowpass(x[a-pad:b], cut, res)
        out[a:b] = seg[pad:]
    return out

def bitcrush(x, bits=6, hold=3):
    q = 2 ** bits
    y = np.round(x * q) / q
    if hold > 1:
        idx = (np.arange(len(y)) // hold) * hold
        y = y[np.clip(idx, 0, len(y)-1)]
    return y

def softclip(x, drive=2.0): return np.tanh(x * drive) / np.tanh(drive)

def delay(x, ms, fb=0.3, mix=0.25, taps=4):
    d = int(SR * ms / 1000.0)
    y = x.copy(); g = mix
    for k in range(1, taps+1):
        s = d * k
        if s >= len(x): break
        y[s:] += x[:-s] * g
        g *= fb
    return y

def water(x, amount=0.5):
    """Подводная окраска: срез верха и короткий хвост отражений."""
    y = lowpass(x, 4200 - 1200*amount, res=0.05)
    return delay(y, 38, fb=0.34, mix=0.18*amount, taps=3)

def norm(x, peak=0.9):
    m = np.max(np.abs(x))
    return x * (peak / m) if m > 1e-9 else x

def edges(x, ms=3):
    k = min(len(x)//2, int(SR*ms/1000))
    if k < 2: return x
    x[:k] *= np.linspace(0, 1, k); x[-k:] *= np.linspace(1, 0, k)
    return x

def finish(x, peak=0.9):
    return edges(norm(np.nan_to_num(x), peak))

def save(path, x):
    import wave, struct
    x = np.clip(finish(x), -1, 1)
    data = (x * 32767).astype('<i2').tobytes()
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(data)

def save_mp3(path, x, bitrate=96):
    """MP3 через lameenc (pip install lameenc). Если его нет — кладём WAV
    рядом: игра одинаково играет и то, и другое, менять придётся только
    расширение в js/audio.js."""
    import numpy as np
    pcm = (np.clip(finish(x), -1, 1) * 32767).astype('<i2').tobytes()
    try:
        import lameenc
    except ImportError:
        save(path[:-4] + '.wav' if path.endswith('.mp3') else path + '.wav', x)
        return False
    enc = lameenc.Encoder()
    enc.set_bit_rate(bitrate); enc.set_in_sample_rate(SR)
    enc.set_channels(1); enc.set_quality(2)
    with open(path, 'wb') as f:
        f.write(bytes(enc.encode(pcm)) + bytes(enc.flush()))
    return True
