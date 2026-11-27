// 별빛 꼬리 마을: 모바일 가로 화면 2D 픽셀 게임 (같은 앱·같은 주소 안에서 전체 화면으로 열린다)
import * as db from '../db.js';
import { h } from '../util.js';
import { Pix, iconURL, rng } from './pixel.js';
import * as P from './props.js';
import { buildWorld, boxFree, zoneAt, TS, GW, GH, GARDEN } from './world.js';
import { playerFrame, petFrame, playerFace, CHAR_SCALE } from './sprites.js';
import { currentStats, levelOf, levelFloor } from '../care.js';

/* ======================= 데이터 정의 ======================= */
const ITEMS = {
  flower: { name: '꽃', sell: 3, icon: () => P.itemIcon.flower() },
  berry: { name: '열매', sell: 4, icon: () => P.itemIcon.berry() },
  stick: { name: '나뭇가지', sell: 2, icon: () => P.itemIcon.stick() },
  gem: { name: '반짝이는 조각', sell: 10, icon: () => P.itemIcon.gem() },
};
const FURN = {
  cushion: { name: '반려동물 방석', price: 40, w: 1, spr: () => P.cushion(), col: null, desc: '반려동물이 이 위에서 쉬어요' },
  pot: { name: '꽃 화분', price: 30, w: 1, spr: () => P.pot(7), col: [-5, -4, 5, 0], desc: '정원이 화사해져요' },
  bench: { name: '나무 벤치', price: 60, w: 2, spr: () => P.bench(), col: [-13, -6, 13, 0], desc: '앉아서 쉬는 자리' },
};
const SAVE_ID = 'village';
const WALK = 58; // 걷는 속도 (월드 픽셀/초)

const dayKey = (now = Date.now()) => new Date(now + 4 * 3600000).toISOString().slice(0, 10); // 매일 오전 5시(한국 시간)에 바뀜
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ======================= 픽셀 아이콘 (버튼용) ======================= */
const iconCache = {};
function pxIcon(name) {
  if (iconCache[name]) return iconCache[name];
  const mk = (w, hh, fn) => { const p = new Pix(w, hh); fn(p); return iconURL(p.done(), 4); };
  const B = '#7a4a2b';
  const t = {
    paw: () => mk(16, 16, p => { p.ell(8, 11, 4.6, 3.8, B); for (const [x, y] of [[3, 7], [6, 3.6], [10, 3.6], [13, 7]]) p.ell(x, y, 1.9, 2.4, B); }),
    heart: () => mk(14, 13, p => { p.disc(4, 4.5, 3.6, '#ef4f6c'); p.disc(9.6, 4.5, 3.6, '#ef4f6c'); p.poly([[.6, 5.6], [13, 5.6], [7, 12.4]], '#ef4f6c'); p.set(3, 3, '#ffb3c1'); p.set(4, 2, '#ffb3c1'); }),
    bag: () => mk(18, 16, p => { p.rect(6, 2, 6, 3, '#8a5230'); p.rect(7, 3, 4, 2, '#f6e3b8'); p.rect(2, 5, 14, 10, '#e8913a'); p.rect(2, 5, 14, 2, '#f5b366'); p.rect(2, 9, 14, 1, '#b4631b'); p.rect(8, 8, 2, 3, '#ffd24a'); }),
    gear: () => mk(16, 16, p => { for (let a = 0; a < 8; a++) p.disc(8 + Math.cos(a * .785) * 6, 8 + Math.sin(a * .785) * 6, 2, '#9aa0aa'); p.disc(8, 8, 5.4, '#b9bfc9'); p.disc(8, 8, 2.4, '#6b7280'); p.set(6, 6, '#e6e9ee'); }),
    coin: () => mk(14, 14, p => { p.disc(7, 7, 6, '#ffcf3d'); p.disc(7, 7, 4, '#e8a900'); p.disc(7, 7, 3, '#ffe27a'); p.set(5, 5, '#fff7c4'); }),
    basket: () => mk(18, 16, p => { p.rect(3, 6, 12, 9, '#d9a867'); p.rect(3, 6, 12, 2, '#efc98a'); for (let y = 9; y < 15; y += 3) p.rect(3, y, 12, 1, '#a8763a'); p.line(4, 6, 9, 1, '#a8763a'); p.line(14, 6, 9, 1, '#a8763a'); p.disc(7, 5, 2, '#ff8fb8'); p.disc(11, 4.6, 2, '#ffd23f'); }),
    shop: () => mk(18, 16, p => { p.rect(2, 7, 14, 8, '#f6e3b8'); p.poly([[1, 7], [17, 7], [15, 2], [3, 2]], '#ef7ea3'); for (let x = 3; x < 16; x += 4) p.rect(x, 2, 2, 5, '#fff'); p.rect(7, 10, 4, 5, '#8a5230'); }),
    home: () => mk(18, 16, p => { p.poly([[9, 1], [17, 8], [1, 8]], '#cf4640'); p.rect(3, 8, 12, 7, '#f6e3b8'); p.rect(7, 10, 4, 5, '#8a5230'); p.rect(4, 9, 2, 2, '#ffd96b'); }),
    sign: () => mk(16, 16, p => { p.rect(7, 6, 2, 9, '#7d4b29'); p.rect(2, 2, 12, 6, '#f6e3b8'); p.rect(2, 2, 12, 1, '#c98a52'); p.rect(4, 4, 8, 1, '#7d4b29'); p.rect(4, 6, 6, 1, '#7d4b29'); }),
    box: () => mk(16, 14, p => { p.rect(2, 4, 12, 9, '#c98a52'); p.rect(2, 4, 12, 2, '#e0a76e'); p.rect(7, 4, 2, 9, '#a8683a'); }),
    leash: () => mk(16, 16, p => { p.ell(8, 11, 4, 3.4, B); for (const [x, y] of [[4, 8], [6.4, 5], [9.6, 5], [12, 8]]) p.ell(x, y, 1.6, 2, B); p.rect(12, 1, 1, 5, '#e8913a'); p.rect(10, 3, 5, 1, '#e8913a'); }),
  };
  return (iconCache[name] = t[name]());
}
const furnIcon = id => iconURL(FURN[id].spr(), 3);
const itemIconURL = id => iconURL(ITEMS[id].icon(), 3);

/* ======================= 게임 상태 ======================= */
let G = null; // 열려 있는 동안만 존재
let opening = false, worldCache = null; // 마을 지도는 한 번만 만든다

function defaults() {
  return { id: SAVE_ID, v: 1, name: '보호자', x: null, y: null, dir: 'down', companionId: null, bag: { flower: 0, berry: 0, stick: 0, gem: 0 }, gathered: {}, owned: { cushion: 0, pot: 0, bench: 0 }, placed: [], purse: 0, petPos: {}, seenHelp: false };
}
function sanitizeSave(raw) {
  const d = defaults(), s = { ...d, ...(raw || {}) };
  const n = v => (Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0);
  s.name = typeof s.name === 'string' && s.name.trim() ? s.name.trim().slice(0, 10) : d.name;
  s.bag = Object.fromEntries(Object.keys(ITEMS).map(k => [k, n(s.bag && s.bag[k])]));
  s.owned = Object.fromEntries(Object.keys(FURN).map(k => [k, n(s.owned && s.owned[k])]));
  s.placed = (Array.isArray(s.placed) ? s.placed : []).filter(p => p && FURN[p.type] && Number.isFinite(p.tx) && Number.isFinite(p.ty)).map(p => ({ uid: String(p.uid || Math.random().toString(36).slice(2)), type: p.type, tx: Math.floor(p.tx), ty: Math.floor(p.ty) }));
  s.gathered = s.gathered && typeof s.gathered === 'object' ? s.gathered : {};
  s.petPos = s.petPos && typeof s.petPos === 'object' ? s.petPos : {};
  s.purse = n(s.purse);
  return s;
}

