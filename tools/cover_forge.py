# Обложка и иконка для itch.io: python3 tools/cover_forge.py <папка>
# Рисуется в низком разрешении и увеличивается целым множителем — пиксели
# остаются ровными, как в игре. Сцена: герой по пояс, мощная контровая
# подсветка с лучами, неоновая сетка пола уходит к горизонту, слаймы.
from PIL import Image
import numpy as np, sys, os

rng = np.random.default_rng(3)

def grid(w, h):
    yy, xx = np.mgrid[0:h, 0:w]
    return yy + 0.5, xx + 0.5

class Scene:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.y, self.x = grid(w, h)
        self.img = np.zeros((h, w, 3), float)
        self.char = np.zeros((h, w), bool)

    def ell(self, cx, cy, rx, ry):
        return ((self.x - cx) / rx) ** 2 + ((self.y - cy) / ry) ** 2 <= 1

    def poly(self, pts):
        m = np.zeros((self.h, self.w), bool)
        n = len(pts)
        for i in range(n):
            x1, y1 = pts[i]; x2, y2 = pts[(i + 1) % n]
            m ^= ((y1 > self.y) != (y2 > self.y)) & (self.x < (x2 - x1) * (self.y - y1) / (y2 - y1 + 1e-9) + x1)
        return m

    def cap(self, p0, p1, r0, r1):
        (x0, y0), (x1, y1) = p0, p1
        dx, dy = x1 - x0, y1 - y0
        t = np.clip(((self.x - x0) * dx + (self.y - y0) * dy) / (dx * dx + dy * dy + 1e-9), 0, 1)
        d = np.hypot(self.x - (x0 + t * dx), self.y - (y0 + t * dy))
        return d <= r0 + (r1 - r0) * t, t

    def glow(self, cx, cy, r, color, k=1.0):
        d = np.hypot(self.x - cx, self.y - cy) / r
        self.img += np.clip(1 - d, 0, 1)[..., None] ** 2 * np.array(color, float) * k

    def put(self, m, color):
        self.img[m] = color

def ring(m):
    d = m.copy()
    d[1:] |= m[:-1]; d[:-1] |= m[1:]; d[:, 1:] |= m[:, :-1]; d[:, :-1] |= m[:, 1:]
    return d & ~m

def shade(S, m, ramp, light=(-1, -1)):
    """Три тона по маске: свет со стороны light, тень с обратной."""
    lx, ly = light
    sh = np.roll(np.roll(m, -ly * 2, 0), -lx * 2, 1)       # сдвиг к свету
    dk = np.roll(np.roll(m, ly * 2, 0), lx * 2, 1)
    S.img[m] = ramp[1]
    S.img[m & ~dk] = ramp[0]
    S.img[m & ~sh] = ramp[2]

# --- палитра игры ---
OUT = (8, 6, 14)
COAT = [(28, 24, 42), (46, 40, 66), (78, 70, 108)]
HOOD = [(18, 15, 28), (32, 28, 48), (58, 52, 84)]
VIS = [(120, 0, 26), (214, 18, 44), (255, 90, 100)]
NEON, NEON_DIM, GAP = (255, 40, 64), (170, 10, 36), (16, 6, 12)
CYAN = (0, 224, 255)
RED = (255, 40, 80)

