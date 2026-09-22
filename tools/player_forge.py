# Генератор листа игрока xplayer.png: 16 кадров 32x32 в ряд.
# Порядок как у directionOffset: 0 юг, 4 запад, 8 восток, 12 север.
# Фазы шага: 0 стойка, 1 левая нога вперёд + правая рука вперёд, 2 проход, 3 наоборот.
from PIL import Image
import sys

W = 32
OUT = (10, 4, 8, 255)
PAL = {
    'k': (14, 8, 12), '0': (26, 17, 22), '1': (40, 27, 34), '2': (58, 40, 50), '3': (84, 62, 80),
    'h': (6, 2, 5),
    'a': (96, 0, 12), 'b': (156, 0, 22), 'c': (214, 22, 42), 'd': (255, 84, 96), 'e': (255, 190, 190),
    'g': (70, 6, 12), 'G': (180, 12, 26), 'R': (245, 44, 58), 'W': (255, 140, 140),
    's': (104, 10, 18), 'S': (190, 36, 48),
    'p': (22, 15, 19), 'q': (34, 24, 30), 'B': (16, 10, 13), 'b2': (40, 28, 34),
}

class Layer:
    def __init__(self): self.px = {}
    def set(self, x, y, c):
        if 0 <= x < W and 0 <= y < W and c in PAL: self.px[(x, y)] = PAL[c]
    def tpl(self, x0, y0, rows, flip=False):
        w = max(len(r) for r in rows)
        for j, r in enumerate(rows):
            for i, ch in enumerate(r):
                if ch != '.': self.set(x0 + (w - 1 - i if flip else i), y0 + j, ch)

def outlined(layer):
    res = dict(layer.px)
    for (x, y) in layer.px:
        for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
            n = (x+dx, y+dy)
            if n not in layer.px and 0 <= n[0] < W and 0 <= n[1] < W: res.setdefault(n, OUT)
    return res

# --- Капюшон (16 шир.) ---
HEAD_S = [
    ".......32.......",
    ".....332221.....",
    "...3322222211...",
    "..322222222211..",
    ".32222222222211.",
    ".3223hhhhhh3211.",
    "322hddddddddh211",
    "322heccccccch211",
    "322hcccccccbh211",
    "322hcccccccbh211",
    "322hbccccccbh211",
    ".322hbccccbh211.",
    ".3222hbbbbh2211.",
    "..32222hh22221..",
]
HEAD_N = [
    ".......32.......",
    ".....332221.....",
    "...3322222211...",
    "..322222222211..",
    ".32222222222211.",
    ".32222222222211.",
    "3222222122222111",
    "3222222122222111",
    "3222222122222111",
    "3222222122222111",
    "3222222122222111",
    ".32222212222211.",
    ".3222222122221..",
    "..32222222221...",
]
HEAD_E = [
    ".....33.........",
    "...332221.......",
    "..32222222211...",
    ".3222222222221..",
    ".32222222222221.",
    "32222222223hhh..",
    "3222222223hdddd.",
    "322222222heccccd",
    "322222222hccccc.",
    "322222222hccccb.",
    "322222222hbcccb.",
    ".32222222hbbba..",
    ".3222222221hh...",
    "..3222222211....",
]
TORSO_S = [
    ".322222222221.",
    "32s22222222221",
    "322s222222221.",
    "3222sS2222221.",
    "32222s2222221.",
    "322222s222221.",
    "3222222s22221.",
    "32222222s2221.",
    "322222222S221.",
    "3222222222221.",
    "32222222222221",
]
TORSO_N = [
    ".322222222221.",
    "3222222222s211",
    "322222222s221.",
    "32222222s2221.",
    "3222222s22221.",
    "322222s222221.",
    "32222s2222221.",
    "3222s22222221.",
    "322222222222.",
    "3222222222221.",
    "32222222222221",
]
TORSO_E = [
    ".3222s21..",
    "32222s221.",
    "322222s21.",
    "322222S21.",
    "322222s21.",
    "3222222s1.",
    "3222222s1.",
    "322222221.",
    "322222221.",
    "3222222221",
    "3222222221",
]
HEM_S = {-1: "2.22.222.22.2.", 0: ".22.222.22.22.", 1: ".2.22.222.22.2"}
HEM_E = {-1: "2.22.22.2.", 0: ".22.2.22..", 1: ".2.22.2.22"}

