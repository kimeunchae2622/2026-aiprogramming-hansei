// 캐릭터 그림(SVG). 강아지/고양이 × 직모/곱슬 × 털색 5가지를 코드로 조합해서 그린다.
export const KINDS = { dog: { label: '강아지', emoji: '🐶' }, cat: { label: '고양이', emoji: '🐱' } };
export const FURS = { straight: { label: '직모' }, curly: { label: '곱슬' } };
export const COLORS = {
  black: { label: '검정', base: '#3b3b42', ear: '#2a2a30', muzzle: '#a3a3ad', ink: '#ffffff' },
  white: { label: '하양', base: '#fbf8f3', ear: '#e7ddd0', muzzle: '#efe5d8', ink: '#3a2b20' },
  brown: { label: '갈색', base: '#8f5e3f', ear: '#6f452b', muzzle: '#c49a74', ink: '#ffffff' },
  yellow: { label: '황색', base: '#e9b560', ear: '#cf9a45', muzzle: '#f6dfb0', ink: '#3a2b20' },
  gray: { label: '회색', base: '#9ca2a9', ear: '#7e848b', muzzle: '#d3d6da', ink: '#2f3338' },
};

const OUT = '#5b4636';   // 윤곽선
const DARK = '#2a1c18';  // 눈·코·입
const PINK = '#f08a94';

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