def background(S, cx, hz):
    h, w = S.h, S.w
    t = S.y / h
    S.img[:] = (np.array([5, 6, 22]) * (1 - t)[..., None] + np.array([22, 8, 40]) * t[..., None])
    # дальние башни-силуэты с огнями
    for i in range(14):
        bx = rng.uniform(0, w); bw = rng.uniform(4, 11) * w / 126; bh = rng.uniform(8, 30) * h / 100
        m = (np.abs(S.x - bx) < bw / 2) & (S.y > hz - bh) & (S.y < hz)
        S.img[m] = (14, 10, 30)
        lights = m & (rng.random((h, w)) < 0.06)
        S.img[lights] = (255, 60, 90) if i % 3 else CYAN
    # контровой свет и лучи
    ang = np.arctan2(S.y - hz * 0.75, S.x - cx)
    rays = (np.sin(ang * 14) > 0.35).astype(float)
    d = np.hypot(S.x - cx, (S.y - hz * 0.75) * 1.1)
    S.img += (rays * np.clip(1 - d / (w * 0.7), 0, 1) ** 1.5)[..., None] * np.array([120, 20, 60])
    S.glow(cx, hz * 0.75, w * 0.42, (255, 40, 90), 1.1)
    S.glow(cx, hz * 0.75, w * 0.2, (255, 170, 190), 0.9)
    # пол: вода с неоновой сеткой в перспективе
    fl = S.y >= hz
    S.img[fl] = np.array([6, 8, 26]) + (S.y[fl] - hz)[..., None] / (h - hz) * np.array([4, 10, 24])
    depth = (S.y - hz) / (h - hz)
    for k in range(1, 12):                                  # поперечные линии
        yline = hz + (h - hz) * (k / 11) ** 2.2
        m = fl & (np.abs(S.y - yline) < 0.5)
        S.img[m] = np.array(CYAN) * (0.25 + 0.6 * k / 11)
    for k in range(-14, 15):                                # к горизонту
        xb = cx + k * w * 0.11
        xs = cx + (xb - cx) * depth
        m = fl & (np.abs(S.x - xs) < 0.5 + 0.2 * depth)
        S.img[m] = np.array(CYAN) * (0.2 + 0.6 * depth[m])[..., None]
    # отражение подсветки на воде
    refl = fl & (np.abs(S.x - cx) < w * 0.16 * (1 - depth * 0.4)) & ((S.y.astype(int) % 2) == 0)
    S.img[refl] = S.img[refl] * 0.5 + np.array([255, 50, 90]) * 0.5

def slime(S, cx, cy, s):
    body = S.ell(cx, cy, 5 * s, 3.6 * s) & (S.y < cy + 2.6 * s)
    S.img[ring(body)] = OUT
    shade(S, body, [(120, 0, 24), (220, 20, 50), (255, 110, 120)])
    for ex in (-1.8, 1.8):
        S.put(S.ell(cx + ex * s, cy - 0.5 * s, 1.1 * s, 1.3 * s), (255, 255, 255))
        S.put(S.ell(cx + ex * s + 0.3 * s, cy - 0.3 * s, 0.55 * s, 0.7 * s), OUT)

def arm(S, sh, el, hand, raised):
    """Рука: рукав пальто до локтя, дальше неоновые бинты, кулак-перчатка."""
    up, _ = S.cap(sh, el, 4.6, 4.0)
    fo, t = S.cap(el, hand, 4.0, 3.6)
    S.img[ring(up | fo)] = OUT
    shade(S, up, COAT)
    dx, dy = hand[0] - el[0], hand[1] - el[1]
    L = np.hypot(dx, dy); ux, uy = dx / L, dy / L
    along = (S.x - el[0]) * ux + (S.y - el[1]) * uy
    across = (S.x - el[0]) * -uy + (S.y - el[1]) * ux
    k = np.floor((along + 0.45 * across) / 1.6).astype(int) % 3
    S.img[fo & (k == 0)] = NEON; S.img[fo & (k == 1)] = NEON_DIM; S.img[fo & (k == 2)] = GAP
    S.img[fo & (k == 0) & ring(~fo)] = (255, 170, 175)
    fist = S.ell(hand[0], hand[1], 5.2, 4.8)
    S.img[ring(fist)] = OUT
    shade(S, fist, [(150, 0, 30), (235, 30, 56), (255, 150, 160)])
    S.char |= up | fo | fist | ring(up | fo | fist)
    return fist

