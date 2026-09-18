"""Пиксельное рисование для спрайт-листов.

Всё кладётся в буфер индексов палитры, а не в цвет: так работает Aseprite
и так получается вид, который от него ждут. Прозрачность двоичная —
пиксель либо есть, либо нет. Полутона делает не альфа, а дизеринг:
шахматка из двух цветов ряби вместо мягкого перехода.
"""
import numpy as np
from PIL import Image

EMPTY = 0   # индекс 0 всегда прозрачный

# Порядковая матрица Байера 4x4. Значение — порог: чем выше плотность,
# тем больше порогов она перекрывает, и тем гуще ложится цвет.
BAYER = np.array([
    [ 0,  8,  2, 10],
    [12,  4, 14,  6],
    [ 3, 11,  1,  9],
    [15,  7, 13,  5],
], dtype=np.float32) / 16.0


class Px:
    def __init__(self, size):
        self.s = size
        self.buf = np.zeros((size, size), dtype=np.int16)

    # --- примитивы -------------------------------------------------------
    def _in(self, x, y):
        return 0 <= x < self.s and 0 <= y < self.s

    def dot(self, x, y, idx):
        x, y = int(round(x)), int(round(y))
        if self._in(x, y):
            self.buf[y, x] = idx

    def block(self, x, y, w, h, idx):
        x, y = int(round(x)), int(round(y))
        x0, y0 = max(0, x), max(0, y)
        x1, y1 = min(self.s, x + w), min(self.s, y + h)
        if x1 > x0 and y1 > y0:
            self.buf[y0:y1, x0:x1] = idx

    def disc(self, cx, cy, r, idx):
        """Заполненный круг с честным пиксельным краем."""
        yy, xx = np.mgrid[0:self.s, 0:self.s]
        m = (xx + 0.5 - cx) ** 2 + (yy + 0.5 - cy) ** 2 <= r * r
        self.buf[m] = idx

    def ring(self, cx, cy, r, idx, w=1):
        yy, xx = np.mgrid[0:self.s, 0:self.s]
        d = np.sqrt((xx + 0.5 - cx) ** 2 + (yy + 0.5 - cy) ** 2)
        m = (d <= r) & (d > r - w)
        self.buf[m] = idx

    def band_dither(self, cx, cy, r0, r1, idx, density=0.5, invert=False):
        """Кольцо, пробитое шахматкой. Плотность может ехать по радиусу —
        тогда край рассыпается, как в рисованных эффектах."""
        yy, xx = np.mgrid[0:self.s, 0:self.s]
        d = np.sqrt((xx + 0.5 - cx) ** 2 + (yy + 0.5 - cy) ** 2)
        inside = (d >= r0) & (d < r1)
        if not inside.any():
            return
        t = np.clip((d - r0) / max(r1 - r0, 1e-6), 0, 1)
        dens = density * (t if invert else (1.0 - t))
        thr = np.tile(BAYER, (self.s // 4 + 1, self.s // 4 + 1))[:self.s, :self.s]
        self.buf[inside & (dens > thr)] = idx

    def line(self, x0, y0, x1, y1, idx, w=1):
        """Брезенхэм. Толщина — квадратным пером, без сглаживания."""
        x0, y0, x1, y1 = int(round(x0)), int(round(y0)), int(round(x1)), int(round(y1))
        dx, dy = abs(x1 - x0), -abs(y1 - y0)
        sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
        err = dx + dy
        off = w // 2
        while True:
            if w <= 1: self.dot(x0, y0, idx)
            else: self.block(x0 - off, y0 - off, w, w, idx)
            if x0 == x1 and y0 == y1: break
            e2 = 2 * err
            if e2 >= dy: err += dy; x0 += sx
            if e2 <= dx: err += dx; y0 += sy

    def outline(self, idx, target, only_over_empty=True):
        """Обводка по контуру всего, что уже нарисовано. В пиксель-арте
        именно она удерживает силуэт на пёстром фоне."""
        filled = self.buf > EMPTY
        grown = np.zeros_like(filled)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dx == 0 and dy == 0: continue
                grown |= np.roll(np.roll(filled, dy, 0), dx, 1)
        edge = grown & (~filled if only_over_empty else np.ones_like(filled))
        self.buf[edge] = target if target is not None else idx

    def to_rgba(self, palette):
        """palette — список RGB по индексам, нулевой считается прозрачным."""
        out = np.zeros((self.s, self.s, 4), dtype=np.uint8)
        for i, col in enumerate(palette):
            if i == EMPTY: continue
            m = self.buf == i
            out[m, 0], out[m, 1], out[m, 2] = col
            out[m, 3] = 255
        return out


def sheet(frames):
    s = frames[0].shape[0]
    img = Image.new('RGBA', (s * len(frames), s), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        img.paste(Image.fromarray(f, 'RGBA'), (i * s, 0))
    return img