/* ======================= 지갑: 모든 아이의 코인 + 마을 주머니 ======================= */
const chars = () => G.ctx.state.characters;
const wallet = () => G.save.purse + chars().reduce((a, c) => a + (c.coins || 0), 0);
async function spend(n) {
  if (wallet() < n) return false;
  let left = n;
  const take = Math.min(G.save.purse, left); G.save.purse -= take; left -= take;
  for (const c of [...chars()].sort((a, b) => (b.coins || 0) - (a.coins || 0))) {
    if (left <= 0) break;
    const t = Math.min(c.coins || 0, left); if (!t) continue;
    c.coins -= t; left -= t;
    await db.put('characters', { ...c });
  }
  G.dirty = true; return true;
}
const earn = n => { G.save.purse += n; G.dirty = true; };

/* ======================= 열기 / 닫기 ======================= */
let escHandler = null, popHandler = null, pushed = false;

export function isVillageOpen() { return !!G; }
export function __debug() { return G; } // 시험용: 실행 중인 게임 상태를 들여다본다 (화면에는 영향 없음)

export async function openVillage(ctx) {
  if (G || opening) return;
  const pets = ctx.state.pets;
  if (!pets.length) { ctx.toast('먼저 반려동물을 등록해 주세요.'); return; }
  opening = true;
  const loading = h('div', { class: 'vg-loading' }, h('div', { class: 'vg-load-ico' }, '🌸'), h('p', {}, '별빛 꼬리 마을을 여는 중…'));
  document.body.append(loading);
  await new Promise(r => setTimeout(r, 40)); // 로딩 화면이 먼저 그려지도록
  let row; try { row = (await db.getAll('game')).find(r => r.id === SAVE_ID); } catch { row = null; }
  let world;
  try { world = worldCache || (worldCache = buildWorld()); } catch (e) { loading.remove(); opening = false; ctx.toast('마을을 열지 못했어요. 잠시 뒤 다시 시도해 주세요.'); return; }
  G = { ctx, world, save: sanitizeSave(row), dirty: false, t: 0, raf: 0, last: 0, S: 2, dpr: 1, vw: 0, vh: 0, cam: { x: 0, y: 0 }, keys: {}, joy: { dx: 0, dy: 0, id: null }, particles: [], pets: [], sel: 'basket', zoneId: null, hudT: 0, saveT: 0, actKey: '', act: null, act2: null, closing: false, tags: new Map(), rot: null };
  setupPlayer(); setupPets(); setupFlies(); buildUI(); resize();
  loading.remove(); opening = false;
  window.addEventListener('resize', resize); window.addEventListener('orientationchange', resize);
  document.addEventListener('keydown', onKey); document.addEventListener('keyup', onKey);
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('pagehide', persist);
  try { history.pushState({ village: 1 }, ''); pushed = true; } catch { pushed = false; }
  popHandler = () => { if (G && pushed) { pushed = false; closeNow(); } };
  window.addEventListener('popstate', popHandler);
  try { const el = document.documentElement; if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' }); } catch { /* 허용되지 않아도 계속 */ }
  try { if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape'); } catch { /* iPhone 등은 회전 안내 */ }
  resize();
  G.last = 0; G.raf = requestAnimationFrame(frame);
  if (!G.save.seenHelp) { G.save.seenHelp = true; G.dirty = true; showHelp(); }
}

function onVis() { if (G && document.hidden) persist(); }

export function closeVillage() { if (!G) return; if (pushed) { try { history.back(); return; } catch { /* 아래로 */ } } closeNow(); }

async function closeNow() {
  if (!G || G.closing) return;
  G.closing = true;
  cancelAnimationFrame(G.raf);
  await persist();
  window.removeEventListener('resize', resize); window.removeEventListener('orientationchange', resize);
  document.removeEventListener('keydown', onKey); document.removeEventListener('keyup', onKey);
  document.removeEventListener('visibilitychange', onVis); window.removeEventListener('pagehide', persist);
  window.removeEventListener('popstate', popHandler); pushed = false;
  G.root.remove();
  const ctx = G.ctx;
  G = null;
  try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch { /* 무시 */ }
  try { if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen(); } catch { /* 무시 */ }
  document.body.classList.remove('noscroll');
  if (ctx.onExit) ctx.onExit();
}

async function persist() {
  if (!G) return;
  G.save.x = Math.round(G.player.x); G.save.y = Math.round(G.player.y); G.save.dir = G.player.dir;
  G.save.petPos = Object.fromEntries(G.pets.map(p => [p.id, [Math.round(p.x), Math.round(p.y)]]));
  try { await db.put('game', { ...G.save }); G.dirty = false; } catch { /* 저장 공간 부족 등: 다음에 다시 시도 */ }
}

/* ======================= 플레이어 / 반려동물 ======================= */
const canStand = (x, y, hw, hh, self) => {
  if (!boxFree(G.world, x, y, hw, hh)) return false;
  for (const f of G.furnCols) if (x + hw > f.x0 && x - hw < f.x1 && y > f.y0 && y - hh < f.y1) return false;
  return true;
};
function findFree(x, y, hw, hh) {
  if (canStand(x, y, hw, hh)) return [x, y];
  for (let r = 6; r < 90; r += 6) for (let a = 0; a < 12; a++) { const nx = x + Math.cos(a * .52) * r, ny = y + Math.sin(a * .52) * r; if (canStand(nx, ny, hw, hh)) return [nx, ny]; }
  return [x, y];
}
function rebuildFurnCols() {
  G.furnCols = [];
  for (const f of G.save.placed) {
    const def = FURN[f.type]; if (!def.col) continue;
    const cx = (f.tx + def.w / 2) * TS, cy = (f.ty + 1) * TS - 2;
    G.furnCols.push({ x0: cx + def.col[0], y0: cy + def.col[1], x1: cx + def.col[2], y1: cy + def.col[3] });
  }
}
function setupPlayer() {
  rebuildFurnCols();
  const s = G.save, w = G.world;
  const [x, y] = findFree(s.x ?? w.spawn.x, s.y ?? w.spawn.y, 5, 4);
  G.player = { x, y, dir: s.dir || 'down', t: 0, moving: false };
}
function petLook(pet) {
  const ch = G.ctx.state.characters.find(c => c.id === pet.id);
  return ch ? { kind: ch.kind, color: ch.color, fur: ch.fur } : { kind: pet.species === 'cat' ? 'cat' : 'dog', color: pet.species === 'cat' ? 'gray' : 'yellow', fur: 'straight' };
}
function setupPets() {
  const rnd = rng(7);
  G.pets = G.ctx.state.pets.map((p, i) => {
    const saved = G.save.petPos[p.id];
    const [x, y] = findFree(saved ? saved[0] : G.player.x + 26 + i * 18, saved ? saved[1] : G.player.y + 10 + (i % 2) * 14, 6, 4);
    const look = petLook(p);
    return { id: p.id, name: p.name, species: p.species, look, x, y, dir: 'down', state: 'idle', timer: 0.5 + rnd() * 2, target: null, anim: 0, speed: 20 + rnd() * 10, trait: { wander: .35 + rnd() * .4, rest: .15 + rnd() * .3, curious: .15 + rnd() * .5 }, happyT: 0, lastPet: 0, stuck: 0, flip: false };
  });
  if (!G.pets.some(p => p.id === G.save.companionId)) G.save.companionId = null;
}

/* ======================= 입력 ======================= */
function onKey(e) {
  if (!G) return;
  if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
  const down = e.type === 'keydown';
  const k = e.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k)) { G.keys[k] = down; e.preventDefault(); }
  if (down && !e.repeat) {
    if (k === 'e' || k === ' ' || k === 'enter') { e.preventDefault(); doMain(); }
    if (k === 'q') doSecond();
    if (k === 'escape' && !G.modal) closeVillage();
  }
}
function moveVec() {
  let dx = G.joy.dx, dy = G.joy.dy;
  const k = G.keys;
  if (k.arrowleft || k.a) dx -= 1; if (k.arrowright || k.d) dx += 1; if (k.arrowup || k.w) dy -= 1; if (k.arrowdown || k.s) dy += 1;
  const l = Math.hypot(dx, dy);
  return l > 1 ? [dx / l, dy / l] : [dx, dy];
}

