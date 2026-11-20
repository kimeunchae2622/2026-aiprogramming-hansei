// 돌보기 탭 = 우리 집 게임: 방, 캐릭터 돌보기, 코인, 상점, 꾸미기, 출석 선물.
import { h, ymd } from './util.js';
import * as db from './db.js';
import { characterSvg, KINDS, FURS, COLORS, OUTFITS } from './character.js';
import { FURNITURE, WALLS, FLOORS, DEFAULT_OWNED, DEFAULT_PLACED, furnitureSvg } from './items.js';
import { createRoom, coinIcon } from './room.js';

// 한 시간에 줄어드는 양 (밥 3, 기분 2, 청결 1.5 → 하루 비워도 크게 슬퍼지지 않는다)
const RATES = { full: 3, happy: 2, clean: 1.5 };
const DAILY_COIN_CAP = 60;   // 돌보기로 하루에 벌 수 있는 코인
const POST_COIN = 10;        // 추억을 올릴 때 받는 코인 (하루 3번까지)
const POST_COIN_LIMIT = 3;
const clamp = n => Math.max(0, Math.min(100, Math.round(n)));
const pick = list => list[Math.floor(Math.random() * list.length)];
const today = () => ymd(new Date());

/* ---------- 저장된 캐릭터 정리 (예전 데이터에는 없는 칸을 채운다) ---------- */
const strList = a => (Array.isArray(a) ? a.filter(x => typeof x === 'string') : []);
const num = (n, d = 0) => (Number.isFinite(n) ? Math.max(0, Math.floor(n)) : d);

export function normalizeChar(c) {
  const owned = [...new Set(['wall:cream', 'floor:wood', ...DEFAULT_OWNED, ...strList(c.owned)])];
  const outfit = {};
  for (const slot of ['hat', 'neck', 'face']) {
    const id = c.outfit && c.outfit[slot];
    outfit[slot] = id && OUTFITS[id] && OUTFITS[id].slot === slot && owned.includes('outfit:' + id) ? id : null;
  }
  const placed = Array.isArray(c.placed) ? strList(c.placed) : [...DEFAULT_PLACED];
  return {
    ...c,
    coins: num(c.coins), xp: num(c.xp), owned,
    placed: placed.filter(id => FURNITURE[id] && owned.includes(id)),
    wall: WALLS[c.wall] && owned.includes('wall:' + c.wall) ? c.wall : 'cream',
    floor: FLOORS[c.floor] && owned.includes('floor:' + c.floor) ? c.floor : 'wood',
    outfit,
    checkin: { last: (c.checkin && c.checkin.last) || '', streak: num(c.checkin && c.checkin.streak) },
    earn: { date: (c.earn && c.earn.date) || '', n: num(c.earn && c.earn.n) },
    postEarn: { date: (c.postEarn && c.postEarn.date) || '', n: num(c.postEarn && c.postEarn.n) },
  };
}

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

const levelOf = xp => 1 + Math.floor(Math.sqrt(xp / 12));
const levelFloor = lv => 12 * (lv - 1) ** 2;

// 행동: 수치 변화(d), 말풍선, 코인·경험치. 안 되는 상황이면 ok:false 로 이유만 알려 준다.
const ACTIONS = {
  feed: {
    label: '밥주기', emoji: '🍚', coin: 4, xp: 3,
    run: s => (s.full >= 95 ? { ok: false, msg: '배불러서 더 못 먹어요' }
      : { ok: true, d: { full: 30, happy: 3 }, msg: pick(['냠냠! 맛있어요', '밥이다! 고마워요']) }),
  },
  snack: {
    label: '간식주기', emoji: '🦴', coin: 3, xp: 2,
    run: s => (s.full >= 95 ? { ok: false, msg: '배불러서 간식도 못 먹겠어요' }
      : { ok: true, d: { full: 8, happy: 12 }, msg: pick(['간식 최고!', '더 주세요~']) }),
  },
  play: {
    label: '놀아주기', emoji: '🧸', coin: 6, xp: 4,
    run: s => (s.full < 15 ? { ok: false, msg: '배고파서 놀 힘이 없어요…' }
      : { ok: true, d: { happy: 20, full: -6, clean: -8 }, msg: pick(['신나요!', '또 놀아요!']) }),
  },
  wash: {
    label: '씻기기', emoji: '🛁', coin: 5, xp: 3,
    run: s => (s.clean >= 95 ? { ok: false, msg: '이미 깨끗해요!' }
      : { ok: true, d: { clean: 45, happy: -3 }, msg: pick(['뽀득뽀득, 깨끗해졌어요', '시원해요!']) }),
  },
  pet: {
    label: '쓰다듬기', emoji: '🤚', coin: 1, xp: 1,
    run: () => ({ ok: true, d: { happy: 8 }, msg: pick(['기분 좋아요~', '더 쓰다듬어 주세요']) }),
  },
};

