// 캐릭터 그림(SVG). 강아지/고양이 × 직모/곱슬 × 털색 5가지 + 옷(액세서리)을 코드로 조합해서 그린다.
// 눈 깜빡임·꼬리 흔들기·숨쉬기 같은 움직임은 css/style.css 의 .c-eyes / .c-tail / .c-body 규칙이 맡는다.
export const KINDS = { dog: { label: '강아지', emoji: '🐶' }, cat: { label: '고양이', emoji: '🐱' } };
export const FURS = { straight: { label: '직모' }, curly: { label: '곱슬' } };
export const COLORS = {
  black: { label: '검정', base: '#3b3b42', ear: '#2a2a30', muzzle: '#a3a3ad', ink: '#ffffff' },
  white: { label: '하양', base: '#fbf8f3', ear: '#e7ddd0', muzzle: '#efe5d8', ink: '#3a2b20' },
  brown: { label: '갈색', base: '#8f5e3f', ear: '#6f452b', muzzle: '#c49a74', ink: '#ffffff' },
  yellow: { label: '황색', base: '#e9b560', ear: '#cf9a45', muzzle: '#f6dfb0', ink: '#3a2b20' },
  gray: { label: '회색', base: '#9ca2a9', ear: '#7e848b', muzzle: '#d3d6da', ink: '#2f3338' },
};

// 옷: slot = hat(머리) / neck(목) / face(얼굴). art 는 200x200 그림 위에 얹는 SVG 조각.
export const OUTFITS = {
  bow: { slot: 'hat', name: '리본', price: 30,
    art: '<g transform="translate(132 58) rotate(16)"><path d="M0 0 L-17 -11 L-17 11 Z" fill="#ff6b9a"/><path d="M0 0 L17 -11 L17 11 Z" fill="#ff6b9a"/><circle r="5.5" fill="#ff3d7f"/></g>' },
  strawhat: { slot: 'hat', name: '밀짚모자', price: 60,
    art: '<ellipse cx="100" cy="60" rx="56" ry="11" fill="#f1d58f" stroke="#b88a3a" stroke-width="2.5"/><path d="M70 58 Q72 24 100 24 Q128 24 130 58 Z" fill="#f6dfa4" stroke="#b88a3a" stroke-width="2.5"/><path d="M71 52 Q100 60 129 52 L130 58 Q100 66 70 58 Z" fill="#e8503f"/>' },
  crown: { slot: 'hat', name: '왕관', price: 120,
    art: '<path d="M72 56 L76 28 L90 44 L100 22 L110 44 L124 28 L128 56 Z" fill="#ffcf3d" stroke="#c99700" stroke-width="2.5" stroke-linejoin="round"/><circle cx="100" cy="48" r="4" fill="#ff5a7a"/><circle cx="82" cy="50" r="3" fill="#5ab0ff"/><circle cx="118" cy="50" r="3" fill="#5ab0ff"/>' },
  scarf: { slot: 'neck', name: '목도리', price: 50,
    art: '<path d="M62 133 Q100 153 138 133 L141 147 Q100 167 59 147 Z" fill="#e8503f" stroke="#a83325" stroke-width="2"/><path d="M114 150 L124 178 L140 172 L132 146 Z" fill="#e8503f" stroke="#a83325" stroke-width="2"/><path d="M118 160 l12 -4 M121 168 l12 -4" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>' },
  bell: { slot: 'neck', name: '방울 목줄', price: 30,
    art: '<path d="M64 135 Q100 154 136 135" fill="none" stroke="#d33a3a" stroke-width="7" stroke-linecap="round"/><circle cx="100" cy="153" r="8" fill="#ffd24a" stroke="#c99700" stroke-width="2"/><path d="M100 150 v7" stroke="#c99700" stroke-width="2"/>' },
  glasses: { slot: 'face', name: '동그란 안경', price: 50,
    art: '<g fill="rgba(180,220,255,.25)" stroke="#3a2b20" stroke-width="3"><circle cx="82" cy="88" r="12"/><circle cx="118" cy="88" r="12"/></g><path d="M94 88 H106 M70 86 L60 82 M130 86 L140 82" stroke="#3a2b20" stroke-width="3" stroke-linecap="round"/>' },
};

const OUT = '#5b4636';   // 윤곽선
const DARK = '#2a1c18';  // 눈·코·입
const PINK = '#f08a1c';
let uidCount = 0;