/* ======================= 업데이트 ======================= */
function tryMove(e, dx, dy, hw, hh) {
  let moved = false;
  if (dx && canStand(e.x + dx, e.y, hw, hh)) { e.x += dx; moved = true; }
  if (dy && canStand(e.x, e.y + dy, hw, hh)) { e.y += dy; moved = true; }
  return moved;
}
const dirOf = (dx, dy, prev) => (Math.abs(dx) > Math.abs(dy) * 1.1 ? (dx < 0 ? 'left' : 'right') : Math.abs(dy) > Math.abs(dx) * 1.1 ? (dy < 0 ? 'up' : 'down') : prev);

function updatePlayer(dt) {
  const p = G.player, [vx, vy] = moveVec(), len = Math.hypot(vx, vy);
  p.moving = len > .12;
  if (p.moving) {
    const sp = WALK * Math.min(1, len);
    const mx = vx * sp * dt, my = vy * sp * dt;
    const ok = tryMove(p, mx, my, 5, 4);
    p.dir = dirOf(vx, vy, p.dir);
    if (ok) { p.t += dt; p.dust = (p.dust || 0) - dt; if (p.dust <= 0) { p.dust = .22; G.particles.push({ kind: 'dust', x: p.x + (Math.random() - .5) * 4, y: p.y - 1, vy: -3, vx: -vx * 6, life: .5, age: 0 }); } } else p.t += dt * .3;
  } else p.t = 0;
}

function updatePets(dt) {
  const pl = G.player;
  for (const pet of G.pets) {
    pet.anim += dt; pet.happyT = Math.max(0, pet.happyT - dt);
    const dxp = pl.x - pet.x, dyp = pl.y - pet.y, dist = Math.hypot(dxp, dyp);
    const isComp = pet.id === G.save.companionId;
    let moving = false;
    const go = (tx, ty, speed, stopAt = 2) => {
      const dx = tx - pet.x, dy = ty - pet.y, d = Math.hypot(dx, dy);
      if (d <= stopAt) return true;
      const sx = dx / d * speed * dt, sy = dy / d * speed * dt;
      const ok = tryMove(pet, sx, sy, 6, 4);
      pet.dir = dirOf(dx, dy, pet.dir); moving = true;
      pet.stuck = ok ? Math.max(0, pet.stuck - dt) : pet.stuck + dt;
      return false;
    };
    if (pet.happyT > 0) { pet.state = 'happy'; pet.dir = dirOf(dxp, dyp, pet.dir); }
    else if (isComp) {
      pet.state = 'follow';
      if (dist > 300) { const [nx, ny] = findFree(pl.x - 12, pl.y + 6, 6, 4); pet.x = nx; pet.y = ny; }
      const off = { left: [14, 2], right: [-14, 2], up: [0, 14], down: [0, -12] }[pl.dir];
      if (dist > 30) go(pl.x + off[0], pl.y + off[1], dist > 70 ? WALK * 1.08 : WALK * .85, 4);
      else if (dist < 14) go(pet.x - dxp, pet.y - dyp, 20, 1);
      else pet.dir = dirOf(dxp, dyp, pet.dir);
      if (pet.stuck > 1.2) { const [nx, ny] = findFree(pl.x, pl.y + 8, 6, 4); pet.x = nx; pet.y = ny; pet.stuck = 0; }
    } else {
      pet.timer -= dt;
      if (pet.state === 'happy' || pet.state === 'follow' || ((pet.state === 'wander' || pet.state === 'approach' || pet.state === 'toRest') && !pet.target)) { pet.state = 'idle'; pet.timer = 1 + Math.random() * 2; pet.target = null; }
      if (pet.state === 'idle' || pet.state === 'look') {
        if (dist < 38 && pet.state !== 'look' && Math.random() < dt * .6) { pet.state = 'look'; pet.timer = 1.4 + Math.random(); }
        if (pet.state === 'look') pet.dir = dirOf(dxp, dyp, pet.dir);
        if (pet.timer <= 0) {
          const r = Math.random(), cush = nearestFurn('cushion', pet.x, pet.y, 150);
          if (cush && r < pet.trait.rest * 1.3) { pet.state = 'toRest'; pet.target = [(cush.tx + .5) * TS, (cush.ty + 1) * TS - 2]; pet.timer = 14; }
          else if (r < pet.trait.rest) { pet.state = 'rest'; pet.timer = 5 + Math.random() * 5; }
          else if (dist < 130 && r < pet.trait.rest + pet.trait.curious) { pet.state = 'approach'; pet.target = [pl.x + (Math.random() - .5) * 40, pl.y + 8 + Math.random() * 14]; pet.timer = 7; }
          else if (r < pet.trait.rest + pet.trait.curious + pet.trait.wander) { pet.state = 'wander'; const a = Math.random() * 6.28, d = 20 + Math.random() * 70; pet.target = [pet.x + Math.cos(a) * d, pet.y + Math.sin(a) * d]; pet.timer = 6; }
          else { pet.state = 'idle'; pet.timer = 1 + Math.random() * 3; }
        }
      } else if (pet.state === 'rest') { if (pet.timer <= 0) { pet.state = 'idle'; pet.timer = 1 + Math.random() * 2; } }
      else { // 목표로 걸어가기
        const arrived = pet.target ? go(pet.target[0], pet.target[1], pet.speed, 3) : true;
        if (arrived || pet.stuck > .8 || pet.timer <= 0) { pet.stuck = 0; if (arrived && pet.state === 'toRest') { pet.state = 'rest'; pet.timer = 8 + Math.random() * 6; } else { pet.state = 'idle'; pet.timer = .8 + Math.random() * 2.5; } }
      }
    }
    pet.moving = moving;
  }
}
const nearestFurn = (type, x, y, maxD) => {
  let best = null, bd = maxD;
  for (const f of G.save.placed) if (f.type === type) { const d = Math.hypot((f.tx + .5) * TS - x, (f.ty + 1) * TS - y); if (d < bd) { bd = d; best = f; } }
  return best;
};

