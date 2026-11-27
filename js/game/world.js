// 별빛 꼬리 마을 지도: 지형(풀·물·돌길·광장)을 픽셀 단위로 칠하고, 건물·나무·소품을 배치하고, 충돌을 계산한다.
// 항상 같은 난수 씨앗으로 만들기 때문에 접속할 때마다 마을이 똑같다.
import { Pix, rng, rgb, mix, darken, lighten } from './pixel.js';
import * as PP from './props.js';

// 같은 인자로 부르면 같은 그림을 돌려준다 (나무 수백 그루를 매번 새로 그리지 않도록)
const spriteCache = new Map();
const P = new Proxy(PP, { get(t, k) {
  const v = t[k];
  if (typeof v !== 'function') return v;
  return (...a) => { const key = k + ':' + a.join(','); let s = spriteCache.get(key); if (!s) { s = v(...a); spriteCache.set(key, s); } return s; };
} });

export const TS = 16, WW = 96, WH = 64, GW = WW * TS, GH = WH * TS;
const T = v => v * TS;
const hash = (x, y, s = 0) => { let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const px32 = hex => { const [r, g, b] = rgb(hex); return (255 << 24) | (b << 16) | (g << 8) | r; };

/* ---------- 지형 정의 (타일 좌표) ---------- */
const LAKE = [{ cx: 84, cy: 38, rx: 11, ry: 11.5 }, { cx: 88, cy: 31, rx: 6.5, ry: 5 }, { cx: 80, cy: 46, rx: 6, ry: 4.5 }];
const POND = { cx: 22, cy: 17, rx: 5.5, ry: 3.6 };
const STREAM = [[34, 23.5], [34, 32], [34.6, 42], [34, 52], [34.4, 60], [34, 67]], STREAM_HW = 1.6;
const PLAZA = { cx: 52, cy: 45, r: 11.6 };
const PATHS = [
  { w: 2.6, pts: [[17.5, 48.4], [17.5, 52], [24, 52.4], [31, 52], [40, 52]] },
  { w: 2.2, pts: [[17.5, 52], [13, 55], [9, 57.5]] },
  { w: 2.2, pts: [[17.5, 52], [22, 56], [26, 58]] },
  { w: 2.8, pts: [[52, 34], [52, 28], [51, 22], [47, 17], [41, 14], [33, 13], [25, 15], [19, 19]] },
  { w: 2.4, pts: [[51, 22], [57, 17], [65, 13], [73, 11], [79, 12.5]] },
  { w: 2.6, pts: [[63, 45], [69, 44.5], [73, 42], [75, 40]] },
  { w: 2.6, pts: [[52, 56], [53, 60], [61, 60.5], [69, 58.5]] },
];
export const ZONES = [
  { id: 'home', name: '우리 집 정원', x0: 4, y0: 34, x1: 33, y1: 62 },
  { id: 'plaza', name: '마을 광장', x0: 38, y0: 33, x1: 66, y1: 58 },
  { id: 'forest', name: '속삭이는 숲', x0: 2, y0: 2, x1: 70, y1: 33 },
  { id: 'mine', name: '광산 입구', x0: 70, y0: 2, x1: 94, y1: 20 },
  { id: 'lake', name: '달빛 호수', x0: 66, y0: 20, x1: 94, y1: 53 },
  { id: 'farm', name: '농장', x0: 66, y0: 53, x1: 94, y1: 62 },
];
export const GARDEN = { x0: 8, y0: 49, x1: 30, y1: 59 }; // 가구를 놓을 수 있는 정원 구역 (타일)

function segDist(x, y, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2));
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
}
const wob = a => Math.sin(a * 3 + 1.3) * .05 + Math.sin(a * 7 + .4) * .03;
function inEll(e, x, y) {
  const dx = (x - T(e.cx)) / T(e.rx), dy = (y - T(e.cy)) / T(e.ry);
  if (Math.abs(dx) > 1.2 || Math.abs(dy) > 1.2) return false;
  return Math.hypot(dx, dy) < 1 + wob(Math.atan2(dy, dx));
}
function isWater(x, y) {
  for (const e of LAKE) if (inEll(e, x, y)) return true;
  if (inEll(POND, x, y)) return true;
  const hw = T(STREAM_HW) + Math.sin(y * .045) * 3;
  for (let i = 0; i < STREAM.length - 1; i++) {
    const [ax, ay] = STREAM[i], [bx, by] = STREAM[i + 1];
    if (segDist(x, y, T(ax), T(ay), T(bx), T(by)) < hw) return true;
  }
  return false;
}

export function zoneAt(x, y) {
  const tx = x / TS, ty = y / TS;
  for (const z of ZONES) if (tx >= z.x0 && tx < z.x1 && ty >= z.y0 && ty < z.y1) return z;
  return null;
}

