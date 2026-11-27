// 마을 소품(나무·집·분수·가구 …) 그림. 전부 코드로 그린 원본 픽셀 아트.
// 각 그림은 { cv, w, h, ax, ay } — (ax, ay) 는 땅에 닿는 기준점(발밑)이다.
import { Pix, mix, darken, lighten, rng } from './pixel.js';

const WOOD = '#a8683a', WOOD_D = '#7d4b29', WOOD_L = '#c98a52';
const mk = (w, h, draw, { bevel = true, outline = .6, ax = w / 2, ay = h - 1 } = {}) => {
  const p = new Pix(w, h);
  draw(p);
  if (bevel) p.bevel(.14, .2);
  if (outline) p.outline(outline);
  return p.done(ax, ay);
};

/* ---------- 나무 ---------- */
function canopy(p, r, cx, cy, R, palette, count = 9) {
  const [d, m, l, h] = palette;
  const spots = [];
  for (let i = 0; i < count; i++) {
    const a = r() * Math.PI * 2, dist = R * (.25 + r() * .55);
    spots.push([cx + Math.cos(a) * dist * 1.1, cy + Math.sin(a) * dist * .8, R * (.34 + r() * .2)]);
  }
  spots.push([cx, cy, R * .62]);
  spots.forEach(([x, y, rr]) => p.disc(x, y + 2, rr, d));
  spots.forEach(([x, y, rr]) => p.disc(x - 1, y, rr * .92, m));
  spots.forEach(([x, y, rr]) => p.disc(x - 2, y - 2, rr * .66, l));
  for (let i = 0; i < count * 3; i++) {
    const x = cx - R * .8 + r() * R * 1.4, y = cy - R * .8 + r() * R * 1.1;
    p.rect(x, y, 2, 1, h);
  }
}

export function treeGreen(seed = 1, big = false) {
  const r = rng(seed * 977 + 13), W = big ? 72 : 56, H = big ? 70 : 54;
  return mk(W, H, p => {
    const cx = W / 2, tw = big ? 8 : 6;
    p.poly([[cx - tw / 2 - 3, H - 2], [cx - tw / 2, H - 9], [cx + tw / 2, H - 9], [cx + tw / 2 + 3, H - 2]], '#8a5230');
    p.rect(cx - tw / 2, H - 22, tw, 14, '#8a5230'); p.rect(cx - tw / 2, H - 22, 2, 14, '#a8693f');
    canopy(p, r, cx, H - 33, big ? 25 : 20, ['#357f3a', '#4fa845', '#79c456', '#a8e070']);
  }, { ax: W / 2, ay: H - 3 });
}

export function pine(seed = 1) {
  const W = 30, H = 56;
  return mk(W, H, p => {
    p.rect(13, H - 14, 5, 12, '#7d4b29'); p.rect(13, H - 14, 2, 12, '#a8693f');
    const tiers = [[H - 16, 13, 18], [H - 28, 11, 15], [H - 40, 9, 12]];
    const cols = ['#1f6b3d', '#2b8a4a', '#3da35a'];
    tiers.forEach(([y, hw, ht], i) => {
      p.poly([[15, y - ht], [15 + hw, y], [15 - hw, y]], cols[i]);
      p.poly([[15, y - ht], [15 - hw + 2, y - 1], [15 - hw * .1, y - 1]], mix(cols[i], '#c8ffb0', .22));
      p.rect(15 - hw, y - 1, hw * 2, 2, mix(cols[i], '#10301a', .35));
    });
  }, { ax: 15, ay: H - 3 });
}

