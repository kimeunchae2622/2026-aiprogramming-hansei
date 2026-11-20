// 캐릭터 돌보기: 밥·간식·놀기·씻기기·쓰다듬기. 시간이 지나면 수치가 서서히 내려간다.
import { h } from './util.js';
import * as db from './db.js';
import { characterSvg, KINDS, FURS, COLORS } from './character.js';

// 한 시간에 줄어드는 양 (밥 3, 기분 2, 청결 1.5 → 하루 비워도 크게 슬퍼지지 않는다)
const RATES = { full: 3, happy: 2, clean: 1.5 };
const clamp = n => Math.max(0, Math.min(100, Math.round(n)));
const pick = list => list[Math.floor(Math.random() * list.length)];

export function currentStats(ch, now = Date.now()) {
  const hours = Math.max(0, (now - ch.at) / 3600000);
  return {
    full: clamp(ch.full - RATES.full * hours),
    happy: clamp(ch.happy - RATES.happy * hours),
    clean: clamp(ch.clean - RATES.clean * hours),
  };
}

function moodOf(s) {
  if (Math.min(s.full, s.happy, s.clean) < 25) return 'sad';
  if (Math.min(s.full, s.happy, s.clean) >= 50 && s.happy >= 60) return 'happy';
  return 'normal';
}

function idleMessage(s) {
  const low = Object.entries(s).sort((a, b) => a[1] - b[1])[0];
  if (low[1] < 25) return { full: '배고파요… 🍚', happy: '심심해요… 놀아 주세요', clean: '씻고 싶어요… 🛁' }[low[0]];
  if (Math.min(s.full, s.happy, s.clean) >= 70) return '기분 최고예요! 💗';
  return '오늘도 같이 있어서 좋아요';
}

// 행동마다: 수치 변화, 말풍선, 떠오르는 이모지. 안 되는 상황이면 ok:false 로 이유만 알려 준다.
const ACTIONS = {
  feed: {
    label: '밥주기', emoji: '🍚',
    run: s => s.full >= 95
      ? { ok: false, msg: '배불러서 더 못 먹어요', fx: ['😮‍💨'] }
      : { ok: true, d: { full: 30, happy: 3 }, msg: pick(['냠냠! 맛있어요', '밥이다! 고마워요']), fx: ['🍚', '😋'] },
  },
  snack: {
    label: '간식주기', emoji: '🦴',
    run: s => s.full >= 95
      ? { ok: false, msg: '배불러서 간식도 못 먹겠어요', fx: ['😮‍💨'] }
      : { ok: true, d: { full: 8, happy: 12 }, msg: pick(['간식 최고!', '더 주세요~']), fx: ['🦴', '✨'] },
  },
  play: {
    label: '놀아주기', emoji: '🧸',
    run: s => s.full < 15
      ? { ok: false, msg: '배고파서 놀 힘이 없어요…', fx: ['💤'] }
      : { ok: true, d: { happy: 20, full: -6, clean: -8 }, msg: pick(['신나요!', '또 놀아요!']), fx: ['🎾', '⭐', '🎵'] },
  },
  wash: {
    label: '씻기기', emoji: '🛁',
    run: s => s.clean >= 95
      ? { ok: false, msg: '이미 깨끗해요!', fx: ['✨'] }
      : { ok: true, d: { clean: 45, happy: -3 }, msg: pick(['뽀득뽀득, 깨끗해졌어요', '시원해요!']), fx: ['🫧', '🫧', '✨'] },
  },
  pet: {
    label: '쓰다듬기', emoji: '🤚',
    run: () => ({ ok: true, d: { happy: 8 }, msg: pick(['기분 좋아요~', '더 쓰다듬어 주세요']), fx: ['💗', '💗', '💗'] }),
  },
};

const BARS = [
  { key: 'full', label: '배부름', emoji: '🍚' },
  { key: 'happy', label: '기분', emoji: '💗' },
  { key: 'clean', label: '청결', emoji: '🫧' },
];

/* ---------- 모습 고르기 (처음 만들 때 / 나중에 바꿀 때 공용) ---------- */
function lookForm({ initial, submitLabel, onSubmit }) {
  let { kind, fur, color } = initial;
  const preview = h('div', { class: 'look-preview', role: 'img', 'aria-label': '캐릭터 미리보기' });
  const kindRow = h('div', { class: 'chips', role: 'radiogroup', 'aria-label': '동물' });
  const furRow = h('div', { class: 'chips', role: 'radiogroup', 'aria-label': '털 모양' });
  const colorRow = h('div', { class: 'chips', role: 'radiogroup', 'aria-label': '털 색' });
  const submit = h('button', { type: 'button', class: 'btn primary block' }, submitLabel);

  const chip = (active, label, onclick, extra) => h('button', {
    type: 'button', class: 'chip' + (active ? ' active' : ''), role: 'radio', 'aria-checked': String(active), onclick,
  }, extra, label);
  const draw = () => {
    preview.innerHTML = characterSvg({ kind, fur, color, mood: 'happy' });
    kindRow.replaceChildren(...Object.entries(KINDS).map(([k, v]) => chip(kind === k, `${v.emoji} ${v.label}`, () => { kind = k; draw(); })));
    furRow.replaceChildren(...Object.entries(FURS).map(([k, v]) => chip(fur === k, v.label, () => { fur = k; draw(); })));
    colorRow.replaceChildren(...Object.entries(COLORS).map(([k, v]) => chip(color === k, v.label, () => { color = k; draw(); },
      h('i', { class: 'swatch', style: `background:${v.base}` }))));
  };
  submit.addEventListener('click', async () => {
    submit.disabled = true;
    try { await onSubmit({ kind, fur, color }); } finally { submit.disabled = false; }
  });
  draw();
  return h('div', { class: 'form' }, preview,
    h('div', { class: 'label' }, '동물', kindRow),
    h('div', { class: 'label' }, '털 모양', furRow),
    h('div', { class: 'label' }, '털 색', colorRow),
    submit);
}