def hero(S, cx, top):
    s = S.w / 126
    X = lambda v: cx + v * s
    Y = lambda v: top + v * s
    # пальто и плечи
    body = S.poly([(X(-15), Y(30)), (X(15), Y(30)), (X(30), Y(84)), (X(-30), Y(84))])
    body |= S.ell(X(0), Y(36), 22 * s, 10 * s)
    S.img[ring(body)] = OUT
    shade(S, body, COAT)
    inner = S.poly([(X(-4), Y(32)), (X(4), Y(32)), (X(9), Y(84)), (X(-9), Y(84))]) & body
    S.img[inner] = (12, 10, 20)
    S.img[ring(inner) & body & (S.x < X(0))] = COAT[2]
    strap, _ = S.cap((X(-14), Y(33)), (X(12), Y(70)), 1.4 * s, 1.4 * s)
    S.img[strap & body] = (120, 10, 32)
    S.img[strap & body & (np.floor(S.y) % 3 == 0)] = (200, 30, 56)
    S.char |= body | ring(body)
    # правая рука (слева на экране) — кулак поднят к капюшону
    arm(S, (X(-17), Y(37)), (X(-32), Y(48)), (X(-28), Y(31)), True)
    # левая рука — вниз и в сторону, в ней пистолет стволом наружу
    gun = S.poly([(X(30), Y(62)), (X(50), Y(62)), (X(50), Y(67)), (X(30), Y(67))])     # затвор
    gun |= S.poly([(X(31), Y(66)), (X(37), Y(66)), (X(35), Y(75)), (X(29), Y(75))])    # рукоять
    S.img[ring(gun)] = OUT
    shade(S, gun, [(40, 44, 60), (84, 94, 116), (160, 178, 200)])
    S.img[gun & (np.abs(S.y - Y(64.5)) < 0.6 * s) & (S.x > X(38))] = CYAN
    S.char |= gun | ring(gun)
    arm(S, (X(18), Y(38)), (X(26), Y(54)), (X(33), Y(66)), False)
    S.glow(X(52), Y(64.5), 8 * s, (255, 120, 60), 1.1)
    S.glow(X(52), Y(64.5), 3 * s, (255, 240, 200), 1.2)
    # капюшон
    hood = S.ell(X(0), Y(16), 19 * s, 17 * s) | S.poly([(X(-3), Y(-3)), (X(3), Y(-3)), (X(10), Y(6)), (X(-10), Y(6))])
    hood |= S.ell(X(0), Y(28), 21 * s, 8 * s)
    S.img[ring(hood)] = OUT
    shade(S, hood, HOOD)
    hole = S.ell(X(1.5), Y(19), 13.5 * s, 13 * s) & (S.y > Y(8))
    S.img[hole] = (4, 2, 8)
    S.img[ring(hole) & hood & (S.y < Y(16))] = HOOD[2]
    vis = (S.poly([(X(-9.5), Y(10)), (X(12.5), Y(10)), (X(12.5), Y(19)), (X(-9.5), Y(19))])
           | (S.ell(X(1.5), Y(19), 11 * s, 10 * s) & (S.y >= Y(18))))
    shade(S, vis, VIS)
    S.img[vis & (S.y < Y(11.5))] = (255, 150, 150)
    refl = vis & (np.abs((S.x - X(-5)) - (S.y - Y(12)) * 0.6) < 1.2 * s) & (S.y < Y(22))
    S.img[refl] = (255, 200, 200)
    S.char |= hood | ring(hood)
    # контровой ободок: красный слева-сверху, голубой справа
    edge = S.char & ~np.roll(S.char, 2, 1)
    S.img[edge & (S.y < Y(60))] = S.img[edge & (S.y < Y(60))] * 0.3 + np.array([255, 70, 100]) * 0.7
    edge_r = S.char & ~np.roll(S.char, -2, 1)
    S.img[edge_r & (S.y < Y(60))] = S.img[edge_r & (S.y < Y(60))] * 0.4 + np.array(CYAN) * 0.6
    S.glow(X(1.5), Y(19), 16 * s, (255, 30, 60), 0.35)       # визор светится
    S.glow(X(-26), Y(24), 10 * s, (255, 40, 70), 0.6)          # и кулак

