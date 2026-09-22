# Генератор листа игрока xplayer.png: 16 кадров 32x32 в ряд.
# Порядок как у directionOffset: 0 юг, 4 запад, 8 восток, 12 север.
# Фазы шага: 0 стойка, 1 левая нога и правая рука вперёд, 2 проход, 3 наоборот.
# Капюшоны взяты из исходного листа пиксель в пиксель, тело рисуется заново.
from PIL import Image
import sys

W = 32
PAL = {
    'A': (0, 0, 0), 'B': (57, 38, 38), 'L': (31, 21, 21), 'I': (53, 17, 17), 'K': (255, 0, 0),
    'C': (128, 0, 0), 'D': (75, 0, 0), 'E': (158, 0, 0), 'F': (202, 50, 50), 'G': (110, 0, 0),
    'H': (57, 57, 57), 'J': (149, 0, 0), 'M': (78, 54, 54), 'N': (40, 27, 27), 'R': (170, 0, 0),
}

HEAD_S = [
    "................................",
    "................................",
    "...............AA...............",
    "...............AA...............",
    ".............AABBAA.............",
    "...........AABBBBBBAA...........",
    "..........ABBBBBBBBBBA..........",
    ".........ABAAAAAAAAAABA.........",
    "........ABACCCCCCCCCCABA........",
    ".......ABACCDDDDDDDDCCABA.......",
    "......ABBACDEFFFFFEFDCABBA......",
    ".....ABBACDFFEEFFFEFEDCABBA.....",
    ".....ABBACDFEEFFFEFEFDCABBA.....",
    ".....ABBACDEFFEFFFEFEDCABBA.....",
    "......ABACCDEEFFFFFFDCCABA......",
    ".......ABACDEFEFFEEFDCABA.......",
    "........ABCDDEFFFEFDDCBA........",
    ".........ABCDEFFFFEDCBA.........",
    "..........ABCDDDDDDCBA..........",
    "..........AABBBBBBBBBA..........",
    "...........AAAAAAAAAAA..........",
]
HEAD_W = [
    "................................",
    "................................",
    "...............AA...............",
    "...............AA...............",
    ".............AABBAA.............",
    "...........AAABBBBBAA...........",
    "..........ABBABBBBBBBA..........",
    ".........ADDBBABBBBBBBA.........",
    "........AEEDDBAABBBBBBBA........",
    ".......AFEEEDBBAABBBBBBBA.......",
    ".......AEEFEDDBBAABBBBBBBA......",
    ".......AEFEFEDBBBABBBBBBBBA.....",
    ".......AFEFEEDDBBABBBBBBBBA.....",
    ".......AFEFFEEDBBABBBBBBBBA.....",
    ".......AEFEEFEDBBABBBBBBBA......",
    ".......AFEFFEDDBABBBBBBBA.......",
    "........AFEFEDBAABBBBBBA........",
    ".........AEEDDAABBBBBBA.........",
    "..........ADDAABBBBBBA..........",
    "..........AABABBBBBBBA..........",
    "...........AAAAAAAAAAA..........",
]
HEAD_E = [
    "................................",
    "................................",
    "...............AA...............",
    "...............AA...............",
    ".............AABBAA.............",
    "...........AABBBBBAAA...........",
    "..........ABBBBBBBABBA..........",
    ".........ABBBBBBBABBDDA.........",
    "........ABBBBBBBAABDDEEA........",
    ".......ABBBBBBBAABBDEEEFA.......",
    "......ABBBBBBBAABBDDEFEEA.......",
    ".....ABBBBBBBBABBBDEFEFEA.......",
    ".....ABBBBBBBBABBDDEEFEFA.......",
    ".....ABBBBBBBBABBDEEFFEFA.......",
    "......ABBBBBBBABBDEFEEFEA.......",
    ".......ABBBBBBBABDDEFFEFA.......",
    "........ABBBBBBAABDEFEFA........",
    ".........ABBBBBBAADDEEA.........",
    "..........ABBBBBBAADDA..........",
    "..........ABBBBBBBABAA..........",
    "..........AAAAAAAAAAA...........",
]
HEAD_N = [
    "................................",
    "................................",
    "...............AA...............",
    "...............AA...............",
    ".............AABBAA.............",
    "...........AABBBBBBAA...........",
    "..........ABBBAAAABBBA..........",
    ".........ABBBABBBBABBBA.........",
    "........ABBBABBBBBBABBBA........",
    ".......ABBBABBBBBBBBABBBA.......",
    "......ABBBABBBBBBBBBBABBBA......",
    ".....ABBBABBBBBBBBBBBBABBBA.....",
    ".....ABBBABBBBBBBBBBBBABBBA.....",
    ".....ABBBABBBBBBBBBBBBABBBA.....",
    "......ABBBABBBBBBBBBBABBBA......",
    ".......ABBBABBBBBBBBABBBA.......",
    "........ABBBABBBBBBABBBA........",
    ".........ABBAABBBBAABBA.........",
    "..........ABBABBBBABBA..........",
    "..........AABBAAAABBAA..........",
    "...........ABBBBBBBBA...........",
]


def outline(fill):
    out = dict(fill)
    for (x, y) in fill:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (x + dx, y + dy)
            if n not in fill and 0 <= n[0] < W and 0 <= n[1] < W:
                out.setdefault(n, 'A')
    return out