const BARS = [
  { key: 'full', label: '배부름', emoji: '🍚' },
  { key: 'happy', label: '기분', emoji: '💗' },
  { key: 'clean', label: '청결', emoji: '🫧' },
];

let room = null;
export function destroyCare() { if (room) { room.destroy(); room = null; } }

async function save(state, ch) {
  const i = state.characters.findIndex(c => c.id === ch.id);
  if (i >= 0) state.characters[i] = ch; else state.characters.push(ch);
  await db.put('characters', { ...ch });
}

// 추억을 올렸을 때 코인 보상 (하루 3번까지). 받은 코인 수를 돌려준다.
export async function grantPostCoins(state, petId) {
  const raw = state.characters.find(c => c.id === petId);
  if (!raw) return 0;
  const ch = normalizeChar(raw);
  if (ch.postEarn.date !== today()) ch.postEarn = { date: today(), n: 0 };
  if (ch.postEarn.n >= POST_COIN_LIMIT) return 0;
  ch.postEarn.n += 1;
  ch.coins += POST_COIN;
  ch.xp += 5;
  try { await save(state, ch); } catch { return 0; }
  return POST_COIN;
}

/* ---------- 모습 고르기 (처음 만들 때 / 나중에 바꿀 때 공용) ---------- */
function lookForm({ initial, outfit = {}, submitLabel, onSubmit }) {
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
    preview.innerHTML = characterSvg({ kind, fur, color, mood: 'happy', outfit });
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
// ctx: { state, toast, openSheet, confirmBox, render, reload, avatar }
export function renderCareTab(ctx) {
  const { state } = ctx;
  destroyCare();
  const pet = state.pets.find(p => p.id === state.carePet) || state.pets.find(p => p.id === state.filter) || state.pets[0];
  state.carePet = pet.id;
  const rawChar = state.characters.find(c => c.id === pet.id);

  const chips = state.pets.length > 1 && h('div', { class: 'filter', role: 'tablist', 'aria-label': '아이 고르기' },
    state.pets.map(p => h('button', {
      class: 'chip' + (p.id === pet.id ? ' active' : ''), role: 'tab',
      onclick: () => { state.carePet = p.id; ctx.render(); },
    }, ctx.avatar(p, 24), p.name)));

  if (!rawChar) {
    const defKind = pet.species === 'cat' ? 'cat' : 'dog';
    return h('div', { class: 'page care' }, chips,
      h('section', { class: 'card' },
        h('h2', {}, `${pet.name}의 캐릭터를 만들어요`),
        h('p', { class: 'muted' }, '우리 아이와 닮은 모습을 골라 보세요. 나만의 아늑한 집에서 함께 지낼 수 있어요. 모습은 언제든 바꿀 수 있어요.'),
        lookForm({
          initial: { kind: defKind, fur: 'straight', color: 'brown' }, submitLabel: '이 모습으로 만들기',
          onSubmit: async look => {
            try {
              const now = Date.now();
              const fresh = normalizeChar({ id: pet.id, ...look, full: 80, happy: 80, clean: 80, at: now, createdAt: now, coins: 30 });
              await save(state, fresh);
              await ctx.reload();
              ctx.toast(`${pet.name} 캐릭터가 생겼어요! 시작 선물 코인 30개`);
            } catch { ctx.toast('저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.'); }
          },
        })));
  }

  /* ---- 캐릭터가 있는 경우: 우리 집 ---- */
  const ch = normalizeChar(rawChar);
  state.characters[state.characters.findIndex(c => c.id === ch.id)] = ch;

  const barEls = {};
  const bars = h('div', { class: 'bars' }, BARS.map(b => {
    const fill = h('i', { 'data-k': b.key });
    const val = h('span', { class: 'bar-val' });
    const track = h('div', { class: 'bar', role: 'progressbar', 'aria-label': b.label, 'aria-valuemin': 0, 'aria-valuemax': 100 }, fill);
    barEls[b.key] = { fill, val, track };
    return h('div', { class: 'bar-row' }, h('span', { class: 'bar-label' }, `${b.emoji} ${b.label}`), track, val);
  }));
  const levelChip = h('span', { class: 'lv-chip' });
  const lvBar = h('i', {});
  const nameRow = h('div', { class: 'care-head' },
    h('strong', {}, pet.name), levelChip, h('span', { class: 'lv-track', 'aria-hidden': 'true' }, lvBar));

  room = createRoom({ onPetTap: () => act('pet') });
  const roomEl = room.el;
  // 이웃: 캐릭터를 만든 다른 반려동물들이 놀러 온다. 눌러서 그 아이 집으로 갈 수 있다.
  const neighborList = state.pets.filter(p => p.id !== pet.id).map(p => {
    const raw = state.characters.find(x => x.id === p.id);
    if (!raw) return null;
    const nch = normalizeChar(raw);
    return { name: p.name, ch: nch, stats: currentStats(nch) };
  }).filter(Boolean);
  room.setNeighbors(neighborList, id => { state.carePet = id; ctx.render(); }, pet.name);
  const othersWithoutChar = state.pets.filter(p => p.id !== pet.id && !state.characters.some(x => x.id === p.id));

  const buttons = [];
  const actionRow = h('div', { class: 'care-buttons' }, Object.entries(ACTIONS).map(([key, a]) => {
    const b = h('button', { class: 'round-btn', type: 'button', onclick: () => act(key) },
      h('span', { class: 'round-icon', 'aria-hidden': 'true' }, a.emoji),
      h('span', { class: 'round-label' }, a.label));
    buttons.push(b);
    return b;
  }));

  const giftDot = h('i', { class: 'tile-dot', 'aria-label': '받을 선물이 있어요' });
  const tile = (emoji, label, onclick, extra) => h('button', { class: 'tile', type: 'button', onclick },
    h('span', { class: 'tile-emoji', 'aria-hidden': 'true' }, emoji), label, extra);
  const tiles = h('div', { class: 'tiles' },
    tile('🛍️', '상점', () => openCatalog('shop')),
    tile('🛋️', '꾸미기', () => openCatalog('decor')),
    tile('🎁', '출석 선물', () => claimGift(), giftDot),
    tile('🎨', '모습 바꾸기', () => openLook()));

  /* 화면 갱신 */
  function refresh() {
    const s = currentStats(ch);
    room.update(ch, s, moodOf(s));
    for (const b of BARS) {
      const e = barEls[b.key];
      e.fill.style.width = s[b.key] + '%';
      e.fill.className = s[b.key] < 25 ? 'low' : '';
      e.track.setAttribute('aria-valuenow', s[b.key]);
      e.val.textContent = s[b.key];
    }
    const lv = levelOf(ch.xp);
    levelChip.textContent = `친밀도 Lv.${lv}`;
    lvBar.style.width = Math.round(((ch.xp - levelFloor(lv)) / (levelFloor(lv + 1) - levelFloor(lv))) * 100) + '%';
    giftDot.style.display = ch.checkin.last === today() ? 'none' : 'block';
    return s;
  }

  const setBusy = b => buttons.forEach(x => { x.disabled = b; });

  function earn(amount) {
    if (ch.earn.date !== today()) ch.earn = { date: today(), n: 0 };
    const got = Math.max(0, Math.min(amount, DAILY_COIN_CAP - ch.earn.n));
    ch.earn.n += got;
    ch.coins += got;
    return got;
  }

  function addXp(n) {
    const before = levelOf(ch.xp);
    ch.xp += n;
    const after = levelOf(ch.xp);
    if (after > before) { ch.coins += 25; return after; }
    return 0;
  }

  async function act(key) {
    if (room.busy) return;
    const now = Date.now();
    const s = currentStats(ch, now);
    const a = ACTIONS[key];
    const r = a.run(s);
    room.touch();
    if (!r.ok) { room.say(r.msg); return; }
    for (const k of Object.keys(RATES)) s[k] = clamp(s[k] + (r.d[k] || 0));
    Object.assign(ch, s, { at: now });
    const got = earn(a.coin);
    const lvUp = addXp(a.xp);
    room.say(r.msg);
    if (got) room.coinFloat(`+${got}`);
    setBusy(true);
    try { await save(state, ch); } catch { ctx.toast('저장하지 못했어요. 저장 공간을 확인해 주세요.'); }
    refresh();
    await room.actions[key]();
    setBusy(false);
    refresh();
    if (lvUp) { room.say(`친밀도가 올랐어요! Lv.${lvUp}`, 3500); room.sparkles(10); ctx.toast(`친밀도 Lv.${lvUp}! 보너스 코인 25개`); }
  }

  async function claimGift() {
    if (ch.checkin.last === today()) { ctx.toast('오늘 선물은 이미 받았어요. 내일 또 만나요!'); return; }
    const yesterday = ymd(new Date(Date.now() - 86400000));
    const streak = ch.checkin.last === yesterday ? ch.checkin.streak + 1 : 1;
    const reward = 20 + Math.min(streak - 1, 6) * 5;
    ch.checkin = { last: today(), streak };
    ch.coins += reward;
    addXp(5);
    try { await save(state, ch); } catch { ctx.toast('저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.'); return; }
    refresh();
    room.coinFloat(`+${reward}`);
    room.sparkles(10);
    await ctx.confirmBox({ title: `출석 ${streak}일째!`, message: `코인 ${reward}개를 받았어요. 매일 오면 더 많이 받아요.`, ok: '좋아요', cancel: null });
  }

  function openLook() {
    ctx.openSheet('모습 바꾸기', api => lookForm({
      initial: { kind: ch.kind, fur: ch.fur, color: ch.color }, outfit: ch.outfit, submitLabel: '저장',
      onSubmit: async look => {
        try {
          Object.assign(ch, look);
          await save(state, ch);
          api.close();
          refresh();
          ctx.toast('모습을 바꿨어요');
        } catch { ctx.toast('저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.'); }
      },
    }));
  }

  /* ---- 상점 / 꾸미기 ---- */
  async function commit(message) {
    try { await save(state, ch); } catch { ctx.toast('저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.'); return false; }
    refresh();
    if (message) ctx.toast(message);
    return true;
  }

  function openCatalog(mode) {
    const shop = mode === 'shop';
    let tab = 'furn';
    ctx.openSheet(shop ? '상점' : '꾸미기', () => {
      const body = h('div', { class: 'catalog' });
      const owns = id => ch.owned.includes(id);
      const priceTag = price => h('span', { class: 'price' }, coinIcon(), price === 0 ? '무료' : price);
      const artHtml = html => { const d = h('div', { class: 'art-box' }); d.innerHTML = html; return d; };
      const card = ({ art, name, price, owned, label, onclick, disabled, active }) => h('div', { class: 'shop-card' + (active ? ' active' : '') },
        h('div', { class: 'shop-art' }, art),
        h('strong', {}, name),
        shop && !owned ? priceTag(price) : null,
        h('button', { class: 'btn small ' + (active ? 'soft' : 'primary'), type: 'button', disabled, onclick }, label));

      const buy = async (id, price, apply, doneMsg) => {
        if (ch.coins < price) { ctx.toast('코인이 부족해요. 돌보기와 추억 쓰기로 모을 수 있어요.'); return; }
        ch.coins -= price;
        ch.owned.push(id);
        apply();
        if (await commit(doneMsg)) draw();
      };

      const furnTab = () => Object.entries(FURNITURE).filter(([id]) => shop || owns(id)).map(([id, it]) => {
        const has = owns(id);
        const placed = ch.placed.includes(id);
        if (shop) {
          return card({
            art: artHtml(furnitureSvg(id)), name: it.name, price: it.price, owned: has,
            label: has ? '보유중' : '구매', disabled: has,
            onclick: () => buy(id, it.price, () => ch.placed.push(id), `${it.name}을(를) 샀어요. 방에 놓았어요!`),
          });
        }
        return card({
          art: artHtml(furnitureSvg(id)), name: it.name, price: 0, owned: true, active: placed,
          label: placed ? '치우기' : '놓기',
          onclick: async () => {
            ch.placed = placed ? ch.placed.filter(x => x !== id) : [...ch.placed, id];
            if (await commit()) draw();
          },
        });
      });

      const roomTab = () => {
        const mk = (kindName, table, current, setIt) => Object.entries(table).filter(([id]) => shop || owns(`${kindName}:${id}`)).map(([id, it]) => {
          const key = `${kindName}:${id}`;
          const has = owns(key);
          const swatch = h('div', { class: 'swatch-art' });
          swatch.style.background = it.bg;
          const name = `${kindName === 'wall' ? '벽지' : '바닥'} · ${it.name}`;
          const using = current === id;
          if (shop && !has) {
            return card({ art: swatch, name, price: it.price, owned: false, label: '구매',
              onclick: () => buy(key, it.price, () => setIt(id), `${it.name}을(를) 샀어요. 바로 적용했어요!`) });
          }
          return card({
            art: swatch, name, price: 0, owned: true, active: using, label: using ? '사용중' : '고르기', disabled: using,
            onclick: async () => { setIt(id); if (await commit()) draw(); },
          });
        });
        return [...mk('wall', WALLS, ch.wall, id => { ch.wall = id; }), ...mk('floor', FLOORS, ch.floor, id => { ch.floor = id; })];
      };

      const outfitTab = () => {
        const cards = [];
        const slotName = { hat: '머리', neck: '목', face: '얼굴' };
        const look = (slot, id) => characterSvg({ kind: ch.kind, fur: ch.fur, color: ch.color, mood: 'happy', outfit: id ? { [slot]: id } : {} });
        if (!shop) {
          for (const slot of ['hat', 'neck', 'face']) {
            const off = !ch.outfit[slot];
            cards.push(card({ art: artHtml(look(slot, null)), name: `${slotName[slot]} · 벗기`, price: 0, owned: true, active: off,
              label: off ? '맨몸' : '벗기', disabled: off,
              onclick: async () => { ch.outfit[slot] = null; if (await commit()) draw(); } }));
          }
        }
        for (const [id, it] of Object.entries(OUTFITS)) {
          const key = `outfit:${id}`;
          const has = owns(key);
          if (!shop && !has) continue;
          const wearing = ch.outfit[it.slot] === id;
          const equip = () => { ch.outfit[it.slot] = id; };
          const name = `${slotName[it.slot]} · ${it.name}`;
          if (shop && !has) {
            cards.push(card({ art: artHtml(look(it.slot, id)), name, price: it.price, owned: false, label: '구매',
              onclick: () => buy(key, it.price, equip, `${it.name}을(를) 샀어요. 입혀 줬어요!`) }));
          } else {
            cards.push(card({ art: artHtml(look(it.slot, id)), name, price: 0, owned: true, active: wearing,
              label: wearing ? '입는 중' : '입기', disabled: wearing,
              onclick: async () => { equip(); if (await commit()) draw(); } }));
          }
        }
        return cards;
      };

      function draw() {
        const tabs = h('div', { class: 'seg', role: 'tablist' },
          [['furn', '가구'], ['room', '벽지·바닥'], ['outfit', '옷']].map(([k, label]) => h('button', {
            type: 'button', class: tab === k ? 'active' : '', role: 'tab', onclick: () => { tab = k; draw(); },
          }, label)));
        const cards = ({ furn: furnTab, room: roomTab, outfit: outfitTab })[tab]();
        body.replaceChildren(...[
          tabs,
          shop && h('div', { class: 'wallet' }, '보유 코인', h('b', {}, coinIcon(), ch.coins.toLocaleString('ko-KR'))),
          cards.length ? h('div', { class: 'shop-grid' }, cards)
            : h('p', { class: 'muted pad' }, '아직 가진 물건이 없어요. 상점에서 구경해 보세요!'),
        ].filter(Boolean));
      }
      draw();
      return body;
    });
  }

  refresh();
  return h('div', { class: 'page care' }, chips,
    h('section', { class: 'card home-card' }, roomEl, nameRow, bars, actionRow, tiles,
      othersWithoutChar.length ? h('p', { class: 'muted neighbor-tip' }, `${othersWithoutChar.map(p => p.name).join(', ')}의 캐릭터도 만들면 이웃으로 놀러 와요. 위에서 아이를 눌러 만들 수 있어요.`) : (neighborList.length ? h('p', { class: 'muted neighbor-tip' }, '이웃 아이를 누르면 그 아이의 집에 놀러 갈 수 있어요.') : null)));
}
