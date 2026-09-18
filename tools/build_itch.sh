#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."
OUT=build-itch
rm -rf "$OUT" "$OUT.zip"
mkdir -p "$OUT"
cp index.html style.css "$OUT"/
cp -r js sfx vfx "$OUT"/
for f in *.mp3 *.png *.jpg *.wav; do [ -e "$f" ] && cp "$f" "$OUT"/; done 2>/dev/null || true
cd "$OUT" && zip -qr "../$OUT.zip" . && cd ..
echo "готово: $OUT.zip"
unzip -l "$OUT.zip" | tail -1
MISSING=""
for f in menu_bg.mp3 fight.mp3 boss1.mp3 bossspawn.mp3 finale.mp3; do
  [ -e "$OUT/$f" ] || MISSING="$MISSING $f"
done
[ -n "$MISSING" ] && echo "НЕ ХВАТАЕТ (положи рядом и пересобери):$MISSING"
exit 0
