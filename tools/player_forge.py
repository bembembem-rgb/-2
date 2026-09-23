# Генератор листа игрока xplayer.png: 16 кадров 48x48 в ряд (игра сама
# берёт размер кадра как ширину/16). 48 px при отрисовке в 80 px дают
# почти ту же плотность пикселя, что у слаймов, — спрайты одного масштаба.
# Порядок как у directionOffset: 0 юг, 4 запад, 8 восток, 12 север.
# Фазы шага: 0 стойка, 1 левая нога и правая рука вперёд, 2 проход, 3 наоборот.
# Формы — по референсу (капюшон, щиток-визор, плащ с рваным подолом,
# светящиеся повязки), светотень как в Sonic Mania: свет сверху-слева,
# светлый ободок по краю, тень снизу-справа, тёмный контур.
from PIL import Image
import numpy as np, sys

W = 48
OUT = (10, 8, 16)
RAMP = {
    'cloak': [(24, 20, 34), (40, 34, 56), (60, 52, 82), (92, 82, 120)],
    'cloakfar': [(16, 13, 24), (26, 22, 36), (36, 31, 50), (48, 42, 66)],
    'pants': [(18, 16, 26), (30, 26, 40), (42, 37, 56), (56, 50, 74)],
    'boot': [(16, 13, 22), (26, 22, 34), (40, 35, 52), (62, 56, 80)],
    'visor': [(110, 0, 24), (200, 16, 40), (240, 44, 60), (255, 120, 120)],
    'glove': [(120, 0, 22), (210, 20, 42), (250, 60, 70), (255, 150, 150)],
    'glovefar': [(70, 0, 14), (130, 6, 26), (160, 14, 32), (190, 40, 52)],
}
BAND_HI, BAND_LO = (240, 34, 52), (96, 6, 22)
BAND_HI_FAR, BAND_LO_FAR = (150, 12, 30), (60, 4, 14)
STRAP, STRAP_HI = (104, 8, 28), (168, 22, 44)
HOLE = (6, 4, 10)
VISOR_SPEC = (255, 225, 225)

yy, xx = np.mgrid[0:W, 0:W]

def ellipse(cx, cy, rx, ry):
    return ((xx + 0.5 - cx) / rx) ** 2 + ((yy + 0.5 - cy) / ry) ** 2 <= 1

def poly(pts):
    m = np.zeros((W, W), bool)
    px, py = xx + 0.5, yy + 0.5
    n = len(pts)
    for i in range(n):
        x1, y1 = pts[i]; x2, y2 = pts[(i + 1) % n]
        cond = ((y1 > py) != (y2 > py)) & (px < (x2 - x1) * (py - y1) / (y2 - y1 + 1e-9) + x1)
        m ^= cond
    return m

def capsule(p0, p1, r0, r1):
    (x0, y0), (x1, y1) = p0, p1
    dx, dy = x1 - x0, y1 - y0
    L2 = dx * dx + dy * dy + 1e-9
    t = np.clip(((xx + 0.5 - x0) * dx + (yy + 0.5 - y0) * dy) / L2, 0, 1)
    d = np.hypot(xx + 0.5 - (x0 + t * dx), yy + 0.5 - (y0 + t * dy))
    return d <= r0 + (r1 - r0) * t, t

def run_len(m, dy, dx):
    """Сколько шагов в направлении (dy,dx) до выхода из маски."""
    out = np.zeros((W, W), int)
    cur = m.copy(); k = 0
    while cur.any() and k < 8:
        k += 1
        sh = np.zeros_like(m)
        ys = slice(max(0, dy), W + min(0, dy)); yd = slice(max(0, -dy), W + min(0, -dy))
        xs = slice(max(0, dx), W + min(0, dx)); xd = slice(max(0, -dx), W + min(0, -dx))
        sh[yd, xd] = cur[ys, xs]
        cur = cur & sh
        out[cur] = k
    return out

def shade(m, ramp):
    """Светотень по маске: ободок сверху-слева, тень снизу-справа."""
    img = np.zeros((W, W, 3), np.uint8)
    up, lf = run_len(m, -1, 0), run_len(m, 0, -1)
    dn, rt = run_len(m, 1, 0), run_len(m, 0, 1)
    img[m] = ramp[1]
    img[m & ((dn <= 1) | (rt <= 0))] = ramp[0]
    img[m & (np.minimum(up, lf) <= 2) & (dn > 1)] = ramp[2]
    img[m & ((up == 0) | ((lf == 0) & (up <= 3))) & (dn > 0)] = ramp[3]
    return img

def ring(m):
    d = m.copy()
    d[1:] |= m[:-1]; d[:-1] |= m[1:]; d[:, 1:] |= m[:, :-1]; d[:, :-1] |= m[:, 1:]
    return d & ~m