/* ---- 나비: 꽃무더기 근처를 천천히 날아다닌다 ---- */
const flyCache = {};
const flySpr = (c, open) => flyCache[c + open] || (flyCache[c + open] = P.butterfly(c, open));
function setupFlies() {
  const rnd = rng(31), blooms = G.world.objects.filter(o => o.kind === 'bloom');
  G.flies = [];
  for (let i = 0; i < 16 && blooms.length; i++) { const b = blooms[Math.floor(rnd() * blooms.length)]; G.flies.push({ hx: b.x, hy: b.y - 12, ph: rnd() * 6.28, c: ['#ffd23f', '#ffffff', '#ff9bbd', '#9fd0ff'][i % 4] }); }
}

/* ---- 효과 입자 ---- */
const heartSpr = (() => { let s; return () => s || (s = (() => { const p = new Pix(11, 10); p.disc(3.5, 3.5, 3, '#ff5a7a'); p.disc(7.5, 3.5, 3, '#ff5a7a'); p.poly([[.6, 4.6], [10.4, 4.6], [5.5, 9.6]], '#ff5a7a'); p.set(2, 2, '#ffd0da'); p.outline(.5); return p.done(5.5, 9); })()); })();
const sparkSpr = (() => { let s; return () => s || (s = (() => { const p = new Pix(9, 9); p.rect(4, 0, 1, 9, '#fff6b0'); p.rect(0, 4, 9, 1, '#fff6b0'); p.rect(3, 3, 3, 3, '#ffffff'); return p.done(4, 4); })()); })();
function burst(kind, x, y, n = 4) {
  for (let i = 0; i < n; i++) G.particles.push({ kind, x: x + (Math.random() - .5) * 14, y, vy: -14 - Math.random() * 10, vx: (Math.random() - .5) * 10, life: 1.1 + Math.random() * .3, age: -i * .08 });
}
function floatText(text, x, y) { G.particles.push({ kind: 'text', text, x, y, vy: -16, vx: 0, life: 1.2, age: 0 }); }
function updateParticles(dt) {
  for (const p of G.particles) { p.age += dt; if (p.age > 0) { p.x += p.vx * dt; p.y += p.vy * dt; } }
  G.particles = G.particles.filter(p => p.age < p.life);
  // 벚꽃잎: 화면 안의 벚나무에서 떨어진다
  G.petals = G.petals || [];
  const cx = G.cam.x, cy = G.cam.y;
  if (G.petals.length < 26 && Math.random() < dt * 14) {
    const trees = G.world.petalTrees.filter(t => t.x > cx - 30 && t.x < cx + G.vw + 30 && t.y > cy - 60 && t.y < cy + G.vh + 60);
    if (trees.length) { const t = trees[Math.floor(Math.random() * trees.length)]; G.petals.push({ x: t.x + (Math.random() - .5) * t.r * 2, y: t.y + (Math.random() - .3) * t.r, vy: 8 + Math.random() * 8, ph: Math.random() * 6.28, life: 5 + Math.random() * 2, age: 0, c: Math.random() > .5 ? '#ffc7dc' : '#ffffff' }); }
  }
  for (const p of G.petals) { p.age += dt; p.y += p.vy * dt; p.x += Math.sin(p.age * 2 + p.ph) * 8 * dt + 4 * dt; }
  G.petals = G.petals.filter(p => p.age < p.life);
}

/* ======================= 상호작용 ======================= */
const today = () => dayKey();
const spotActive = s => G.save.gathered[s.id] !== today();
const dist = (a, x, y) => Math.hypot(a.x - x, a.y - y);

function computeActions() {
  const pl = G.player, W = G.world;
  let act = null, act2 = null;
  const pets = G.pets.map(p => [p, Math.hypot(p.x - pl.x, p.y - pl.y)]).filter(([, d]) => d < 26).sort((a, b) => a[1] - b[1]);
  const near = pets[0] && pets[0][0];
  if (near) {
    act = { key: 'pet:' + near.id, label: `${near.name} 쓰다듬기`, icon: 'heart', run: () => petPet(near) };
    const on = G.save.companionId === near.id;
    act2 = { key: 'comp:' + near.id + on, label: on ? '동행 해제' : '산책 동행', icon: 'leash', run: () => toggleCompanion(near) };
  }
  // 가구 놓기 모드
  const sel = G.sel;
  if (FURN[sel] && G.save.owned[sel] > 0) {
    const g = ghost();
    act = { key: 'place:' + sel + (g.ok ? 1 : 0), label: g.ok ? `${FURN[sel].name} 놓기` : '여기엔 놓을 수 없어요', icon: 'box', disabled: !g.ok, run: () => placeFurn(sel, g) };
    return { act, act2 };
  }
  if (!act) {
    let best = null, bd = 1e9;
    for (const s of W.spots) { if (!spotActive(s)) continue; const d = dist(s, pl.x, pl.y); if (d < s.r && d < bd) { bd = d; best = { key: 'gather:' + s.id, label: `${ITEMS[s.type].name} 채집`, icon: 'basket', run: () => gather(s) }; } }
    if (best) act = best;
  }
  if (!act) {
    let best = null, bd = 1e9;
    for (const it of W.interacts) { const d = dist(it, pl.x, pl.y); if (d < it.r && d < bd) { bd = d; best = it; } }
    if (best) act = { key: 'it:' + best.id, label: best.kind === 'shop' ? '상점 구경하기' : best.kind === 'home' ? '집에 들어가기' : best.kind === 'wip' ? best.label + ' (준비 중)' : best.label, icon: best.kind === 'shop' ? 'shop' : best.kind === 'home' ? 'home' : 'sign', run: () => useInteract(best) };
  }
  if (!act) {
    for (const f of G.save.placed) if (Math.hypot((f.tx + FURN[f.type].w / 2) * TS - pl.x, (f.ty + .5) * TS - pl.y) < 22) { act = { key: 'pick:' + f.uid, label: `${FURN[f.type].name} 치우기`, icon: 'box', run: () => pickFurn(f) }; break; }
  }
  return { act, act2 };
}
function doMain() { if (G && G.act && !G.act.disabled && !G.modal) G.act.run(); }
function doSecond() { if (G && G.act2 && !G.modal) G.act2.run(); }

async function petPet(pet) {
  pet.happyT = 1.6; pet.state = 'happy'; burst('heart', pet.x, pet.y - 18, 4);
  const now = Date.now();
  if (now - pet.lastPet < 6000) return;
  pet.lastPet = now;
  const ch = chars().find(c => c.id === pet.id);
  if (ch) { // 기존 친밀도(경험치)와 기분을 올린다
    const s = currentStats(ch, now);
    Object.assign(ch, { full: s.full, happy: Math.min(100, s.happy + 3), clean: s.clean, at: now, xp: (ch.xp || 0) + 1 });
    try { await db.put('characters', { ...ch }); } catch { /* 저장 실패는 무시 */ }
    floatText('친밀도 +1', pet.x, pet.y - 30);
  }
}
function toggleCompanion(pet) {
  G.save.companionId = G.save.companionId === pet.id ? null : pet.id; G.dirty = true;
  toast(G.save.companionId ? `${pet.name}와(과) 함께 산책해요!` : `${pet.name}는 마을에서 쉬어요`);
  burst('heart', pet.x, pet.y - 18, 2);
}
async function gather(s) {
  if (!spotActive(s)) return;
  G.save.gathered[s.id] = today(); G.save.bag[s.type]++; G.dirty = true;
  burst('spark', s.x, s.y - 8, 5); floatText(`${ITEMS[s.type].name} +1`, s.x, s.y - 14);
  await persist();
}
function useInteract(it) {
  if (it.kind === 'shop') openShop();
  else if (it.kind === 'home') { const c = G.ctx; closeNow().then(() => { c.state.tab = 'care'; c.render && c.render(); }); }
  else openInfo(it.label, it.text, it.kind === 'wip');
}

