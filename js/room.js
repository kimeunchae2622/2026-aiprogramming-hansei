// 우리 집 장면: 방(벽·바닥·창문·가구), 실시간 낮밤과 날씨, 돌아다니고 잠자는 캐릭터, 행동 연출.
import { h } from './util.js';
import { characterSvg } from './character.js';
import { FURNITURE, WALLS, FLOORS, furnitureSvg } from './items.js';
import { iconEl as ic } from './icons.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const rand = (a, b) => a + Math.random() * (b - a);

export const WEATHER_LABEL = { sunny: '맑음', cloudy: '흐림', rain: '비', snow: '눈' };
const SKY = { dawn: ['#ffd1ad', '#ffeed6'], day: ['#7cc8ff', '#e3f4ff'], dusk: ['#ff8f66', '#ffd9ad'], night: ['#18204a', '#38457f'] };

export function phaseOf(hour) {
  if (hour >= 5 && hour < 7) return 'dawn';
  if (hour >= 7 && hour < 17) return 'day';
  if (hour >= 17 && hour < 19) return 'dusk';
  return 'night';
}

// 날씨는 그날 날짜로 정해진다 (같은 날에는 하루 종일 같은 날씨)
export function weatherOf(date) {
  const key = date.getFullYear() * 372 + date.getMonth() * 31 + date.getDate();
  const r = ((key * 9301 + 49297) % 233280) / 233280;
  const winter = date.getMonth() === 11 || date.getMonth() <= 1;
  if (r < 0.14) return winter ? 'snow' : 'rain';
  if (r < 0.36) return 'cloudy';
  return 'sunny';
}

const coinSvg = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#ffcf3d" stroke="#d99a00" stroke-width="2"/><circle cx="12" cy="12" r="6" fill="none" stroke="#e8a900" stroke-width="2"/></svg>';
export const coinIcon = () => { const t = document.createElement('template'); t.innerHTML = coinSvg; return t.content.firstChild; };