export function cherryTree(seed = 1, size = 'l') {
  const r = rng(seed * 4099 + 7), big = size === 'l';
  const W = big ? 84 : 60, H = big ? 86 : 66;
  return mk(W, H, p => {
    const cx = W / 2, th = big ? 22 : 15;
    p.poly([[cx - 8, H - 2], [cx - 4, H - th], [cx + 4, H - th], [cx + 9, H - 2]], '#7d4b29');
    p.rect(cx - 4, H - th - 18, 8, 18, '#7d4b29'); p.rect(cx - 4, H - th - 18, 3, 18, '#a8693f');
    p.line(cx, H - th - 10, cx - 14, H - th - 24, '#7d4b29', 3); p.line(cx, H - th - 12, cx + 15, H - th - 26, '#7d4b29', 3);
    canopy(p, r, cx, big ? 34 : 28, big ? 32 : 24, ['#d9709c', '#f08db3', '#ffb3cf', '#ffe4ee'], big ? 12 : 9);
    for (let i = 0; i < (big ? 40 : 24); i++) p.rect(cx - 30 + r() * 60, 6 + r() * 50, 2, 2, r() > .5 ? '#fff3f7' : '#ffd0e0');
  }, { ax: W / 2, ay: H - 3, bevel: false });
}

export function bush(kind = 'plain', seed = 1) {
  const r = rng(seed * 311 + 5), W = 26, H = 20;
  return mk(W, H, p => {
    canopy(p, r, 13, 10, 10, ['#357f3a', '#4fa845', '#79c456', '#a8e070'], 6);
    if (kind === 'berry') for (const [x, y] of [[8, 9], [14, 6], [18, 11], [11, 13], [16, 14]]) { p.disc(x, y, 1.7, '#e5384b'); p.set(x - .5, y - 1, '#ffb3b8'); }
    if (kind === 'flower') for (const [x, y] of [[8, 8], [14, 5], [18, 10], [11, 12]]) { p.disc(x, y, 1.6, '#ff8fb8'); p.set(x, y, '#fff'); }
  }, { ay: H - 2 });
}

export function rock(kind = 0) {
  const sizes = [[22, 16], [32, 22], [14, 11]], [W, H] = sizes[kind % 3];
  return mk(W, H, p => {
    p.ell(W / 2, H * .62, W * .46, H * .36, '#9097a3');
    p.ell(W / 2 - 1, H * .5, W * .4, H * .3, '#b4bac5');
    p.ell(W / 2 - 3, H * .4, W * .22, H * .15, '#d3d8e0');
    p.rect(W * .6, H * .55, 3, 1, '#7c8390');
    if (kind === 1) { p.ell(W * .22, H * .78, W * .16, H * .16, '#9097a3'); p.ell(W * .85, H * .72, W * .14, H * .14, '#8a919d'); }
  }, { ay: H - 1 });
}

/* ---------- 채집 지점 (꽃·열매·나뭇가지·반짝이는 조각) ---------- */
export function flowerPatch(full = true, seed = 1) {
  const W = 20, H = 18, r = rng(seed * 17 + 3);
  return mk(W, H, p => {
    for (const x of [5, 10, 15]) { p.rect(x, 8, 1, 7, '#3f8f3a'); p.poly([[x, 12], [x - 4, 9], [x, 10]], '#5db446'); p.poly([[x, 13], [x + 4, 10], [x, 11]], '#5db446'); }
    if (full) [[5, 6, '#ff7fa6'], [10, 4, '#ffd23f'], [15, 6, '#ff6f91']].forEach(([x, y, c]) => { p.disc(x, y, 3, c); p.disc(x, y, 1.2, '#fff6c8'); });
    else for (const x of [5, 10, 15]) p.disc(x, 7 + (r() > .5 ? 0 : 1), 1.1, '#3f8f3a');
  }, { ay: 16 });
}
export function stickPile(full = true) {
  const W = 20, H = 12;
  return mk(W, H, p => {
    if (!full) { p.set(6, 8, '#6fae3d'); p.set(13, 7, '#6fae3d'); return; }
    p.line(2, 9, 16, 4, '#8a5230', 2); p.line(4, 4, 17, 9, '#a8693f', 2); p.line(6, 7, 14, 10, '#7d4b29', 2);
    p.set(16, 4, '#c98a52'); p.set(3, 4, '#d9a066');
  }, { ay: 11 });
}
export function gemSpot(full = true) {
  const W = 16, H = 18;
  return mk(W, H, p => {
    if (!full) { p.ell(8, 14, 3, 1.5, '#6fae3d'); return; }
    p.poly([[8, 3], [12, 8], [10, 15], [6, 15], [4, 8]], '#a487f2');
    p.poly([[8, 3], [12, 8], [8, 9]], '#d7c6ff'); p.poly([[8, 9], [12, 8], [10, 15]], '#7c5fd6');
    p.set(7, 6, '#fff');
  }, { ay: 16 });
}
export function gemShard(size = 1) { // 가방 아이콘용
  const W = 14, H = 14;
  return mk(W, H, p => { p.poly([[7, 1], [11, 6], [9, 12], [5, 12], [3, 6]], '#a487f2'); p.poly([[7, 1], [11, 6], [7, 7]], '#d7c6ff'); p.poly([[7, 7], [11, 6], [9, 12]], '#7c5fd6'); p.set(6, 4, '#fff'); }, { ay: 12 });
}
export const itemIcon = {
  flower: () => mk(14, 14, p => { p.rect(6, 7, 1, 6, '#3f8f3a'); p.disc(6.5, 5, 3.4, '#ff7fa6'); p.disc(6.5, 5, 1.3, '#fff2b8'); p.poly([[6, 10], [2, 8], [6, 9]], '#5db446'); }),
  berry: () => mk(14, 14, p => { p.poly([[7, 2], [11, 3], [9, 5]], '#4fa845'); for (const [x, y] of [[5, 7], [9, 7], [7, 10]]) { p.disc(x, y, 2.4, '#e5384b'); p.set(x - 1, y - 1, '#ffc0c6'); } }),
  stick: () => mk(14, 14, p => { p.line(2, 11, 11, 2, '#8a5230', 2); p.line(3, 5, 11, 11, '#a8693f', 2); p.set(11, 2, '#d9a066'); }),
  gem: () => gemShard(),
};

