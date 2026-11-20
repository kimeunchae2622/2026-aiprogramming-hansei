import * as db from './db.js';
import { h, uid, compressImage, formatTime, ymd, parseYmd, isLeap, formatClock, WEEKDAYS } from './util.js';
import { downloadBackup, parseBackup } from './backup.js';
import { renderMapTab, destroyMap } from './map.js';
import { renderCareTab, destroyCare, grantPostCoins } from './care.js';
import { iconEl as ic } from './icons.js';
import { getSettings, setSettings, STYLES, MODES, ACCENTS } from './theme.js';

const SPECIES = {
  dog: { label: '강아지', emoji: '🐶' },
  cat: { label: '고양이', emoji: '🐱' },
  other: { label: '기타', emoji: '🐾' },
};
const PAGE_SIZE = 20;
const TEXT_MAX = 2000;
const DAY = 86400000;

const EVENT_TYPES = {
  hospital: { label: '병원', emoji: '🏥' },
  birthday: { label: '생일', emoji: '🎂' },
  grooming: { label: '미용', emoji: '✂️' },
  etc: { label: '기타', emoji: '📌' },
};

const TABS = [
  { id: 'feed', label: '추억', icon: 'house' },
  { id: 'calendar', label: '달력', icon: 'calendar-days' },
  { id: 'care', label: '돌보기', icon: 'paw-print' },
  { id: 'map', label: '지도', icon: 'map-pin' },
  { id: 'more', label: '더보기', icon: 'sliders-horizontal' },
];

const state = {
  pets: [], posts: [], events: [], characters: [], carePet: null, filter: 'all',
  calMonth: { y: new Date().getFullYear(), m: new Date().getMonth() }, calSel: ymd(new Date()), tab: 'feed',
  shown: PAGE_SIZE, lastBackup: undefined, lastPet: null, bannerHidden: false, installTipHidden: false,
};

let urls = [];
const blobUrl = blob => { const u = URL.createObjectURL(blob); urls.push(u); return u; };
const $ = sel => document.querySelector(sel);

/* ---------- 데이터 불러오기 ---------- */
async function load() {
  const [pets, posts, events, characters, lastBackup, tipHidden] = await Promise.all([
    db.getAll('pets'), db.getAll('posts'), db.getAll('events'), db.getAll('characters'), db.getMeta('lastBackup'), db.getMeta('installTipHidden'),
  ]);
  state.pets = pets.sort((a, b) => a.createdAt - b.createdAt);
  state.posts = posts.sort((a, b) => b.createdAt - a.createdAt);
  state.events = events;
  state.characters = characters;
  state.lastBackup = lastBackup;
  state.installTipHidden = !!tipHidden;
  if (state.filter !== 'all' && !state.pets.some(p => p.id === state.filter)) state.filter = 'all';
}

async function reload() { await load(); render(); }

function friendlyError(err) {
  if (err && err.name === 'QuotaExceededError') return '저장 공간이 부족해요. 오래된 사진을 정리하거나 백업 후 다시 시도해 주세요.';
  return '저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.';
}

/* ---------- 공통 UI: 알림, 확인창, 시트 ---------- */
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

const overlayStack = [];
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && overlayStack.length) overlayStack[overlayStack.length - 1].tryClose();
});

function unlockIfEmpty() {
  if (!$('#modal-root').children.length) document.body.classList.remove('noscroll');
}

function openSheet(title, buildBody, { beforeClose } = {}) {
  const root = $('#modal-root');
  const back = h('div', { class: 'backdrop' });
  const box = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title });
  let closed = false;
  const cleanup = [];
  const api = {
    close() {
      if (closed) return;
      closed = true;
      cleanup.forEach(f => f());
      back.remove();
      const i = overlayStack.indexOf(api);
      if (i >= 0) overlayStack.splice(i, 1);
      unlockIfEmpty();
    },
    async tryClose() {
      if (beforeClose && !(await beforeClose())) return;
      api.close();
    },
    url(blob) { const u = URL.createObjectURL(blob); cleanup.push(() => URL.revokeObjectURL(u)); return u; },
  };
  box.append(
    h('div', { class: 'sheet-head' },
      h('h2', {}, title),
      h('button', { class: 'icon-btn', 'aria-label': '닫기', onclick: () => api.tryClose() }, ic('x', { size: 22 }))),
    buildBody(api));
  back.addEventListener('click', e => { if (e.target === back) api.tryClose(); });
  back.append(box);
  root.append(back);
  overlayStack.push(api);
  document.body.classList.add('noscroll');
  return api;
}

