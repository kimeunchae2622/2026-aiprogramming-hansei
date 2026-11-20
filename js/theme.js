// 꾸미기 설정: 디자인(카드형/타임라인형), 포인트 색, 밝기(자동/밝게/어둡게).
// 이 기기에만 저장한다 (localStorage). 첫 화면이 깜빡이지 않도록 index.html 의 작은 스크립트가 먼저 같은 값을 적용한다.
const KEY = 'pet-memories-settings';

export const STYLES = {
  card: { label: '카드형', desc: '사진이 큼직하게 보이는 피드' },
  timeline: { label: '타임라인형', desc: '글이 주인공인 간결한 피드' },
};
export const MODES = { auto: '자동', light: '밝게', dark: '어둡게' };
export const ACCENTS = [
  { label: '코랄', color: '#e8503f' },
  { label: '오렌지', color: '#f08a1c' },
  { label: '초록', color: '#2fa56a' },
  { label: '청록', color: '#14a5a0' },
  { label: '파랑', color: '#3b82f6' },
  { label: '남색', color: '#6366f1' },
  { label: '보라', color: '#a855f7' },
  { label: '분홍', color: '#ec4899' },
];
const DEFAULTS = { style: 'card', accent: ACCENTS[0].color, mode: 'auto' };

function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    return sanitize(raw);
  } catch { return { ...DEFAULTS }; }
}

function sanitize(raw) {
  return {
    style: raw && STYLES[raw.style] ? raw.style : DEFAULTS.style,
    accent: raw && /^#[0-9a-f]{6}$/i.test(raw.accent || '') ? raw.accent.toLowerCase() : DEFAULTS.accent,
    mode: raw && MODES[raw.mode] ? raw.mode : DEFAULTS.mode,
  };
}

// ---- 색 대비 계산 (WCAG): 어떤 포인트 색을 골라도 글자가 또렷하게 읽히도록 자동 보정 ----
const toRgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const toHex = rgb => '#' + rgb.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = hex => { const [r, g, b] = toRgb(hex).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const mix = (hex, target, amount) => toHex(toRgb(hex).map((v, i) => v + (toRgb(target)[i] - v) * amount));

// 대비가 목표(ratio) 이상이 될 때까지 포인트 색을 조금씩 target(검정/흰색) 쪽으로 옮긴다
function shiftUntil(hex, against, target, ratio) {
  let c = hex;
  for (let i = 0; i <= 20 && contrast(c, against) < ratio; i++) c = mix(hex, target, i * 0.05);
  return c;
}

// 버튼처럼 색을 칠하는 곳: { fill: 배경색, on: 그 위의 글자색 }
export function fillColors(hex) {
  if (lum(hex) > 0.45) return { fill: hex, on: '#111111' };            // 밝은 색 → 검정 글자
  return { fill: shiftUntil(hex, '#ffffff', '#000000', 4.5), on: '#ffffff' }; // 그 외 → 흰 글자(필요하면 살짝 어둡게)
}
// 글자·작은 아이콘에 쓰는 포인트 색: 바탕(밝음/어두움)에서 잘 읽히게 보정
export function textColor(hex, theme) {
  return theme === 'dark'
    ? shiftUntil(hex, '#16181c', '#ffffff', 5)
    : shiftUntil(hex, '#f4f5f7', '#000000', 4.5);
}

let settings = read();
const dark = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

export function getSettings() { return { ...settings }; }

export function setSettings(patch) {
  settings = sanitize({ ...settings, ...patch });
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* 저장 못 해도 이번 실행에는 적용 */ }
  apply();
}

export function apply() {
  const root = document.documentElement;
  const theme = settings.mode === 'auto' ? (dark && dark.matches ? 'dark' : 'light') : settings.mode;
  root.dataset.style = settings.style;
  root.dataset.theme = theme;
  root.style.setProperty('--accent', settings.accent);
  const { fill, on } = fillColors(settings.accent);
  root.style.setProperty('--accent-fill', fill);
  root.style.setProperty('--on-accent', on);
  root.style.setProperty('--accent-text', textColor(settings.accent, theme));
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#000000' : '#ffffff');
}

if (dark && dark.addEventListener) dark.addEventListener('change', () => { if (settings.mode === 'auto') apply(); });
apply();