// opts: { onPetTap }
export function createRoom(opts = {}) {
  let alive = true;
  let busy = false;
  let sleeping = false;
  let eating = false;
  let moodOverride = null;
  let px = 50;                 // 캐릭터 가로 위치(%)
  let lastTouch = 0;
  let cur = { ch: null, stats: null, mood: 'normal' };
  const timers = new Set();
  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };

  /* ---------- 뼈대 ---------- */
  const sun = h('div', { class: 'win-sun' });
  const moon = h('div', { class: 'win-moon' });
  const sky = h('div', { class: 'win-sky' }, sun, moon,
    h('div', { class: 'win-cloud c1' }), h('div', { class: 'win-cloud c2' }), h('div', { class: 'win-rain' }), h('div', { class: 'win-snow' }));
  const windowEl = h('div', { class: 'room-window' }, sky, h('div', { class: 'win-cross' }));
  const wall = h('div', { class: 'room-wall' }, windowEl);
  const floor = h('div', { class: 'room-floor' });
  const wallItems = h('div', { class: 'layer' });
  const floorItems = h('div', { class: 'layer' });
  const fxLayer = h('div', { class: 'layer fx-layer', 'aria-hidden': 'true' });
  const night = h('div', { class: 'room-night' });
  const glow = h('div', { class: 'lamp-glow' });

  const petSvg = h('div', { class: 'pet-svg', role: 'img' });
  const zzz = h('div', { class: 'zzz', 'aria-hidden': 'true' }, 'z', h('b', {}, 'Z'), h('i', {}, 'z'));
  const bubble = h('div', { class: 'room-bubble', role: 'status', 'aria-live': 'polite' });
  const petInner = h('div', { class: 'pet-inner' }, petSvg);
  const petBtn = h('button', { class: 'pet-hit', type: 'button', 'aria-label': '쓰다듬기', onclick: () => { touch(); opts.onPetTap && opts.onPetTap(); } }, petInner);
  const pet = h('div', { class: 'room-pet', style: 'left:50%' }, petBtn, zzz);

  const coinNum = h('span', {}, '0');
  const coinPill = h('div', { class: 'hud-pill coin', 'aria-label': '코인' }, coinIcon(), coinNum);
  const timePill = h('div', { class: 'hud-pill' });
  const hud = h('div', { class: 'room-hud' }, coinPill, timePill);

  const el = h('div', { class: 'room', 'data-phase': 'day', 'data-weather': 'sunny' }, wall, floor, wallItems, floorItems, pet, night, glow, fxLayer, bubble, hud);

  /* ---------- 그리기 ---------- */
  const touch = () => { lastTouch = Date.now(); if (sleeping) wake(); };

  function mood() {
    if (sleeping) return 'sleep';
    if (eating) return 'eat';
    return moodOverride || cur.mood;
  }

  function paintPet() {
    const { ch } = cur;
    if (!ch) return;
    petSvg.innerHTML = characterSvg({
      kind: ch.kind, fur: ch.fur, color: ch.color, mood: mood(),
      dirty: !!(cur.stats && cur.stats.clean < 40), outfit: ch.outfit || {},
    });
    petSvg.setAttribute('aria-label', '캐릭터');
  }

  function drawRoom() {
    const { ch } = cur;
    wall.style.background = (WALLS[ch.wall] || WALLS.cream).bg;
    floor.style.background = (FLOORS[ch.floor] || FLOORS.wood).bg;
    wallItems.replaceChildren();
    floorItems.replaceChildren();
    let lamp = null;
    for (const id of ch.placed) {
      const it = FURNITURE[id];
      if (!it || !ch.owned.includes(id)) continue;
      const box = h('div', { class: `furn item-${id}` + (it.kind === 'floor' ? ` furn-${it.layer}` : ' furn-wall') });
      box.style.left = it.x + '%';
      box.style.width = it.w + '%';
      box.style.aspectRatio = `${it.vb[0]} / ${it.vb[1]}`;
      if (it.kind === 'floor') box.style.bottom = it.b + '%'; else box.style.top = it.t + '%';
      box.innerHTML = furnitureSvg(id);
      (it.kind === 'floor' ? floorItems : wallItems).append(box);
      if (id === 'lamp') lamp = it;
    }
    glow.style.display = lamp ? 'block' : 'none';
    if (lamp) { glow.style.left = lamp.x + '%'; glow.style.bottom = (lamp.b + 17) + '%'; }
    updateClock();
  }

  function updateClock() {
    const d = new Date();
    const hh = ((d.getHours() % 12) + d.getMinutes() / 60) * 30;
    const mm = d.getMinutes() * 6;
    const hand = (cls, deg) => el.querySelectorAll(cls).forEach(n => n.setAttribute('transform', `rotate(${deg} 50 50)`));
    hand('.hand-h', hh); hand('.hand-m', mm);
  }

  function ambient() {
    const now = new Date();
    const phase = phaseOf(now.getHours());
    const weather = weatherOf(now);
    el.dataset.phase = phase;
    el.dataset.weather = weather;
    const [a, b] = SKY[phase];
    sky.style.background = `linear-gradient(${a}, ${b})`;
    const t = Math.min(1, Math.max(0, (now.getHours() + now.getMinutes() / 60 - 5) / 14)); // 5시~19시
    sun.style.left = (10 + t * 70) + '%';
    sun.style.top = (62 - Math.sin(Math.PI * t) * 46) + '%';
    const nt = (((now.getHours() + now.getMinutes() / 60) - 19 + 24) % 24) / 10; // 19시~5시
    moon.style.left = (14 + Math.min(1, nt) * 62) + '%';
    moon.style.top = (58 - Math.sin(Math.PI * Math.min(1, nt)) * 38) + '%';
    const label = now.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });
    timePill.replaceChildren(ic(phase === 'night' ? 'moon' : 'sun', { size: 16 }), `${label} · ${WEATHER_LABEL[weather]}`);
    updateClock();
    if (sleeping && phase !== 'night') wake();
  }

  /* ---------- 캐릭터 움직임 ---------- */
  async function walkTo(x) {
    const dx = x - px;
    if (Math.abs(dx) < 1) return;
    const d = 500 + Math.abs(dx) * 36;
    pet.classList.toggle('dir-left', dx < 0);
    pet.classList.add('walking');
    pet.style.transition = `left ${d}ms ease-in-out`;
    pet.style.left = x + '%';
    px = x;
    await sleep(d);
    pet.classList.remove('walking');
  }

  function sleepSpot() {
    const { ch } = cur;
    if (ch && ch.placed.includes('bed') && ch.owned.includes('bed')) return FURNITURE.bed.x;
    if (ch && ch.placed.includes('cushion') && ch.owned.includes('cushion')) return FURNITURE.cushion.x;
    return 50;
  }

  async function goSleep() {
    if (sleeping) return;
    await walkTo(sleepSpot());
    if (busy) return;
    sleeping = true;
    pet.classList.add('sleeping');
    paintPet();
  }

  function wake() {
    if (!sleeping) return;
    sleeping = false;
    pet.classList.remove('sleeping');
    paintPet();
  }

  async function wander() {
    while (alive) {
      await sleep(rand(3500, 8000));
      if (!alive) return;
      if (busy || document.hidden) continue;
      if (sleeping) { if (el.dataset.phase !== 'night') wake(); continue; }
      if (el.dataset.phase === 'night' && Date.now() - lastTouch > 9000) { await goSleep(); continue; }
      await walkTo(rand(20, 80));
    }
  }

  /* ---------- 연출 도구 ---------- */
  function fx(html, { x, y, cls = '', life = 1500, delay = 0, style = '' }) {
    const n = h('div', { class: 'fx ' + cls, style: `left:${x}%;top:${y}%;animation-delay:${delay}ms;${style}` });
    n.innerHTML = html;
    fxLayer.append(n);
    later(() => n.remove(), life + delay);
    return n;
  }
  const heartSvg = '<svg viewBox="0 0 24 24" width="26" height="26" fill="#ff5a7a" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>';
  function hearts(n = 5) {
    for (let i = 0; i < n; i++) fx(heartSvg, { x: px - 10 + rand(0, 20), y: 60, cls: 'rise', delay: i * 110, life: 1500 });
  }
  function sparkles(n = 8) {
    for (let i = 0; i < n; i++) fx('✨', { x: px - 14 + rand(0, 28), y: 56 + rand(0, 20), cls: 'twinkle', delay: i * 90, life: 1200 });
  }
  function say(text, ms = 2800) {
    bubble.textContent = text;
    bubble.classList.add('show');
    later(() => { if (bubble.textContent === text) bubble.classList.remove('show'); }, ms);
  }
  function coinFloat(text) {
    const n = h('div', { class: 'coin-float' }, text);
    hud.append(n);
    later(() => n.remove(), 1400);
  }

  /* ---------- 행동 연출 (끝나면 Promise 가 풀린다) ---------- */
  async function run(fn) {
    if (busy) return false;
    busy = true; touch(); wake();
    try { await fn(); } finally { busy = false; moodOverride = null; paintPet(); }
    return true;
  }

  const bowl = () => el.querySelector('.item-bowl .kibble');

  const actions = {
    feed: () => run(async () => {
      await walkTo(FURNITURE.bowl.x + 14);
      const k = bowl();
      if (k) k.setAttribute('opacity', '1');
      await sleep(350);
      eating = true; paintPet();
      pet.classList.add('chewing');
      await sleep(2300);
      pet.classList.remove('chewing');
      eating = false;
      if (k) k.setAttribute('opacity', '0');
      moodOverride = 'happy'; paintPet();
      hearts(4);
      await sleep(900);
    }),
    snack: () => run(async () => {
      fx('<svg viewBox="0 0 40 24" width="48" height="30"><g fill="#f4e6c9" stroke="#b79b6b" stroke-width="2"><rect x="9" y="8" width="22" height="8" rx="4"/><circle cx="8" cy="8" r="5"/><circle cx="8" cy="16" r="5"/><circle cx="32" cy="8" r="5"/><circle cx="32" cy="16" r="5"/></g></svg>',
        { x: px, y: 8, cls: 'drop', life: 1100 });
      await sleep(850);
      pet.classList.add('jump');
      eating = true; paintPet();
      await sleep(1300);
      pet.classList.remove('jump');
      eating = false;
      moodOverride = 'happy'; paintPet();
      hearts(3);
      await sleep(700);
    }),
    play: () => run(async () => {
      const ball = h('div', { class: 'toy-ball' });
      ball.style.left = (px + 14) + '%';
      floorItems.append(ball);
      let bx = px + 14;
      for (let i = 0; i < 3; i++) {
        let tx; do { tx = rand(18, 82); } while (Math.abs(tx - bx) < 20);
        ball.classList.add('bouncing');
        ball.style.transition = 'left .9s ease-in-out';
        ball.style.left = tx + '%';
        bx = tx;
        await Promise.all([walkTo(tx - 10 * Math.sign(tx - px) - 0), sleep(950)]);
        ball.classList.remove('bouncing');
        if (i === 1) { moodOverride = 'happy'; paintPet(); }
      }
      ball.remove();
      hearts(5);
      await sleep(600);
    }),
    wash: () => run(async () => {
      await walkTo(50);
      moodOverride = 'happy'; paintPet();
      pet.classList.add('shake');
      for (let i = 0; i < 14; i++) fx('', { x: px - 18 + rand(0, 36), y: 48 + rand(0, 14), cls: 'foam', life: 2000, delay: i * 90, style: `--s:${rand(14, 30)}px` });
      for (let i = 0; i < 10; i++) fx('', { x: px - 16 + rand(0, 32), y: 14, cls: 'drip', life: 1200, delay: i * 120 });
      await sleep(2300);
      pet.classList.remove('shake');
      sparkles(10);
      await sleep(900);
    }),
    pet: () => run(async () => {
      pet.classList.add('squish');
      moodOverride = 'happy'; paintPet();
      hearts(4);
      await sleep(900);
      pet.classList.remove('squish');
    }),
  };

  /* ---------- 이웃(= 사용자가 키우는 다른 반려동물)이 놀러 오기 ---------- */
  const neighbors = [];
  const greetings = ['안녕!', '같이 놀자!', '놀러 왔어요~', '여기 아늑하다!', '냄새 좋아요'];

  function addNeighbor({ name, ch, stats }, onVisit, mainName) {
    const holder = h('div', { class: 'pet-svg' });
    const nbBubble = h('div', { class: 'nb-bubble' });
    const tag = h('span', { class: 'nb-name' }, name);
    const hit = h('button', { class: 'pet-hit', type: 'button', 'aria-label': `${name}의 집에 놀러 가기`, onclick: () => onVisit(ch.id) },
      h('div', { class: 'pet-inner' }, holder), tag);
    const node = h('div', { class: 'room-pet room-neighbor', style: `left:${rand(18, 82)}%` }, nbBubble, hit);
    const n = { node, holder, nbBubble, x: parseFloat(node.style.left), ch, stats, name };
    const paint = () => {
      const asleep = el.dataset.phase === 'night';
      holder.innerHTML = characterSvg({ kind: ch.kind, fur: ch.fur, color: ch.color, mood: asleep ? 'sleep' : 'normal', outfit: ch.outfit || {} });
      node.classList.toggle('sleeping', asleep);
    };
    n.paint = paint;
    paint();
    el.insertBefore(node, night);
    neighbors.push(n);

    const walk = async x => {
      const dx = x - n.x;
      if (Math.abs(dx) < 1) return;
      const d = 600 + Math.abs(dx) * 42;
      node.classList.toggle('dir-left', dx < 0);
      node.classList.add('walking');
      node.style.transition = `left ${d}ms ease-in-out`;
      node.style.left = x + '%';
      n.x = x;
      await sleep(d);
      node.classList.remove('walking');
    };
    const nbSay = text => {
      nbBubble.textContent = text;
      nbBubble.classList.add('show');
      later(() => { if (nbBubble.textContent === text) nbBubble.classList.remove('show'); }, 2600);
    };

    (async () => {
      await sleep(rand(1500, 4000));
      while (alive) {
        await sleep(rand(5000, 11000));
        if (!alive) return;
        if (busy || document.hidden) continue;
        if (el.dataset.phase === 'night') { if (!node.classList.contains('sleeping')) paint(); continue; }
        if (node.classList.contains('sleeping')) paint();
        if (Math.random() < 0.45) { // 주인공 캐릭터에게 인사하러 가기
          const side = px > 50 ? -1 : 1;
          await walk(Math.max(14, Math.min(86, px + side * 20)));
          if (!alive) return;
          nbSay(`${mainName}, ${greetings[Math.floor(Math.random() * greetings.length)]}`);
          hearts(2);
          await sleep(1800);
        } else {
          await walk(rand(14, 86));
        }
      }
    })();
  }

  function setNeighbors(list, onVisit, mainName) {
    neighbors.forEach(n => n.node.remove());
    neighbors.length = 0;
    list.forEach(item => addNeighbor(item, onVisit, mainName));
  }

  /* ---------- 공개 함수 ---------- */
  function update(ch, stats, moodName) {
    const firstDraw = !cur.ch;
    cur = { ch, stats, mood: moodName };
    coinNum.textContent = ch.coins.toLocaleString('ko-KR');
    drawRoom();
    paintPet();
    if (firstDraw) ambient();
  }

  ambient();
  const clockTimer = setInterval(() => { if (!document.hidden) ambient(); }, 30000);
  wander();

  return {
    el, update, say, coinFloat, hearts, sparkles, touch, setNeighbors,
    actions,
    get busy() { return busy; },
    destroy() {
      alive = false;
      clearInterval(clockTimer);
      timers.forEach(clearTimeout);
      timers.clear();
    },
  };
}