function confirmBox({ title, message, ok = '확인', cancel = '취소', danger = false }) {
  return new Promise(resolve => {
    const root = $('#modal-root');
    const back = h('div', { class: 'backdrop center' });
    const api = { tryClose: () => done(false) };
    function done(value) {
      back.remove();
      const i = overlayStack.indexOf(api);
      if (i >= 0) overlayStack.splice(i, 1);
      unlockIfEmpty();
      resolve(value);
    }
    back.append(h('div', { class: 'dialog', role: 'alertdialog', 'aria-modal': 'true' },
      h('h3', {}, title),
      message && h('p', {}, message),
      h('div', { class: 'dialog-actions' },
        cancel && h('button', { class: 'btn ghost', onclick: () => done(false) }, cancel),
        h('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), onclick: () => done(true) }, ok))));
    root.append(back);
    overlayStack.push(api);
    document.body.classList.add('noscroll');
  });
}

function openViewer(blob) {
  const root = $('#modal-root');
  const url = URL.createObjectURL(blob);
  const back = h('div', { class: 'viewer', role: 'dialog', 'aria-label': '사진 크게 보기' });
  const api = {
    tryClose() {
      URL.revokeObjectURL(url);
      back.remove();
      const i = overlayStack.indexOf(api);
      if (i >= 0) overlayStack.splice(i, 1);
      unlockIfEmpty();
    },
  };
  back.append(h('img', { src: url, alt: '사진' }),
    h('button', { class: 'icon-btn viewer-close', 'aria-label': '닫기' }, ic('x', { size: 22 })));
  back.addEventListener('click', () => api.tryClose());
  root.append(back);
  overlayStack.push(api);
  document.body.classList.add('noscroll');
}

/* ---------- 작은 부품 ---------- */
function avatar(pet, size = 40, mk = blobUrl) {
  const style = `width:${size}px;height:${size}px;font-size:${Math.round(size * 0.55)}px`;
  if (pet && pet.photo) return h('img', { class: 'avatar', style, src: mk(pet.photo), alt: '' });
  return h('span', { class: 'avatar', style, 'aria-hidden': 'true' }, (SPECIES[pet?.species] || SPECIES.other).emoji);
}

// 사진 선택 버튼. 사진은 고르는 즉시 폰에 부담 없는 크기로 줄인다.
function photoPicker({ idleLabel, onPick, onBusy }) {
  const input = h('input', { type: 'file', accept: 'image/*', hidden: true });
  const btn = h('button', { type: 'button', class: 'btn soft', onclick: () => input.click() }, idleLabel());
  input.addEventListener('change', async () => {
    const file = input.files && input.files[0];
    input.value = '';
    if (!file) return;
    btn.disabled = true;
    btn.textContent = '사진 줄이는 중…';
    onBusy(true);
    try {
      onPick(await compressImage(file));
    } catch {
      toast('사진을 불러오지 못했어요. 다른 사진으로 시도해 주세요.');
    } finally {
      btn.disabled = false;
      btn.textContent = idleLabel();
      onBusy(false);
    }
  });
  return { input, btn, refreshLabel: () => { btn.textContent = idleLabel(); } };
}

/* ---------- 반려동물 등록/수정 폼 ---------- */
function petForm({ pet, mkUrl, firstTime, onDone, onDeleted }) {
  let species = pet?.species || 'dog';
  let photo = pet?.photo || null;
  let busy = false;

  const nameInput = h('input', {
    class: 'input', type: 'text', maxLength: 20, value: pet?.name || '',
    placeholder: '예: 콩이', 'aria-label': '이름', autocomplete: 'off',
  });
  const error = h('p', { class: 'field-error', role: 'alert' });
  const preview = h('div', { class: 'photo-row' });
  const speciesRow = h('div', { class: 'chips', role: 'radiogroup', 'aria-label': '종류' });
  const saveBtn = h('button', { type: 'button', class: 'btn primary block' }, firstTime ? '시작하기' : '저장');

  const picker = photoPicker({
    idleLabel: () => '사진 고르기',
    onBusy: b => { busy = b; saveBtn.disabled = b; },
    onPick: blob => { photo = blob; drawPhoto(); },
  });
  const drawSpecies = () => {
    speciesRow.replaceChildren(...Object.entries(SPECIES).map(([key, s]) =>
      h('button', {
        type: 'button', class: 'chip' + (species === key ? ' active' : ''),
        role: 'radio', 'aria-checked': String(species === key),
        onclick: () => { species = key; drawSpecies(); drawPhoto(); },
      }, `${s.emoji} ${s.label}`)));
  };
  function drawPhoto() {
    preview.replaceChildren(
      avatar({ photo, species }, 72, mkUrl),
      h('div', { class: 'photo-actions' },
        picker.btn,
        photo && h('button', { type: 'button', class: 'btn link', onclick: () => { photo = null; drawPhoto(); } }, '사진 지우기')));
  }

  saveBtn.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    error.textContent = '';
    if (!name) { error.textContent = '이름을 입력해 주세요.'; nameInput.focus(); return; }
    if (state.pets.some(p => p.name === name && p.id !== pet?.id)) {
      error.textContent = '같은 이름의 아이가 이미 있어요. 다른 이름을 써 주세요.'; nameInput.focus(); return;
    }
    if (busy) return;
    saveBtn.disabled = true;
    try {
      const saved = { id: pet?.id || uid(), name, species, photo, createdAt: pet?.createdAt || Date.now() };
      await db.put('pets', saved);
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
      onDone(saved);
    } catch (err) {
      toast(friendlyError(err));
      saveBtn.disabled = false;
    }
  });
  nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') saveBtn.click(); });

  drawSpecies();
  drawPhoto();
  const form = h('div', { class: 'form' },
    h('label', { class: 'label' }, '이름', nameInput), error,
    h('div', { class: 'label' }, '종류', speciesRow),
    h('div', { class: 'label' }, '사진 (선택)', preview),
    picker.input, saveBtn);

  if (pet && !firstTime) {
    const count = state.posts.filter(p => p.petId === pet.id).length;
    const evCount = state.events.filter(e => e.petId === pet.id).length;
    const what = [count && `추억 ${count}개`, evCount && `일정 ${evCount}개`].filter(Boolean).join('와 ');
    form.append(h('button', {
      type: 'button', class: 'btn link danger-text',
      onclick: async () => {
        const ok = await confirmBox({
          title: `${pet.name}을(를) 삭제할까요?`,
          message: what ? `${pet.name}의 ${what}도 함께 삭제되고, 되돌릴 수 없어요.` : '되돌릴 수 없어요.',
          ok: '삭제', danger: true,
        });
        if (!ok) return;
        try {
          await db.removePetWithPosts(pet.id);
          onDeleted();
        } catch (err) { toast(friendlyError(err)); }
      },
    }, `${pet.name} 삭제하기`));
  }
  return form;
}

function openPetSheet(pet) {
  return openSheet(pet ? '아이 정보 수정' : '반려동물 추가', api =>
    petForm({
      pet, mkUrl: api.url,
      onDone: async saved => {
        api.close();
        if (!pet) { state.filter = saved.id; state.lastPet = saved.id; state.tab = 'feed'; }
        await reload();
        toast(pet ? '저장했어요' : `${saved.name}을(를) 등록했어요`);
      },
      onDeleted: async () => { api.close(); await reload(); toast('삭제했어요'); },
    }));
}

/* ---------- 글쓰기 / 수정 ---------- */
function openCompose(post) {
  const editing = !!post;
  let petId = post?.petId
    || (state.filter !== 'all' ? state.filter : null)
    || (state.pets.some(p => p.id === state.lastPet) ? state.lastPet : state.pets[0].id);
  let photo = post?.photo || null;
  const initial = { text: post?.text || '', photo };
  let busy = false;
  let currentText = () => initial.text;

  return openSheet(editing ? '추억 수정' : '새 추억', api => {
    const textarea = h('textarea', {
      class: 'input textarea', maxLength: TEXT_MAX, rows: 5, value: initial.text,
      placeholder: '오늘 어떤 추억을 남길까요?', 'aria-label': '내용',
    });
    currentText = () => textarea.value;
    const counter = h('span', { class: 'counter' });
    const photoBox = h('div', { class: 'compose-photo' });
    const petRow = h('div', { class: 'chips', role: 'radiogroup', 'aria-label': '누구의 추억인가요' });
    const submit = h('button', { type: 'button', class: 'btn primary block' }, editing ? '저장' : '올리기');

    const refresh = () => {
      counter.textContent = `${textarea.value.length}/${TEXT_MAX}`;
      submit.disabled = busy || !(textarea.value.trim() || photo);
    };
    const drawPets = () => {
      petRow.replaceChildren(...state.pets.map(p => h('button', {
        type: 'button', class: 'chip' + (p.id === petId ? ' active' : ''), role: 'radio',
        'aria-checked': String(p.id === petId),
        onclick: () => { petId = p.id; drawPets(); },
      }, avatar(p, 24, api.url), p.name)));
    };
    const picker = photoPicker({
      idleLabel: () => (photo ? '사진 바꾸기' : '사진 추가'),
      onBusy: b => { busy = b; refresh(); },
      onPick: blob => { photo = blob; drawPhoto(); },
    });
    function drawPhoto() {
      picker.refreshLabel();
      photoBox.replaceChildren(...[
        photo && h('div', { class: 'thumb' },
          h('img', { src: api.url(photo), alt: '첨부한 사진' }),
          h('button', { type: 'button', class: 'thumb-x', 'aria-label': '사진 빼기', onclick: () => { photo = null; drawPhoto(); refresh(); } }, ic('x', { size: 20 }))),
        picker.btn].filter(Boolean));
      refresh();
    }

    submit.addEventListener('click', async () => {
      const text = textarea.value.trim();
      if (!text && !photo) { toast('글이나 사진을 하나는 넣어 주세요.'); return; }
      submit.disabled = true;
      try {
        await db.put('posts', {
          id: post?.id || uid(), petId, text, photo,
          createdAt: post?.createdAt || Date.now(), updatedAt: Date.now(),
        });
        state.lastPet = petId;
        initial.text = textarea.value; initial.photo = photo; // 저장했으니 닫을 때 묻지 않음
        api.close();
        if (state.filter !== 'all') state.filter = petId;
        state.shown = Math.max(state.shown, PAGE_SIZE);
        const coins = editing ? 0 : await grantPostCoins(state, petId);
        await reload();
        window.scrollTo(0, 0);
        toast(editing ? '수정했어요' : coins ? `추억을 남겼어요 · 코인 +${coins}` : '추억을 남겼어요');
      } catch (err) {
        toast(friendlyError(err));
        refresh();
      }
    });
    textarea.addEventListener('input', refresh);

    if (state.pets.length > 1) drawPets();
    drawPhoto();
    setTimeout(() => { if (!editing) textarea.focus(); }, 50);
    return h('div', { class: 'form' },
      state.pets.length > 1 && h('div', { class: 'label' }, '누구의 추억인가요?', petRow),
      textarea, h('div', { class: 'counter-row' }, counter),
      photoBox, picker.input, submit);
  }, {
    beforeClose: () => (currentText() !== initial.text || photo !== initial.photo)
      ? confirmBox({ title: '작성을 그만할까요?', message: '쓰던 내용이 사라져요.', ok: '그만하기', cancel: '계속 쓰기', danger: true })
      : true,
  });
}

function openPostMenu(post) {
  openSheet('이 추억', api => h('div', { class: 'menu' },
    h('button', { class: 'btn soft block', onclick: () => { api.close(); openCompose(post); } }, ic('pencil', { size: 20 }), '수정하기'),
    h('button', {
      class: 'btn soft block danger-text',
      onclick: async () => {
        const ok = await confirmBox({ title: '이 추억을 삭제할까요?', message: '삭제하면 되돌릴 수 없어요.', ok: '삭제', danger: true });
        if (!ok) return;
        try {
          await db.remove('posts', post.id);
          api.close();
          await reload();
          toast('삭제했어요');
        } catch (err) { toast(friendlyError(err)); }
      },
    }, ic('trash-2', { size: 20 }), '삭제하기')));
}

/* ---------- 화면: 시작(첫 실행) ---------- */
function renderOnboarding() {
  const form = petForm({
    firstTime: true, mkUrl: blobUrl,
    onDone: async saved => { state.filter = saved.id; state.lastPet = saved.id; await reload(); toast(`${saved.name}, 반가워요!`); },
    onDeleted: () => {},
  });
  return h('main', { class: 'welcome' },
    h('div', { class: 'welcome-hero' }, ic('paw-print', { size: 46, fill: true })),
    h('h1', {}, '우리 아이를 소개해 주세요'),
    h('p', { class: 'muted' }, '추억은 이 폰에만 저장돼요. 나만 볼 수 있어요.'),
    h('div', { class: 'card' }, form));
}

/* ---------- 홈 화면에 추가(앱처럼 쓰기) ---------- */
let installPrompt = null; // 안드로이드 크롬이 알려 주는 "설치" 기능
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; if (state.pets.length) render(); });
window.addEventListener('appinstalled', () => { installPrompt = null; if (state.pets.length) render(); });

