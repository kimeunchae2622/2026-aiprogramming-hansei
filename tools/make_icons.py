"""앱 아이콘(PNG) 생성: 주황 바탕 + 흰 발바닥. 사용: python tools/make_icons.py

만드는 파일(저장소 루트):
  icon-192.png, icon-512.png        일반 아이콘 (둥근 모서리)
  icon-maskable-512.png             안드로이드 마스크용 (꽉 찬 바탕, 그림은 안전 영역 안)
  apple-touch-icon.png (180)        아이폰 홈 화면용 (꽉 찬 바탕, 아이폰이 모서리를 둥글게 처리)
"""
from PIL import Image, ImageDraw

BG = (255, 159, 104)
PAW = (255, 255, 255)
SS = 4  # 4배로 그린 뒤 줄여서 가장자리를 부드럽게


def paw(draw, size, scale):
    """size 정사각형 중앙에 발바닥을 그린다. scale = 그림이 차지하는 비율."""
    u = size * scale / 100.0           # 100칸 격자 기준 1칸의 픽셀 수
    ox = (size - 100 * u) / 2
    oy = (size - 100 * u) / 2

    def ell(cx, cy, rx, ry, rot=None):
        box = [ox + (cx - rx) * u, oy + (cy - ry) * u, ox + (cx + rx) * u, oy + (cy + ry) * u]
        draw.ellipse(box, fill=PAW)

    # 큰 발바닥 (둥근 삼각형 느낌: 큰 타원 + 아래쪽 보강)
    ell(50, 66, 25, 21)
    ell(36, 72, 14, 12)
    ell(64, 72, 14, 12)
    # 발가락 4개
    ell(22, 46, 8.5, 11)
    ell(40, 30, 9, 12)
    ell(60, 30, 9, 12)
    ell(78, 46, 8.5, 11)


def make(size, rounded, scale):
    big = size * SS
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if rounded:
        d.rounded_rectangle([0, 0, big - 1, big - 1], radius=int(big * 0.22), fill=BG)
    else:
        d.rectangle([0, 0, big, big], fill=BG)
    paw(d, big, scale)
    return img.resize((size, size), Image.LANCZOS)


if __name__ == "__main__":
    make(512, True, 0.66).save("icon-512.png")
    make(192, True, 0.66).save("icon-192.png")
    make(512, False, 0.52).save("icon-maskable-512.png")   # 안전 영역(중앙 80%) 안에 들어가게 작게
    make(180, False, 0.62).convert("RGB").save("apple-touch-icon.png")
    print("icons ok")