class Canvas:
    def __init__(self):
        self.rgb = np.zeros((W, W, 3), np.uint8); self.a = np.zeros((W, W), bool)
    def layer(self, m, img, outline=True, keep=None):
        """Слой поверх: контур отделяет его от того, что сзади. keep — где контур не нужен."""
        if outline:
            r = ring(m)
            if keep is not None: r &= ~keep
            r &= self.a                      # внешний контур дорисуется в конце
            self.rgb[r] = OUT
        self.rgb[m] = img[m]; self.a |= m
    def paint(self, m, color):
        m = m & self.a; self.rgb[m] = color
    def finish(self):
        r = ring(self.a); self.rgb[r] = OUT; self.a |= r
        return self.rgb, self.a

def banded_arm(cv, shoulder, hand, far=False, keep=None):
    """Рука: тёмный рукав, на предплечье светящиеся витки поперёк руки, красная перчатка."""
    m, t = capsule(shoulder, hand, 2.6, 2.1)
    ramp = RAMP['cloakfar' if far else 'cloak']
    img = shade(m, ramp)
    fore = m & (t > 0.42)
    hi, lo = (BAND_HI_FAR, BAND_LO_FAR) if far else (BAND_HI, BAND_LO)
    L = np.hypot(hand[0] - shoulder[0], hand[1] - shoulder[1])
    band = (np.floor(t * L / 1.5) % 2 == 0)
    img[fore & band] = hi; img[fore & ~band] = lo
    cv.layer(m, img, keep=keep)
    g = ellipse(hand[0], hand[1] + 0.8, 2.4, 2.2)
    cv.layer(g, shade(g, RAMP['glovefar' if far else 'glove']), keep=m)

def leg(cv, hip, foot, facing=0, far=False):
    m, _ = capsule(hip, (foot[0], foot[1] - 2), 2.2, 2.0)
    cv.layer(m, shade(m, RAMP['cloakfar' if far else 'pants']))
    bx = foot[0] + facing * 1.2
    b = ellipse(bx, foot[1] - 0.8, 3.2 if facing else 2.8, 1.9)
    cv.layer(b, shade(b, RAMP['cloakfar' if far else 'boot']), keep=m)

def hem_cut(m, y_hem, x0, x1, shift):
    """Рваный подол: зубцы разной длины, сдвиг даёт покачивание при шаге."""
    for x in range(x0, x1 + 1):
        k = (x + shift) % 5
        depth = (0, 2, 1, 3, 1)[k]
        m[y_hem - depth + 1:, x] = False
    return m

# --- ракурсы ---

def draw_front(phase, back=False):
    s = {0: 0, 1: 1, 2: 0, 3: -1}[phase]; bob = 1 if s else 0
    front = not back
    cv = Canvas()
    toward = lambda f: f != 0 and ((f > 0) == front)
    away = lambda f: f != 0 and not toward(f)
    # ноги: у S правая нога персонажа слева на экране
    legs = []
    for side, f in (('R', -s), ('L', s)):
        x = 20.5 if (side == 'R') == front else 27.5
        fy = 46 + (1 if toward(f) else (-1 if away(f) else 0))
        legs.append((away(f), x, fy))
    for is_away, x, fy in sorted(legs, key=lambda l: not l[0]):
        leg(cv, (x, 37 + bob), (x, min(fy, 47)))
    # руки, что уходят назад, — за плащом
    arms = []
    for side, f in (('R', s), ('L', -s)):
        left = (side == 'R') == front
        sx = 15.5 if left else 32.5
        inward = 1 if left else -1
        hy = 36 + bob + (2 if toward(f) else (-3 if away(f) else 0))
        hx = sx - inward * 1.0 + (inward * 1.5 if toward(f) else 0)
        arms.append((away(f), (sx, 25 + bob), (hx, hy)))
    for is_away, sh, hd in arms:
        if is_away: banded_arm(cv, sh, hd)
    # плащ
    top, hem = 21 + bob, 41 + bob
    body = poly([(16, top), (32, top), (34.5, hem), (13.5, hem)])
    body = hem_cut(body, hem, 13, 35, phase)
    img = shade(body, RAMP['cloak'])
    for fx in (21, 27):                               # складки
        img[body & (xx == fx) & (yy > top + 6) & (yy < hem - 1)] = RAMP['cloak'][0]
    cv.layer(body, img)
    if front:
        # запах плаща и ремень через грудь
        cv.paint((xx == 24) & (yy >= top + 3) & (yy <= hem - 3), RAMP['cloak'][0])
        strap, _ = capsule((18, top + 2), (30, hem - 5), 0.9, 0.9)
        cv.paint(strap & body, STRAP); cv.paint(strap & body & (yy % 3 == 0), STRAP_HI)
    else:
        strap, _ = capsule((30, top + 2), (18, hem - 5), 0.9, 0.9)
        cv.paint(strap & body, STRAP)
    for is_away, sh, hd in arms:
        if not is_away: banded_arm(cv, sh, hd, keep=(yy <= sh[1] + 1))
    # капюшон
    hood = ellipse(24, 12 + bob, 11.5, 10.5) | poly([(22, 1 + bob), (26, 1 + bob), (30, 6 + bob), (18, 6 + bob)])
    hood |= ellipse(24, 19 + bob, 12.5, 4.5)
    cv.layer(hood, shade(hood, RAMP['cloak']))
    if front:
        hole = ellipse(24, 14.5 + bob, 8.6, 8.2) & (yy >= 7 + bob)
        cv.paint(hole, HOLE)
        # щиток: плоский верх, прямые бока, скруглённый низ
        visor = (poly([(17, 9.5 + bob), (31, 9.5 + bob), (31, 15 + bob), (17, 15 + bob)])
                 | (ellipse(24, 14.5 + bob, 7, 6.6) & (yy >= 14 + bob)))
        rim = ring(hole) & hood & (yy <= 12 + bob)        # светлая кромка капюшона над лицом
        cv.paint(rim, RAMP['cloak'][3])
        vimg = shade(visor, RAMP['visor'])
        vimg[visor & (yy == 10 + bob)] = RAMP['visor'][3]
        cv.rgb[visor] = vimg[visor]
        cv.paint((xx == 19) & (yy == 11 + bob), VISOR_SPEC)
        cv.paint((xx == 20) & (yy == 11 + bob), RAMP['visor'][3])
    else:
        cv.paint((xx == 24) & (yy >= 6 + bob) & (yy <= 19 + bob) & hood, RAMP['cloak'][0])
    return cv.finish()