/* ---------- 돌보기 탭 ---------- */
// ctx: { state, toast, openSheet, render, reload, avatar }
export function renderCareTab(ctx) {
  const { state } = ctx;
  const pet = state.pets.find(p => p.id === state.carePet) || state.pets.find(p => p.id === state.filter) || state.pets[0];
  state.carePet = pet.id;
  const ch = state.characters.find(c => c.id === pet.id);

  const chips = state.pets.length > 1 && h('div', { class: 'filter', role: 'tablist', 'aria-label': '아이 고르기' },
    state.pets.map(p => h('button', {
      class: 'chip' + (p.id === pet.id ? ' active' : ''), role: 'tab',
      onclick: () => { state.carePet = p.id; ctx.render(); },
    }, ctx.avatar(p, 24), p.name)));

  if (!ch) {
    const defKind = pet.species === 'cat' ? 'cat' : 'dog';
    return h('div', { class: 'care' }, chips,
      h('section', { class: 'card' },
        h('h2', {}, `${pet.name}의 캐릭터를 만들어요`),
        h('p', { class: 'muted' }, '우리 아이와 닮은 모습을 골라 보세요. 나중에 언제든 바꿀 수 있어요.'),
        lookForm({
          initial: { kind: defKind, fur: 'straight', color: 'brown' }, submitLabel: '이 모습으로 만들기',
          onSubmit: async look => {
            try {
              const now = Date.now();
              await db.put('characters', { id: pet.id, ...look, full: 80, happy: 80, clean: 80, at: now, createdAt: now });
              await ctx.reload();
              ctx.toast(`${pet.name} 캐릭터가 생겼어요! 🐾`);
            } catch { ctx.toast('저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.'); }
          },
        })));
  }

  /* 캐릭터가 있는 경우: 돌보기 화면 */
  const svgBox = h('div', { class: 'char-svg', role: 'img', 'aria-label': `${pet.name} 캐릭터` });
  const bubble = h('div', { class: 'bubble', role: 'status', 'aria-live': 'polite' });
  const fx = h('div', { class: 'fx', 'aria-hidden': 'true' });
  const barEls = {};
  const bars = h('div', { class: 'bars' }, BARS.map(b => {
    const fill = h('i', {});
    const val = h('span', { class: 'bar-val' });
    const track = h('div', { class: 'bar', role: 'progressbar', 'aria-label': b.label, 'aria-valuemin': 0, 'aria-valuemax': 100 }, fill);
    barEls[b.key] = { fill, val, track };
    return h('div', { class: 'bar-row' }, h('span', { class: 'bar-label' }, `${b.emoji} ${b.label}`), track, val);
  }));

  const paint = message => {
    const s = currentStats(ch);
    svgBox.innerHTML = characterSvg({ kind: ch.kind, fur: ch.fur, color: ch.color, mood: moodOf(s), dirty: s.clean < 40 });
    for (const b of BARS) {
      const e = barEls[b.key];
      e.fill.style.width = s[b.key] + '%';
      e.fill.className = s[b.key] < 25 ? 'low' : '';
      e.track.setAttribute('aria-valuenow', s[b.key]);
      e.val.textContent = s[b.key];
    }
    bubble.textContent = message || idleMessage(s);
  };

  const burst = emojis => {
    for (let i = 0; i < 6; i++) {
      if (fx.children.length > 24) break;
      const el = h('span', { class: 'fx-item', style: `left:${15 + Math.random() * 70}%;animation-delay:${i * 80}ms` }, emojis[i % emojis.length]);
      fx.append(el);
      setTimeout(() => el.remove(), 1500);
    }
  };

  const act = async key => {
    const now = Date.now();
    const s = currentStats(ch, now);
    const r = ACTIONS[key].run(s);
    if (r.ok) {
      for (const k of Object.keys(RATES)) s[k] = clamp(s[k] + (r.d[k] || 0));
      Object.assign(ch, s, { at: now });
    }
    paint(r.msg);
    burst(r.fx);
    if (r.ok) {
      try { await db.put('characters', { ...ch }); }
      catch { ctx.toast('저장하지 못했어요. 저장 공간을 확인해 주세요.'); }
    }
  };

  const buttons = h('div', { class: 'care-buttons' }, Object.entries(ACTIONS).map(([key, a]) =>
    h('button', { class: 'round-btn', type: 'button', onclick: () => act(key) },
      h('span', { class: 'round-icon', 'aria-hidden': 'true' }, a.emoji),
      h('span', { class: 'round-label' }, a.label))));

  paint();
  return h('div', { class: 'care' }, chips,
    h('section', { class: 'card stage-card' },
      h('div', { class: 'stage' }, bubble, svgBox, fx),
      h('p', { class: 'char-name' }, pet.name),
      bars, buttons,
      h('button', {
        class: 'btn link', type: 'button',
        onclick: () => ctx.openSheet('모습 바꾸기', api => lookForm({
          initial: { kind: ch.kind, fur: ch.fur, color: ch.color }, submitLabel: '저장',
          onSubmit: async look => {
            try {
              await db.put('characters', { ...ch, ...look });
              api.close();
              await ctx.reload();
              ctx.toast('모습을 바꿨어요');
            } catch { ctx.toast('저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.'); }
          },
        })),
      }, '🎨 모습 바꾸기')));
}