export function decoFlowers(seed = 1) {
  const r = rng(seed * 61 + 1), W = 16, H = 10;
  const cols = ['#ffffff', '#ff9bbd', '#ffd23f', '#b99cf5', '#ff7a7a'];
  return mk(W, H, p => {
    for (let i = 0; i < 4; i++) { const x = 2 + r() * 11, y = 3 + r() * 5; p.rect(x, y + 1, 1, 3, '#3f8f3a'); p.disc(x, y, 1.7, r.pick(cols)); p.set(x, y, '#fff7c2'); }
  }, { bevel: false, outline: 0, ay: H - 1 });
}
export function mushroom() { return mk(10, 10, p => { p.rect(4, 5, 3, 4, '#f4e8d0'); p.ell(5.5, 4, 4.5, 3.3, '#e5484d'); p.set(4, 3, '#fff'); p.set(7, 4, '#fff'); }, { ay: 9 }); }

/* ---------- 건물 ---------- */
function roofTiles(p, x0, y0, x1, y1, topInset, color, step = 4) {
  // (x0..x1) 아래 폭, topInset: 맨 위에서 양옆이 줄어드는 정도
  const h = y1 - y0;
  for (let y = y0, i = 0; y < y1; y += step, i++) {
    const t = (y - y0) / h, inset = topInset * (1 - t);
    const lx = x0 + inset, rx = x1 - inset, c = i % 2 ? color : darken(color, .1);
    p.rect(lx, y, rx - lx, step, c);
    p.rect(lx, y, rx - lx, 1, lighten(color, .28));
    for (let x = lx + (i % 2) * 3; x < rx; x += 6) p.rect(x, y + 1, 1, step - 1, darken(color, .28));
  }
}