export function buildWorld() {
  const r = rng(20261127);
  const world = { TS, WW, WH, GW, GH, objects: [], cols: [], spots: [], interacts: [], lamps: [], petalTrees: [], smoke: [], glows: [], sparkles: [], anim: [] };

  /* 1) 물 마스크 */
  const water = new Uint8Array(GW * GH);
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (isWater(x, y)) water[y * GW + x] = 1;

  world.waterPts = [];
  for (let i = 0; i < 20000 && world.waterPts.length < 420; i++) {
    const x = Math.floor(r() * GW), y = Math.floor(r() * GH);
    if (water[y * GW + x] && water[y * GW + x + 4] && water[y * GW + x - 4]) world.waterPts.push([x, y, r() * 6.28]);
  }

  /* 2) 풀·물·광장 칠하기 */
  const img = new ImageData(GW, GH), u = new Uint32Array(img.data.buffer);
  const grass = ['#8dcc4d', '#85c446', '#94d357', '#80bf42'].map(px32), grassL = ['#9bd95d', '#93d255', '#a3df66', '#8ecb4f'].map(px32), grassD = ['#79b83e', '#72b038', '#82c046', '#6aa834'].map(px32);
  const forest = ['#79b845', '#72b041', '#80c04b', '#6ba93c'].map(px32), forestL = ['#86c552', '#7fbe4c', '#8dcd58', '#78b845'].map(px32), forestD = ['#69a73a', '#62a035', '#70b040', '#5a9a30'].map(px32);
  const vn = (x, y, s) => { const gx = Math.floor(x), gy = Math.floor(y), fx = x - gx, fy = y - gy, a = hash(gx, gy, s), b = hash(gx + 1, gy, s), c = hash(gx, gy + 1, s), d = hash(gx + 1, gy + 1, s), sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy); return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy; };
  const stoneC = ['#dcc3a0', '#cfb28d', '#e6d1b1'].map(px32), mortar = px32('#a98763'), rim = px32('#8f7655');
  const wAt = (x, y) => (x < 0 || y < 0 || x >= GW || y >= GH) ? 0 : water[y * GW + x];
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const i = y * GW + x;
    if (water[i]) {
      const near = !wAt(x - 1, y) || !wAt(x + 1, y) || !wAt(x, y - 1) || !wAt(x, y + 1);
      const near2 = !wAt(x - 2, y) || !wAt(x + 2, y) || !wAt(x, y - 2) || !wAt(x, y + 2);
      if (near) u[i] = px32('#e1f5ff'); else if (near2) u[i] = px32('#8fd5f7');
      else { const w = ((x >> 3) + (y >> 2) * 2) % 7 === 0 ? '#58b8ee' : (hash(x >> 1, y >> 1, 7) > .86 ? '#2f8fd0' : '#3da6e4'); u[i] = px32(w); }
      continue;
    }
    if (wAt(x - 1, y) || wAt(x + 1, y) || wAt(x, y - 1) || wAt(x, y + 1)) { u[i] = px32('#4f7c33'); continue; }
    if (wAt(x - 2, y) || wAt(x + 2, y) || wAt(x, y - 2) || wAt(x, y + 2)) { u[i] = px32('#6aa63c'); continue; }
    const dxp = x - T(PLAZA.cx), dyp = y - T(PLAZA.cy), d = Math.hypot(dxp, dyp), R = T(PLAZA.r) + wob(Math.atan2(dyp, dxp)) * 60;
    if (d < R) {
      if (d > R - 4) { u[i] = d > R - 2 ? rim : px32('#b99874'); continue; }
      const row = Math.floor(y / 7), xo = (row % 2) * 5, col = Math.floor((x + xo) / 10);
      if (y % 7 === 0 || (x + xo) % 10 === 0) u[i] = mortar; else u[i] = stoneC[Math.floor(hash(col, row, 3) * 3)];
      continue;
    }
    const nz = vn(x / 44, y / 44, 5), inF = y < T(33), f = nz > .62 ? (inF ? forestL : grassL) : nz < .3 ? (inF ? forestD : grassD) : (inF ? forest : grass);
    u[i] = f[Math.floor(hash(x >> 2, y >> 2, 1) * 4)];
  }
  const ground = new Pix(GW, GH);
  ground.g.putImageData(img, 0, 0);
  world.ground = ground.cv;

  /* 3) 타일 충돌(물·가장자리) */
  const solid = new Uint8Array(WW * WH);
  for (let ty = 0; ty < WH; ty++) for (let tx = 0; tx < WW; tx++) {
    let n = 0;
    for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) n += water[(ty * TS + a * 4 + 2) * GW + tx * TS + b * 4 + 2];
    solid[ty * WW + tx] = (n >= 8 || tx < 2 || ty < 2 || tx >= WW - 2 || ty >= WH - 2) ? 1 : 0;
  }
  world.solid = solid;
  const clearTiles = (x0, y0, x1, y1) => { for (let ty = Math.floor(y0); ty < y1; ty++) for (let tx = Math.floor(x0); tx < x1; tx++) solid[ty * WW + tx] = 0; };

  /* 4) 돌길 */
  const pathMask = new Uint8Array(WW * WH);
  const g = ground.g;
  const stone = (x, y, rx, ry) => {
    const c = r.pick(['#d9c19c', '#cdb28c', '#e2cca8']);
    ground.ell(x, y + 1, rx, ry, '#8f7655'); ground.ell(x, y, rx, ry, darken(c, .12)); ground.ell(x, y - .5, rx - 1, ry - 1, c); ground.ell(x - 1.5, y - 1.5, rx * .5, ry * .4, lighten(c, .35));
  };
  for (const pth of PATHS) {
    for (let s = 0; s < pth.pts.length - 1; s++) {
      const [ax, ay] = pth.pts[s], [bx, by] = pth.pts[s + 1];
      const len = Math.hypot(bx - ax, by - ay) * TS, steps = Math.ceil(len / 11);
      const nx = -(by - ay) / (len / TS), ny = (bx - ax) / (len / TS);
      for (let k = 0; k <= steps; k++) {
        const t = k / steps, cx = T(ax + (bx - ax) * t), cy = T(ay + (by - ay) * t);
        for (const off of (k % 2 ? [-.5, .5] : [-1.0, 0, 1.0])) {
          const lat = off * pth.w * TS * .5 * .92 + (r() - .5) * 4;
          const x = cx + nx * lat + (r() - .5) * 3, y = cy + ny * lat + (r() - .5) * 3;
          if (wAt(Math.round(x), Math.round(y))) continue;
          const dp = Math.hypot(x - T(PLAZA.cx), y - T(PLAZA.cy)); if (dp < T(PLAZA.r) - 6) continue;
          stone(x, y, 6 + r() * 2.2, 4.4 + r() * 1.5);
        }
      }
      for (let k = 0; k <= len / 8; k++) { // 길 주변 타일 표시
        const t = k / (len / 8), mx = ax + (bx - ax) * t, my = ay + (by - ay) * t, rad = pth.w / 2 + 1.2;
        for (let ty = Math.floor(my - rad); ty <= my + rad; ty++) for (let tx = Math.floor(mx - rad); tx <= mx + rad; tx++) if (tx >= 0 && ty >= 0 && tx < WW && ty < WH && Math.hypot(tx + .5 - mx, ty + .5 - my) < rad) pathMask[ty * WW + tx] = 1;
      }
    }
  }
  for (let ty = 0; ty < WH; ty++) for (let tx = 0; tx < WW; tx++) if (Math.hypot(tx + .5 - PLAZA.cx, ty + .5 - PLAZA.cy) < PLAZA.r + .5) pathMask[ty * WW + tx] = 1;

  /* 5) 지형 위 장식: 풀 무더기, 돌다리, 부두, 폭포, 텃밭, 농장 */
  for (let i = 0; i < 5200; i++) { // 풀잎
    const x = Math.floor(r() * (GW - 4)) + 2, y = Math.floor(r() * (GH - 6)) + 4;
    if (wAt(x, y) || wAt(x + 2, y) || wAt(x - 2, y) || wAt(x, y + 3)) continue;
    const dp = Math.hypot(x - T(PLAZA.cx), y - T(PLAZA.cy)); if (dp < T(PLAZA.r)) continue;
    const dark = y < T(33) ? '#5a9a38' : '#609f3a';
    g.fillStyle = dark; g.fillRect(x, y, 1, 2); g.fillRect(x - 2, y + 1, 1, 1); g.fillRect(x + 2, y + 1, 1, 1);
    g.fillStyle = '#b6e873'; g.fillRect(x, y - 1, 1, 1);
  }
  const reed = (x, y) => { ground.rect(x, y - 8, 1, 9, '#4e8f3a'); ground.rect(x - 2, y - 5, 1, 6, '#5fa545'); ground.rect(x + 2, y - 6, 1, 7, '#5fa545'); ground.rect(x, y - 13, 2, 6, '#8a5230'); ground.rect(x, y - 13, 1, 2, '#b27a4a'); };
  for (let i = 0, n = 0; i < 4000 && n < 70; i++) { // 물가 갈대
    const x = Math.floor(r() * GW), y = Math.floor(r() * GH);
    if (wAt(x, y) || !(wAt(x + 4, y) || wAt(x - 4, y) || wAt(x, y + 4)) || wAt(x, y - 2)) continue;
    reed(x, y); n++;
  }
  for (let i = 0, n = 0; i < 6000 && n < 26; i++) { // 연잎
    const x = Math.floor(r() * GW), y = Math.floor(r() * GH);
    if (!wAt(x, y) || !wAt(x + 12, y) || !wAt(x - 12, y) || !wAt(x, y + 10) || !wAt(x, y - 10)) continue;
    ground.ell(x, y + 1, 6, 4, '#2c7a3c'); ground.ell(x, y, 6, 4, '#4fa845'); ground.ell(x - 1, y - 1, 3.5, 1.8, '#7cc957'); ground.rect(x, y, 6, 1, '#3d8fd0');
    if (r() > .45) { ground.disc(x - 1, y - 1, 2.6, '#ff8fb8'); ground.disc(x - 1, y - 1, 1, '#fff3b0'); }
    n++;
  }
  // 돌다리 (시냇물 위)
  { const x0 = T(31), x1 = T(38), y0 = T(50.4), y1 = T(53.6);
    ground.rect(x0, y0 + 6, x1 - x0, y1 - y0 - 12, '#7a6a55');
    ground.rect(x0 + 2, y0 + 8, x1 - x0 - 4, y1 - y0 - 16, '#d9c9a8');
    for (let x = x0 + 2; x < x1 - 2; x += 8) ground.rect(x, y0 + 8, 1, y1 - y0 - 16, '#bfae8c');
    for (let y = y0 + 8; y < y1 - 8; y += 6) ground.rect(x0 + 2, y, x1 - x0 - 4, 1, '#bfae8c');
    for (const yy of [y0, y1 - 8]) { ground.rect(x0 - 2, yy, x1 - x0 + 4, 8, '#b6a688'); ground.rect(x0 - 2, yy, x1 - x0 + 4, 2, '#e2d6bb'); ground.rect(x0 - 2, yy + 7, x1 - x0 + 4, 1, '#7a6a55'); for (let x = x0; x < x1; x += 7) ground.rect(x, yy + 2, 1, 5, '#8f7f64'); }
    for (const xx of [x0 - 4, x1 - 2]) for (const yy of [y0 - 2, y1 - 8]) { ground.rect(xx, yy, 6, 10, '#a89878'); ground.rect(xx, yy, 6, 2, '#d8ccb0'); }
    clearTiles(31, 51, 38, 53); }
  // 나무 부두 (호수)
  { const x0 = T(70), x1 = T(79.5), y0 = T(39), y1 = T(41);
    ground.rect(x0, y0 + 2, x1 - x0, y1 - y0 - 1, '#6b4326');
    for (let x = x0; x < x1; x += 6) { ground.rect(x, y0, 5, y1 - y0, '#b87a45'); ground.rect(x, y0, 5, 2, '#d49a63'); ground.rect(x + 5, y0, 1, y1 - y0, '#7d4b29'); }
    for (const yy of [y0 - 3, y1 - 3]) for (let x = x0 + 12; x < x1; x += 26) { ground.rect(x, yy, 4, 9, '#7d4b29'); ground.rect(x, yy, 4, 2, '#a8693f'); }
    ground.rect(x1 - 2, y0, 2, y1 - y0, '#7d4b29');
    clearTiles(70, 39, 80, 41); }
  // 폭포 (호수 북동쪽, 시냇물 시작점)
  const falls = (x, y0, y1, w) => { for (let yy = y0; yy < y1; yy++) for (let xx = x; xx < x + w; xx++) { const c = hash(xx, yy >> 1, 9); ground.rect(xx, yy, 1, 1, c > .6 ? '#ffffff' : c > .25 ? '#bfe9fb' : '#7fcbf2'); } ground.ell(x + w / 2, y1, w * .7, 4, '#e8f8ff'); };
  falls(T(87.2), T(21.6), T(26.4), 40); falls(T(33.3), T(21.6), T(24.4), 28);
  // 텃밭 / 농장 밭
  const plot = (tx, ty, tw, th, crop) => {
    const x = T(tx), y = T(ty), w = T(tw), h = T(th);
    ground.rect(x - 3, y - 3, w + 6, h + 6, '#8a5a30'); ground.rect(x, y, w, h, '#6b4326');
    for (let yy = y + 3; yy < y + h; yy += 7) ground.rect(x, yy, w, 2, '#563519');
    for (let yy = y + 5; yy < y + h - 3; yy += 7) for (let xx = x + 5; xx < x + w - 3; xx += 9) {
      if (crop === 'tomato') { ground.rect(xx, yy - 5, 1, 6, '#3f8f3a'); ground.disc(xx - 2, yy - 3, 1.5, '#4fa845'); ground.disc(xx + 3, yy - 2, 3, '#e5384b'); ground.set(xx + 2, yy - 4, '#ffb3b8'); }
      else if (crop === 'carrot') { ground.poly([[xx - 2, yy - 4], [xx + 2, yy - 4], [xx, yy - 8]], '#4fa845'); ground.disc(xx, yy - 3, 1.6, '#ff9f43'); }
      else { ground.poly([[xx, yy], [xx - 4, yy - 5], [xx - 1, yy - 3]], '#5db446'); ground.poly([[xx, yy], [xx + 4, yy - 5], [xx + 1, yy - 3]], '#79c456'); }
    }
  };
  plot(8, 51, 4.5, 2, 'tomato'); plot(8, 54, 4.5, 2, 'carrot');
  for (let ty = 50; ty < 57; ty++) for (let tx = 7; tx < 14; tx++) world.__plotTiles = (world.__plotTiles || []).concat([[tx, ty]]);
  plot(72, 55, 6, 3, 'tomato'); plot(79, 55, 6, 3, 'carrot'); plot(72, 59, 6, 2.4, 'leaf'); plot(79, 59, 6, 2.4, 'leaf');

  /* 6) 오브젝트(깊이 정렬되는 물건) 등록 도구 */
  const occ = new Set();
  const key = (tx, ty) => ty * WW + tx;
  const addCol = (x0, y0, x1, y1) => world.cols.push({ x0, y0, x1, y1 });
  const add = (spr, tx, ty, o = {}) => {
    const ax = T(tx), ay = T(ty);
    const ob = { spr, x: ax, y: ay, sy: ay + (o.sort || 0), id: o.id || null, kind: o.kind || 'prop', frames: o.frames || null };
    world.objects.push(ob);
    if (o.col) addCol(ax + o.col[0], ay + o.col[1], ax + o.col[2], ay + o.col[3]);
    occ.add(key(Math.floor(tx), Math.floor(ty)));
    return ob;
  };
  const inGarden = (x, y) => (x > 5.5 && x < 32 && y > 36 && y < 61) || (x > 69.5 && x < 93.5 && y > 52.5 && y < 62.5); // 우리 집 정원과 농장(손으로 꾸민 곳)
  const free = (tx, ty, pad = 0) => {
    for (let a = -pad; a <= pad; a++) for (let b = -pad; b <= pad; b++) {
      const x = Math.floor(tx) + a, y = Math.floor(ty) + b;
      if (x < 2 || y < 2 || x >= WW - 2 || y >= WH - 2 || solid[key(x, y)] || pathMask[key(x, y)] || occ.has(key(x, y))) return false;
    }
    return true;
  };
  const tree = (kind, tx, ty, seed) => {
    const s = kind === 'pine' ? P.pine(seed) : kind === 'cherry' ? P.cherryTree(seed, 'l') : kind === 'cherryS' ? P.cherryTree(seed, 's') : P.treeGreen(seed, kind === 'big');
    const ob = add(s, tx, ty, { col: [-5, -6, 5, 0], kind: 'tree' });
    if (kind === 'cherry' || kind === 'cherryS') world.petalTrees.push({ x: T(tx), y: T(ty) - (kind === 'cherry' ? 52 : 40), r: kind === 'cherry' ? 30 : 22 });
    return ob;
  };

  (world.__plotTiles || []).forEach(([tx, ty]) => occ.add(ty * WW + tx));
  /* 7) 우리 집과 정원 */
  const house = add(P.house(), 17.5, 47, { col: [-46, -22, 46, 0], kind: 'house' });
  world.smoke.push({ x: house.x + 30, y: house.y - 90 });
  world.glows.push({ x: house.x - 38, y: house.y - 32, r: 26 }, { x: house.x + 28, y: house.y - 32, r: 26 });
  world.interacts.push({ id: 'home-door', kind: 'home', x: T(17.5), y: T(47.8), r: 26, label: '집에 들어가기' });
  tree('cherry', 9.5, 44, 1); tree('cherryS', 27.5, 42.6, 2); tree('big', 8, 58, 3); tree('treeS', 30, 58, 4);
  add(P.bench(), 24.2, 45.2, { col: [-13, -6, 13, 0] }); add(P.pot(2), 12.2, 47.4, { col: [-5, -4, 5, 0] }); add(P.pot(3), 22.8, 47.4, { col: [-5, -4, 5, 0] });
  add(P.doghouse(), 10.5, 50.2, { col: [-18, -10, 18, 0] }); add(P.mailbox(), 30.2, 49.6, { col: [-4, -5, 4, 0] });
  for (const [x, y] of [[14.2, 51.4], [21.2, 51.4]]) { add(P.lamp(), x, y, { col: [-3, -4, 3, 0], kind: 'lamp' }); world.lamps.push({ x: T(x), y: T(y) - 30, r: 44 }); }
  // 울타리
  const fence = (x0, y0, x1, y1, wood, gap) => {
    for (let x = x0; x < x1; x++) for (const y of [y0, y1]) { if (gap && gap(x, y)) continue; add(P.fenceH(wood), x + .5, y + 1, { col: [-8, -7, 8, 0], kind: 'fence' }); }
    for (let y = y0 + 1; y < y1; y++) for (const x of [x0, x1]) { if (gap && gap(x, y)) continue; add(P.fenceV(wood), x + .5, y + 1, { col: [-4, -16, 4, 0], kind: 'fence' }); }
  };
  fence(6, 37, 31, 60, false, (x, y) => x === 31 && y >= 50 && y <= 53);
  fence(70, 53, 93, 61, true, (x, y) => x === 70 && y >= 56 && y <= 58);
  const bloom = (fn, tx, ty, seed) => add(fn(seed), tx, ty, { col: [-8, -5, 8, 0], kind: 'bloom' });
  for (const [tx, ty, k] of [[12.8, 46.6, 0], [14.6, 46.8, 1], [20.4, 46.8, 2], [21.8, 46.4, 0], [10, 41.6, 1], [26, 40.2, 2], [8.2, 48.6, 0], [29, 54.6, 1], [29.2, 44, 2], [26.4, 48.4, 0], [8.6, 38.8, 2], [12, 38.6, 1], [17, 38.8, 0], [22, 38.8, 2], [28, 38.8, 1]])
    bloom([P.hydrangea, P.lavender, P.tulips][k], tx, ty, tx * 3 + ty);
  add(P.blanket(), 12.6, 43.6); add(P.stump(), 14.6, 42.4, { col: [-6, -4, 6, 0] }); add(P.lanternGround(), 14.6, 41.7);
  /* 8) 마을 광장 */
  const fountain = add(P.fountain(0), 52, 46.4, { col: [-26, -14, 26, 0], kind: 'fountain', frames: [P.fountain(0), P.fountain(1)] });
  world.anim.push(fountain);
  add(P.shopBuilding(), 52, 39.4, { col: [-40, -26, 40, 0], kind: 'shop' });
  world.interacts.push({ id: 'shop', kind: 'shop', x: T(52), y: T(40.6), r: 30, label: '상점' });
  add(P.stall(0), 44.4, 41.4, { col: [-16, -8, 16, 0] }); add(P.stall(1), 59.6, 41.4, { col: [-16, -8, 16, 0] }); add(P.stall(2), 63.6, 48.4, { col: [-16, -8, 16, 0] });
  add(P.bench(1), 46, 51.8, { col: [-13, -6, 13, 0] }); add(P.bench(1), 58, 51.8, { col: [-13, -6, 13, 0] });
  for (const [x, y] of [[45, 44.6], [59, 44.6], [47.6, 54.4], [56.4, 54.4]]) { add(P.lamp(), x, y, { col: [-3, -4, 3, 0], kind: 'lamp' }); world.lamps.push({ x: T(x), y: T(y) - 30, r: 46 }); }
  for (let k = 0; k < 10; k++) { // 분수 둘레 화분
    const a = k / 10 * Math.PI * 2 + .3, x = 52 + Math.cos(a) * 6.4, y = 46.4 + Math.sin(a) * 4.2;
    if (Math.abs(a % 6.28 - 4.71) < .5) continue; // 북쪽(상점 길)은 비운다
    add(P.pot(k + 5), x, y, { col: [-5, -4, 5, 0] });
  }
  for (const [tx, ty, k] of [[41.4, 40.6, 2], [43, 38.6, 1], [62.2, 38.6, 0], [63.6, 41.4, 2], [46.6, 56.4, 0], [57.6, 56.6, 1], [40.2, 46, 1], [65, 52.4, 0], [48.4, 47.6, 2], [55.8, 47.6, 0]])
    bloom([P.hydrangea, P.lavender, P.tulips][k], tx, ty, tx * 5 + ty);
  add(P.noticeBoard(), 42.6, 49.4, { col: [-14, -6, 14, 0] });
  world.interacts.push({ id: 'board', kind: 'info', x: T(42.6), y: T(50.2), r: 26, label: '마을 안내판', text: '별빛 꼬리 마을에 어서 와요! 숲과 호수에서 꽃·열매·나뭇가지·반짝이는 조각을 모으고, 상점에서 정원 가구를 살 수 있어요.' });
  add(P.mailbox(), 41, 54, { col: [-4, -5, 4, 0] });
  tree('cherry', 39.5, 56, 5); tree('cherryS', 65.5, 55.6, 6); tree('big', 66.2, 37, 7);
  /* 9) 숲, 광산, 호수, 농장 */
  add(P.mineEntrance(), 80.5, 10, { col: [-44, -26, 44, 0], kind: 'mine' });
  add(P.minecart(), 86.5, 11.2, { col: [-14, -8, 14, 0] });
  world.interacts.push({ id: 'mine', kind: 'wip', x: T(80.5), y: T(11.4), r: 34, label: '광산 입구', text: '광산은 준비 중이에요. 다음 업데이트에서 열려요!' });
  add(P.signPost(), 76, 12.6, { col: [-5, -4, 5, 0] });
  world.interacts.push({ id: 'pier', kind: 'wip', x: T(78.4), y: T(40), r: 26, label: '낚시터', text: '낚시터는 준비 중이에요. 부두 끝에서 곧 낚시를 할 수 있어요!' });
  add(P.signPost(), 76.8, 38.6, { col: [-5, -4, 5, 0] }); add(P.lamp(), 79, 38.4, { col: [-3, -4, 3, 0], kind: 'lamp' }); world.lamps.push({ x: T(79), y: T(38.4) - 30, r: 46 });
  add(P.bench(), 71.8, 36.2, { col: [-13, -6, 13, 0] }); add(P.bench(), 72.2, 44.6, { col: [-13, -6, 13, 0] });
  add(P.windmill(), 89.6, 60.4, { col: [-18, -16, 18, 0], kind: 'windmill' }); add(P.scarecrow(), 78.4, 58.6, { col: [-5, -4, 5, 0] }); add(P.haystack(), 86.8, 53.8, { col: [-10, -7, 10, 0] });
  add(P.signPost(), 70.4, 60, { col: [-5, -4, 5, 0] });
  world.interacts.push({ id: 'farm', kind: 'wip', x: T(71.2), y: T(60.2), r: 30, label: '농장', text: '농장은 준비 중이에요. 씨앗을 심고 작물을 키우는 기능이 곧 열려요!' });
  add(P.noticeBoard(), 49.6, 28.6, { col: [-14, -6, 14, 0] });
  world.interacts.push({ id: 'forest-sign', kind: 'info', x: T(49.6), y: T(29.4), r: 26, label: '숲 안내판', text: '속삭이는 숲이에요. 반짝이는 곳 가까이 가서 채집 버튼을 눌러 보세요. 채집한 곳은 내일 아침 5시에 다시 생겨요.' });
  add(P.noticeBoard(), 70.2, 33, { col: [-14, -6, 14, 0] });
  world.interacts.push({ id: 'lake-sign', kind: 'info', x: T(70.2), y: T(33.8), r: 26, label: '호수 안내판', text: '달빛 호수예요. 부두에서 곧 낚시를 할 수 있어요.' });

  // 가장자리 숲 + 숲 지대
  for (let x = 1; x < WW; x += 2.6) { tree(r() > .5 ? 'pine' : 'big', x, 2.4 + r() * 1.2, Math.floor(r() * 4) + 1); tree(r() > .4 ? 'pine' : 'treeS', x + 1, WH - 1.6 + r() * .8, Math.floor(r() * 4) + 1); }
  for (let y = 4; y < WH - 2; y += 2.8) { tree(r() > .5 ? 'pine' : 'big', 1.6 + r() * .6, y, Math.floor(r() * 4) + 1); tree(r() > .5 ? 'pine' : 'treeS', WW - 1.6 - r() * .6, y, Math.floor(r() * 4) + 1); }
  const clearings = [[19, 19, 5], [46, 12, 4.5], [60, 22, 4], [34, 12, 3]];
  tree('cherry', 18, 21, 8); tree('cherry', 45.5, 13, 9); tree('cherryS', 61, 23.4, 10); tree('cherryS', 12, 12, 11);
  const inClear = (x, y) => clearings.some(([cx, cy, cr]) => Math.hypot(x - cx, y - cy) < cr);
  for (let i = 0, n = 0; i < 4000 && n < 150; i++) { // 숲 나무
    const x = 3 + r() * 66, y = 4 + r() * 28;
    if (inClear(x, y) || !free(x, y, 1)) continue;
    const k = r(); tree(k < .45 ? 'big' : k < .75 ? 'pine' : k < .9 ? 'treeS' : 'cherryS', x, y, Math.floor(r() * 4) + 1); n++;
  }
  for (let i = 0, n = 0; i < 2000 && n < 34; i++) { // 호수 주변 / 숲 가장자리 나무
    const x = 66 + r() * 28, y = 3 + r() * 50;
    if (!free(x, y, 1) || (x > 70 && y > 22 && y < 52 && Math.hypot(x - 84, y - 38) < 14) || (x > 69 && y > 52)) continue;
    tree(r() > .5 ? 'big' : 'pine', x, y, Math.floor(r() * 4) + 1); n++;
  }
  for (let i = 0, n = 0; i < 1500 && n < 10; i++) { // 광장·정원 가장자리 나무
    const x = 36 + r() * 30, y = 56 + r() * 5; if (!free(x, y, 1)) continue; tree('treeS', x, y, Math.floor(r() * 4) + 1); n++;
  }
  // 바위와 덤불
  for (let i = 0, n = 0; i < 3000 && n < 46; i++) {
    const x = 3 + r() * 90, y = 3 + r() * 58;
    if (!free(x, y, 1) || Math.hypot(x - 52, y - 45) < 13 || inGarden(x, y)) continue;
    const k = Math.floor(r() * 3); add(P.rock(k), x, y, { col: [k === 1 ? -14 : -9, -9, k === 1 ? 14 : 9, 0], kind: 'rock' }); n++;
  }
  for (let i = 0, n = 0; i < 3000 && n < 40; i++) {
    const x = 3 + r() * 90, y = 3 + r() * 58;
    if (!free(x, y, 0) || Math.hypot(x - 52, y - 45) < 12.5 || inGarden(x, y)) continue;
    add(P.bush(r() > .6 ? 'flower' : 'plain', Math.floor(r() * 4)), x, y, { col: [-9, -5, 9, 0], kind: 'bush' }); n++;
  }
  for (let i = 0, n = 0; i < 4000 && n < 26; i++) {
    const x = 4 + r() * 90, y = 4 + r() * 56;
    if (!free(x, y, 0) || inGarden(x, y)) continue;
    bloom([P.hydrangea, P.lavender, P.tulips][n % 3], x, y, n + 11); n++;
  }
  // 폭포 바위
  for (const [x, y] of [[85.8, 22.4], [89.6, 22.2], [93, 22.8], [32.4, 22.6], [36, 22.6]]) add(P.rock(1), x, y, { col: [-14, -9, 14, 0] });

  /* 10) 채집 지점 (같은 씨앗 → 같은 위치) */
  const spotDefs = [['flower', 8, P.flowerPatch], ['berry', 7, null], ['stick', 7, P.stickPile], ['gem', 7, P.gemSpot]];
  const taken = [];
  for (const [type, count] of spotDefs) {
    for (let i = 0, n = 0; i < 6000 && n < count; i++) {
      const lakeSide = n >= count - 2;
      const x = lakeSide ? 66 + r() * 8 : 4 + r() * 62, y = lakeSide ? 24 + r() * 28 : 4 + r() * 28;
      if (!free(x, y, 0) || taken.some(([a, b]) => Math.hypot(a - x, b - y) < 4)) continue;
      const id = `${type}-${n + 1}`;
      const sprites = type === 'berry' ? { full: P.bush('berry', n + 7), empty: P.bush('plain', n + 7) }
        : { full: (type === 'flower' ? P.flowerPatch(true, n) : type === 'stick' ? P.stickPile(true) : P.gemSpot(true)), empty: (type === 'flower' ? P.flowerPatch(false, n) : type === 'stick' ? P.stickPile(false) : P.gemSpot(false)) };
      world.spots.push({ id, type, x: T(x), y: T(y), r: 22, sprites });
      occ.add(key(Math.floor(x), Math.floor(y))); taken.push([x, y]); n++;
    }
  }
  // 정원 안 체험용 채집 지점 2곳 (처음 해 보기 쉽도록 집 근처)
  for (const [type, x, y] of [['flower', 21.2, 55.4], ['stick', 14.4, 58]]) {
    const n = world.spots.filter(s => s.type === type).length + 1, id = `${type}-${n}`;
    world.spots.push({ id, type, x: T(x), y: T(y), r: 22, sprites: type === 'flower' ? { full: P.flowerPatch(true, 3), empty: P.flowerPatch(false, 3) } : { full: P.stickPile(true), empty: P.stickPile(false) } });
    occ.add(key(Math.floor(x), Math.floor(y)));
  }

  /* 11) 바닥에 흩뿌리는 작은 꽃 */
  for (let i = 0, n = 0; i < 6000 && n < 340; i++) {
    const tx = 2 + r() * (WW - 4), ty = 3 + r() * (WH - 5), x = Math.floor(tx * TS), y = Math.floor(ty * TS);
    if (wAt(x, y) || wAt(x + 10, y) || wAt(x - 10, y) || pathMask[key(Math.floor(tx), Math.floor(ty))]) continue;
    const sp = P.decoFlowers(Math.floor(r() * 90)); ground.blit(sp, x - 8, y - 8); n++;
  }
  for (let i = 0, n = 0; i < 2000 && n < 16; i++) { // 버섯
    const tx = 4 + r() * 60, ty = 5 + r() * 26, x = Math.floor(tx * TS), y = Math.floor(ty * TS);
    if (wAt(x, y) || pathMask[key(Math.floor(tx), Math.floor(ty))] || occ.has(key(Math.floor(tx), Math.floor(ty)))) continue;
    ground.blit(P.mushroom(), x - 5, y - 9); n++;
  }

  /* 12) 충돌 격자 */
  world.colGrid = new Map();
  world.cols.forEach((c, i) => {
    for (let ty = Math.floor(c.y0 / TS); ty <= Math.floor(c.y1 / TS); ty++) for (let tx = Math.floor(c.x0 / TS); tx <= Math.floor(c.x1 / TS); tx++) {
      const k = key(tx, ty); if (!world.colGrid.has(k)) world.colGrid.set(k, []); world.colGrid.get(k).push(i);
    }
  });
  world.pathMask = pathMask;
  world.objects.sort((a, b) => a.sy - b.sy);
  world.spawn = { x: T(17.5), y: T(51.4) };
  return world;
}

/* ---------- 충돌 검사 (발밑 상자) ---------- */
export function boxFree(world, x, y, hw, hh) {
  const x0 = x - hw, x1 = x + hw, y0 = y - hh, y1 = y;
  if (x0 < T(2) || x1 > GW - T(2) || y0 < T(2) || y1 > GH - T(2)) return false;
  for (let ty = Math.floor(y0 / TS); ty <= Math.floor(y1 / TS); ty++) for (let tx = Math.floor(x0 / TS); tx <= Math.floor(x1 / TS); tx++) {
    if (world.solid[ty * WW + tx]) return false;
    const list = world.colGrid.get(ty * WW + tx);
    if (list) for (const i of list) { const c = world.cols[i]; if (x1 > c.x0 && x0 < c.x1 && y1 > c.y0 && y0 < c.y1) return false; }
  }
  return true;
}