const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function installSteps() {
  if (isIOS()) {
    return ['사파리(Safari)로 이 주소를 열어요. (다른 앱 안에서 열었다면 사파리로 옮겨 주세요)', '화면 아래 가운데의 공유 버튼(네모에 위쪽 화살표)을 눌러요.', '"홈 화면에 추가"를 고르고 오른쪽 위 "추가"를 눌러요.'];
  }
  return ['크롬(Chrome)에서 이 주소를 열어요.', '오른쪽 위 ⋮ 버튼을 눌러요.', '"홈 화면에 추가" 또는 "앱 설치"를 눌러요.'];
}

/* ---------- 화면: 추억(피드) ---------- */
function backupBannerNeeded() {
  if (state.bannerHidden || !state.posts.length) return false;
  if (state.lastBackup === undefined) return state.posts.length >= 3;
  return Date.now() - state.lastBackup > 30 * DAY;
}

function installBannerNeeded() {
  return !state.installTipHidden && !isStandalone() && state.posts.length >= 1;
}

const isLong = text => !!text && (text.length > 110 || text.split('\n').length > 3);

async function toggleFav(post) {
  try {
    await db.put('posts', { ...post, fav: !post.fav });
    post.fav = !post.fav;
    return true;
  } catch (err) { toast(friendlyError(err)); return false; }
}