export function house() {
  const W = 112, H = 96;
  return mk(W, H, p => {
    const wall = '#f6e9cb', beam = '#8a5230';
    p.rect(12, 46, 88, 42, wall);
    p.rect(12, 80, 88, 9, '#b9a487'); for (let x = 12; x < 100; x += 8) p.rect(x + ((x / 8) % 2) * 3, 82, 5, 2, '#9a8568');
    for (const x of [12, 40, 70, 97]) p.rect(x, 46, 3, 36, beam);
    p.rect(12, 62, 88, 3, beam);
    p.rect(12, 46, 88, 3, '#d8c9a8');
    // 문
    p.rect(47, 60, 18, 28, '#9a5f35'); p.ell(56, 61, 9, 6, '#9a5f35');
    for (const x of [50, 54, 58, 62]) p.rect(x, 58, 1, 30, '#7d4b29');
    p.set(62, 74, '#ffd24a'); p.set(62, 75, '#ffd24a');
    p.disc(56, 62, 5, '#3f8f3a'); p.disc(56, 62, 2.6, '#9a5f35');
    for (const [x, y] of [[53, 60], [59, 60], [56, 67], [52, 64], [60, 64]]) p.set(x, y, '#ff6f91');
    p.rect(45, 88, 22, 3, '#d3cbb9'); p.rect(43, 91, 26, 3, '#bdb4a0');
    // 창문 + 꽃상자
    for (const wx of [20, 78]) {
      p.rect(wx - 2, 56, 4, 18, WOOD_D); p.rect(wx + 14, 56, 4, 18, WOOD_D);
      p.rect(wx, 56, 14, 16, '#ffd96b'); p.rect(wx, 56, 14, 5, '#fff2ad');
      p.rect(wx + 6, 56, 2, 16, beam); p.rect(wx, 63, 14, 2, beam);
      p.rect(wx - 3, 72, 20, 5, '#8a5230');
      for (let i = 0; i < 6; i++) p.disc(wx - 1 + i * 3.5, 71, 1.7, ['#ff8fb8', '#b99cf5', '#ffffff'][i % 3]);
      p.rect(wx - 2, 74, 18, 1, '#3f8f3a');
    }
    // 지붕
    p.poly([[24, 8], [88, 8], [112, 48], [0, 48]], '#cf4640');
    roofTiles(p, 0, 8, 112, 48, 24, '#cf4640', 4);
    p.rect(0, 47, 112, 3, '#8c2f33'); p.rect(12, 50, 88, 3, '#d3c3a0');
    // 다락 창
    p.rect(47, 24, 18, 15, wall); p.rect(51, 27, 10, 9, '#ffd96b'); p.rect(55, 27, 2, 9, beam); p.rect(51, 31, 10, 1, beam);
    p.poly([[44, 25], [56, 14], [68, 25]], '#a8342f'); p.rect(44, 25, 24, 2, '#7a2326');
    // 굴뚝
    p.rect(80, 0, 12, 22, '#d6c7a4'); for (let y = 3; y < 22; y += 4) p.rect(80, y, 12, 1, '#a89272'); p.rect(78, 0, 16, 3, '#8a7a62');
    // 등불
    for (const x of [41, 71]) { p.rect(x, 60, 3, 6, '#ffd45a'); p.set(x + 1, 59, '#3d3a46'); }
    // 등나무
    for (let i = 0; i < 16; i++) { const x = 90 + (i % 4) * 4, y = 36 + Math.floor(i / 4) * 8 + (i % 2) * 3; p.disc(x, y, 3, i % 2 ? '#a98bd6' : '#c4a8ee'); p.set(x - 1, y - 1, '#e6d8ff'); }
    for (const [x, y] of [[88, 34], [96, 40], [92, 52]]) p.disc(x, y, 3.4, '#4fa845');
  }, { bevel: true, ax: W / 2, ay: H - 4 });
}

