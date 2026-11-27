// 최초 캐릭터·반려동물 만들기 화면 (설정에서 다시 열어 고칠 수도 있다).
// 반려동물 "게임 속 모습"만 따로 저장한다. 앱에 등록된 반려동물 정보는 건드리지 않는다.
import { h } from '../util.js';
import { iconURL } from './pixel.js';
import { LOOKS, DEFAULT_LOOK, normLook, playerFrame, petFrame, PET_OPTS, normPetLook } from './sprites.js';

const PLAYER_ROWS = [['style', '머리 모양'], ['hair', '머리색'], ['skin', '피부색'], ['glasses', '안경'], ['gcolor', '안경 색'], ['dress', '원피스 색']];
const PET_ROWS = [['kind', '동물'], ['color', '털 색'], ['coat', '털 길이'], ['fur', '털 결'], ['pattern', '무늬'], ['eye', '눈'], ['nose', '코'], ['ear', '귀'], ['tail', '꼬리'], ['acc', '장식']];
const swatch = v => v.hair || v.skin || v.gl || v.dress || null;

// deps: { modal(title, body, opts) → close, save, pets, onSave(), toast }
export function runCreator({ modal, save, pets, onDone, editing }) {
  const steps = [{ type: 'player' }, ...pets.map(p => ({ type: 'pet', pet: p }))];
  let i = 0, close = null;
  const draft = { look: normLook(save.look), pets: Object.fromEntries(pets.map(p => [p.id, normPetLook(save.petLooks[p.id], p.species)])) };
  const body = h('div', { class: 'vg-creator' });

  const preview = (frames) => {
    const box = h('div', { class: 'vg-prev' });
    for (const f of frames) { const im = h('img', { src: iconURL(f, 3), alt: '' }); box.append(im); }
    return box;
  };
  const chipRow = (label, opts, cur, onPick, withColor) => h('div', { class: 'vg-lab' }, label,
    h('div', { class: 'vg-chips' }, Object.entries(opts).map(([id, v]) => {
      const name = typeof v === 'string' ? v : v.name, sw = typeof v === 'string' ? null : swatch(v);
      return h('button', { type: 'button', class: 'vg-chip' + (cur === id ? ' on' : ''), 'aria-pressed': String(cur === id), onclick: () => onPick(id) }, sw ? h('i', { style: `background:${sw}` }) : null, name);
    })));

  function draw() {
    const st = steps[i], last = i === steps.length - 1;
    let title, frames, rows;
    if (st.type === 'player') {
      title = '나는 어떤 모습일까요?';
      frames = [playerFrame('down', 0, draft.look), playerFrame('left', 1, draft.look), playerFrame('up', 0, draft.look)];
      rows = PLAYER_ROWS.map(([k, label]) => chipRow(label, LOOKS[k], draft.look[k], id => { draft.look[k] = id; draw(); }));
    } else {
      const l = draft.pets[st.pet.id];
      title = `${st.pet.name}의 모습을 골라 주세요`;
      frames = [petFrame(l, 'down', 'stand'), petFrame(l, 'left', 'walk1'), petFrame(l, 'up', 'stand'), petFrame(l, 'left', 'rest')];
      rows = PET_ROWS.map(([k, label]) => chipRow(label, PET_OPTS[k], l[k], id => { l[k] = id; draft.pets[st.pet.id] = normPetLook(l); draw(); }));
    }
    body.replaceChildren(
      h('div', { class: 'vg-step' }, `${i + 1} / ${steps.length}`, h('b', {}, title)),
      preview(frames), h('div', { class: 'vg-rows' }, rows),
      h('div', { class: 'vg-nav' },
        i > 0 ? h('button', { class: 'vg-btn', type: 'button', onclick: () => { i--; draw(); } }, '← 이전') : null,
        h('button', { class: 'vg-btn big', type: 'button', onclick: () => { if (last) finish(); else { i++; draw(); } } }, last ? (editing ? '저장하기' : '마을로 들어가기') : '다음 →')));
    body.parentNode && (body.parentNode.scrollTop = 0);
  }
  function finish() {
    save.look = normLook(draft.look);
    for (const p of pets) save.petLooks[p.id] = normPetLook(draft.pets[p.id], p.species);
    save.setup = true;
    close();
    onDone();
  }
  draw();
  close = modal(editing ? '외모 바꾸기' : '별빛 꼬리 마을에 오신 걸 환영해요', body, { wide: true, locked: !editing });
}