def draw_east(phase):
    s = {0: 0, 1: 1, 2: 0, 3: -1}[phase]; bob = 1 if s else 0
    cv = Canvas()
    # дальние рука и нога — левые; ближние — правые. s=+1: левая нога и правая рука вперёд.
    far_arm_hand = (23 - 5 * s, 35 + bob - abs(s))
    banded_arm(cv, (23, 25 + bob), far_arm_hand, far=True)
    if s == 0 and phase == 2:
        leg(cv, (24, 37 + bob), (24, 46), facing=1, far=True)
        leg(cv, (22, 37 + bob), (20, 44), facing=1)                 # проход: ближняя нога поднята
    elif s == 0:
        leg(cv, (24, 37), (25, 46), facing=1, far=True)
        leg(cv, (22, 37), (22, 46), facing=1)
    else:
        leg(cv, (24, 37 + bob), (24 + 5 * s, 46), facing=1, far=True)
        leg(cv, (22, 37 + bob), (22 - 5 * s, 46), facing=1)
    top, hem = 21 + bob, 41 + bob
    body = poly([(18, top), (29, top), (31.5, hem), (15.5, hem)])
    body = hem_cut(body, hem, 15, 32, phase)
    img = shade(body, RAMP['cloak'])
    img[body & (xx == 20) & (yy > top + 6) & (yy < hem - 1)] = RAMP['cloak'][0]
    cv.layer(body, img)
    strap, _ = capsule((27, top + 1), (22, hem - 6), 0.9, 0.9)
    cv.paint(strap & body, STRAP)
    near_hand = (24 + 6 * s, 35 + bob - abs(s))
    banded_arm(cv, (24, 25 + bob), near_hand, keep=(yy <= 26 + bob))
    hood = ellipse(23, 12 + bob, 11.5, 10.5) | poly([(18, 1 + bob), (22, 1 + bob), (26, 5 + bob), (14, 6 + bob)])
    hood |= ellipse(22.5, 19 + bob, 10.5, 4.2)
    cv.layer(hood, shade(hood, RAMP['cloak']))
    hole = ellipse(30, 14 + bob, 5.5, 8) & hood & (yy >= 7 + bob)
    cv.paint(hole, HOLE)
    visor = ellipse(30.5, 14.5 + bob, 4.2, 6.2) & (yy >= 9 + bob) & (xx >= 27)
    cv.paint(ring(hole) & hood & (yy <= 11 + bob), RAMP['cloak'][3])
    vimg = shade(visor, RAMP['visor'])
    vimg[visor & (yy == 9 + bob)] = RAMP['visor'][3]
    cv.rgb[visor] = vimg[visor]; cv.a |= visor
    cv.paint((xx == 29) & (yy == 10 + bob), VISOR_SPEC)
    return cv.finish()

def frame(d, phase):
    if d == 'S': return draw_front(phase)
    if d == 'N': return draw_front(phase, back=True)
    rgb, a = draw_east(phase)
    if d == 'W': rgb, a = rgb[:, ::-1], a[:, ::-1]
    return rgb, a

def build(path):
    sheet = np.zeros((W, W * 16, 4), np.uint8)
    for di, d in enumerate(['S', 'W', 'E', 'N']):
        for ph in range(4):
            rgb, a = frame(d, ph)
            x0 = (di * 4 + ph) * W
            sheet[:, x0:x0 + W, :3] = rgb; sheet[:, x0:x0 + W, 3] = a * 255
    img = Image.fromarray(sheet, 'RGBA'); img.save(path)
    return img

if __name__ == '__main__':
    sh = build(sys.argv[1] if len(sys.argv) > 1 else 'xplayer.png')
    if len(sys.argv) > 2:
        big = sh.resize((sh.width * 6, sh.height * 6), Image.NEAREST)
        bg = Image.new('RGBA', big.size, (150, 160, 180, 255)); bg.alpha_composite(big); bg.save(sys.argv[2])
