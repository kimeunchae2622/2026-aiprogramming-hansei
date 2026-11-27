// 주인공과 반려동물 스프라이트(걷기 프레임 포함). 모두 코드로 그린 원본 픽셀 아트.
// 캐릭터는 마을 그래픽보다 2배 촘촘한 픽셀로 그려서(표정·머리결·털 표현) 화면에는 0.5배로 찍는다.
import { Pix, mix, darken, lighten } from './pixel.js';

export const CHAR_SCALE = 0.5; // 스프라이트 1칸 = 월드 반 칸

/* 짜임 무늬: 타원 안쪽에 한 칸 건너 점을 찍어 밀짚 질감을 만든다 */
function weave(p, cx, cy, rx, ry, c, step = 2) {
  for (let y = Math.floor(cy - ry); y < cy + ry; y++) for (let x = Math.floor(cx - rx); x < cx + rx; x++) {
    if (((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 > .94) continue;
    if ((x + (y >> 1)) % step === 0 && y % 2 === 0) p.set(x, y, c);
  }
}

/* ======================= 주인공 (밀짚모자 소녀) ======================= */
const BASE = {
  skin: '#ffe1c2', skinD: '#efb994', blush: '#ff9fae',
  hair: '#8c5232', hairD: '#5f3520', hairL: '#b87a4a',
  hat: '#f1cf7b', hatD: '#cda24b', hatL: '#fbe9ab', weave: '#dfb95e',
  rib: '#d83c3c', ribD: '#a02530', ribL: '#f06a62',
  dress: '#e65b73', dressD: '#b9405a', dressL: '#f78ca1',
  white: '#fff7e8', whiteD: '#e6d6bb',
  boot: '#7a4527', bootL: '#a56a41', eye: '#3a2118', iris: '#7a4a28',
};
let C = BASE; // 그리는 동안만 외형 설정으로 바뀐다
const P_W = 52, P_H = 72, P_AX = 26, P_AY = 66;

// 주인공 외형 선택지 (나중에 의상·액세서리를 같은 방식으로 늘릴 수 있다)
export const LOOKS = {
  style: { short: { name: '짧은 머리' }, long: { name: '긴 머리' }, tied: { name: '묶은 머리' } },
  hair: { black: { name: '검정', hair: '#3b3340', hairD: '#241d29', hairL: '#6a5d78' }, brown: { name: '갈색', hair: '#8c5232', hairD: '#5f3520', hairL: '#b87a4a' }, lightbrown: { name: '밝은 갈색', hair: '#b98350', hairD: '#8a5a30', hairL: '#dcae7c' }, blonde: { name: '금발', hair: '#d9a441', hairD: '#a8751f', hairL: '#f2cd7a' } },
  skin: { fair: { name: '하얀', skin: '#ffe9d6', skinD: '#f1c9aa' }, light: { name: '밝은', skin: '#ffe1c2', skinD: '#efb994' }, tan: { name: '구릿빛', skin: '#e8b88a', skinD: '#c98f62' }, deep: { name: '짙은', skin: '#b9774f', skinD: '#965a37' } },
  glasses: { none: { name: '없음' }, round: { name: '둥근 안경' }, horn: { name: '뿔테 안경' } },
  gcolor: { black: { name: '검정', gl: '#2b2733' }, gray: { name: '회색', gl: '#8d939c' }, brown: { name: '갈색', gl: '#7a4a2b' } },
  dress: { pink: { name: '분홍', dress: '#e65b73', dressD: '#b9405a', dressL: '#f78ca1' }, blue: { name: '파랑', dress: '#4f8fe0', dressD: '#346cb8', dressL: '#86b6f2' }, green: { name: '초록', dress: '#4fae6a', dressD: '#358a4e', dressL: '#85d09b' }, yellow: { name: '노랑', dress: '#f0b429', dressD: '#c4881a', dressL: '#f8d36a' } },
};
export const DEFAULT_LOOK = { style: 'long', hair: 'brown', skin: 'light', glasses: 'none', gcolor: 'black', dress: 'pink' };
export const normLook = l => { const o = { ...DEFAULT_LOOK }; for (const k of Object.keys(DEFAULT_LOOK)) if (l && LOOKS[k] && LOOKS[k][l[k]]) o[k] = l[k]; return o; };
const lookKey = l => { const n = normLook(l); return Object.keys(DEFAULT_LOOK).map(k => n[k]).join('-'); };
const palette = l => { const n = normLook(l); return { ...BASE, ...LOOKS.hair[n.hair], ...LOOKS.dress[n.dress], ...LOOKS.skin[n.skin], gl: LOOKS.gcolor[n.gcolor].gl }; };
function glassesFront(p, kind, y0) {
  if (kind === 'none') return; const g = C.gl;
  for (const x of [20, 32]) { if (kind === 'round') { p.disc(x, 34 + y0, 5.4, g); p.disc(x, 34 + y0, 3.9, C.skin); } else { p.rect(x - 5.5, 30 + y0, 11, 8, g); p.rect(x - 4, 31.5 + y0, 8, 5, C.skin); } }
  p.rect(25, 33 + y0, 2, 1.5, g);
}
function glassesSide(p, kind, y0) {
  if (kind === 'none') return; const g = C.gl;
  if (kind === 'round') { p.disc(18, 34 + y0, 5.4, g); p.disc(18, 34 + y0, 3.9, C.skin); } else { p.rect(12.5, 30 + y0, 11, 8, g); p.rect(14, 31.5 + y0, 8, 5, C.skin); }
  p.rect(23, 33 + y0, 9, 1.5, g);
}

function hairWaves(p, x0, x1, y, count, color) { // 머리끝 물결
  for (let i = 0; i < count; i++) p.disc(x0 + (x1 - x0) * i / (count - 1), y + (i % 2) * 2, 3.2, color);
}

function hatBlock(p, cx, cy, tilt = 0, side = false) {
  // 챙
  p.ell(cx, cy + 2.4, 23, 7, C.hatD);
  p.ell(cx, cy, 23, 7, C.hat);
  p.ell(cx - 3, cy - 1.6, 15, 3.2, C.hatL);
  weave(p, cx, cy, 22, 6.6, C.weave);
  // 머리 부분
  p.ell(cx, cy - 5, 13.2, 10, C.hat);
  p.ell(cx - 3, cy - 8.2, 8.6, 5.6, C.hatL);
  weave(p, cx, cy - 5, 12.6, 9.4, C.weave);
  // 리본 띠
  p.poly([[cx - 13.4, cy - 3.2], [cx + 13.4, cy - 3.2], [cx + 14, cy + 1.6], [cx - 14, cy + 1.6]], C.rib);
  p.rect(cx - 14, cy + 0.6, 28, 1.6, C.ribD); p.rect(cx - 13, cy - 3, 26, 1, C.ribL);
}

function bowAt(p, x, y, big = 1) {
  p.poly([[x, y], [x - 8 * big, y - 5 * big], [x - 8 * big, y + 5 * big]], C.rib);
  p.poly([[x, y], [x + 8 * big, y - 5 * big], [x + 8 * big, y + 5 * big]], C.rib);
  p.poly([[x - 3, y + 1], [x - 6 * big, y + 10 * big], [x - 1, y + 8 * big]], C.ribD);
  p.poly([[x + 3, y + 1], [x + 6 * big, y + 10 * big], [x + 1, y + 8 * big]], C.ribD);
  p.disc(x, y, 2.6 * big, C.ribD); p.set(x - 1, y - 1, C.ribL);
}

function flowersAt(p, x, y) {
  p.poly([[x + 2, y + 4], [x - 6, y + 2], [x, y + 8]], '#4fa845'); p.poly([[x + 4, y + 4], [x + 10, y + 7], [x + 2, y + 9]], '#3f8f3a');
  for (const [dx, dy, c] of [[-2, 0, '#ff8fb5'], [4, -2, '#fff'], [3, 4, '#ff6f9a']]) {
    for (let a = 0; a < 5; a++) p.disc(x + dx + Math.cos(a * 1.257) * 2.2, y + dy + Math.sin(a * 1.257) * 2.2, 1.7, c);
    p.disc(x + dx, y + dy, 1.5, '#ffe27a');
  }
}

function player(dir, frame, look) {
  C = palette(look);
  const { style: hs, glasses: gl } = normLook(look);
  const p = new Pix(P_W, P_H);
  const walk = frame === 1 || frame === 2;
  const bob = walk ? -1 : 0;
  const lift = [frame === 1 ? 2 : 0, frame === 2 ? 2 : 0];
  const arm = [frame === 1 ? 2 : frame === 2 ? -2 : 0, frame === 2 ? 2 : frame === 1 ? -2 : 0];

  const boots = (side = false) => {
    if (side) {
      const sw = frame === 1 ? -4 : frame === 2 ? 4 : 0;
      for (const o of [sw, -sw]) {
        p.rect(23 + o, 54, 6, 8, C.white); p.rect(22 + o, 60, 9, 6, C.boot); p.rect(22 + o, 60, 9, 1, C.bootL);
        p.rect(21 + o, 64, 10, 2, '#4a2a17');
      }
      return;
    }
    [[19, 0], [29, 1]].forEach(([x, i]) => {
      p.rect(x, 56 - lift[i], 6, 6, C.white); p.rect(x, 61 - lift[i], 6, 1, C.whiteD);
      p.rect(x - 1, 61 - lift[i], 8, 6, C.boot); p.rect(x - 1, 61 - lift[i], 8, 1, C.bootL); p.rect(x - 1, 66 - lift[i], 8, 1, '#4a2a17');
      p.set(x + 2, 63 - lift[i], C.bootL); p.set(x + 4, 63 - lift[i], C.bootL);
    });
  };

  const y0 = bob;
  if (dir === 'down') {
    if (hs === 'long') { p.ell(26, 38 + y0, 16.5, 16, C.hair); hairWaves(p, 11, 41, 52 + y0, 6, C.hair); } else { p.ell(26, 31 + y0, 15, 10, C.hair); if (hs === 'tied') { p.ell(8, 43 + y0, 4.2, 8, C.hair); p.ell(44, 43 + y0, 4.2, 8, C.hair); p.disc(9, 35 + y0, 2.4, C.rib); p.disc(43, 35 + y0, 2.4, C.rib); } }
    boots();
    // 원피스 + 앞치마
    p.poly([[18, 40 + y0], [34, 40 + y0], [38, 47 + y0], [43, 60], [9, 60], [14, 47 + y0]], C.dress);
    p.poly([[20, 42 + y0], [32, 42 + y0], [35, 49 + y0], [38, 59], [14, 59], [17, 49 + y0]], C.dressL);
    p.rect(21, 42 + y0, 10, 8, C.dress); p.rect(20, 39 + y0, 3, 5, C.dress); p.rect(29, 39 + y0, 3, 5, C.dress);
    p.rect(9, 57, 34, 3, C.dressD);
    for (let x = 10; x < 43; x += 3) p.disc(x, 61, 1.9, C.white);
    p.rect(30, 51 + y0, 8, 6, C.dressD); p.rect(30, 51 + y0, 8, 1, C.dressL); p.rect(31, 55 + y0, 6, 1, C.dress);
    p.set(26, 46 + y0, '#ffd24a'); p.set(26, 50 + y0, '#ffd24a');
    p.poly([[22, 38 + y0], [30, 38 + y0], [26, 44 + y0]], C.white);
    // 소매와 팔
    for (const [x, a] of [[12, arm[0]], [40, arm[1]]]) {
      p.ell(x, 43 + y0, 6, 5.4, C.white); p.ell(x, 45 + y0, 5.4, 3, C.whiteD); p.ell(x - 1, 41 + y0, 4, 2.4, '#fff');
      p.rect(x - 2, 47 + y0, 4, 6 + a, C.skin); p.disc(x, 54 + y0 + a, 2.6, C.skin);
    }
    // 얼굴
    p.ell(26, 33 + y0, 13.4, 11.6, C.skinD); p.ell(26, 32 + y0, 13, 11.2, C.skin);
    p.ell(18, 37 + y0, 3.2, 1.9, C.blush); p.ell(34, 37 + y0, 3.2, 1.9, C.blush);
    glassesFront(p, gl, y0);
    for (const x of [20, 32]) {
      p.ell(x, 34 + y0, 2.5, 3.6, C.eye); p.ell(x, 35 + y0, 1.5, 2.2, C.iris);
      p.rect(x - 2, 32 + y0, 2, 2, '#fff'); p.set(x + 1, 36 + y0, '#fff');
    }
    p.line(17, 30 + y0, 22, 29 + y0, C.hairD); p.line(30, 29 + y0, 35, 30 + y0, C.hairD);
    p.set(26, 37 + y0, '#e8a890'); p.line(24, 40 + y0, 28, 40 + y0, '#c9605e'); p.set(23, 39 + y0, '#c9605e'); p.set(29, 39 + y0, '#c9605e');
    // 앞머리와 옆머리
    p.ell(26, 24 + y0, 15, 7, C.hair);
    p.poly([[12, 25 + y0], [21, 33 + y0], [25, 25 + y0]], C.hair); p.poly([[22, 25 + y0], [28, 31 + y0], [32, 25 + y0]], C.hair); p.poly([[29, 25 + y0], [39, 33 + y0], [41, 25 + y0]], C.hair);
    const sl = hs === 'long' ? 22 : hs === 'tied' ? 11 : 9; p.rect(11, 25 + y0, 4, sl, C.hair); p.rect(37, 25 + y0, 4, sl, C.hair);
    for (const [x1, y1, x2, y2] of [[16, 23, 14, 34], [23, 22, 21, 30], [34, 23, 36, 33], ...(hs === 'long' ? [[13, 36, 13, 46], [39, 36, 39, 46]] : [])]) p.line(x1, y1 + y0, x2, y2 + y0, C.hairL);
    hatBlock(p, 26, 19 + y0);
    bowAt(p, 12, 18 + y0, .8); flowersAt(p, 10, 12 + y0);
  } else if (dir === 'up') {
    if (hs === 'long') { p.ell(26, 38 + y0, 17, 19, C.hair); hairWaves(p, 11, 41, 55 + y0, 6, C.hair); for (const [x1, y1, x2, y2] of [[18, 30, 17, 52], [26, 28, 26, 54], [34, 30, 35, 52]]) p.line(x1, y1 + y0, x2, y2 + y0, C.hairL); } else { p.ell(26, 31 + y0, 16, 12, C.hair); if (hs === 'tied') { p.ell(12, 44 + y0, 4.4, 9, C.hair); p.ell(40, 44 + y0, 4.4, 9, C.hair); p.disc(12, 35 + y0, 2.4, C.rib); p.disc(40, 35 + y0, 2.4, C.rib); } }
    boots();
    p.poly([[18, 41 + y0], [34, 41 + y0], [38, 48 + y0], [43, 60], [9, 60], [14, 48 + y0]], C.dress);
    p.rect(9, 57, 34, 3, C.dressD); for (let x = 10; x < 43; x += 3) p.disc(x, 61, 1.9, C.white);
    bowAt(p, 26, 50 + y0, 1.2);
    for (const [x, a] of [[12, arm[1]], [40, arm[0]]]) { p.ell(x, 43 + y0, 6, 5.4, C.white); p.ell(x, 45 + y0, 5.4, 3, C.whiteD); p.rect(x - 2, 47 + y0, 4, 6 + a, C.skin); p.disc(x, 54 + y0 + a, 2.6, C.skin); }
    p.ell(26, 27 + y0, 14, 11, C.hair);
    hatBlock(p, 26, 19 + y0);
    bowAt(p, 26, 22 + y0, 1.5); flowersAt(p, 40, 12 + y0);
  } else { // left
    p.ell(32, 30 + y0, 11, 11, C.hair);
    if (hs === 'long') { p.ell(34, 38 + y0, 8.5, 17, C.hair); hairWaves(p, 27, 40, 52 + y0, 4, C.hair); p.line(33, 30 + y0, 35, 50 + y0, C.hairL); } else if (hs === 'tied') { p.ell(40, 40 + y0, 4.6, 9, C.hair); p.disc(39, 32 + y0, 2.4, C.rib); }
    boots(true);
    p.poly([[19, 41 + y0], [32, 41 + y0], [38, 60], [14, 60]], C.dress);
    p.poly([[21, 43 + y0], [31, 43 + y0], [35, 59], [17, 59]], C.dressL);
    p.rect(14, 57, 24, 3, C.dressD); for (let x = 15; x < 38; x += 3) p.disc(x, 61, 1.9, C.white);
    p.rect(27, 51 + y0, 7, 5, C.dressD); p.set(22, 46 + y0, '#ffd24a');
    p.poly([[21, 39 + y0], [26, 39 + y0], [22, 44 + y0]], C.white);
    const a = frame === 1 ? -3 : frame === 2 ? 3 : 0;
    p.ell(25 + a * .3, 44 + y0, 5.6, 5.2, C.white); p.ell(25 + a * .3, 46 + y0, 5, 2.8, C.whiteD);
    p.rect(23 + a * .8, 48 + y0, 4, 6, C.skin); p.disc(25 + a, 55 + y0, 2.6, C.skin);
    p.ell(24, 33 + y0, 12, 11.4, C.skinD); p.ell(24, 32 + y0, 11.6, 11, C.skin);
    p.disc(12, 35 + y0, 1.4, C.skinD);
    p.ell(16, 37 + y0, 3, 1.8, C.blush);
    glassesSide(p, gl, y0);
    p.ell(18, 34 + y0, 2.3, 3.5, C.eye); p.ell(18, 35 + y0, 1.4, 2.1, C.iris); p.rect(16.5, 32 + y0, 2, 2, '#fff'); p.set(19, 36 + y0, '#fff');
    p.line(15, 30 + y0, 20, 29 + y0, C.hairD);
    p.line(14, 40 + y0, 17, 40 + y0, '#c9605e');
    p.ell(27, 25 + y0, 13, 7, C.hair); p.poly([[14, 26 + y0], [20, 32 + y0], [26, 26 + y0]], C.hair); p.rect(28, 25 + y0, 8, 16, C.hair);
    p.line(20, 23 + y0, 18, 30 + y0, C.hairL);
    hatBlock(p, 26, 19 + y0, 0, true);
    bowAt(p, 42, 20 + y0, .9); flowersAt(p, 12, 13 + y0);
  }
  p.bevel(.14, .2).outline(.58);
  C = BASE;
  return p.done(P_AX, P_AY);
}

/* ======================= 반려동물 ======================= */
export const FUR = {
  black: { base: '#3f3f4a', belly: '#9d9dac', ink: '#fff' },
  white: { base: '#fbf6ec', belly: '#f2e8d6', ink: '#3a2b20' },
  brown: { base: '#9c6b46', belly: '#ebd5b3', ink: '#fff' },
  yellow: { base: '#f0b45c', belly: '#fff5e2', ink: '#3a2b20' },
  gray: { base: '#9ca3ab', belly: '#f0f2f4', ink: '#2f3338' },
};
const EAR_IN = '#f5a9a9', NOSE = '#2e1e22', COLLAR = '#d94b4b', BELL = '#ffd24a', EYE = '#241512';
const PW = 64, PH = 52, PAX = 32, PAY = 47;

/* ---------- 반려동물 외형 선택지 (게임 안에서만 쓰는 모습. 앱의 반려동물 정보는 건드리지 않는다) ---------- */
const NOSES = { black: '#2e1e22', brown: '#6b4030', pink: '#f08a94' };
const IRIS = { dark: null, brown: '#8a5a34', blue: '#5aa9ff', green: '#5ec27a' };
export const PET_OPTS = {
  kind: { dog: '강아지', cat: '고양이' },
  color: { black: '검정', white: '하양', brown: '갈색', yellow: '황색', gray: '회색' },
  coat: { short: '짧은 털', long: '긴 털' },
  fur: { straight: '직모', curly: '곱슬' },
  pattern: { plain: '무늬 없음', stripes: '줄무늬', spots: '점무늬' },
  eye: { dark: '검은 눈', brown: '갈색 눈', blue: '파란 눈', green: '초록 눈' },
  nose: { black: '검정 코', brown: '갈색 코', pink: '분홍 코' },
  ear: { up: '쫑긋한 귀', down: '처진 귀' },
  tail: { short: '짧은 꼬리', long: '긴 꼬리' },
  acc: { none: '장식 없음', collar: '목걸이', ribbon: '리본', scarf: '스카프' },
};
export function normPetLook(l, species) {
  const cat = species === 'cat' || (l && l.kind === 'cat');
  const d = { kind: cat ? 'cat' : 'dog', color: cat ? 'gray' : 'yellow', fur: 'straight', coat: 'short', pattern: cat ? 'stripes' : 'plain', eye: 'dark', nose: cat ? 'pink' : 'black', ear: 'up', tail: cat ? 'long' : 'short', acc: 'collar' };
  const o = { ...d };
  for (const k of Object.keys(d)) if (l && PET_OPTS[k] && PET_OPTS[k][l[k]]) o[k] = l[k];
  return o;
}

function eyeAt(p, x, y, ink, happy, iris) {
  if (happy) { p.line(x - 3, y + 1, x - 1, y - 1, '#2a1c18', 1); p.line(x - 1, y - 1, x + 1, y - 1, '#2a1c18', 1); p.line(x + 1, y - 1, x + 3, y + 1, '#2a1c18', 1); return; }
  p.ell(x, y, 2.4, 3, EYE);
  if (iris) p.ell(x, y + .6, 1.7, 2.2, iris);
  p.rect(x - 1.6, y - 2, 1.8, 1.8, '#fff'); p.set(x + 1, y + 1.4, '#ffffff'); if (!iris) p.set(x, y + 2, '#6a4a3a');
}

function drawAcc(p, acc, view, x, y) {
  if (acc === 'collar') { if (view === 'h') { p.rect(x - 11, y - 2, 22, 4, COLLAR); p.disc(x, y + 3, 2.6, BELL); p.set(x - 1, y + 2, '#fff7b0'); } else { p.rect(x - 2, y - 5, 4, 10, COLLAR); p.disc(x, y + 6, 2.4, BELL); } }
  else if (acc === 'ribbon') { p.poly([[x, y], [x - 8, y - 5], [x - 8, y + 5]], '#ff7fa6'); p.poly([[x, y], [x + 8, y - 5], [x + 8, y + 5]], '#ff7fa6'); p.disc(x, y, 2.6, '#e5487c'); p.set(x - 1, y - 1, '#ffd0e0'); }
  else if (acc === 'scarf') { if (view === 'h') { p.rect(x - 12, y - 3, 24, 6, '#4f8fe0'); p.rect(x - 12, y - 1, 24, 1.5, '#fff'); p.rect(x + 4, y + 2, 6, 8, '#4f8fe0'); p.rect(x + 4, y + 6, 6, 1.5, '#fff'); } else { p.rect(x - 3, y - 6, 6, 12, '#4f8fe0'); p.rect(x - 3, y - 1, 6, 1.5, '#fff'); p.rect(x - 1, y + 5, 5, 6, '#4f8fe0'); } }
}

function petSprite(look, dir, pose) {
  const { kind, color, fur, coat, pattern, eye, nose, ear, tail, acc } = normPetLook(look);
  const c = FUR[color] || FUR.brown, iris = IRIS[eye], NOSE = NOSES[nose];
  const dog = kind !== 'cat';
  const base = c.base, shade = darken(base, .2), light = lighten(base, .22), belly = c.belly;
  const p = new Pix(PW, PH);
  const w1 = pose === 'walk1', w2 = pose === 'walk2', walk = w1 || w2, happy = pose === 'happy';
  const bob = walk ? -1 : 0;
  const curly = fur === 'curly', longCoat = coat === 'long';
  const stripes = pattern === 'stripes', spots = pattern === 'spots';
  const tuft = (x, y, r = 2.4) => { if (curly) { p.disc(x, y, r, base); p.disc(x - .6, y - .6, r * .55, light); } else if (longCoat) { p.disc(x, y, r * .72, base); } };
  const dots = list => list.forEach(([x, y, r = 2.6]) => p.disc(x, y, r, shade));
  const down = ear === 'down';

  if (pose === 'rest') { // 엎드려 쉬는 모습 (왼쪽을 보고)
    p.ell(36, 38, 21, 9, base); p.ell(34, 36, 17, 5.5, light); p.ell(34, 43, 16, 3.4, belly);
    p.ell(15, 36, 10.5, 8.6, base); p.ell(13, 34, 7, 4.5, light); p.ell(9, 39, 6, 4, belly); p.ell(4.5, 38, 2.4, 1.8, NOSE);
    p.line(14, 33, 18, 33, '#2a1c18'); p.line(14, 34, 17, 34, '#2a1c18');
    if (dog) { if (down) p.ell(21, 36, 4, 7, shade); else { p.ell(22, 30, 5, 7, shade); p.ell(22, 31, 2.4, 4, EAR_IN); } }
    else { p.poly([[12, 29], [14, 20], [20, 28]], base); p.poly([[14, 28], [15, 23], [18, 28]], EAR_IN); p.poly([[19, 28], [25, 21], [26, 30]], shade); }
    if (dog) { if (tail === 'long') { p.ell(55, 36, 9, 4, shade); p.ell(61, 33, 3, 3, belly); } else { p.ell(54, 38, 8, 5, shade); p.ell(57, 36, 3.4, 3, belly); } }
    else { p.ell(52, 39, tail === 'long' ? 11 : 7, 4, shade); p.ell(tail === 'long' ? 60 : 57, 38, 3, 3, shade); }
    drawAcc(p, acc, 'v', 26, 36);
    if (stripes) for (const x of [30, 36, 42]) p.rect(x, 29, 2, 6, shade);
    if (spots) dots([[32, 31], [42, 34], [24, 31, 2]]);
    if (curly || longCoat) for (const [x, y] of [[24, 30], [34, 29], [44, 31], [52, 34], [18, 41]]) tuft(x, y);
    p.bevel(.14, .2).outline(.58);
    return p.done(PAX, PAY);
  }

  if (dir === 'left') {
    const t = happy ? 4 : (walk ? (w1 ? -2 : 2) : 0);
    if (dog) { if (tail === 'long') { p.ell(55, 17 + t, 4.8, 11, base); p.ell(56, 9 + t, 3.2, 4, belly); } else { p.ell(53, 22 + t, 6.4, 8, base); p.ell(54, 17 + t, 3.8, 4, belly); p.ell(52, 23 + t, 3, 5, light); } }
    else { const n = tail === 'long' ? 16 : 8; for (let i = 0; i < n; i++) { const x = 46 + Math.sin(i / 2.8) * 4 + Math.min(i, 8) * .7, y = 38 - i * 1.9; p.disc(x, y + t * .3, 2.2, (i % 4 === 3 || i > n - 3) ? shade : base); } }
    const l1 = w1 ? 2 : 0, l2 = w2 ? 2 : 0;
    p.rect(40, 34, 6, 9 - l2, shade); p.rect(45, 34, 6, 9 - l1, shade); p.rect(40, 41 - l2, 6, 3, belly); p.rect(45, 41 - l1, 6, 3, belly);
    p.ell(32, 29 + bob, dog ? 19 : 17, dog ? 11 : 9.4, base);
    p.ell(30, 24 + bob, dog ? 14 : 12, 5, light);
    p.ell(29, 36 + bob, 13, 5.2, belly);
    if (dog) p.ell(18, 32 + bob, 6, 7, belly);
    if (stripes) for (const x of [24, 30, 36, 42]) p.rect(x, 20 + bob, 2, 7, shade);
    if (spots) dots([[26, 23 + bob], [38, 26 + bob, 3.2], [46, 24 + bob], [32, 31 + bob, 2.2]]);
    p.rect(17, 34 - l1, 6, 10, base); p.rect(24, 34 - l2, 6, 10, base);
    p.rect(17, 42 - l1, 6, 4, belly); p.rect(24, 42 - l2, 6, 4, belly);
    p.set(19, 44 - l1, '#cdbba0'); p.set(26, 44 - l2, '#cdbba0');
    if (curly || longCoat) for (const [x, y] of [[16, 24], [24, 19], [34, 18], [44, 21], [48, 28], [20, 38], [30, 39], [40, 38]]) tuft(x, y + bob);
    const hy = 21 + bob;
    p.disc(16, hy, dog ? 10.4 : 10.8, base);
    p.ell(14, hy - 3, 7, 4.4, light);
    p.ell(dog ? 8 : 9.4, hy + 5.4, dog ? 6.8 : 4.4, dog ? 5 : 3.6, belly);
    p.ell(dog ? 3 : 5.4, hy + 3.6, 2.6, 2.1, NOSE); p.set(dog ? 2 : 4.4, hy + 2.6, '#fff');
    if (dog) { if (down) { p.ell(19, hy + 2, 4.2, 8, shade); } else { p.poly([[11, hy - 8], [20, hy - 12], [23, hy - 1]], shade); p.poly([[14, hy - 7], [19, hy - 10], [20, hy - 4]], EAR_IN); p.poly([[14, hy - 8], [16, hy - 10], [17, hy - 2]], base); } }
    else if (down) { p.poly([[5, hy - 3], [6, hy - 8], [11, hy - 4]], base); p.poly([[10, hy - 4], [12, hy - 8], [15, hy - 3]], shade); }
    else {
      p.poly([[3.5, hy - 3], [4.5, hy - 10], [10, hy - 4]], base); p.poly([[5, hy - 4], [5.5, hy - 8], [8.5, hy - 4.5]], EAR_IN);
      p.poly([[9, hy - 4], [11.5, hy - 10], [14, hy - 3]], shade);
    }
    if (stripes) { p.rect(13, hy - 9, 2, 4, shade); p.rect(17, hy - 9, 2, 4, shade); }
    if (happy) { p.line(10, hy - 1, 13, hy - 3, '#2a1c18'); p.line(13, hy - 3, 16, hy - 1, '#2a1c18'); } else eyeAt(p, 12, hy - 1, c.ink, false, iris);
    p.line(dog ? 3 : 5, hy + 7, dog ? 9 : 10, hy + 8, '#6b4636');
    if (dog && (walk || happy)) { p.ell(7, hy + 9, 2.6, 2.8, '#ff8a99'); p.set(7, hy + 8, '#ff5e75'); }
    if (!dog) { p.line(1, hy + 3, -0, hy + 2, '#fff'); p.line(2, hy + 5, 0, hy + 6, '#fff'); }
    drawAcc(p, acc, 'v', 23, hy + 8);
    if (curly || longCoat) for (const [x, y] of [[8, hy - 6], [22, hy + 6]]) tuft(x, y);
  } else if (dir === 'down') {
    const hy = 19 + bob;
    if (!dog) { const n = tail === 'long' ? 14 : 6; for (let i = 0; i < n; i++) p.disc(48 + Math.sin(i / 2.5) * 3, 40 - i * 2, 2.2, i % 4 === 3 ? shade : base); }
    else if (tail === 'long') { p.ell(47, 36, 3.6, 8, base); }
    p.ell(32, 37 + bob, dog ? 14 : 12, 10, base); p.ell(32, 40 + bob, 7.4, 6.4, belly);
    const l1 = w1 ? 2 : 0, l2 = w2 ? 2 : 0;
    p.rect(22, 41 - l1, 7, 6, belly); p.rect(35, 41 - l2, 7, 6, belly);
    p.line(25, 46 - l1, 25, 47 - l1, '#cdbba0'); p.line(38, 46 - l2, 38, 47 - l2, '#cdbba0');
    if (spots) dots([[22, 36 + bob], [43, 38 + bob, 3]]);
    if (curly || longCoat) for (const [x, y] of [[19, 36], [45, 36], [32, 28], [24, 44], [40, 44]]) tuft(x, y + bob);
    p.ell(32, hy + 1, dog ? 17 : 16, dog ? 13.6 : 13, base); p.ell(30, hy - 5, 11, 4.4, light);
    if (curly || longCoat) for (const [x, y] of [[16, hy + 1], [48, hy + 1], [22, hy - 9], [42, hy - 9], [20, hy + 8], [44, hy + 8]]) tuft(x, y);
    if (dog) {
      if (down) { p.ell(14, hy + 3, 4.6, 9, shade); p.ell(50, hy + 3, 4.6, 9, shade); }
      else { p.poly([[15, hy - 1], [16, hy - 15], [26, hy - 8]], shade); p.poly([[49, hy - 1], [48, hy - 15], [38, hy - 8]], shade); p.poly([[18, hy - 5], [18, hy - 11], [23, hy - 8]], EAR_IN); p.poly([[46, hy - 5], [46, hy - 11], [41, hy - 8]], EAR_IN); }
      p.poly([[30, hy - 12], [34, hy - 12], [36, hy + 3], [28, hy + 3]], belly);
    } else if (down) { p.poly([[16, hy - 1], [15, hy - 10], [26, hy - 7]], base); p.poly([[48, hy - 1], [49, hy - 10], [38, hy - 7]], base); }
    else { p.poly([[16, hy - 1], [15, hy - 17], [27, hy - 10]], base); p.poly([[48, hy - 1], [49, hy - 17], [37, hy - 10]], base); p.poly([[18, hy - 5], [18, hy - 13], [24, hy - 10]], EAR_IN); p.poly([[46, hy - 5], [46, hy - 13], [40, hy - 10]], EAR_IN); }
    if (stripes) { for (const x of [28, 32, 36]) p.rect(x, hy - 12, 1.5, 5, shade); }
    if (spots) dots([[22, hy - 4, 3], [44, hy + 2, 2.6]]);
    p.ell(32, hy + 7, dog ? 8.6 : 7, dog ? 6 : 5, belly);
    p.ell(32, hy + 4, 3.4, 2.4, NOSE); p.set(31, hy + 3, '#fff');
    p.line(32, hy + 6, 32, hy + 8, '#6b4636'); p.line(29, hy + 9, 32, hy + 8, '#6b4636'); p.line(35, hy + 9, 32, hy + 8, '#6b4636');
    if (happy) { eyeAt(p, 24, hy - 2, c.ink, true); eyeAt(p, 40, hy - 2, c.ink, true); } else { eyeAt(p, 24, hy - 2, c.ink, false, iris); eyeAt(p, 40, hy - 2, c.ink, false, iris); }
    if (dog && (walk || happy)) { p.ell(32, hy + 12, 3, 3.4, '#ff8a99'); p.line(32, hy + 10, 32, hy + 13, '#e8566e'); }
    if (!dog) { p.line(19, hy + 6, 11, hy + 4, '#fff'); p.line(19, hy + 8, 11, hy + 9, '#fff'); p.line(45, hy + 6, 53, hy + 4, '#fff'); p.line(45, hy + 8, 53, hy + 9, '#fff'); }
    drawAcc(p, acc, 'h', 32, hy + 15);
  } else { // up (뒷모습)
    const hy = 20 + bob;
    p.ell(32, 37 + bob, dog ? 14 : 12, 10.4, base);
    const l1 = w1 ? 2 : 0, l2 = w2 ? 2 : 0;
    p.rect(22, 41 - l1, 7, 6, belly); p.rect(35, 41 - l2, 7, 6, belly);
    if (stripes) for (const x of [26, 31, 36]) p.rect(x, 30 + bob, 2, 8, shade);
    if (spots) dots([[26, 34 + bob], [38, 36 + bob, 3]]);
    if (dog) { const lg = tail === 'long'; p.ell(32, 33 + bob, lg ? 4 : 6.6, lg ? 8 : 6.6, base); p.ell(32, lg ? 27 + bob : 31 + bob, 3.4, 3.4, belly); p.ell(31, 29 + bob, 2.4, 2.4, '#fff'); }
    else { const n = tail === 'long' ? 12 : 6; for (let i = 0; i < n; i++) p.disc(32 + Math.sin(i / 2) * 3, 35 - i * 2.2 + bob, 2.2, i % 4 === 3 ? shade : base); }
    if (curly || longCoat) for (const [x, y] of [[19, 37], [45, 37], [24, 44], [40, 44]]) tuft(x, y + bob);
    p.ell(32, hy, dog ? 16 : 15, dog ? 13 : 12, base); p.ell(30, hy - 6, 10, 4, light);
    if (curly || longCoat) for (const [x, y] of [[17, hy], [47, hy], [32, hy - 11]]) tuft(x, y);
    if (dog) { if (down) { p.ell(15, hy + 2, 4.6, 9, shade); p.ell(49, hy + 2, 4.6, 9, shade); } else { p.poly([[7, hy], [8, hy - 8], [13, hy - 4]].map(([x, y]) => [x + 8, y]), shade); p.poly([[23, hy], [22, hy - 8], [17, hy - 4]].map(([x, y]) => [x + 26, y]), shade); } }
    else if (down) { p.poly([[16, hy], [15, hy - 9], [27, hy - 6]], base); p.poly([[48, hy], [49, hy - 9], [37, hy - 6]], base); }
    else { p.poly([[16, hy], [15, hy - 16], [27, hy - 9]], base); p.poly([[48, hy], [49, hy - 16], [37, hy - 9]], base); }
    drawAcc(p, acc, 'h', 32, hy + 13);
  }
  p.bevel(.14, .2).outline(.58);
  return p.done(PAX, PAY);
}

/* ======================= 캐시와 공개 함수 ======================= */
const cache = new Map();
const memo = (key, make) => { let v = cache.get(key); if (!v) { v = make(); cache.set(key, v); } return v; };

export const playerFrame = (dir, frame, look) => memo(`pl|${dir}|${frame}|${lookKey(look)}`, () => player(dir === 'right' ? 'left' : dir, frame, look));
export const petFrame = (look, dir, pose) => { const l = normPetLook(look); return memo(`pet|${JSON.stringify(l)}|${dir}|${pose}`, () => petSprite(l, dir === 'right' ? 'left' : dir, pose)); };
export const PLAYER_ANCHOR = { ax: P_AX, ay: P_AY };

export function playerFace(look) { // HUD 얼굴 아이콘
  return memo('face|' + lookKey(look), () => {
    const f = playerFrame('down', 0, look);
    const p = new Pix(36, 32);
    p.g.drawImage(f.cv, 8, 2, 36, 32, 0, 0, 36, 32);
    return p.done();
  });
}