// 하트(좋아요) 버튼: 소중한 추억 표시. 누르면 통통 튄다.
function heartButton(post) {
  const btn = h('button', { class: 'icon-btn heart-btn', type: 'button' });
  btn.sync = () => {
    btn.classList.toggle('on', !!post.fav);
    btn.setAttribute('aria-pressed', String(!!post.fav));
    btn.setAttribute('aria-label', post.fav ? '좋아요 취소' : '좋아요');
    btn.replaceChildren(ic('heart', { size: 26, fill: !!post.fav }));
  };
  btn.addEventListener('click', async () => {
    if (!(await toggleFav(post))) return;
    btn.sync();
    btn.classList.remove('pop'); void btn.offsetWidth; btn.classList.add('pop');
  });
  btn.sync();
  return btn;
}

// 사진: 한 번 누르면 크게 보기, (카드형은) 두 번 누르면 좋아요
function photoButton(post, { doubleTapLike = false, heart } = {}) {
  const big = doubleTapLike ? h('span', { class: 'big-heart', 'aria-hidden': 'true' }, ic('heart', { size: 96, fill: true })) : null;
  let timer = null;
  const btn = h('button', { class: 'post-photo', type: 'button', 'aria-label': '사진 크게 보기' },
    h('img', { src: blobUrl(post.photo), alt: '', loading: 'lazy' }), big);
  btn.addEventListener('click', () => {
    if (!doubleTapLike) { openViewer(post.photo); return; }
    if (timer) { // 두 번째 누름 = 좋아요
      clearTimeout(timer); timer = null;
      (async () => {
        if (!post.fav && !(await toggleFav(post))) return;
        if (heart) heart.sync();
        big.classList.remove('show'); void big.offsetWidth; big.classList.add('show');
      })();
      return;
    }
    timer = setTimeout(() => { timer = null; openViewer(post.photo); }, 260);
  });
  return btn;
}

function withReadMore(node, long) {
  if (!long) return [node];
  node.classList.add('clamp');
  const more = h('button', { class: 'read-more', type: 'button', onclick: e => { node.classList.remove('clamp'); e.currentTarget.remove(); } }, '더 보기');
  return [node, more];
}

const timeEl = post => h('time', { datetime: new Date(post.createdAt).toISOString(), 'data-ts': post.createdAt }, formatTime(post.createdAt));
const petName = pet => (pet ? pet.name : '(삭제된 아이)');

// 디자인 A: 카드형
function postCardCard(post) {
  const pet = state.pets.find(p => p.id === post.petId);
  const heart = heartButton(post);
  const caption = post.text && h('div', { class: 'caption' }, h('strong', {}, petName(pet)), h('span', { class: 'post-text' }, post.text));
  return h('article', { class: 'post card-style' },
    h('header', { class: 'post-head' },
      avatar(pet, 36),
      h('div', { class: 'post-meta' }, h('strong', {}, petName(pet)), timeEl(post)),
      h('button', { class: 'icon-btn', 'aria-label': '이 추억 메뉴', onclick: () => openPostMenu(post) }, ic('ellipsis', { size: 24 }))),
    post.photo && photoButton(post, { doubleTapLike: true, heart }),
    h('div', { class: 'post-actions' }, heart),
    caption && withReadMore(caption, isLong(post.text)));
}

// 디자인 B: 타임라인형
function postCardTimeline(post) {
  const pet = state.pets.find(p => p.id === post.petId);
  const text = post.text && h('p', { class: 'post-text' }, post.text);
  return h('article', { class: 'post tl-style' },
    avatar(pet, 44),
    h('div', { class: 'tl-body' },
      h('div', { class: 'tl-head' },
        h('strong', {}, petName(pet)), h('span', { class: 'sub' }, '·'), h('span', { class: 'sub' }, timeEl(post)),
        h('button', { class: 'icon-btn', 'aria-label': '이 추억 메뉴', onclick: () => openPostMenu(post) }, ic('ellipsis', { size: 22 }))),
      text && withReadMore(text, isLong(post.text)),
      post.photo && photoButton(post),
      h('div', { class: 'tl-actions' }, heartButton(post))));
}

function pickPet(id) { state.filter = id; state.shown = PAGE_SIZE; render(); }

function petPicker(style) {
  if (style === 'timeline') {
    return h('div', { class: 'xtabs', role: 'tablist', 'aria-label': '아이 고르기' },
      h('button', { class: 'xtab' + (state.filter === 'all' ? ' active' : ''), role: 'tab', onclick: () => pickPet('all') }, '전체'),
      ...state.pets.map(p => h('button', { class: 'xtab' + (state.filter === p.id ? ' active' : ''), role: 'tab', onclick: () => pickPet(p.id) }, p.name)),
      h('button', { class: 'xtab xtab-add', 'aria-label': '반려동물 추가', onclick: () => openPetSheet() }, ic('plus', { size: 22 })));
  }
  const story = (active, ring, name, onclick, extra = '') => h('button', { class: 'story' + (active ? ' active' : '') + extra, role: 'tab', onclick },
    h('span', { class: 'story-ring' }, ring), h('span', { class: 'story-name' }, name));
  return h('div', { class: 'stories', role: 'tablist', 'aria-label': '아이 고르기' },
    story(state.filter === 'all', h('span', { class: 'story-all' }, ic('paw-print', { size: 26, fill: true })), '전체', () => pickPet('all')),
    ...state.pets.map(p => story(state.filter === p.id, avatar(p, 60), p.name, () => pickPet(p.id))),
    story(false, ic('plus', { size: 26 }), '추가', () => openPetSheet(), ' story-add'));
}