/* ---- 가구 놓기 ---- */
function ghost() {
  const def = FURN[G.sel], pl = G.player;
  const dx = { left: -1, right: 1, up: 0, down: 0 }[pl.dir], dy = { left: 0, right: 0, up: -1, down: 1 }[pl.dir];
  const fx = pl.x + dx * 14, fy = pl.y + dy * 14 - (dy ? 0 : 2);
  const tx = Math.floor(fx / TS - (def.w === 2 ? 1 : 0) + (def.w === 2 ? .5 : 0)), ty = Math.floor(fy / TS);
  const rect = { x0: tx * TS, y0: ty * TS, x1: (tx + def.w) * TS, y1: (ty + 1) * TS };
  let ok = tx >= GARDEN.x0 && tx + def.w - 1 <= GARDEN.x1 && ty >= GARDEN.y0 && ty <= GARDEN.y1;
  if (ok) for (let x = tx; x < tx + def.w && ok; x++) if (G.world.solid[ty * 96 + x]) ok = false;
  if (ok) for (const c of G.world.cols) if (rect.x1 > c.x0 && rect.x0 < c.x1 && rect.y1 > c.y0 + 2 && rect.y0 < c.y1 - 2) { ok = false; break; }
  if (ok) for (const f of G.save.placed) { const w = FURN[f.type].w; if (tx < f.tx + w && tx + def.w > f.tx && ty === f.ty) { ok = false; break; } }
  if (ok) for (const s of G.world.spots) if (s.x > rect.x0 - 6 && s.x < rect.x1 + 6 && s.y > rect.y0 && s.y < rect.y1 + 8) { ok = false; break; }
  return { tx, ty, ok, w: def.w };
}
async function placeFurn(type, g) {
  if (!g.ok || G.save.owned[type] <= 0) return;
  G.save.owned[type]--; G.save.placed.push({ uid: Math.random().toString(36).slice(2), type, tx: g.tx, ty: g.ty });
  rebuildFurnCols(); G.dirty = true; burst('spark', (g.tx + g.w / 2) * TS, (g.ty + 1) * TS - 4, 4); await persist();
}
async function pickFurn(f) {
  G.save.placed = G.save.placed.filter(x => x.uid !== f.uid); G.save.owned[f.type]++;
  rebuildFurnCols(); G.dirty = true; await persist();
}

/* ======================= 그리기 ======================= */
function drawSpr(g, spr, x, y, scale = 1, flip = false) {
  const w = spr.w * scale, hh = spr.h * scale, dx = Math.round(x - spr.ax * scale), dy = Math.round(y - spr.ay * scale);
  if (!flip) g.drawImage(spr.cv, dx, dy, w, hh);
  else { g.save(); g.translate(dx + w, dy); g.scale(-1, 1); g.drawImage(spr.cv, 0, 0, w, hh); g.restore(); }
}
const shadow = (g, x, y, w = 7) => { g.fillStyle = 'rgba(28,48,18,.28)'; g.fillRect(Math.round(x - w), Math.round(y - 2), w * 2, 2); g.fillRect(Math.round(x - w + 2), Math.round(y - 3), w * 2 - 4, 1); g.fillRect(Math.round(x - w + 2), Math.round(y), w * 2 - 4, 1); };

function nightAmount() {
  if (G && G.nightOverride != null) return G.nightOverride; // 시험용
  const d = new Date(), t = d.getHours() + d.getMinutes() / 60;
  if (t >= 20 || t < 5) return 1; if (t >= 18) return (t - 18) / 2; if (t < 7) return 1 - (t - 5) / 2; return 0;
}