// mood: 'happy' | 'normal' | 'sad',  dirty: 지저분한 상태 표시
export function characterSvg({ kind = 'dog', fur = 'straight', color = 'brown', mood = 'normal', dirty = false } = {}) {
  const c = COLORS[color] || COLORS.brown;
  const dog = kind !== 'cat';
  const curly = fur === 'curly';
  let s = '';

  // 꼬리
  const tail = dog ? 'M148 152 Q184 142 176 108' : 'M150 162 Q192 162 182 122 Q178 106 164 112';
  s += `<path d="${tail}" fill="none" stroke="${OUT}" stroke-width="22" stroke-linecap="round"/>`;
  s += `<path d="${tail}" fill="none" stroke="${c.base}" stroke-width="16" stroke-linecap="round"/>`;

  // 귀 (머리 뒤쪽)
  if (dog) {
    s += `<ellipse cx="56" cy="90" rx="16" ry="30" transform="rotate(12 56 90)" fill="${c.ear}" stroke="${OUT}" stroke-width="3"/>`;
    s += `<ellipse cx="144" cy="90" rx="16" ry="30" transform="rotate(-12 144 90)" fill="${c.ear}" stroke="${OUT}" stroke-width="3"/>`;
  } else {
    s += `<path d="M60 74 L64 22 L100 52 Z" fill="${c.base}" stroke="${OUT}" stroke-width="3" stroke-linejoin="round"/>`;
    s += `<path d="M140 74 L136 22 L100 52 Z" fill="${c.base}" stroke="${OUT}" stroke-width="3" stroke-linejoin="round"/>`;
    s += `<path d="M67 62 L69 37 L90 54 Z" fill="#f5b5b5"/><path d="M133 62 L131 37 L110 54 Z" fill="#f5b5b5"/>`;
  }

  // 몸
  if (curly) {
    s += bumps(100, 152, 52, 40, 16, 11, c.base);
    s += `<ellipse cx="100" cy="152" rx="52" ry="40" fill="${c.base}"/>`;
  } else {
    s += `<ellipse cx="100" cy="152" rx="52" ry="40" fill="${c.base}" stroke="${OUT}" stroke-width="3"/>`;
  }
  // 앞발
  s += `<ellipse cx="80" cy="190" rx="16" ry="9" fill="${c.base}" stroke="${OUT}" stroke-width="3"/>`;
  s += `<ellipse cx="120" cy="190" rx="16" ry="9" fill="${c.base}" stroke="${OUT}" stroke-width="3"/>`;

  // 머리
  if (curly) {
    for (const [x, y] of [[84, 50], [116, 50], [100, 42]]) { // 머리 위 뭉치
      s += `<circle cx="${x}" cy="${y}" r="14" fill="${c.base}" stroke="${OUT}" stroke-width="3"/>`;
    }
    s += bumps(100, 92, 46, 46, 18, 11, c.base);
    s += `<circle cx="100" cy="92" r="46" fill="${c.base}"/>`;
  } else {
    s += `<circle cx="100" cy="92" r="46" fill="${c.base}" stroke="${OUT}" stroke-width="3"/>`;
  }

  // 주둥이
  s += dog
    ? `<ellipse cx="100" cy="108" rx="22" ry="16" fill="${c.muzzle}"/>`
    : `<ellipse cx="100" cy="106" rx="18" ry="12" fill="${c.muzzle}"/>`;

  // 눈
  if (mood === 'happy') {
    s += `<path d="M74 90 Q82 79 90 90 M110 90 Q118 79 126 90" fill="none" stroke="${c.ink}" stroke-width="3.5" stroke-linecap="round"/>`;
    s += `<ellipse cx="66" cy="104" rx="8" ry="5" fill="#ff8fa3" opacity=".4"/><ellipse cx="134" cy="104" rx="8" ry="5" fill="#ff8fa3" opacity=".4"/>`;
  } else {
    const dy = mood === 'sad' ? 2 : 0;
    for (const x of [82, 118]) {
      s += `<circle cx="${x}" cy="${88 + dy}" r="8" fill="#fff" stroke="${OUT}" stroke-width="1.5"/>`;
      s += `<circle cx="${x}" cy="${89 + dy}" r="4.8" fill="${DARK}"/><circle cx="${x + 1.6}" cy="${87 + dy}" r="1.6" fill="#fff"/>`;
    }
    if (mood === 'sad') {
      s += `<path d="M72 82 L90 74 M128 82 L110 74" fill="none" stroke="${c.ink}" stroke-width="3" stroke-linecap="round"/>`;
    }
  }

  // 코와 입
  s += dog
    ? `<ellipse cx="100" cy="101" rx="7" ry="5" fill="${DARK}"/>`
    : `<path d="M95 100 L105 100 L100 106 Z" fill="${PINK}" stroke="${PINK}" stroke-linejoin="round"/>`;
  if (mood === 'happy') {
    s += `<path d="M88 110 Q100 128 112 110 Z" fill="#c0392b" stroke="${DARK}" stroke-width="2" stroke-linejoin="round"/>`;
    s += `<path d="M95 118 Q100 126 105 118 Z" fill="${PINK}"/>`;
  } else if (mood === 'sad') {
    s += `<path d="M91 119 Q100 110 109 119" fill="none" stroke="${DARK}" stroke-width="2.6" stroke-linecap="round"/>`;
  } else {
    s += `<path d="M100 106 L100 110 M100 110 Q93 117 87 111 M100 110 Q107 117 113 111" fill="none" stroke="${DARK}" stroke-width="2.6" stroke-linecap="round"/>`;
  }
  if (!dog) {
    s += `<path d="M80 104 L54 98 M80 108 L52 110 M80 112 L56 122 M120 104 L146 98 M120 108 L148 110 M120 112 L144 122" fill="none" stroke="${OUT}" stroke-width="1.6" stroke-linecap="round"/>`;
  }

  // 씻겨 주고 싶은 상태: 얼룩
  if (dirty) {
    s += `<g fill="#6b4a2f" opacity=".38"><ellipse cx="70" cy="150" rx="10" ry="6"/><ellipse cx="132" cy="162" rx="12" ry="6"/>`
      + `<ellipse cx="98" cy="178" rx="8" ry="5"/><ellipse cx="120" cy="64" rx="8" ry="5"/><ellipse cx="72" cy="70" rx="6" ry="4"/></g>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%" aria-hidden="true" focusable="false">${s}</svg>`;
}