def swing_arm(L, x0, y0, dx, length, far=False, width=3):
    """Рука от плеча (x0,y0) вниз на length строк, кисть смещена по x на dx."""
    sleeve_rows = 4
    for i in range(length):
        t = i / max(1, length - 1)
        cx = x0 + round(dx * t)
        y = y0 + i
        if i < sleeve_rows:
            for k in range(width):
                L.set(cx + k, y, '1' if far else '321'[k] if width == 3 else '21'[k])
            continue
        band = (i - sleeve_rows) % 2 == 0
        x1 = cx + (1 if width == 3 else 0)   # предплечье уже рукава
        if i == length - 1:                  # кисть
            L.set(x1, y, 'G' if far else 'R'); L.set(x1 + 1, y, 'g' if far else 'G')
        elif far:
            L.set(x1, y, 'G' if band else 'g'); L.set(x1 + 1, y, 'g')
        else:
            L.set(x1, y, 'W' if band else 'R'); L.set(x1 + 1, y, 'R' if band else 'G')

def leg(L, x, y0, length, dx=0, far=False):
    for i in range(length):
        t = i / max(1, length - 1)
        cx = x + round(dx * t)
        y = y0 + i
        if i >= length - 2:
            L.set(cx, y, 'B' if far else 'b2'); L.set(cx + 1, y, 'B')
            if i == length - 1: L.set(cx + (2 if dx >= 0 else -1), y, 'B')
        else:
            L.set(cx, y, 'p' if far else 'q'); L.set(cx + 1, y, 'p')

def frame(direction, phase):
    bob = 1 if phase in (1, 3) else 0
    s = {0: 0, 1: 1, 2: 0, 3: -1}[phase]   # +1: левая нога и правая рука вперёд
    img = {}
    def put(layer): img.update(outlined(layer))

    if direction in ('S', 'N'):
        front = direction == 'S'
        # правая сторона персонажа у S слева на экране, у N справа
        rx, lx = (6, 23) if front else (23, 6)
        rlx, llx = (12, 18) if front else (18, 12)
        def toward(fwd): return fwd != 0 and ((fwd > 0) == front)
        def away(fwd): return fwd != 0 and not toward(fwd)
        legs = Layer()
        for fwd, x in ((-s, rlx), (s, llx)):      # ноги: левая вперёд при s=+1
            leg(legs, x, 25, 6 if toward(fwd) else (4 if away(fwd) else 5))
        put(legs)
        back, fr = Layer(), Layer()
        for fwd, x in ((s, rx), (-s, lx)):        # руки: правая вперёд при s=+1
            inward = 1 if x < 16 else -1
            ln = 11 if toward(fwd) else (7 if away(fwd) else 9)
            dx = inward if toward(fwd) else (-inward if away(fwd) else 0)
            swing_arm(back if away(fwd) else fr, x, 15 + bob, dx, ln)
        put(back)
        torso = Layer()
        torso.tpl(9, 14 + bob, TORSO_S if front else TORSO_N)
        torso.tpl(9, 25 + bob, [HEM_S[s]])
        put(torso)
        put(fr)
        head = Layer()
        head.tpl(8, 2 + bob, HEAD_S if front else HEAD_N)
        put(head)
    else:
        # восток, ближняя сторона — правая. Запад строится зеркалом.
        far_arm, far_leg, near_leg, near_arm = Layer(), Layer(), Layer(), Layer()
        swing_arm(far_arm, 15, 15 + bob, -5 * s, 9 if s == 0 else 8, far=True, width=2)
        if s == 0:
            leg(far_leg, 15, 25, 6, 0, far=True)
            leg(near_leg, 14 if phase == 0 else 13, 25, 6 if phase == 0 else 5, 0)
        else:
            leg(far_leg, 15, 25, 6, 3 * s, far=True)     # левая нога вперёд при s=+1
            leg(near_leg, 14, 25, 6, -3 * s)
        put(far_arm); put(far_leg); put(near_leg)
        torso = Layer()
        torso.tpl(11, 14 + bob, TORSO_E)
        torso.tpl(11, 25 + bob, [HEM_E[s]])
        put(torso)
        swing_arm(near_arm, 13, 15 + bob, 4 * s, 9 if s == 0 else 8)   # правая рука вперёд
        put(near_arm)
        head = Layer()
        head.tpl(8, 2 + bob, HEAD_E)
        put(head)
    return img

def build(path):
    sheet = Image.new('RGBA', (W * 16, W), (0, 0, 0, 0))
    for di, d in enumerate(['S', 'W', 'E', 'N']):
        for ph in range(4):
            if d == 'W':
                px = {(W - 1 - x, y): c for (x, y), c in frame('E', ph).items()}
            else:
                px = frame(d, ph)
            for (x, y), c in px.items():
                col = c if len(c) == 4 else c + (255,)
                sheet.putpixel(((di * 4 + ph) * W + x, y), col)
    sheet.save(path)
    return sheet

if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'xplayer.png'
    sh = build(out)
    if len(sys.argv) > 2:
        big = sh.resize((sh.width * 8, sh.height * 8), Image.NEAREST)
        bg = Image.new('RGBA', big.size, (40, 44, 60, 255)); bg.alpha_composite(big); bg.save(sys.argv[2])