function render() {
  const { world, cam, vw, vh } = G, g = G.g, sc = G.sc;
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#2d5a2a'; g.fillRect(0, 0, G.cv.width, G.cv.height);
  g.imageSmoothingEnabled = false;
  const cx = Math.round(cam.x), cy = Math.round(cam.y);
  g.setTransform(sc, 0, 0, sc, -cx * sc, -cy * sc);
  g.drawImage(world.ground, cx, cy, vw, vh, cx, cy, vw, vh);
  // 물 반짝임
  g.fillStyle = '#ffffff';
  for (const [x, y, ph] of world.waterPts) { if (x < cx - 4 || x > cx + vw + 4 || y < cy - 4 || y > cy + vh + 4) continue; const a = Math.sin(G.t * 1.6 + ph); if (a > .72) { g.globalAlpha = (a - .72) * 3; g.fillRect(x, y, 3, 1); g.fillRect(x + 1, y - 1, 1, 1); } }
  g.globalAlpha = 1;
  // 깊이 정렬
  const list = [];
  for (const o of world.objects) { const sp = o.spr; if (o.x + sp.w < cx - 8 || o.x - sp.w > cx + vw + 8 || o.y - sp.h > cy + vh + 8 || o.y + 8 < cy) continue; const hide = (o.kind === 'tree' || o.kind === 'house' || o.kind === 'shop' || o.kind === 'mine' || o.kind === 'windmill') && G.player.y < o.y && G.player.y > o.y - sp.h * .9 && Math.abs(G.player.x - o.x) < sp.w * .46; // 뒤에 서면 반투명
    list.push({ sy: o.sy, f: () => { const frame = o.frames ? o.frames[((Math.floor(G.t * 2) % o.frames.length) + o.frames.length) % o.frames.length] : sp; if (hide) g.globalAlpha = .5; drawSpr(g, frame, o.x, o.y); g.globalAlpha = 1; } }); }
  for (const s of world.spots) { if (s.x < cx - 20 || s.x > cx + vw + 20 || s.y < cy - 10 || s.y > cy + vh + 30) continue; const act = spotActive(s), spr = act ? s.sprites.full : s.sprites.empty; list.push({ sy: s.y, f: () => { drawSpr(g, spr, s.x, s.y); if (act) { const a = (Math.sin(G.t * 3 + s.x) + 1) / 2; if (a > .5) drawSpr(g, sparkSpr(), s.x + 8, s.y - 18 - a * 2); } } }); }
  for (const f of G.save.placed) { const def = FURN[f.type], spr = def.spr(), x = (f.tx + def.w / 2) * TS, y = (f.ty + 1) * TS - 2; list.push({ sy: y, f: () => drawSpr(g, f.type === 'bench' ? spr : spr, x, y) }); }
  const pl = G.player;
  list.push({ sy: pl.y, f: () => { const fr = pl.moving ? [1, 0, 2, 0][Math.floor(pl.t / .13) % 4] : 0; const br = pl.moving ? 0 : (Math.sin(G.t * 2.3) > .55 ? -1 : 0); shadow(g, pl.x, pl.y, 8); drawSpr(g, playerFrame(pl.dir, fr), pl.x, pl.y + br, CHAR_SCALE, pl.dir === 'right'); } });
  for (const pet of G.pets) list.push({ sy: pet.y, f: () => { const pose = pet.state === 'rest' ? 'rest' : pet.state === 'happy' ? 'happy' : pet.moving ? (Math.floor(pet.anim / .18) % 2 ? 'walk1' : 'walk2') : 'stand'; const d = pet.state === 'rest' ? (pet.dir === 'right' ? 'right' : 'left') : pet.dir; shadow(g, pet.x, pet.y, pet.state === 'rest' ? 10 : 8); const bounce = pet.state === 'happy' ? -Math.abs(Math.sin(pet.anim * 9)) * 3 : (!pet.moving && pet.state !== 'rest' && Math.sin(G.t * 2.6 + pet.speed) > .5 ? -1 : 0); drawSpr(g, petFrame(pet.look.kind, pet.look.color, pet.look.fur, d, pose), pet.x, pet.y + bounce, CHAR_SCALE, d === 'right'); } });
  list.sort((a, b) => a.sy - b.sy);
  for (const it of list) it.f();
  // 놓기 미리보기
  if (FURN[G.sel] && G.save.owned[G.sel] > 0) { const gh = ghost(), def = FURN[G.sel]; g.globalAlpha = .6; drawSpr(g, def.spr(), (gh.tx + def.w / 2) * TS, (gh.ty + 1) * TS - 2); g.globalAlpha = .45; g.fillStyle = gh.ok ? '#6dff8a' : '#ff6a6a'; g.fillRect(gh.tx * TS, gh.ty * TS, def.w * TS, TS); g.globalAlpha = 1; }
  // 나비
  if (nightAmount() < .5) for (const f of G.flies) { const x = f.hx + Math.sin(G.t * .8 + f.ph) * 28, y = f.hy + Math.cos(G.t * 1.1 + f.ph) * 12 + Math.sin(G.t * 5 + f.ph) * 1.5; if (x < cx - 8 || x > cx + vw + 8 || y < cy - 8 || y > cy + vh + 8) continue; drawSpr(g, flySpr(f.c, Math.floor(G.t * 7 + f.ph * 3) % 2 === 0), x, y); }
  // 굴뚝 연기
  for (const sm of world.smoke) for (let i = 0; i < 5; i++) { const ph = ((G.t * .25 + i / 5) % 1), x = sm.x + Math.sin(ph * 6 + i) * 4 + ph * 8, y = sm.y - ph * 26; g.globalAlpha = (1 - ph) * .7; g.fillStyle = '#ffffff'; g.fillRect(Math.round(x - 2 - ph * 3), Math.round(y), 4 + ph * 6, 3 + ph * 3); }
  g.globalAlpha = 1;
  // 벚꽃잎
  for (const p of G.petals || []) { g.globalAlpha = Math.min(1, (p.life - p.age) * 1.2); g.fillStyle = p.c; g.fillRect(Math.round(p.x), Math.round(p.y), 2, 2); g.fillRect(Math.round(p.x) + 1, Math.round(p.y) + 1, 1, 1); }
  g.globalAlpha = 1;
  // 효과 (하트·반짝임·글자)
  for (const p of G.particles) { if (p.age < 0) continue; g.globalAlpha = Math.min(1, (p.life - p.age) * 2); if (p.kind === 'heart') drawSpr(g, heartSpr(), p.x, p.y); else if (p.kind === 'spark') drawSpr(g, sparkSpr(), p.x, p.y); else if (p.kind === 'dust') { g.globalAlpha *= .5; g.fillStyle = '#f3ead2'; const sz = 2 + Math.floor(p.age * 4); g.fillRect(Math.round(p.x - sz / 2), Math.round(p.y - sz / 2), sz, sz - 1); } }
  g.globalAlpha = 1;
  // 밤 / 저녁 색감 + 등불
  const night = nightAmount();
  if (night > 0) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = `rgba(16,24,70,${.5 * night})`; g.fillRect(0, 0, G.cv.width, G.cv.height);
    g.setTransform(sc, 0, 0, sc, -cx * sc, -cy * sc);
    g.globalCompositeOperation = 'lighter';
    for (const l of [...world.lamps, ...world.glows]) { if (l.x < cx - 60 || l.x > cx + vw + 60 || l.y < cy - 60 || l.y > cy + vh + 60) continue; const gr = g.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r); gr.addColorStop(0, `rgba(255,205,110,${.55 * night})`); gr.addColorStop(1, 'rgba(255,205,110,0)'); g.fillStyle = gr; g.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2); }
    g.globalCompositeOperation = 'source-over';
  } else if (new Date().getHours() === 17) { g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = 'rgba(255,150,70,.1)'; g.fillRect(0, 0, G.cv.width, G.cv.height); }
  // 떠오르는 글자 (DOM 대신 캔버스 위에 또렷하게)
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.font = `bold ${Math.round(5 * sc)}px sans-serif`; g.textAlign = 'center';
  for (const p of G.particles) if (p.kind === 'text' && p.age >= 0) { g.globalAlpha = Math.min(1, (p.life - p.age) * 2); const x = (p.x - cx) * sc, y = (p.y - cy) * sc; g.lineWidth = 3 * sc / 2; g.strokeStyle = '#3a2418'; g.strokeText(p.text, x, y); g.fillStyle = '#fff3c4'; g.fillText(p.text, x, y); }
  g.globalAlpha = 1;
  updateTags(cx, cy);
}

/* ---- 이름표 (DOM으로 또렷하게) ---- */
function updateTags(cx, cy) {
  for (const pet of G.pets) {
    let tag = G.tags.get(pet.id);
    if (!tag) { tag = h('div', { class: 'vg-tag' }, pet.name); G.tagsEl.append(tag); G.tags.set(pet.id, tag); }
    const x = (pet.x - cx) * G.S, y = (pet.y - cy - (pet.state === 'rest' ? 20 : 30)) * G.S;
    tag.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
    tag.classList.toggle('comp', pet.id === G.save.companionId);
    tag.style.display = x < -40 || x > G.cssW + 40 || y < -20 || y > G.cssH + 20 ? 'none' : '';
  }
}

/* ======================= 프레임 루프 ======================= */
function frame(ts) {
  if (!G || G.closing) return;
  if (!G.last) G.last = ts;
  const dt = clamp((ts - G.last) / 1000, 0, .05); G.last = ts; // 시계가 거꾸로 가도 음수가 되지 않게
  if (!document.hidden && !G.portrait) {
   try {
    G.t += dt;
    updatePlayer(dt); updatePets(dt); updateParticles(dt);
    // 카메라
    const tx = clamp(G.player.x - G.vw / 2, 0, GW - G.vw), ty = clamp(G.player.y - G.vh * .58, 0, GH - G.vh);
    const k = 1 - Math.exp(-9 * dt); G.cam.x += (tx - G.cam.x) * k; G.cam.y += (ty - G.cam.y) * k;
    // 구역 이름
    const z = zoneAt(G.player.x, G.player.y);
    if (z && z.id !== G.zoneId) { G.zoneId = z.id; showZone(z.name); }
    // 행동 버튼
    const { act, act2 } = computeActions();
    if ((act ? act.key : '') !== G.actKey || (act2 ? act2.key : '') !== G.act2Key) { G.actKey = act ? act.key : ''; G.act2Key = act2 ? act2.key : ''; G.act = act; G.act2 = act2; paintActions(); } else { G.act = act; G.act2 = act2; }
    G.hudT -= dt; if (G.hudT <= 0) { G.hudT = .3; paintHud(); }
    G.saveT += dt; if (G.saveT > 6) { G.saveT = 0; if (G.dirty || G.player.moving) persist(); }
    render();
   } catch (e) { // 한 프레임의 오류가 게임 전체를 멈추지 않도록
    G.errs = (G.errs || 0) + 1; if (G.errs === 1) console.error('마을 오류:', e);
    if (G.errs > 120) { toast('문제가 생겨 마을을 닫아요'); closeVillage(); return; }
   }
  }
  G.raf = requestAnimationFrame(frame);
}