def sparks(S, n):
    for _ in range(n):
        # искры гуще у источника света, как пепел над взрывом
        x = np.clip(rng.normal(S.w / 2, S.w * 0.3), 0, S.w - 2)
        y = np.clip(rng.normal(S.h * 0.45, S.h * 0.25), 0, S.h * 0.9)
        c = [(255, 200, 120), (255, 120, 80), (255, 70, 90), CYAN][rng.integers(4)]
        xi, yi = int(x), int(y)
        S.img[yi, xi] = c
        if rng.random() < 0.4 and xi + 1 < S.w: S.img[yi, xi + 1] = np.array(c) * 0.6

FONT = {  # 5x7
    'N': ["1...1", "11..1", "1.1.1", "1..11", "1...1", "1...1", "1...1"],
    'E': ["11111", "1....", "1....", "1111.", "1....", "1....", "11111"],
    'O': [".111.", "1...1", "1...1", "1...1", "1...1", "1...1", ".111."],
    'T': ["11111", "..1..", "..1..", "..1..", "..1..", "..1..", "..1.."],
    'I': ["111", ".1.", ".1.", ".1.", ".1.", ".1.", "111"],
    'D': ["1111.", "1...1", "1...1", "1...1", "1...1", "1...1", "1111."],
    'S': [".1111", "1....", "1....", ".111.", "....1", "....1", "1111."],
    'Z': ["11111", "....1", "...1.", "..1..", ".1...", "1....", "11111"],
    'R': ["1111.", "1...1", "1...1", "1111.", "1.1..", "1..1.", "1...1"],
    ':': [".", "1", ".", ".", ".", "1", "."],
    ' ': ["..", "..", "..", "..", "..", "..", ".."],
}

def text(S, s, x0, y0, sc, color, shadow):
    x = x0
    for ch in s:
        g = FONT[ch]
        for j, row in enumerate(g):
            for i, v in enumerate(row):
                if v == '1':
                    for a in range(sc):
                        for b in range(sc):
                            yy, xx = y0 + j * sc + a, x + i * sc + b
                            if 0 <= yy + sc < S.h and 0 <= xx + sc < S.w:
                                S.img[yy + sc // 2 + 1, xx + sc // 2 + 1] = shadow
        for j, row in enumerate(g):
            for i, v in enumerate(row):
                if v == '1':
                    S.img[y0 + j * sc:y0 + (j + 1) * sc, x + i * sc:x + (i + 1) * sc] = color
        x += (len(g[0]) + 1) * sc

def text_w(s, sc): return sum((len(FONT[c][0]) + 1) * sc for c in s) - sc

def render(w, h, title):
    S = Scene(w, h)
    cx, hz = w / 2, h * 0.62
    background(S, cx, hz)
    s = w / 126
    for (sx, sy, ss) in ((w * 0.12, hz + 6 * s, 0.9 * s), (w * 0.86, hz + 9 * s, 1.1 * s), (w * 0.26, hz + 16 * s, 1.3 * s)):
        slime(S, sx, sy, ss)
    hero(S, cx - 2 * s, h * 0.27 if title else h * 0.12)
    sparks(S, int(w * h / 260))
    if title:
        t1, t2 = 'NEON TIDES:', 'ZERO'
        sc1, sc2 = max(1, round(w / 126)), max(2, round(w / 60))
        text(S, t1, int((w - text_w(t1, sc1)) / 2), int(h * 0.04), sc1, (230, 240, 255), (60, 10, 40))
        text(S, t2, int((w - text_w(t2, sc2)) / 2), int(h * 0.04) + 9 * sc1, sc2, (255, 50, 80), (40, 0, 20))
    return np.clip(S.img, 0, 255).astype(np.uint8)

def save(arr, scale, path):
    Image.fromarray(arr).resize((arr.shape[1] * scale, arr.shape[0] * scale), Image.NEAREST).save(path)

if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else '.'
    os.makedirs(out, exist_ok=True)
    save(render(126, 100, True), 5, os.path.join(out, 'cover_630x500.png'))
    save(render(128, 128, False), 4, os.path.join(out, 'icon_512.png'))
    save(render(64, 64, False), 1, os.path.join(out, 'favicon_64.png'))
