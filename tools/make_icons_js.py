"""Lucide 아이콘(ISC 라이선스)을 내려받아 js/icons.js 로 묶는다. 사용: python tools/make_icons_js.py
출처: https://lucide.dev  (https://github.com/lucide-icons/lucide, ISC License)
"""
import re
import urllib.request

NAMES = [
    "house", "calendar-days", "paw-print", "map-pin", "sliders-horizontal", "plus", "x",
    "chevron-left", "chevron-right", "heart", "ellipsis", "image-plus", "trash-2", "pencil",
    "search", "locate-fixed", "phone", "navigation", "download", "upload", "check",
    "palette", "sun", "moon", "smartphone", "shield-check", "pen-line", "users", "info",
]
BASE = "https://unpkg.com/lucide-static@0.468.0/icons/{}.svg"

out = [
    "// Lucide 아이콘 (https://lucide.dev, ISC License). tools/make_icons_js.py 로 생성한 파일이라 직접 고치지 않는다.",
    "const PATHS = {",
]
for n in NAMES:
    req = urllib.request.Request(BASE.format(n), headers={"User-Agent": "Mozilla/5.0"})
    svg = urllib.request.urlopen(req, timeout=30).read().decode("utf-8")
    inner = re.search(r"<svg[^>]*>(.*)</svg>", svg, re.S).group(1)
    inner = re.sub(r"\s+", " ", inner).strip()
    out.append(f"  '{n}': '{inner}',")
out.append("};")
out.append("""
// 아이콘을 SVG 글자로 돌려준다. fill=true 면 속을 칠한다(하트 등). 색은 글자색(currentColor)을 따른다.
export function icon(name, { size = 24, fill = false, stroke = 2, cls = '' } = {}) {
  const body = PATHS[name];
  if (!body) return '';
  return `<svg class="ico ${cls}" xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}

// 같은 아이콘을 화면에 바로 붙일 수 있는 요소로 돌려준다.
export function iconEl(name, opts) {
  const t = document.createElement('template');
  t.innerHTML = icon(name, opts);
  return t.content.firstChild;
}
""")
open("js/icons.js", "w", encoding="utf-8").write("\n".join(out))
print("icons:", len(NAMES))
