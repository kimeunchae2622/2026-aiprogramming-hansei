// 픽셀 아트를 코드로 그리는 도구. 모든 그림은 이 파일의 도구로 "한 칸씩" 찍어서 만든다.
// 외부 이미지 파일은 쓰지 않는다 → 라이선스 문제 없음, 그림체 통일.

const clamp255 = v => Math.max(0, Math.min(255, Math.round(v)));
export const rgb = hex => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export const toHex = ([r, g, b]) => '#' + [r, g, b].map(v => clamp255(v).toString(16).padStart(2, '0')).join('');
export const mix = (a, b, t) => { const x = rgb(a), y = rgb(b); return toHex(x.map((v, i) => v + (y[i] - v) * t)); };
export const darken = (c, t = .25) => mix(c, '#2a1424', t);
export const lighten = (c, t = .25) => mix(c, '#fffbe8', t);

// 항상 같은 순서로 같은 값을 돌려주는 난수 (마을이 접속할 때마다 똑같이 만들어지도록)
export function rng(seed = 1) {
  let s = (seed >>> 0) || 1;
  const f = () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  f.range = (a, b) => a + f() * (b - a);
  f.int = (a, b) => Math.floor(a + f() * (b - a + 1));
  f.pick = list => list[Math.floor(f() * list.length)];
  return f;
}

export class Pix {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.cv = document.createElement('canvas');
    this.cv.width = w; this.cv.height = h;
    this.g = this.cv.getContext('2d', { willReadFrequently: true });
    this.g.imageSmoothingEnabled = false;
  }
  set(x, y, c) { this.g.fillStyle = c; this.g.fillRect(Math.floor(x), Math.floor(y), 1, 1); return this; }
  rect(x, y, w, h, c) { this.g.fillStyle = c; this.g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); return this; }
  ell(cx, cy, rx, ry, c) {
    this.g.fillStyle = c;
    const x0 = Math.floor(cx - rx), x1 = Math.ceil(cx + rx), y0 = Math.floor(cy - ry), y1 = Math.ceil(cy + ry);
    for (let y = y0; y < y1; y++) {
      let run = -1;
      for (let x = x0; x <= x1; x++) {
        const inside = x < x1 && ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1;
        if (inside && run < 0) run = x;
        if (!inside && run >= 0) { this.g.fillRect(run, y, x - run, 1); run = -1; }
      }
    }
    return this;
  }
  disc(cx, cy, r, c) { return this.ell(cx, cy, r, r, c); }
  line(x0, y0, x1, y1, c, thick = 1) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    this.g.fillStyle = c;
    for (;;) {
      this.g.fillRect(x0, y0, thick, thick);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
    return this;
  }
  poly(pts, c) { // 안쪽을 한 줄씩 채우는 다각형
    this.g.fillStyle = c;
    const ys = pts.map(p => p[1]);
    const y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
    for (let y = y0; y < y1; y++) {
      const yc = y + .5, xs = [];
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
        if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) xs.push(ax + (yc - ay) / (by - ay) * (bx - ax));
      }
      xs.sort((p, q) => p - q);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const a = Math.round(xs[i]), b = Math.round(xs[i + 1]);
        if (b > a) this.g.fillRect(a, y, b - a, 1);
      }
    }
    return this;
  }
  blit(src, x, y, flip = false) {
    const cv = src.cv || src;
    if (!flip) this.g.drawImage(cv, Math.round(x), Math.round(y));
    else { this.g.save(); this.g.translate(Math.round(x) + cv.width, Math.round(y)); this.g.scale(-1, 1); this.g.drawImage(cv, 0, 0); this.g.restore(); }
    return this;
  }
  // 위쪽 가장자리는 밝게, 아래쪽 가장자리는 어둡게 → 둥근 느낌 (이미 그린 그림에만 적용)
  bevel(up = .22, down = .26) {
    const id = this.g.getImageData(0, 0, this.w, this.h), d = id.data, w = this.w, h = this.h;
    const src = new Uint8ClampedArray(d);
    const a = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : src[(y * w + x) * 4 + 3];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (!src[i + 3]) continue;
      const base = [src[i], src[i + 1], src[i + 2]];
      let out = null;
      if (!a(x, y - 1)) out = mix(toHex(base), '#ffffff', up);
      else if (!a(x, y + 1)) out = mix(toHex(base), '#000014', down);
      if (out) { const c = rgb(out); d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; }
    }
    this.g.putImageData(id, 0, 0);
    return this;
  }
  // 윤곽선: 닿아 있는 색보다 어두운 색으로 한 겹 두른다 (그림 가장자리 1칸은 비워 둘 것)
  outline(strength = .55, fixed = null) {
    const id = this.g.getImageData(0, 0, this.w, this.h), d = id.data, w = this.w, h = this.h;
    const src = new Uint8ClampedArray(d);
    const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? null : (src[(y * w + x) * 4 + 3] > 40 ? (y * w + x) * 4 : null);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (src[i + 3] > 40) continue;
      const n = at(x, y + 1) ?? at(x - 1, y) ?? at(x + 1, y) ?? at(x, y - 1);
      if (n == null) continue;
      const col = fixed ? rgb(fixed) : rgb(mix(toHex([src[n], src[n + 1], src[n + 2]]), '#1c0f1a', strength));
      d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
    }
    this.g.putImageData(id, 0, 0);
    return this;
  }
  // 완성된 그림을 한 장으로 돌려준다 (anchor: 발밑 기준점)
  done(ax = this.w / 2, ay = this.h) { return { cv: this.cv, w: this.w, h: this.h, ax, ay }; }
}

// 작은 그림을 정수 배율로 크게 보여 주는 data URL (아이콘용)
export function iconURL(sprite, scale = 3) {
  const c = document.createElement('canvas');
  c.width = sprite.w * scale; c.height = sprite.h * scale;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  g.drawImage(sprite.cv, 0, 0, c.width, c.height);
  return c.toDataURL();
}