/* ======================= 화면 크기 ======================= */
function resize() {
  if (!G) return;
  const W = window.innerWidth, H = window.innerHeight;
  G.portrait = H > W * 1.05;
  G.rot.style.display = G.portrait ? 'flex' : 'none';
  const dpr = Math.max(1, Math.round(window.devicePixelRatio || 1));
  const base = Math.min(W / 400, H / 187);
  const S = 2 * Math.max(1, Math.round(base / 2));
  G.S = S; G.dpr = dpr; G.sc = S * dpr; G.cssW = W; G.cssH = H;
  G.cv.width = Math.floor(W * dpr); G.cv.height = Math.floor(H * dpr);
  G.cv.style.width = W + 'px'; G.cv.style.height = H + 'px';
  G.vw = Math.ceil(G.cv.width / G.sc); G.vh = Math.ceil(G.cv.height / G.sc);
  G.g = G.cv.getContext('2d'); G.g.imageSmoothingEnabled = false;
  if (!G.cam.init) { G.cam.x = clamp(G.player.x - G.vw / 2, 0, GW - G.vw); G.cam.y = clamp(G.player.y - G.vh / 2, 0, GH - G.vh); G.cam.init = true; }
  G.root.style.setProperty('--u', Math.max(.8, Math.min(1.35, H / 400)));
}

/* ======================= UI (HTML 겹치기) ======================= */
function buildUI() {
  const cv = h('canvas', { class: 'vg-canvas' });
  const tags = h('div', { class: 'vg-tags' });
  const faceImg = h('img', { class: 'vg-face', src: iconURL(playerFace(), 3), alt: '' });
  G.nameEl = h('div', { class: 'vg-name' }); G.lvEl = h('div', { class: 'vg-lv' });
  G.heartBar = h('i', {}); G.starBar = h('i', {});
  const prof = h('div', { class: 'vg-panel vg-prof' }, h('div', { class: 'vg-face-wrap' }, faceImg),
    h('div', { class: 'vg-prof-text' }, G.nameEl, G.lvEl,
      h('div', { class: 'vg-bar heart', title: '친밀도' }, h('img', { src: pxIcon('heart'), alt: '친밀도' }), h('span', {}, G.heartBar)),
      h('div', { class: 'vg-bar star', title: '오늘 채집' }, h('b', {}, '★'), h('span', {}, G.starBar))));
  G.coinEl = h('span', {}, '0');
  const coin = h('div', { class: 'vg-panel vg-coin' }, h('img', { src: pxIcon('coin'), alt: '' }), G.coinEl);
  const bagBtn = h('button', { class: 'vg-panel vg-round', 'aria-label': '가방', onclick: () => openBag() }, h('img', { src: pxIcon('bag'), alt: '' }));
  const gearBtn = h('button', { class: 'vg-panel vg-round', 'aria-label': '설정', onclick: () => openSettings() }, h('img', { src: pxIcon('gear'), alt: '' }));
  const tr = h('div', { class: 'vg-tr' }, coin, bagBtn, gearBtn);
  G.actImg = h('img', { src: pxIcon('paw'), alt: '' }); G.actLabel = h('span', { class: 'vg-act-label' });
  G.actBtn = h('button', { class: 'vg-act', 'aria-label': '행동', onclick: () => doMain() }, G.actImg);
  G.actWrap = h('div', { class: 'vg-act-wrap' }, G.actLabel, G.actBtn);
  G.act2Img = h('img', { src: pxIcon('leash'), alt: '' }); G.act2Label = h('span', { class: 'vg-act2-label' });
  G.act2Btn = h('button', { class: 'vg-act2', 'aria-label': '보조 행동', onclick: () => doSecond() }, G.act2Img);
  G.act2Wrap = h('div', { class: 'vg-act2-wrap' }, G.act2Label, G.act2Btn);
  const knob = h('div', { class: 'vg-knob' });
  const joy = h('div', { class: 'vg-joy', 'aria-label': '이동 조이스틱' }, h('i', { class: 'u' }), h('i', { class: 'd' }), h('i', { class: 'l' }), h('i', { class: 'r' }), knob);
  bindJoystick(joy, knob);
  G.hotbar = h('div', { class: 'vg-panel vg-hotbar', role: 'toolbar', 'aria-label': '도구와 아이템' });
  G.zoneEl = h('div', { class: 'vg-zone' });
  G.toastEl = h('div', { class: 'vg-toast', role: 'status' });
  G.rot = h('div', { class: 'vg-rotate' }, h('div', { class: 'vg-rot-ico' }, '📱↻'), h('p', {}, '폰을 가로로 돌려 주세요'), h('button', { class: 'vg-btn', onclick: () => closeVillage() }, '← 돌아가기'));
  G.root = h('div', { class: 'vg-root' }, cv, tags, prof, tr, joy, G.act2Wrap, G.actWrap, G.hotbar, G.zoneEl, G.toastEl, G.rot);
  document.body.append(G.root); document.body.classList.add('noscroll');
  G.cv = cv; G.tagsEl = tags;
  paintHud(); paintActions();
}

function bindJoystick(el, knob) {
  const R = 38;
  const set = (e) => {
    const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let dx = e.clientX - cx, dy = e.clientY - cy; const l = Math.hypot(dx, dy);
    if (l > R) { dx = dx / l * R; dy = dy / l * R; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const m = Math.hypot(dx, dy) / R;
    G.joy.dx = m < .18 ? 0 : dx / R; G.joy.dy = m < .18 ? 0 : dy / R;
  };
  el.addEventListener('pointerdown', e => { G.joy.id = e.pointerId; el.setPointerCapture(e.pointerId); set(e); e.preventDefault(); });
  el.addEventListener('pointermove', e => { if (G.joy.id === e.pointerId) set(e); });
  const end = e => { if (G && G.joy.id === e.pointerId) { G.joy.id = null; G.joy.dx = 0; G.joy.dy = 0; knob.style.transform = ''; } };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); el.addEventListener('lostpointercapture', end);
}

function toast(msg) {
  if (!G) return;
  G.toastEl.textContent = msg; G.toastEl.classList.add('show');
  clearTimeout(G.toastT); G.toastT = setTimeout(() => G && G.toastEl.classList.remove('show'), 2400);
}
function showZone(name) {
  G.zoneEl.textContent = name; G.zoneEl.classList.remove('show'); void G.zoneEl.offsetWidth; G.zoneEl.classList.add('show');
}

function paintActions() {
  const a = G.act, b = G.act2;
  G.actWrap.style.display = a ? '' : 'none';
  if (a) { G.actImg.src = pxIcon(a.icon); G.actLabel.textContent = a.label; G.actBtn.disabled = !!a.disabled; G.actBtn.classList.toggle('off', !!a.disabled); }
  G.act2Wrap.style.display = b ? '' : 'none';
  if (b) { G.act2Img.src = pxIcon(b.icon); G.act2Label.textContent = b.label; }
}

