// 꾸미기 설정: 디자인(카드형/타임라인형), 포인트 색, 밝기(자동/밝게/어둡게).
// 이 기기에만 저장한다 (localStorage). 첫 화면이 깜빡이지 않도록 index.html 의 작은 스크립트가 먼저 같은 값을 적용한다.
const KEY = 'pet-memories-settings';

export const STYLES = {
  card: { label: '카드형', desc: '사진이 큼직하게 보이는 피드' },
  timeline: { label: '타임라인형', desc: '글이 주인공인 간결한 피드' },
};
export const MODES = { auto: '자동', light: '밝게', dark: '어둡게' };
export const ACCENTS = [
  { label: '코랄', color: '#ff6b57' },
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

// 포인트 색 위에 올라가는 글자색: 밝은 색이면 검정, 어두운 색이면 흰색
function onAccent(hex) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.4 ? '#111111' : '#ffffff';
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
  root.style.setProperty('--on-accent', onAccent(settings.accent));
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#000000' : '#ffffff');
}

if (dark && dark.addEventListener) dark.addEventListener('change', () => { if (settings.mode === 'auto') apply(); });
apply();