export function shopBuilding() {
  const W = 92, H = 104;
  return mk(W, H, p => {
    const wall = '#f2e6c8', blue = '#4d62a8';
    p.rect(8, 56, 76, 42, wall);
    p.rect(8, 90, 76, 8, '#b9a487'); for (const x of [8, 36, 64, 82]) p.rect(x, 56, 3, 36, '#6e4a8c' && '#7d4b29');
    p.poly([[16, 34], [76, 34], [92, 60], [0, 60]], blue); roofTiles(p, 0, 34, 92, 60, 16, blue, 4); p.rect(0, 59, 92, 3, '#2d3a78');
    // 시계탑
    p.rect(30, 8, 32, 52, '#f6ecd0'); p.rect(30, 8, 3, 52, '#d8c9a8'); p.rect(59, 8, 3, 52, '#d8c9a8');
    p.poly([[27, 12], [46, -2], [65, 12]], '#c4403c'); roofTiles(p, 27, 4, 65, 12, 10, '#c4403c', 2);
    p.disc(46, 28, 11, '#fffdf3'); p.disc(46, 28, 9, '#fffdf3'); p.line(46, 28, 46, 21, '#3a2b20'); p.line(46, 28, 51, 30, '#c4403c');
    for (const [x, y] of [[46, 19], [46, 37], [37, 28], [55, 28]]) p.set(x, y, '#3a2b20');
    p.rect(35, 44, 22, 6, '#e8d9b8');
    // 문과 창
    p.rect(37, 70, 18, 28, '#9a5f35'); p.ell(46, 71, 9, 6, '#9a5f35'); for (const x of [41, 45, 49]) p.rect(x, 68, 1, 30, '#7d4b29'); p.set(52, 85, '#ffd24a');
    for (const wx of [13, 63]) { p.rect(wx, 68, 16, 14, '#ffd96b'); p.rect(wx + 7, 68, 2, 14, '#8a5230'); p.rect(wx - 2, 66, 20, 2, '#8a5230'); }
    // 줄무늬 차양
    for (const ax of [11, 61]) for (let i = 0; i < 10; i++) { p.rect(ax + i * 2, 60, 2, 6, i % 2 ? '#ffffff' : '#ef7ea3'); }
    // 간판 (동전)
    p.rect(78, 66, 2, 12, '#3d3a46'); p.disc(84, 72, 5, '#ffcf3d'); p.disc(84, 72, 3, '#e8a900'); p.set(83, 70, '#fff3a8');
    for (const x of [8, 78]) { p.rect(x, 96, 10, 4, '#8a5230'); for (let i = 0; i < 4; i++) p.disc(x + 2 + i * 2.5, 95, 1.6, ['#ff8fb8', '#ffd23f', '#fff', '#b99cf5'][i]); }
  }, { ax: W / 2, ay: H - 4 });
}

export function stall(kind = 0) {
  const W = 44, H = 44, pal = [['#ef7ea3', '#ffffff'], ['#f2b84b', '#ffffff'], ['#6fb6e8', '#ffffff']][kind % 3];
  return mk(W, H, p => {
    p.rect(5, 12, 3, 30, WOOD_D); p.rect(36, 12, 3, 30, WOOD_D);
    p.rect(4, 30, 36, 11, WOOD); p.rect(4, 30, 36, 2, WOOD_L); p.rect(4, 36, 36, 1, WOOD_D);
    const goods = [['#e5384b', '#ffd23f', '#7ac74f'], ['#e8b87a', '#c98a52', '#f6dfa8'], ['#ff9f43', '#ffd23f', '#e5384b']][kind % 3];
    for (let i = 0; i < 6; i++) p.disc(9 + i * 5.2, 27, 2.6, goods[i % 3]);
    p.poly([[2, 4], [42, 4], [44, 16], [0, 16]], pal[0]);
    for (let i = 0; i < 11; i++) if (i % 2) p.rect(2 + i * 3.7 - (i * .1), 4, 4, 12, pal[1]);
    for (let i = 0; i < 11; i++) p.disc(2 + i * 4, 17, 2, i % 2 ? pal[1] : pal[0]);
  }, { ay: H - 3 });
}

export function fountain(frame = 0) {
  const W = 64, H = 56;
  return mk(W, H, p => {
    p.ell(32, 42, 30, 13, '#a99f90'); p.ell(32, 40, 30, 13, '#cfc6b6'); p.ell(32, 41, 25, 10, '#4aaee8'); p.ell(32, 40, 25, 10, '#62c2f2');
    p.ell(32, 41, 18, 6.5, '#8bd7f7');
    p.rect(28, 20, 8, 20, '#c9c0af'); p.rect(28, 20, 3, 20, '#e2dac9');
    p.ell(32, 22, 13, 5, '#cfc6b6'); p.ell(32, 22, 10, 3.4, '#5fc0f0');
    p.rect(30, 8, 4, 12, '#c9c0af'); p.disc(32, 7, 3.4, '#e2dac9');
    const d = frame ? 1 : 0;
    p.line(32, 6, 24, 14 + d, '#bfe9fb'); p.line(32, 6, 40, 14 + d, '#bfe9fb'); p.line(32, 6, 32, 3, '#ffffff');
    p.line(26, 20, 16, 30 + d, '#9edcf7'); p.line(38, 20, 48, 30 + d, '#9edcf7');
    for (const [x, y] of [[22, 13 + d * 2], [42, 12 + d * 2], [14, 28 + d], [50, 28 + d], [32, 1 + d]]) p.rect(x, y, 2, 2, '#e8f8ff');
  }, { ay: H - 2 });
}

