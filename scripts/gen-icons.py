#!/usr/bin/env python3
# 얼말까 브랜드 아이콘/스플래시 생성기 (placeholder).
# 디자이너 교체 전까지 쓰는 자동 생성본. 실행: python scripts/gen-icons.py
# 결과: assets/{icon,adaptive-icon,splash,favicon}.png
#
# 컨셉: 다크 배경(#0b0f17)에 상승 시세 스파크라인(라임 #a3e635) + 종점 글로우.
# 4x 슈퍼샘플 후 LANCZOS 다운샘플로 안티에일리어싱.

from PIL import Image, ImageDraw, ImageFont
import os

BG = (11, 15, 23)          # #0b0f17
LIME = (163, 230, 53)      # #a3e635
LIME_SOFT = (163, 230, 53, 70)
INK = (230, 238, 248)      # 라이트 텍스트
ROOT = os.path.join(os.path.dirname(__file__), "..", "assets")
SS = 4                     # supersample factor

# 정규화된 스파크라인 좌표 (0~1). 살짝 출렁이며 우상향.
SPARK = [
    (0.10, 0.66), (0.22, 0.58), (0.31, 0.70), (0.43, 0.50),
    (0.55, 0.60), (0.66, 0.40), (0.78, 0.46), (0.90, 0.26),
]


def lerp(a, b, t):
    return a + (b - a) * t


def draw_spark(draw, box, scale=1.0, width_frac=0.045, dot=True):
    """box=(x,y,w,h) 영역 안에 스파크라인. scale<1이면 가운데 축소."""
    x0, y0, w, h = box
    # 중앙 기준 축소
    cx, cy = x0 + w / 2, y0 + h / 2
    sw, sh = w * scale, h * scale
    px0, py0 = cx - sw / 2, cy - sh / 2
    pts = [(px0 + sx * sw, py0 + sy * sh) for sx, sy in SPARK]
    lw = int(sw * width_frac)
    draw.line(pts, fill=LIME, width=lw, joint="curve")
    # 라인 양 끝 둥글게
    r = lw / 2
    for (x, y) in (pts[0], pts[-1]):
        draw.ellipse([x - r, y - r, x + r, y + r], fill=LIME)
    if dot:
        ex, ey = pts[-1]
        # 글로우 헤일로
        gl = lw * 2.6
        glow = Image.new("RGBA", draw._image.size, (0, 0, 0, 0))
        gd = ImageDraw.Draw(glow)
        gd.ellipse([ex - gl, ey - gl, ex + gl, ey + gl], fill=LIME_SOFT)
        draw._image.alpha_composite(glow)
        # 코어 닷
        cr = lw * 1.15
        draw.ellipse([ex - cr, ey - cr, ex + cr, ey + cr], fill=LIME)
        draw.ellipse([ex - cr * 0.4, ey - cr * 0.4, ex + cr * 0.4, ey + cr * 0.4],
                     fill=(255, 255, 255))


def new_canvas(size, bg):
    return Image.new("RGBA", (size * SS, size * SS), bg)


def finish(img, size, path):
    img = img.resize((size, size), Image.LANCZOS)
    img.convert("RGBA").save(path)
    print("wrote", os.path.relpath(path), img.size)


def gen_icon(size=1024):
    img = new_canvas(size, BG + (255,))
    d = ImageDraw.Draw(img)
    d._image = img
    S = size * SS
    draw_spark(d, (0, 0, S, S), scale=0.62, width_frac=0.05)
    finish(img, size, os.path.join(ROOT, "icon.png"))


def gen_adaptive(size=1024):
    # Android 적응형: 전경은 투명, 콘텐츠는 안전영역(중앙 ~66%) 안.
    img = new_canvas(size, (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d._image = img
    S = size * SS
    draw_spark(d, (0, 0, S, S), scale=0.50, width_frac=0.055)
    finish(img, size, os.path.join(ROOT, "adaptive-icon.png"))


def gen_splash(size=1242):
    img = new_canvas(size, (0, 0, 0, 0))  # 배경색은 app.json splash.backgroundColor
    d = ImageDraw.Draw(img)
    d._image = img
    S = size * SS
    # 위쪽에 스파크라인, 아래에 워드마크
    draw_spark(d, (0, int(S * 0.18), S, int(S * 0.42)), scale=0.55, width_frac=0.04)
    try:
        font = ImageFont.truetype("C:/Windows/Fonts/malgunbd.ttf", int(S * 0.11))
    except Exception:
        font = ImageFont.load_default()
    text = "얼말까"
    tb = d.textbbox((0, 0), text, font=font)
    tw, th = tb[2] - tb[0], tb[3] - tb[1]
    d.text(((S - tw) / 2 - tb[0], int(S * 0.62) - tb[1]), text, font=font, fill=INK)
    # 서브 카피
    try:
        sub = ImageFont.truetype("C:/Windows/Fonts/malgun.ttf", int(S * 0.032))
    except Exception:
        sub = ImageFont.load_default()
    st = "지금 사도 될까?"
    sb = d.textbbox((0, 0), st, font=sub)
    sw = sb[2] - sb[0]
    d.text(((S - sw) / 2 - sb[0], int(S * 0.75) - sb[1]), st, font=sub, fill=LIME)
    finish(img, size, os.path.join(ROOT, "splash.png"))


def gen_favicon(size=196):
    img = new_canvas(size, BG + (255,))
    d = ImageDraw.Draw(img)
    d._image = img
    S = size * SS
    draw_spark(d, (0, 0, S, S), scale=0.68, width_frac=0.06)
    finish(img, size, os.path.join(ROOT, "favicon.png"))


if __name__ == "__main__":
    gen_icon()
    gen_adaptive()
    gen_splash()
    gen_favicon()
    print("done.")
