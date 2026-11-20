import * as db from './db.js';
import { h, uid, compressImage, formatTime } from './util.js';
import { downloadBackup, parseBackup } from './backup.js';

const SPECIES = {
  dog: { label: '강아지', emoji: '🐶' },
  cat: { label: '고양이', emoji: '🐱' },
  other: { label: '기타', emoji: '🐾' },
};
const PAGE_SIZE = 20;
const TEXT_MAX = 2000;
const DAY = 86400000;

const TABS = [
  { id: 'feed', label: '추억', icon: '📖' },
  { id: 'more', label: '더보기', icon: '⚙️' },
];

const state = {
  pets: [], posts: [], filter: 'all', tab: 'feed',
  shown: PAGE_SIZE, lastBackup: undefined, lastPet: null, bannerHidden: false,
};

let urls = [];
const blobUrl = blob => { const u = URL.createObjectURL(blob); urls.push(u); return u; };
const $ = sel => document.querySelector(sel);

/* ---------- 데이터 불러오기 ---------- */
async function load() {
  const [pets, posts, lastBackup] = await Promise.all([
    db.getAll('pets'), db.getAll('posts'), db.getMeta('lastBackup'),
  ]);
  state.pets = pets.sort((a, b) => a.createdAt - b.createdAt);
  state.posts = posts.sort((a, b) => b.createdAt - a.createdAt);
  state.lastBackup = lastBackup;
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
      h('button', { class: 'icon-btn', 'aria-label': '닫기', onclick: () => api.tryClose() }, '✕')),
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
    h('button', { class: 'icon-btn viewer-close', 'aria-label': '닫기' }, '✕'));
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
    idleLabel: () => '📷 사진 고르기',
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
    form.append(h('button', {
      type: 'button', class: 'btn link danger-text',
      onclick: async () => {
        const ok = await confirmBox({
          title: `${pet.name}을(를) 삭제할까요?`,
          message: count ? `${pet.name}의 추억 ${count}개도 함께 삭제되고, 되돌릴 수 없어요.` : '되돌릴 수 없어요.',
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
      idleLabel: () => (photo ? '📷 사진 바꾸기' : '📷 사진 추가'),
      onBusy: b => { busy = b; refresh(); },
      onPick: blob => { photo = blob; drawPhoto(); },
    });
    function drawPhoto() {
      picker.refreshLabel();
      photoBox.replaceChildren(...[
        photo && h('div', { class: 'thumb' },
          h('img', { src: api.url(photo), alt: '첨부한 사진' }),
          h('button', { type: 'button', class: 'thumb-x', 'aria-label': '사진 빼기', onclick: () => { photo = null; drawPhoto(); refresh(); } }, '✕')),
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
        await reload();
        window.scrollTo(0, 0);
        toast(editing ? '수정했어요' : '추억을 남겼어요 🐾');
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
    h('button', { class: 'btn soft block', onclick: () => { api.close(); openCompose(post); } }, '✏️ 수정하기'),
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
    }, '🗑️ 삭제하기')));
}

/* ---------- 화면: 시작(첫 실행) ---------- */
function renderOnboarding() {
  const form = petForm({
    firstTime: true, mkUrl: blobUrl,
    onDone: async saved => { state.filter = saved.id; state.lastPet = saved.id; await reload(); toast(`${saved.name}, 반가워요! 🐾`); },
    onDeleted: () => {},
  });
  return h('main', { class: 'welcome' },
    h('div', { class: 'welcome-hero' }, '🐾'),
    h('h1', {}, '우리 아이를 소개해 주세요'),
    h('p', { class: 'muted' }, '추억은 이 폰에만 저장돼요. 나만 볼 수 있어요.'),
    h('div', { class: 'card' }, form));
}

/* ---------- 화면: 추억(피드) ---------- */
function backupBannerNeeded() {
  if (state.bannerHidden || !state.posts.length) return false;
  if (state.lastBackup === undefined) return state.posts.length >= 3;
  return Date.now() - state.lastBackup > 30 * DAY;
}

function postCard(post) {
  const pet = state.pets.find(p => p.id === post.petId);
  return h('article', { class: 'post' },
    h('header', { class: 'post-head' },
      avatar(pet, 40),
      h('div', { class: 'post-meta' },
        h('strong', {}, pet ? pet.name : '(삭제된 아이)'),
        h('time', { datetime: new Date(post.createdAt).toISOString() }, formatTime(post.createdAt))),
      h('button', { class: 'icon-btn', 'aria-label': '더보기', onclick: () => openPostMenu(post) }, '⋯')),
    post.text && h('p', { class: 'post-text' }, post.text),
    post.photo && h('button', { class: 'post-photo', 'aria-label': '사진 크게 보기', onclick: () => openViewer(post.photo) },
      h('img', { src: blobUrl(post.photo), alt: '', loading: 'lazy' })));
}

function renderFeed() {
  const wrap = h('div', {});
  wrap.append(h('div', { class: 'filter', role: 'tablist', 'aria-label': '아이 고르기' },
    h('button', {
      class: 'chip' + (state.filter === 'all' ? ' active' : ''), role: 'tab',
      onclick: () => { state.filter = 'all'; state.shown = PAGE_SIZE; render(); },
    }, '전체'),
    ...state.pets.map(p => h('button', {
      class: 'chip' + (state.filter === p.id ? ' active' : ''), role: 'tab',
      onclick: () => { state.filter = p.id; state.shown = PAGE_SIZE; render(); },
    }, avatar(p, 24), p.name)),
    h('button', { class: 'chip add', 'aria-label': '반려동물 추가', onclick: () => openPetSheet() }, '＋')));

  if (backupBannerNeeded()) {
    wrap.append(h('div', { class: 'banner' },
      h('span', {}, '🔒 소중한 추억을 잃어버리지 않게 백업해 두세요.'),
      h('div', { class: 'banner-actions' },
        h('button', { class: 'btn small primary', onclick: () => { state.tab = 'more'; render(); window.scrollTo(0, 0); } }, '백업하러 가기'),
        h('button', { class: 'btn small link', onclick: () => { state.bannerHidden = true; render(); } }, '나중에'))));
  }

  const list = state.filter === 'all' ? state.posts : state.posts.filter(p => p.petId === state.filter);
  if (!list.length) {
    const pet = state.pets.find(p => p.id === state.filter);
    wrap.append(h('div', { class: 'empty' },
      h('div', { class: 'empty-icon' }, '📖'),
      h('h2', {}, pet ? `${pet.name}의 첫 추억을 남겨 보세요` : '첫 추억을 남겨 보세요'),
      h('p', { class: 'muted' }, '글만 써도 되고, 사진을 함께 올려도 돼요.'),
      h('button', { class: 'btn primary', onclick: () => openCompose() }, '✏️ 추억 쓰기')));
  } else {
    const shown = list.slice(0, state.shown);
    wrap.append(h('div', { class: 'posts' }, shown.map(postCard)));
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
    message: `지금 있는 기록(아이 ${state.pets.length}마리, 추억 ${state.posts.length}개)은 사라지고, 백업 파일의 기록(아이 ${parsed.pets.length}마리, 추억 ${parsed.posts.length}개)으로 바뀌어요.`,
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

function renderMore() {
  const restoreInput = h('input', { type: 'file', accept: '.json,application/json', hidden: true });
  restoreInput.addEventListener('change', async () => {
    const file = restoreInput.files && restoreInput.files[0];
    restoreInput.value = '';
    if (file) await restoreFrom(file);
  });

  return h('div', { class: 'more' },
    h('section', { class: 'card' },
      h('h2', {}, '우리 아이들'),
      h('ul', { class: 'pet-list' }, state.pets.map(p => h('li', {},
        h('button', { class: 'pet-row', onclick: () => openPetSheet(p) },
          avatar(p, 44),
          h('span', { class: 'pet-row-text' },
            h('strong', {}, p.name),
            h('small', {}, `${(SPECIES[p.species] || SPECIES.other).label} · 추억 ${state.posts.filter(x => x.petId === p.id).length}개`)),
          h('span', { class: 'chev', 'aria-hidden': 'true' }, '›'))))),
      h('button', { class: 'btn soft block', onclick: () => openPetSheet() }, '＋ 반려동물 추가')),
    h('section', { class: 'card' },
      h('h2', {}, '기록 보관'),
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
      }, '💾 백업 파일 저장'),
      h('button', { class: 'btn soft block', onclick: () => restoreInput.click() }, '📂 백업에서 복원'),
      restoreInput));
}

/* ---------- 전체 그리기 ---------- */
function render() {
  urls.forEach(u => URL.revokeObjectURL(u));
  urls = [];
  const root = $('#app');
  root.replaceChildren();
  if (!state.pets.length) { root.append(renderOnboarding()); return; }

  const tabBar = h('nav', { class: 'tabbar', 'aria-label': '메뉴' }, TABS.map(t => h('button', {
    class: 'tab' + (state.tab === t.id ? ' active' : ''),
    'aria-current': state.tab === t.id ? 'page' : null,
    onclick: () => { if (state.tab !== t.id) { state.tab = t.id; render(); window.scrollTo(0, 0); } },
  }, h('span', { class: 'tab-icon', 'aria-hidden': 'true' }, t.icon), t.label)));

  root.append(...[
    h('header', { class: 'topbar' }, h('h1', {}, '🐾 추억 저장소')),
    h('main', { class: 'main' }, state.tab === 'feed' ? renderFeed() : renderMore()),
    state.tab === 'feed' && h('button', { class: 'fab', onclick: () => openCompose() }, '✏️ 글쓰기'),
    tabBar].filter(Boolean));
}

/* ---------- 시작 ---------- */
async function start() {
  try {
    await load();
    render();
  } catch {
    $('#app').replaceChildren(h('main', { class: 'welcome' },
      h('div', { class: 'welcome-hero' }, '😿'),
      h('h1', {}, '저장 기능을 쓸 수 없어요'),
      h('p', { class: 'muted' }, '인터넷 브라우저의 시크릿(비공개) 모드라면 끄고 다시 열어 주세요. 계속 안 되면 다른 브라우저(크롬, 사파리)로 열어 보세요.')));
  }
}

start();
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