export function lamp() {
  const W = 14, H = 40;
  return mk(W, H, p => {
    p.rect(6, 14, 3, 24, '#3a3744'); p.rect(3, 35, 9, 4, '#2c2a35'); p.rect(4, 12, 7, 3, '#2c2a35');
    p.rect(2, 2, 11, 11, '#ffd45a'); p.rect(3, 3, 4, 8, '#fff2a8'); p.rect(2, 2, 11, 1, '#3a3744'); p.rect(2, 12, 11, 1, '#3a3744'); p.rect(7, 2, 1, 11, '#3a3744');
    p.poly([[1, 3], [7, -1], [13, 3]], '#2c2a35');
  }, { bevel: false, ay: H - 2, ax: 7 });
}

export function bench(color = 0) {
  const W = 30, H = 22, w = color ? '#c98a52' : '#a8683a';
  return mk(W, H, p => {
    p.rect(3, 5, 24, 4, w); p.rect(3, 5, 24, 1, lighten(w, .3)); p.rect(3, 10, 24, 3, w); p.rect(3, 14, 24, 4, darken(w, .12));
    p.rect(2, 3, 2, 17, '#3a3744'); p.rect(26, 3, 2, 17, '#3a3744'); p.rect(4, 17, 2, 4, '#3a3744'); p.rect(24, 17, 2, 4, '#3a3744');
  }, { ay: H - 2 });
}

export function pot(seed = 1) {
  const W = 18, H = 22, r = rng(seed * 19 + 2);
  return mk(W, H, p => {
    for (let i = 0; i < 5; i++) { const x = 4 + i * 2.6, y = 3 + (i % 2) * 3 + r() * 2; p.rect(x, y + 3, 1, 6, '#3f8f3a'); p.disc(x, y, 2.4, ['#ff7fa6', '#ffd23f', '#ff9bbd', '#fff', '#b99cf5'][i]); p.set(x, y, '#fff3b0'); }
    p.poly([[3, 11], [15, 11], [13, 20], [5, 20]], '#c4683c'); p.rect(2, 10, 14, 3, '#d9824e'); p.rect(3, 11, 12, 1, '#efa070');
  }, { ay: H - 2 });
}

export function cushion() {
  const W = 26, H = 14;
  return mk(W, H, p => {
    p.ell(13, 8, 11.5, 5.2, '#f7a8c6'); p.ell(13, 7, 9.5, 4, '#ffc9dd'); p.ell(13, 7, 5, 2.2, '#f08db3');
    p.disc(13, 7, 1.2, '#fff'); p.rect(1, 7, 2, 4, '#ffe29a'); p.rect(23, 7, 2, 4, '#ffe29a');
  }, { ay: H - 2 });
}

export function doghouse() {
  const W = 44, H = 40;
  return mk(W, H, p => {
    p.rect(6, 18, 32, 20, '#c98a52'); p.rect(6, 18, 32, 2, '#e0a76e');
    for (const x of [14, 22, 30]) p.rect(x, 20, 1, 18, '#a8683a');
    p.poly([[22, 2], [44, 20], [0, 20]], '#cf4640'); roofTiles(p, 0, 4, 44, 20, 20, '#cf4640', 3);
    p.rect(14, 22, 16, 16, '#4a2f27'); p.ell(22, 24, 8, 4, '#4a2f27'); p.ell(22, 35, 6.5, 2.4, '#f7a8c6');
    p.disc(22, 14, 2.4, '#fff3e0'); p.set(21, 13, '#a8683a'); p.set(23, 13, '#a8683a'); p.set(22, 15, '#a8683a');
  }, { ay: H - 2 });
}