def arm_rows(ln, far=False):
    """Цвета руки сверху вниз: рукав, затем светящиеся витки, кисть — яркая."""
    hi, lo = ('R', 'I') if far else ('K', 'I')
    rows = ['N' if far else 'B']
    for k in range(ln - 1, 0, -1):
        rows.append(hi if (k - 1) % 2 == 0 else lo)
    return rows

def leg_px(g, x, y0, ln, dx=0, toe=1, far=False):
    """Нога шириной 2 от бедра y0 на ln строк; нижняя строка — ботинок с носком."""
    c = 'N' if far else 'L'
    for i in range(ln):
        t = i / max(1, ln - 1)
        cx = x + round(dx * t)
        g[(cx, y0 + i)] = c; g[(cx + 1, y0 + i)] = c
        if i == ln - 1 and toe: g[(cx + (2 if toe > 0 else -1), y0 + i)] = c

def front_back(phase, front):
    s = {0: 0, 1: 1, 2: 0, 3: -1}[phase]        # +1: левая нога и правая рука вперёд
    bob = 1 if s else 0
    y0 = 21 + bob                                # плечи
    g = {}
    for x in range(11, 21): g[(x, y0)] = 'B'
    shirt = ["GGHH", "GJJH", "GGJH", "HHGH", "HHHH"] if front else ["BBBB", "BMBB", "BBMB", "BBBB", "BBBB"]
    for i, row in enumerate(shirt):
        for j, c in enumerate(row): g[(14 + j, y0 + 1 + i)] = c
    toward = lambda f: f != 0 and ((f > 0) == front)
    away = lambda f: f != 0 and not toward(f)
    # правая рука/нога персонажа у S слева на экране, у N справа
    for side, f in (('R', s), ('L', -s)):
        ax = 11 if (side == 'R') == front else 19
        ln = 6 if toward(f) else (4 if away(f) else 5)
        for i, c in enumerate(arm_rows(ln)):
            g[(ax, y0 + i)] = c; g[(ax + 1, y0 + i)] = c
    hip = y0 + 6
    for side, f in (('R', -s), ('L', s)):
        lx = 13 if (side == 'R') == front else 17
        ln = 3 if not away(f) else 2
        leg_px(g, lx, hip, ln, toe=0)
        by = hip + ln - 1                        # ботинок шире наружу
        g[(lx - 1 if lx < 16 else lx + 2, by)] = 'L'
    return outline(g)

def side_east(phase):
    s = {0: 0, 1: 1, 2: 0, 3: -1}[phase]
    bob = 1 if s else 0
    y0 = 21 + bob
    far, body, near = {}, {}, {}
    # Дальняя рука целиком за телом: торчащие из-за спины пиксели читались как мусор.
    hip = y0 + 6
    if s == 0:
        leg_px(far, 15, hip, 3, 0, far=True)
        if phase == 0: leg_px(body, 14, hip, 3, 0)
        else: leg_px(body, 13, hip, 2, -1)           # проход: ближняя нога поднята
    else:
        leg_px(far, 15, hip, 3 if s < 0 else 2, 2 * s, far=True)   # левая вперёд при s=+1
        leg_px(body, 14, hip, 3 if s > 0 else 2, -2 * s)
    for x in range(13, 19): body[(x, y0)] = 'B'
    for i, row in enumerate(["BBBGB", "BBBJB", "BBMGB", "BBBHB", "BBBBB"]):
        for j, c in enumerate(row): body[(13 + j, y0 + 1 + i)] = c
    # Ближняя рука — правая, вперёд при s=+1. В замахе кисть поднимается на строку:
    # рука идёт по дуге, а не удлиняется.
    ln = 6 if s == 0 else 5
    rows = arm_rows(ln)
    rows.insert(1, 'B')                          # рукав в две строки
    rows = rows[:ln - 1] + ['K']                # кисть — яркая перчатка
    for i, c in enumerate(rows):
        cx = 14 + round(4 * s * i / (ln - 1))
        near[(cx, y0 + i)] = c; near[(cx + 1, y0 + i)] = c
    img = {}
    for layer in (far, body):
        img.update(outline(layer))
    for (x, y), c in outline(near).items():
        if y > y0 or (x, y) in near: img[(x, y)] = c   # без обводки над плечом
    return img

def frame(d, phase):
    bob = 1 if phase in (1, 3) else 0
    if d == 'S': px = front_back(phase, True); head = HEAD_S
    elif d == 'N': px = front_back(phase, False); head = HEAD_N
    elif d == 'E': px = side_east(phase); head = HEAD_E
    else:
        px = {(W - 1 - x, y): c for (x, y), c in side_east(phase).items()}; head = HEAD_W
    for y, row in enumerate(head):
        for x, c in enumerate(row):
            if c != '.' and 0 <= y + bob < W: px[(x, y + bob)] = c
    return px

def build(path):
    sheet = Image.new('RGBA', (W * 16, W), (0, 0, 0, 0))
    for di, d in enumerate(['S', 'W', 'E', 'N']):
        for ph in range(4):
            for (x, y), c in frame(d, ph).items():
                if 0 <= x < W and 0 <= y < W:
                    sheet.putpixel(((di * 4 + ph) * W + x, y), PAL[c] + (255,))
    sheet.save(path)
    return sheet

if __name__ == '__main__':
    sh = build(sys.argv[1] if len(sys.argv) > 1 else 'xplayer.png')
    if len(sys.argv) > 2:
        big = sh.resize((sh.width * 8, sh.height * 8), Image.NEAREST)
        bg = Image.new('RGBA', big.size, (40, 44, 60, 255)); bg.alpha_composite(big); bg.save(sys.argv[2])