function focusPet() {
  return G.pets.find(p => p.id === G.save.companionId) || G.pets.map(p => [p, Math.hypot(p.x - G.player.x, p.y - G.player.y)]).sort((a, b) => a[1] - b[1])[0][0];
}
function paintHud() {
  if (!G) return;
  G.nameEl.textContent = G.save.name;
  const fp = focusPet(), ch = chars().find(c => c.id === fp.id);
  const xp = ch ? (ch.xp || 0) : 0, lv = levelOf(xp);
  G.lvEl.textContent = ch ? `${fp.name} · 친밀도 Lv.${lv}` : `${fp.name}`;
  G.heartBar.style.width = (ch ? Math.round(((xp - levelFloor(lv)) / (levelFloor(lv + 1) - levelFloor(lv))) * 100) : 0) + '%'; // 친밀도: 시간이 지나도 줄지 않는다
  const done = G.world.spots.filter(s => !spotActive(s)).length;
  G.starBar.style.width = Math.round(done / G.world.spots.length * 100) + '%'; // 오늘 채집 진행
  G.coinEl.textContent = wallet().toLocaleString('ko-KR');
  // 핫바
  const slots = [['basket', '바구니', null, null], ...Object.keys(ITEMS).map(k => [k, ITEMS[k].name, G.save.bag[k], itemIconURL(k)]), ...Object.keys(FURN).map(k => [k, FURN[k].name, G.save.owned[k], furnIcon(k)])];
  const key = JSON.stringify(slots.map(s => [s[0], s[2]])) + G.sel;
  if (G.hotKey === key) return;
  G.hotKey = key;
  G.hotbar.replaceChildren(...slots.map(([id, name, count, src]) => h('button', {
    class: 'vg-slot' + (G.sel === id ? ' sel' : '') + (count === 0 ? ' empty' : ''), type: 'button', 'aria-label': name, 'aria-pressed': String(G.sel === id), title: name,
    onclick: () => { if (FURN[id] && !count) { toast(`${name}이(가) 없어요. 상점에서 살 수 있어요`); return; } G.sel = G.sel === id && id !== 'basket' ? 'basket' : id; G.hotKey = ''; paintHud(); if (FURN[G.sel]) toast(`${name}: 놓을 자리에 서서 '놓기'를 눌러요`); },
  }, id === 'basket' ? h('img', { src: pxIcon('basket'), alt: '' }) : h('img', { src, alt: '' }), count == null ? null : h('b', { class: 'cnt' }, count))));
}

/* ======================= 창(모달) ======================= */
function modal(title, body, { wide = false } = {}) {
  const close = () => { back.remove(); G && (G.modal = null); };
  const back = h('div', { class: 'vg-back', onclick: e => { if (e.target === back) close(); } },
    h('div', { class: 'vg-panel vg-modal' + (wide ? ' wide' : ''), role: 'dialog', 'aria-label': title },
      h('div', { class: 'vg-modal-head' }, h('strong', {}, title), h('button', { class: 'vg-x', 'aria-label': '닫기', onclick: close }, '✕')),
      h('div', { class: 'vg-modal-body' }, body)));
  G.root.append(back); G.modal = { close };
  return close;
}
function openInfo(title, text, wip) { modal(title, h('div', { class: 'vg-info' }, wip ? h('div', { class: 'vg-wip' }, '🚧 준비 중') : null, h('p', {}, text))); }
function showHelp() {
  modal('별빛 꼬리 마을에 오신 걸 환영해요', h('div', { class: 'vg-info' },
    h('p', {}, '🕹️ 왼쪽 조이스틱으로 움직여요'), h('p', {}, '🐾 반려동물 가까이 가면 쓰다듬거나 산책에 데려갈 수 있어요'),
    h('p', {}, '🧺 반짝이는 꽃·열매·나뭇가지·조각을 모아 보세요'), h('p', {}, '🛍️ 광장 상점에서 정원 가구를 사서 우리 집 정원에 놓을 수 있어요'),
    h('button', { class: 'vg-btn big', onclick: () => G.modal && G.modal.close() }, '시작하기')));
}
function openBag() {
  const grid = h('div', { class: 'vg-grid' },
    ...Object.keys(ITEMS).map(k => h('div', { class: 'vg-cell' }, h('img', { src: itemIconURL(k), alt: '' }), h('b', {}, ITEMS[k].name), h('span', {}, `${G.save.bag[k]}개`))),
    ...Object.keys(FURN).map(k => h('div', { class: 'vg-cell' }, h('img', { src: furnIcon(k), alt: '' }), h('b', {}, FURN[k].name), h('span', {}, `보관 ${G.save.owned[k]} · 정원 ${G.save.placed.filter(p => p.type === k).length}`))));
  modal('가방', h('div', {}, grid, h('p', { class: 'vg-note' }, '가구는 아래 칸에서 골라 정원에 놓아요. 채집한 물건은 광장 상점에서 팔 수 있어요.')), { wide: true });
}
function openSettings() {
  const input = h('input', { class: 'vg-input', maxLength: 10, value: G.save.name, 'aria-label': '내 이름' });
  modal('설정', h('div', { class: 'vg-info' },
    h('label', { class: 'vg-lab' }, '내 이름', input),
    h('button', { class: 'vg-btn', onclick: () => { const v = input.value.trim().slice(0, 10); if (!v) { toast('이름을 입력해 주세요'); return; } G.save.name = v; G.dirty = true; paintHud(); toast('이름을 저장했어요'); G.modal && G.modal.close(); } }, '이름 저장'),
    h('button', { class: 'vg-btn', onclick: () => { G.modal && G.modal.close(); showHelp(); } }, '도움말'),
    h('button', { class: 'vg-btn danger', onclick: () => closeVillage() }, '마을에서 나가기')));
}
function openShop() {
  let tab = 'buy';
  const body = h('div', {});
  const draw = () => {
    const wal = h('div', { class: 'vg-wallet' }, '보유 코인', h('b', {}, h('img', { src: pxIcon('coin'), alt: '' }), wallet().toLocaleString('ko-KR')));
    const tabs = h('div', { class: 'vg-tabs' }, ['buy', 'sell'].map(t => h('button', { class: tab === t ? 'on' : '', onclick: () => { tab = t; draw(); } }, t === 'buy' ? '사기' : '팔기')));
    let rows;
    if (tab === 'buy') rows = Object.entries(FURN).map(([id, f]) => h('div', { class: 'vg-row' }, h('img', { src: furnIcon(id), alt: '' }), h('div', { class: 'vg-row-t' }, h('b', {}, f.name), h('span', {}, f.desc)),
      h('button', { class: 'vg-btn small', onclick: async () => { if (!(await spend(f.price))) { toast('코인이 부족해요'); return; } G.save.owned[id]++; G.dirty = true; await persist(); toast(`${f.name}을(를) 샀어요! 아래 칸에서 골라 놓아요`); G.hotKey = ''; paintHud(); draw(); } }, h('img', { src: pxIcon('coin'), alt: '' }), f.price)));
    else rows = Object.entries(ITEMS).map(([id, it]) => h('div', { class: 'vg-row' }, h('img', { src: itemIconURL(id), alt: '' }), h('div', { class: 'vg-row-t' }, h('b', {}, it.name), h('span', {}, `가방 ${G.save.bag[id]}개 · 개당 ${it.sell}코인`)),
      h('button', { class: 'vg-btn small', disabled: !G.save.bag[id], onclick: async () => { const n = G.save.bag[id]; if (!n) return; G.save.bag[id] = 0; earn(n * it.sell); await persist(); toast(`${it.name} ${n}개를 팔아 ${n * it.sell}코인을 받았어요`); G.hotKey = ''; paintHud(); draw(); } }, '모두 팔기')));
    body.replaceChildren(wal, tabs, ...rows);
  };
  draw();
  modal('마을 상점', body, { wide: true });
}