function banner(iconName, text, actions) {
  return h('div', { class: 'banner' },
    h('span', { class: 'banner-text' }, ic(iconName, { size: 20 }), text),
    h('div', { class: 'banner-actions' }, actions));
}

function renderFeed() {
  const style = getSettings().style;
  const wrap = h('div', {});
  wrap.append(petPicker(style));

  const goMore = () => { state.tab = 'more'; render(); window.scrollTo(0, 0); };
  if (backupBannerNeeded()) {
    wrap.append(banner('shield-check', '소중한 추억을 잃어버리지 않게 백업해 두세요.', [
      h('button', { class: 'btn small primary', onclick: goMore }, '백업하러 가기'),
      h('button', { class: 'btn small link', onclick: () => { state.bannerHidden = true; render(); } }, '나중에')]));
  } else if (installBannerNeeded()) {
    wrap.append(banner('smartphone', '홈 화면에 추가하면 앱처럼 바로 열 수 있어요.', [
      h('button', { class: 'btn small primary', onclick: goMore }, '방법 보기'),
      h('button', {
        class: 'btn small link',
        onclick: async () => { state.installTipHidden = true; render(); try { await db.setMeta('installTipHidden', true); } catch { /* 다음에 다시 보일 뿐 */ } },
      }, '닫기')]));
  }

  const list = state.filter === 'all' ? state.posts : state.posts.filter(p => p.petId === state.filter);
  if (!list.length) {
    const pet = state.pets.find(p => p.id === state.filter);
    wrap.append(h('div', { class: 'empty' },
      h('div', { class: 'empty-icon' }, ic('image-plus', { size: 34 })),
      h('h2', {}, pet ? `${pet.name}의 첫 추억을 남겨 보세요` : '첫 추억을 남겨 보세요'),
      h('p', { class: 'muted' }, '글만 써도 되고, 사진을 함께 올려도 돼요.'),
      h('button', { class: 'btn primary', onclick: () => openCompose() }, ic('pen-line', { size: 20 }), '추억 쓰기')));
  } else {
    const shown = list.slice(0, state.shown);
    wrap.append(h('div', { class: 'posts' }, shown.map(style === 'timeline' ? postCardTimeline : postCardCard)));
    if (list.length > shown.length) {
      wrap.append(h('button', { class: 'btn soft block more-btn', onclick: () => { state.shown += PAGE_SIZE; render(); } },
        `이전 추억 더 보기 (${list.length - shown.length}개 남음)`));
    }
  }
  return wrap;
}