// 털 색 위에 하이라이트를 주기 위한 밝은 색
function lighten(hex, amount = 0.28) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const m = v => Math.round(v + (255 - v) * amount).toString(16).padStart(2, '0');
  return `#${m(r)}${m(g)}${m(b)}`;
}

// 털이 곱슬곱슬해 보이도록 가장자리에 작은 동그라미를 둘러 붙인다
function bumps(cx, cy, rx, ry, n, r, fill) {
  let out = '';
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n;
    const x = (cx + rx * Math.cos(a)).toFixed(1);
    const y = (cy + ry * Math.sin(a)).toFixed(1);
    out += `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${OUT}" stroke-width="3"/>`;
  }
  return out;
}

// mood: 'happy' | 'normal' | 'sad' | 'sleep' | 'eat',  dirty: 지저분한 상태,  outfit: { hat, neck, face }
export function characterSvg({ kind = 'dog', fur = 'straight', color = 'brown', mood = 'normal', dirty = false, outfit = {} } = {}) {
  const c = COLORS[color] || COLORS.brown;
  const dog = kind !== 'cat';
  const curly = fur === 'curly';
  const id = `g${++uidCount}`;
  const grad = `url(#${id})`;
  let s = `<defs><radialGradient id="${id}" cx="38%" cy="28%" r="80%"><stop offset="0" stop-color="${lighten(c.base)}"/><stop offset="1" stop-color="${c.base}"/></radialGradient></defs>`;

  // 바닥 그림자
  s += '<ellipse cx="100" cy="193" rx="66" ry="8" fill="rgba(0,0,0,.14)"/>';

  // 꼬리
  const tail = dog ? 'M148 152 Q184 142 176 108' : 'M150 162 Q192 162 182 122 Q178 106 164 112';
  s += `<g class="c-tail"><path d="${tail}" fill="none" stroke="${OUT}" stroke-width="22" stroke-linecap="round"/>`;
  s += `<path d="${tail}" fill="none" stroke="${c.base}" stroke-width="16" stroke-linecap="round"/></g>`;

  // 몸
  s += '<g class="c-body">';
  if (curly) {
    s += bumps(100, 152, 52, 40, 16, 11, c.base);
    s += `<ellipse cx="100" cy="152" rx="52" ry="40" fill="${grad}"/>`;
  } else {
    s += `<ellipse cx="100" cy="152" rx="52" ry="40" fill="${grad}" stroke="${OUT}" stroke-width="3"/>`;
  }
  s += `<ellipse cx="100" cy="160" rx="28" ry="22" fill="${c.muzzle}" opacity=".55"/>`;
  s += `<ellipse cx="80" cy="190" rx="16" ry="9" fill="${c.base}" stroke="${OUT}" stroke-width="3"/>`;
  s += `<ellipse cx="120" cy="190" rx="16" ry="9" fill="${c.base}" stroke="${OUT}" stroke-width="3"/>`;
  s += '</g>';

  // 목 액세서리
  if (outfit.neck && OUTFITS[outfit.neck]) s += `<g class="acc">${OUTFITS[outfit.neck].art}</g>`;

  // 머리
  s += '<g class="c-head">';
  if (dog) {
    s += `<g class="c-ear-l"><ellipse cx="56" cy="90" rx="16" ry="30" transform="rotate(12 56 90)" fill="${c.ear}" stroke="${OUT}" stroke-width="3"/></g>`;
    s += `<g class="c-ear-r"><ellipse cx="144" cy="90" rx="16" ry="30" transform="rotate(-12 144 90)" fill="${c.ear}" stroke="${OUT}" stroke-width="3"/></g>`;
  } else {
    s += `<g class="c-ear-l"><path d="M60 74 L64 22 L100 52 Z" fill="${c.base}" stroke="${OUT}" stroke-width="3" stroke-linejoin="round"/><path d="M67 62 L69 37 L90 54 Z" fill="#f5b5b5"/></g>`;
    s += `<g class="c-ear-r"><path d="M140 74 L136 22 L100 52 Z" fill="${c.base}" stroke="${OUT}" stroke-width="3" stroke-linejoin="round"/><path d="M133 62 L131 37 L110 54 Z" fill="#f5b5b5"/></g>`;
  }
  if (curly) {
    for (const [x, y] of [[84, 50], [116, 50], [100, 42]]) {
      s += `<circle cx="${x}" cy="${y}" r="14" fill="${c.base}" stroke="${OUT}" stroke-width="3"/>`;
    }
    s += bumps(100, 92, 46, 46, 18, 11, c.base);
    s += `<circle cx="100" cy="92" r="46" fill="${grad}"/>`;
  } else {
    s += `<circle cx="100" cy="92" r="46" fill="${grad}" stroke="${OUT}" stroke-width="3"/>`;
  }
  s += dog
    ? `<ellipse cx="100" cy="108" rx="22" ry="16" fill="${c.muzzle}"/>`
    : `<ellipse cx="100" cy="106" rx="18" ry="12" fill="${c.muzzle}"/>`;
  s += '<ellipse cx="66" cy="104" rx="8" ry="5" fill="#ff8fa3" opacity=".28"/><ellipse cx="134" cy="104" rx="8" ry="5" fill="#ff8fa3" opacity=".28"/>';

  // 눈
  if (mood === 'happy' || mood === 'sleep') {
    const d = mood === 'sleep' ? 'M74 90 Q82 98 90 90 M110 90 Q118 98 126 90' : 'M74 90 Q82 79 90 90 M110 90 Q118 79 126 90';
    s += `<path d="${d}" fill="none" stroke="${c.ink}" stroke-width="3.5" stroke-linecap="round"/>`;
  } else {
    const dy = mood === 'sad' ? 2 : 0;
    s += '<g class="c-eyes">';
    for (const x of [82, 118]) {
      s += `<circle cx="${x}" cy="${88 + dy}" r="8" fill="#fff" stroke="${OUT}" stroke-width="1.5"/>`;
      s += `<circle cx="${x}" cy="${89 + dy}" r="4.8" fill="${DARK}"/><circle cx="${x + 1.6}" cy="${87 + dy}" r="1.6" fill="#fff"/>`;
    }
    s += '</g>';
    if (mood === 'sad') {
      s += `<path d="M72 82 L90 74 M128 82 L110 74" fill="none" stroke="${c.ink}" stroke-width="3" stroke-linecap="round"/>`;
    }
  }

  // 코와 입
  s += dog
    ? `<ellipse cx="100" cy="101" rx="7" ry="5" fill="${DARK}"/><ellipse cx="98" cy="99.5" rx="2.2" ry="1.2" fill="#fff" opacity=".6"/>`
    : `<path d="M95 100 L105 100 L100 106 Z" fill="#f08a94" stroke="#f08a94" stroke-linejoin="round"/>`;
  if (mood === 'happy') {
    s += `<path d="M88 110 Q100 128 112 110 Z" fill="#c0392b" stroke="${DARK}" stroke-width="2" stroke-linejoin="round"/>`;
    s += '<path d="M95 118 Q100 126 105 118 Z" fill="#f08a94"/>';
  } else if (mood === 'eat') {
    s += `<g class="c-mouth"><ellipse cx="100" cy="116" rx="9" ry="7" fill="#c0392b" stroke="${DARK}" stroke-width="2"/></g>`;
  } else if (mood === 'sad') {
    s += `<path d="M91 119 Q100 110 109 119" fill="none" stroke="${DARK}" stroke-width="2.6" stroke-linecap="round"/>`;
  } else {
    s += `<path d="M100 106 L100 110 M100 110 Q93 117 87 111 M100 110 Q107 117 113 111" fill="none" stroke="${DARK}" stroke-width="2.6" stroke-linecap="round"/>`;
  }
  if (!dog) {
    s += `<path d="M80 104 L54 98 M80 108 L52 110 M80 112 L56 122 M120 104 L146 98 M120 108 L148 110 M120 112 L144 122" fill="none" stroke="${OUT}" stroke-width="1.6" stroke-linecap="round"/>`;
  }
  if (outfit.face && OUTFITS[outfit.face]) s += `<g class="acc">${OUTFITS[outfit.face].art}</g>`;
  if (outfit.hat && OUTFITS[outfit.hat]) s += `<g class="acc">${OUTFITS[outfit.hat].art}</g>`;
  s += '</g>';

  // 씻겨 주고 싶은 상태: 얼룩
  if (dirty) {
    s += '<g fill="#6b4a2f" opacity=".38"><ellipse cx="70" cy="150" rx="10" ry="6"/><ellipse cx="132" cy="162" rx="12" ry="6"/>'
      + '<ellipse cx="98" cy="178" rx="8" ry="5"/><ellipse cx="120" cy="64" rx="8" ry="5"/><ellipse cx="72" cy="70" rx="6" ry="4"/></g>';
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%" aria-hidden="true" focusable="false">${s}</svg>`;
}