export function noticeBoard() {
  const W = 34, H = 40;
  return mk(W, H, p => {
    p.rect(5, 14, 3, 24, WOOD_D); p.rect(26, 14, 3, 24, WOOD_D);
    p.rect(2, 4, 30, 22, WOOD); p.rect(2, 4, 30, 2, WOOD_L); p.rect(4, 7, 26, 17, '#f6e9cb');
    p.rect(7, 9, 9, 7, '#fff'); p.rect(18, 10, 9, 6, '#ffe29a'); p.rect(8, 18, 16, 1, '#a8683a'); p.rect(8, 21, 12, 1, '#a8683a');
    p.disc(11, 9, 1, '#e5384b'); p.disc(22, 10, 1, '#4fa845');
    p.poly([[0, 4], [17, -1], [34, 4]], WOOD_D);
  }, { ay: H - 2 });
}

export function mailbox() {
  return mk(16, 30, p => {
    p.rect(7, 14, 3, 14, WOOD_D); p.rect(2, 4, 12, 11, '#d94b4b'); p.ell(8, 5, 6, 3, '#e86a6a'); p.rect(2, 11, 12, 1, '#a82b2b');
    p.rect(10, 1, 2, 5, '#e5384b'); p.rect(10, 1, 4, 2, '#e5384b');
    p.disc(7, 9, 1.4, '#fff'); p.set(5, 7, '#fff'); p.set(9, 7, '#fff');
  }, { ay: 28 });
}

// 준비 중 표지판 (노랑·검정 줄무늬)
export function signPost(kind = 'wip') {
  const W = 38, H = 40;
  return mk(W, H, p => {
    p.rect(17, 14, 4, 24, WOOD_D);
    p.rect(3, 4, 32, 14, '#ffd23f');
    for (let x = 3; x < 35; x += 8) p.poly([[x, 4], [x + 4, 4], [x + 1, 18], [x - 3, 18]], '#2c2a35');
    p.rect(3, 4, 32, 14, 'rgba(0,0,0,0)'); p.rect(4, 6, 30, 10, '#fff3b0'); p.rect(9, 8, 20, 2, '#2c2a35'); p.rect(12, 12, 14, 2, '#2c2a35');
    p.rect(3, 4, 32, 1, '#fff'); p.rect(3, 17, 32, 1, '#c99700');
  }, { ay: H - 2 });
}