/* ---------- 화면: 더보기 (아이들 관리 + 백업) ---------- */
function formatDate(ts) {
  return new Date(ts).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

async function restoreFrom(file) {
  let parsed;
  try {
    parsed = await parseBackup(await file.text());
  } catch {
    await confirmBox({ title: '복원할 수 없는 파일이에요', message: '"추억저장소_백업"으로 시작하는 백업 파일을 골라 주세요.', ok: '확인', cancel: null });
    return;
  }
  const ok = await confirmBox({
    title: '백업으로 복원할까요?',
    message: `지금 있는 기록(아이 ${state.pets.length}마리, 추억 ${state.posts.length}개, 일정 ${state.events.length}개)은 사라지고, 백업 파일의 기록(아이 ${parsed.pets.length}마리, 추억 ${parsed.posts.length}개, 일정 ${parsed.events.length}개)으로 바뀌어요.`,
    ok: '복원하기', danger: true,
  });
  if (!ok) return;
  try {
    await db.replaceAll(parsed);
    state.filter = 'all'; state.shown = PAGE_SIZE;
    await reload();
    toast('복원했어요');
  } catch (err) {
    toast(friendlyError(err));
  }
}

/* ---------- 꾸미기 (디자인·색상·밝기) ---------- */
function renderThemeCard() {
  const cur = getSettings();
  const apply = patch => { setSettings(patch); render(); };

  const mockCard = h('div', { class: 'mock' },
    h('div', { class: 'stor' }, h('b'), h('b'), h('b')), h('div', { class: 'img' }), h('i', { class: 'ln' }));
  const mockTl = h('div', { class: 'mock' },
    h('div', { class: 'row' }, h('span', { class: 'dot-a' }), h('i', { class: 'ln' })),
    h('div', { class: 'row' }, h('span', { class: 'dot-a' }), h('i', { class: 'ln' })),
    h('div', { class: 'row' }, h('span', { class: 'dot-a' }), h('i', { class: 'ln' })));
  const styleOpt = (key, mock) => h('button', {
    class: 'style-opt' + (cur.style === key ? ' active' : ''), type: 'button', 'aria-pressed': String(cur.style === key),
    onclick: () => apply({ style: key }),
  }, mock, h('strong', {}, STYLES[key].label), h('small', {}, STYLES[key].desc));

  const preset = ACCENTS.some(a => a.color === cur.accent);
  const colorInput = h('input', { type: 'color', value: cur.accent, 'aria-label': '원하는 색 고르기' });
  colorInput.addEventListener('input', () => setSettings({ accent: colorInput.value }));
  colorInput.addEventListener('change', () => apply({ accent: colorInput.value }));

  return h('section', { class: 'card' },
    h('h2', { class: 'section-title' }, ic('palette', { size: 22 }), '꾸미기'),
    h('div', { class: 'label' }, '디자인', h('div', { class: 'style-picker' }, styleOpt('card', mockCard), styleOpt('timeline', mockTl))),
    h('div', { class: 'label' }, '포인트 색',
      h('div', { class: 'swatches' },
        ACCENTS.map(a => h('button', {
          class: 'swatch-btn' + (cur.accent === a.color ? ' active' : ''), type: 'button', style: `background:${a.color}`,
          'aria-label': a.label, 'aria-pressed': String(cur.accent === a.color), onclick: () => apply({ accent: a.color }),
        }, cur.accent === a.color && ic('check', { size: 20, stroke: 3 }))),
        h('label', { class: 'swatch-btn swatch-custom' + (preset ? '' : ' active'), 'aria-label': '직접 고르기' },
          colorInput, !preset && ic('check', { size: 20, stroke: 3 })))),
    h('div', { class: 'label' }, '밝기',
      h('div', { class: 'seg', role: 'radiogroup', 'aria-label': '밝기' },
        Object.entries(MODES).map(([k, label]) => h('button', {
          type: 'button', class: cur.mode === k ? 'active' : '', role: 'radio', 'aria-checked': String(cur.mode === k),
          onclick: () => apply({ mode: k }),
        }, k === 'light' && ic('sun', { size: 18 }), k === 'dark' && ic('moon', { size: 18 }), label)))));
}

function renderMore() {
  const restoreInput = h('input', { type: 'file', accept: '.json,application/json', hidden: true });
  restoreInput.addEventListener('change', async () => {
    const file = restoreInput.files && restoreInput.files[0];
    restoreInput.value = '';
    if (file) await restoreFrom(file);
  });

  return h('div', { class: 'page more' },
    h('section', { class: 'card' },
      h('h2', { class: 'section-title' }, ic('users', { size: 22 }), '우리 아이들'),
      h('ul', { class: 'pet-list' }, state.pets.map(p => h('li', {},
        h('button', { class: 'pet-row', onclick: () => openPetSheet(p) },
          avatar(p, 44),
          h('span', { class: 'pet-row-text' },
            h('strong', {}, p.name),
            h('small', {}, `${(SPECIES[p.species] || SPECIES.other).label} · 추억 ${state.posts.filter(x => x.petId === p.id).length}개`)),
          h('span', { class: 'chev', 'aria-hidden': 'true' }, ic('chevron-right', { size: 22 })))))),
      h('button', { class: 'btn soft block', onclick: () => openPetSheet() }, ic('plus', { size: 20 }), '반려동물 추가')),
    renderThemeCard(),
    !isStandalone() && h('section', { class: 'card' },
      h('h2', { class: 'section-title' }, ic('smartphone', { size: 22 }), '앱처럼 쓰기'),
      h('p', { class: 'muted' }, '홈 화면에 추가하면 앱 아이콘을 눌러 바로 열 수 있어요. 따로 설치할 필요는 없어요.'),
      installPrompt && h('button', {
        class: 'btn primary block',
        onclick: async () => {
          const ev = installPrompt;
          installPrompt = null;
          ev.prompt();
          try { await ev.userChoice; } catch { /* 닫음 */ }
          render();
        },
      }, '홈 화면에 추가하기'),
      h('ol', { class: 'steps' }, installSteps().map(t => h('li', {}, t)))),
    h('section', { class: 'card' },
      h('h2', { class: 'section-title' }, ic('shield-check', { size: 22 }), '기록 보관'),
      h('p', { class: 'muted' }, '추억은 이 폰 안에만 저장돼요. 폰을 바꾸거나 인터넷 사용 기록을 지우면 사라질 수 있어서, 가끔 백업 파일을 저장해 두면 안전해요. 파일은 폰의 다운로드 폴더에 저장돼요.'),
      h('p', { class: 'backup-status' },
        state.lastBackup ? `마지막 백업: ${formatDate(state.lastBackup)}` : '아직 백업한 적이 없어요'),
      h('button', {
        class: 'btn primary block',
        onclick: async ev => {
          const btn = ev.currentTarget;
          btn.disabled = true;
          try {
            const { counts } = await downloadBackup();
            await reload();
            toast(`백업 파일을 저장했어요 (추억 ${counts.posts}개)`);
          } catch { toast('백업 파일을 만들지 못했어요.'); btn.disabled = false; }
        },
      }, ic('download', { size: 20 }), '백업 파일 저장'),
      h('button', { class: 'btn soft block', onclick: () => restoreInput.click() }, ic('upload', { size: 20 }), '백업에서 복원'),
      restoreInput));
}

/* ---------- 전체 그리기 ---------- */
const careCtx = { state, toast, openSheet, confirmBox, avatar, render: () => render(), reload: () => reload() };

function render() {
  urls.forEach(u => URL.revokeObjectURL(u));
  urls = [];
  destroyMap();
  destroyCare();
  const root = $('#app');
  root.replaceChildren();
  if (!state.pets.length) { root.append(renderOnboarding()); return; }

  const style = getSettings().style;
  const tabBar = h('nav', { class: 'tabbar', 'aria-label': '메뉴' }, h('div', { class: 'tabbar-inner' }, TABS.map(t => h('button', {
    class: 'tab' + (state.tab === t.id ? ' active' : ''),
    'aria-current': state.tab === t.id ? 'page' : null,
    onclick: () => { if (state.tab !== t.id) { state.tab = t.id; render(); window.scrollTo(0, 0); } },
  }, ic(t.icon, { size: 24 }), t.label))));

  const newPost = state.tab === 'feed' && style === 'card'
    ? h('button', { class: 'icon-btn', 'aria-label': '새 추억 쓰기', onclick: () => openCompose() }, ic('plus', { size: 28 })) : null;

  root.append(...[
    h('header', { class: 'topbar' }, h('div', { class: 'topbar-row' },
      h('h1', { class: 'brand' }, ic('paw-print', { size: 26, fill: true }), '추억 저장소'),
      h('div', { class: 'topbar-actions' }, newPost))),
    h('main', { class: 'main' }, ({ feed: renderFeed, calendar: renderCalendar, care: () => renderCareTab(careCtx), map: () => renderMapTab(toast), more: renderMore })[state.tab]()),
    state.tab === 'feed' && style === 'timeline' && h('button', { class: 'fab', 'aria-label': '새 추억 쓰기', onclick: () => openCompose() }, ic('plus', { size: 30, stroke: 2.4 })),
    tabBar].filter(Boolean));
}

/* ---------- 화면: 달력 ---------- */
const pad = n => String(n).padStart(2, '0');
const dateLabel = ds => { const d = parseYmd(ds); return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`; };

// 그 날짜에 해당하는 일정인가? (생일은 매년 같은 날 반복)
function occursOn(ev, ds) {
  if (ev.date === ds) return true;
  if (ev.type !== 'birthday' || ds < ev.date) return false;
  const [, em, ed] = ev.date.split('-').map(Number);
  const [y, m, d] = ds.split('-').map(Number);
  if (em === m && ed === d) return true;
  return em === 2 && ed === 29 && m === 2 && d === 28 && !isLeap(y); // 2/29 생일은 평년엔 2/28
}
const eventsOn = ds => state.events.filter(e => occursOn(e, ds)).sort((a, b) => (a.time || '').localeCompare(b.time || ''));

function upcomingEvents(limit = 5, horizonDays = 120) {
  const out = [];
  const now = new Date();
  for (let i = 0; i < horizonDays && out.length < limit; i++) {
    const ds = ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() + i));
    for (const ev of eventsOn(ds)) { out.push({ ev, ds, days: i }); if (out.length >= limit) break; }
  }
  return out;
}

function eventRow(ev, ds, { withDate = false, days = 0 } = {}) {
  const pet = state.pets.find(p => p.id === ev.petId);
  const t = EVENT_TYPES[ev.type] || EVENT_TYPES.etc;
  const age = ev.type === 'birthday' ? Number(ds.slice(0, 4)) - Number(ev.date.slice(0, 4)) : 0;
  const sub = [withDate && dateLabel(ds), formatClock(ev.time), pet && pet.name, age > 0 && `${age}살`].filter(Boolean).join(' · ');
  const dday = withDate && (days === 0 ? '오늘' : days === 1 ? '내일' : `D-${days}`);
  return h('button', { class: 'event-row', onclick: () => openEventSheet(ev) },
    h('span', { class: 'event-icon type-' + ev.type, 'aria-hidden': 'true' }, t.emoji),
    h('span', { class: 'event-text' }, h('strong', {}, ev.title), sub && h('small', {}, sub)),
    dday && h('span', { class: 'dday' + (days === 0 ? ' today' : '') }, dday));
}

function moveMonth(delta) {
  const d = new Date(state.calMonth.y, state.calMonth.m + delta, 1);
  state.calMonth = { y: d.getFullYear(), m: d.getMonth() };
  const today = new Date();
  state.calSel = (d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth())
    ? ymd(today) : ymd(d);
  render();
}

function renderCalendar() {
  const { y, m } = state.calMonth;
  const now = new Date();
  const today = ymd(now);
  const dim = new Date(y, m + 1, 0).getDate();
  const startDow = new Date(y, m, 1).getDay();

  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(h('span', { class: 'cal-blank' }));
  for (let d = 1; d <= dim; d++) {
    const ds = `${y}-${pad(m + 1)}-${pad(d)}`;
    const evs = eventsOn(ds);
    const types = [...new Set(evs.map(e => e.type))].slice(0, 3);
    const dow = (startDow + d - 1) % 7;
    cells.push(h('button', {
      class: 'cal-day' + (ds === state.calSel ? ' sel' : '') + (ds === today ? ' today' : '') + (dow === 0 ? ' sun' : dow === 6 ? ' sat' : ''),
      'aria-label': `${m + 1}월 ${d}일${evs.length ? `, 일정 ${evs.length}개` : ''}`,
      'aria-pressed': String(ds === state.calSel),
      onclick: () => { state.calSel = ds; render(); },
    }, h('span', { class: 'cal-num' }, d),
    h('span', { class: 'cal-dots' }, types.map(t => h('i', { class: 'dot type-' + t })))));
  }

  const dayEvents = eventsOn(state.calSel);
  const up = upcomingEvents();
  const notThisMonth = y !== now.getFullYear() || m !== now.getMonth();
  return h('div', { class: 'page calendar' },
    h('section', { class: 'card cal-card' },
      h('div', { class: 'cal-head' },
        h('button', { class: 'icon-btn', 'aria-label': '이전 달', onclick: () => moveMonth(-1) }, ic('chevron-left', { size: 28 })),
        h('h2', {}, `${y}년 ${m + 1}월`),
        h('button', { class: 'icon-btn', 'aria-label': '다음 달', onclick: () => moveMonth(1) }, ic('chevron-right', { size: 28 }))),
      h('div', { class: 'cal-grid cal-week', 'aria-hidden': 'true' },
        WEEKDAYS.map((w, i) => h('span', { class: i === 0 ? 'sun' : i === 6 ? 'sat' : '' }, w))),
      h('div', { class: 'cal-grid' }, cells),
      notThisMonth && h('button', {
        class: 'btn link',
        onclick: () => { state.calMonth = { y: now.getFullYear(), m: now.getMonth() }; state.calSel = today; render(); },
      }, '오늘로 가기')),
    h('section', { class: 'card' },
      h('h2', {}, dateLabel(state.calSel)),
      dayEvents.length
        ? h('div', { class: 'event-list' }, dayEvents.map(ev => eventRow(ev, state.calSel)))
        : h('p', { class: 'muted' }, '이 날은 일정이 없어요.'),
      h('button', { class: 'btn primary block', onclick: () => openEventSheet(null, state.calSel) }, ic('plus', { size: 20 }), '일정 추가')),
    h('section', { class: 'card' },
      h('h2', {}, '다가오는 일정'),
      up.length
        ? h('div', { class: 'event-list' }, up.map(u => eventRow(u.ev, u.ds, { withDate: true, days: u.days })))
        : h('p', { class: 'muted' }, '곧 다가오는 일정이 없어요. 병원 예약이나 생일을 적어 두면 여기에 보여요.')));
}

function openEventSheet(ev, presetDate) {
  const editing = !!ev;
  let type = ev?.type || 'hospital';
  let petId = ev ? ev.petId : (state.pets.length === 1 ? state.pets[0].id : (state.filter !== 'all' ? state.filter : null));
  let lastAuto = '';

  return openSheet(editing ? '일정 수정' : '새 일정', api => {
    const title = h('input', { class: 'input', type: 'text', maxLength: 40, value: ev?.title || '', placeholder: '예: 예방접종', 'aria-label': '제목', autocomplete: 'off' });
    const date = h('input', { class: 'input', type: 'date', value: ev?.date || presetDate || ymd(new Date()), 'aria-label': '날짜' });
    const time = h('input', { class: 'input', type: 'time', value: ev?.time || '', 'aria-label': '시간 (선택)' });
    const memo = h('textarea', { class: 'input textarea memo', maxLength: 300, rows: 3, value: ev?.memo || '', placeholder: '메모 (선택)', 'aria-label': '메모' });
    const error = h('p', { class: 'field-error', role: 'alert' });
    const typeRow = h('div', { class: 'chips', role: 'radiogroup', 'aria-label': '종류' });
    const petRow = h('div', { class: 'chips', role: 'radiogroup', 'aria-label': '누구의 일정인가요' });
    const dateLabelEl = h('label', { class: 'label' });
    const save = h('button', { type: 'button', class: 'btn primary block' }, editing ? '저장' : '추가');

    // 제목을 비워 뒀거나 자동으로 채운 그대로라면, 종류·아이를 바꿀 때 제목도 맞춰 준다
    const autoTitle = () => {
      const pet = state.pets.find(p => p.id === petId);
      const who = pet ? `${pet.name} ` : '';
      return { hospital: `${who}병원 예약`, birthday: `${who}생일`, grooming: `${who}미용`, etc: '' }[type];
    };
    const applyAuto = () => {
      if (!title.value.trim() || title.value === lastAuto) { lastAuto = autoTitle(); title.value = lastAuto; }
    };
    const drawDateLabel = () => dateLabelEl.replaceChildren(
      type === 'birthday' ? '태어난 날 (매년 반복돼요)' : '날짜', date);
    const drawType = () => {
      typeRow.replaceChildren(...Object.entries(EVENT_TYPES).map(([k, t]) => h('button', {
        type: 'button', class: 'chip' + (type === k ? ' active' : ''), role: 'radio', 'aria-checked': String(type === k),
        onclick: () => { type = k; drawType(); applyAuto(); },
      }, `${t.emoji} ${t.label}`)));
      drawDateLabel();
    };
    const drawPets = () => petRow.replaceChildren(
      h('button', { type: 'button', class: 'chip' + (petId == null ? ' active' : ''), role: 'radio', 'aria-checked': String(petId == null), onclick: () => { petId = null; drawPets(); applyAuto(); } }, '모두'),
      ...state.pets.map(p => h('button', {
        type: 'button', class: 'chip' + (p.id === petId ? ' active' : ''), role: 'radio', 'aria-checked': String(p.id === petId),
        onclick: () => { petId = p.id; drawPets(); applyAuto(); },
      }, avatar(p, 24, api.url), p.name)));

    save.addEventListener('click', async () => {
      error.textContent = '';
      const t = title.value.trim();
      if (!t) { error.textContent = '제목을 입력해 주세요.'; title.focus(); return; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date.value)) { error.textContent = '날짜를 골라 주세요.'; return; }
      save.disabled = true;
      try {
        await db.put('events', {
          id: ev?.id || uid(), petId, type, title: t, date: date.value, time: time.value || '',
          memo: memo.value.trim(), createdAt: ev?.createdAt || Date.now(),
        });
        api.close();
        if (type !== 'birthday') { // 생일은 태어난 해가 과거라서, 보던 달을 그대로 둔다
          state.calSel = date.value;
          const d = parseYmd(date.value);
          state.calMonth = { y: d.getFullYear(), m: d.getMonth() };
        }
        await reload();
        toast(editing ? '수정했어요' : '일정을 추가했어요');
      } catch (err) { toast(friendlyError(err)); save.disabled = false; }
    });

    if (!editing) applyAuto();
    drawType();
    if (state.pets.length > 1) drawPets();
    const form = h('div', { class: 'form' },
      h('div', { class: 'label' }, '종류', typeRow),
      state.pets.length > 1 && h('div', { class: 'label' }, '누구의 일정인가요?', petRow),
      h('label', { class: 'label' }, '제목', title), error,
      dateLabelEl,
      h('label', { class: 'label' }, '시간 (선택)', time),
      h('label', { class: 'label' }, '메모 (선택)', memo),
      save);
    if (editing) {
      form.append(h('button', {
        type: 'button', class: 'btn link danger-text',
        onclick: async () => {
          const ok = await confirmBox({ title: '이 일정을 삭제할까요?', message: '삭제하면 되돌릴 수 없어요.', ok: '삭제', danger: true });
          if (!ok) return;
          try { await db.remove('events', ev.id); api.close(); await reload(); toast('삭제했어요'); }
          catch (err) { toast(friendlyError(err)); }
        },
      }, '일정 삭제하기'));
    }
    return form;
  });
}

/* ---------- "방금 전" 같은 시간 표시 자동 갱신 ---------- */
// 화면을 다시 그리지 않고 글자만 바꾼다 (스크롤·열린 창·입력 중인 내용이 유지됨)
function refreshTimes() {
  if (document.hidden) return;
  const now = Date.now();
  document.querySelectorAll('time[data-ts]').forEach(el => {
    const text = formatTime(Number(el.dataset.ts), now);
    if (el.textContent !== text) el.textContent = text;
  });
}
setInterval(refreshTimes, 30000);
document.addEventListener('visibilitychange', () => {
  refreshTimes(); // 앱으로 돌아오면 바로 갱신
  if (!document.hidden && state.tab === 'care' && state.pets.length) render(); // 그동안 줄어든 수치 반영
});

/* ---------- 시작 ---------- */
async function start() {
  try {
    await load();
    render();
  } catch {
    $('#app').replaceChildren(h('main', { class: 'welcome' },
      h('div', { class: 'welcome-hero' }, ic('info', { size: 44 })),
      h('h1', {}, '저장 기능을 쓸 수 없어요'),
      h('p', { class: 'muted' }, '인터넷 브라우저의 시크릿(비공개) 모드라면 끄고 다시 열어 주세요. 계속 안 되면 다른 브라우저(크롬, 사파리)로 열어 보세요.')));
  }
}

start();
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