export function haystack() { return mk(26, 20, p => { p.ell(13, 12, 12, 7, '#e8c46a'); p.ell(13, 9, 10, 5, '#f4d985'); for (let i = 0; i < 8; i++) p.rect(3 + i * 2.8, 6 + (i % 3) * 3, 2, 1, '#c99a3a'); }, { ay: 18 }); }
export function scarecrow() {
  return mk(24, 40, p => {
    p.rect(11, 14, 3, 24, WOOD_D); p.rect(2, 18, 20, 3, WOOD_D);
    p.rect(7, 16, 11, 12, '#5a8fd0'); p.rect(7, 16, 11, 2, '#7aaee8'); p.rect(3, 16, 4, 4, '#5a8fd0'); p.rect(18, 16, 4, 4, '#5a8fd0');
    p.disc(12.5, 11, 5, '#f4d985'); p.rect(10, 9, 1, 2, '#3a2b20'); p.rect(14, 9, 1, 2, '#3a2b20'); p.rect(11, 13, 3, 1, '#c75b5b');
    p.ell(12.5, 6.5, 9, 2.6, '#e0b050'); p.ell(12.5, 4, 5, 3.6, '#e0b050'); p.rect(8, 5, 9, 1, '#d94b4b');
  }, { ay: 38 });
}
export function windmill() {
  const W = 76, H = 84;
  return mk(W, H, p => {
    p.poly([[22, 80], [54, 80], [48, 34], [28, 34]], '#f2e2bd'); for (let y = 40; y < 80; y += 6) p.rect(24 + (y - 40) * .1, y, 28 - (y - 40) * .2, 1, '#cdb88c');
    p.rect(22, 76, 32, 5, '#b9a487');
    p.poly([[24, 36], [52, 36], [38, 14]], '#c9433f'); roofTiles(p, 24, 22, 52, 36, 8, '#c9433f', 3);
    p.rect(33, 58, 10, 22, '#9a5f35'); p.rect(31, 44, 5, 7, '#ffd96b'); p.rect(40, 44, 5, 7, '#ffd96b');
    const c = [38, 24];
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; const ex = c[0] + Math.cos(a) * 28, ey = c[1] + Math.sin(a) * 28; p.line(c[0], c[1], ex, ey, '#8a5230', 2); const mx = c[0] + Math.cos(a) * 15, my = c[1] + Math.sin(a) * 15; p.poly([[c[0] + Math.cos(a) * 6, c[1] + Math.sin(a) * 6], [ex, ey], [ex + Math.cos(a + 1.57) * 7, ey + Math.sin(a + 1.57) * 7], [mx + Math.cos(a + 1.57) * 7, my + Math.sin(a + 1.57) * 7]], '#fff3dc'); }
    p.disc(c[0], c[1], 3, '#6b3d22');
  }, { ay: 82 });
}
export function mineEntrance() {
  const W = 92, H = 78;
  return mk(W, H, p => {
    p.ell(46, 52, 46, 28, '#8a8f9b'); p.ell(46, 46, 42, 24, '#a4a9b5'); p.ell(36, 38, 22, 12, '#c0c5ce');
    p.rect(26, 36, 40, 42, '#2a2230'); p.ell(46, 36, 20, 12, '#2a2230');
    p.rect(22, 30, 5, 48, WOOD_D); p.rect(65, 30, 5, 48, WOOD_D); p.rect(22, 28, 48, 6, WOOD); p.rect(22, 28, 48, 1, WOOD_L);
    for (const x of [30, 58]) { p.rect(x, 22, 4, 7, '#ffd45a'); p.set(x + 1, 21, '#3d3a46'); }
    for (const [x, y, s] of [[10, 52, 1], [78, 56, 1], [16, 62, 0], [74, 44, 0]]) { p.poly([[x, y], [x + 3, y - 10 - s * 4], [x + 6, y]], '#b79af7'); p.poly([[x + 2, y], [x + 3, y - 10 - s * 4], [x + 4, y]], '#e2d3ff'); }
    p.rect(30, 70, 32, 2, '#5a4f60'); for (let x = 30; x < 62; x += 6) p.rect(x, 68, 2, 6, '#7d4b29');
  }, { ay: H - 4 });
}
export function minecart() { return mk(30, 22, p => { p.rect(3, 6, 24, 11, '#6b5a4a'); p.rect(3, 6, 24, 2, '#8a7560'); p.disc(8, 19, 3, '#3a3744'); p.disc(22, 19, 3, '#3a3744'); p.disc(9, 5, 3, '#b79af7'); p.disc(16, 4, 3.4, '#d7c6ff'); p.disc(22, 5, 3, '#a487f2'); }, { ay: 21 }); }

/* ---------- 울타리 (타일 단위) ---------- */
export function fenceH(wood = false) {
  const W = 16, H = 22, c = wood ? '#c98a52' : '#f4efe4', cd = wood ? '#8a5230' : '#cfc7b6';
  return mk(W, H, p => {
    for (const x of [1, 6, 11]) { p.rect(x, 6, 4, 14, c); p.poly([[x, 6], [x + 4, 6], [x + 2, 3]], c); p.rect(x + 3, 6, 1, 14, cd); }
    p.rect(0, 10, 16, 2, cd); p.rect(0, 15, 16, 2, cd);
  }, { bevel: false, ay: 20 });
}
export function fenceV(wood = false) {
  const W = 16, H = 16, c = wood ? '#c98a52' : '#f4efe4', cd = wood ? '#8a5230' : '#cfc7b6';
  return mk(W, H, p => { p.rect(7, 0, 2, 16, cd); for (const y of [1, 9]) { p.rect(5, y, 6, 6, c); p.rect(5, y + 5, 6, 1, cd); } }, { bevel: false, ay: 15 });
}
