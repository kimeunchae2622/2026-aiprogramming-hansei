// 우리 집 게임의 물건 목록: 가구, 벽지, 바닥. (옷은 js/character.js 의 OUTFITS)
// 가구 위치: x = 가로 중심(%), b = 바닥에서 높이(%, 방 높이 기준), w = 너비(%, 방 너비 기준)
// layer: back(캐릭터 뒤), under(캐릭터 발밑), front(캐릭터 앞)
const SHADOW = 'rgba(60,35,10,.16)';

export const FURNITURE = {
  bowl: { name: '밥그릇', price: 0, kind: 'floor', layer: 'front', x: 26, b: 4, w: 17, vb: [100, 60],
    art: `<ellipse cx="50" cy="54" rx="42" ry="5" fill="${SHADOW}"/><path d="M12 26 H88 Q86 54 50 54 Q14 54 12 26Z" fill="#e8503f"/><ellipse cx="50" cy="26" rx="38" ry="9" fill="#c53a2c"/><ellipse cx="50" cy="25" rx="32" ry="6" fill="#6b3b2c"/><g class="kibble" opacity="0"><circle cx="38" cy="21" r="5" fill="#b9773f"/><circle cx="50" cy="18" r="5.5" fill="#c98648"/><circle cx="62" cy="21" r="5" fill="#b9773f"/><circle cx="44" cy="24" r="4.5" fill="#a96a35"/><circle cx="57" cy="24" r="4.5" fill="#a96a35"/></g><path d="M24 40 q26 10 52 0" stroke="#fff" stroke-opacity=".45" stroke-width="3" fill="none" stroke-linecap="round"/>` },
  rug: { name: '동글 러그', price: 60, kind: 'floor', layer: 'under', x: 50, b: 5, w: 62, vb: [120, 40],
    art: '<ellipse cx="60" cy="22" rx="58" ry="17" fill="#f3b95f"/><ellipse cx="60" cy="22" rx="48" ry="13" fill="#fff3cf"/><ellipse cx="60" cy="22" rx="30" ry="8" fill="#f3b95f"/>' },
  cushion: { name: '푹신 방석', price: 40, kind: 'floor', layer: 'under', x: 47, b: 3, w: 22, vb: [100, 50],
    art: `<ellipse cx="50" cy="44" rx="44" ry="6" fill="${SHADOW}"/><rect x="8" y="10" width="84" height="34" rx="17" fill="#7fb8ff"/><rect x="14" y="13" width="72" height="10" rx="5" fill="#fff" opacity=".35"/><circle cx="50" cy="28" r="4" fill="#4a8fe0"/>` },
  bed: { name: '포근 침대', price: 120, kind: 'floor', layer: 'under', x: 78, b: 7, w: 30, vb: [120, 70],
    art: `<ellipse cx="60" cy="64" rx="54" ry="6" fill="${SHADOW}"/><path d="M6 36 Q6 10 60 10 Q114 10 114 36 Q114 62 60 62 Q6 62 6 36Z" fill="#c9915a" stroke="#a8703c" stroke-width="3"/><ellipse cx="60" cy="34" rx="44" ry="18" fill="#fff1dc"/><ellipse cx="60" cy="37" rx="30" ry="11" fill="#ffe2bd"/>` },
  plant: { name: '화분', price: 50, kind: 'floor', layer: 'back', x: 11, b: 14, w: 17, vb: [80, 110],
    art: `<ellipse cx="40" cy="105" rx="24" ry="4" fill="${SHADOW}"/><path d="M18 70 H62 L56 104 H24Z" fill="#c4683c"/><rect x="15" y="63" width="50" height="10" rx="4" fill="#d9824e"/><path d="M40 64 Q10 50 16 14 Q38 28 40 64Z" fill="#3fae6a"/><path d="M40 64 Q70 48 64 12 Q42 28 40 64Z" fill="#2e9a5a"/><path d="M40 64 Q32 36 40 6 Q52 36 40 64Z" fill="#58c984"/>` },
  lamp: { name: '스탠드 조명', price: 80, kind: 'floor', layer: 'back', x: 92, b: 15, w: 12, vb: [60, 130],
    art: `<ellipse cx="30" cy="125" rx="17" ry="4" fill="${SHADOW}"/><rect x="28" y="52" width="4" height="72" fill="#7a5a3a"/><ellipse cx="30" cy="123" rx="14" ry="3.5" fill="#5b4636"/><path class="shade" d="M8 54 L16 14 H44 L52 54Z" fill="#ffd36e" stroke="#e0a93c" stroke-width="2"/>` },
  basket: { name: '장난감 바구니', price: 60, kind: 'floor', layer: 'front', x: 62, b: 3, w: 15, vb: [80, 60],
    art: `<ellipse cx="40" cy="56" rx="34" ry="4" fill="${SHADOW}"/><circle cx="26" cy="22" r="9" fill="#ef5350"/><circle cx="48" cy="20" r="8" fill="#42a5f5"/><circle cx="37" cy="13" r="7" fill="#ffd54f"/><path d="M10 26 H70 L64 54 H16Z" fill="#d9a867" stroke="#b57f3a" stroke-width="2"/><path d="M15 36 H65 M13 45 H67" stroke="#b57f3a" stroke-width="2"/>` },
  frame: { name: '풍경 액자', price: 40, kind: 'wall', x: 66, t: 13, w: 15, vb: [80, 100],
    art: '<rect x="4" y="4" width="72" height="92" rx="6" fill="#b57f3a"/><rect x="10" y="10" width="60" height="80" rx="3" fill="#fffaf0"/><circle cx="40" cy="36" r="11" fill="#ffcf5a"/><path d="M10 90 V62 Q30 44 46 64 Q58 52 70 66 V90Z" fill="#7cc99a"/>' },
  clock: { name: '벽시계', price: 60, kind: 'wall', x: 50, t: 7, w: 10, vb: [100, 100],
    art: '<circle cx="50" cy="50" r="46" fill="#fff" stroke="#8a6a3f" stroke-width="6"/><g stroke="#8a6a3f" stroke-width="3" stroke-linecap="round"><path d="M50 12 v7 M50 81 v7 M12 50 h7 M81 50 h7"/></g><line class="hand-h" x1="50" y1="50" x2="50" y2="29" stroke="#3a2b20" stroke-width="5" stroke-linecap="round"/><line class="hand-m" x1="50" y1="50" x2="50" y2="20" stroke="#e8503f" stroke-width="3.5" stroke-linecap="round"/><circle cx="50" cy="50" r="4" fill="#3a2b20"/>' },
};

export const WALLS = {
  cream: { name: '크림', price: 0, bg: 'linear-gradient(#fff3de, #f9e2bd)', swatch: '#f9e2bd' },
  sky: { name: '하늘', price: 40, bg: 'linear-gradient(#e6f4ff, #bfe1fb)', swatch: '#bfe1fb' },
  mint: { name: '민트', price: 40, bg: 'linear-gradient(#e6f8ee, #c3ead5)', swatch: '#c3ead5' },
  pink: { name: '벚꽃', price: 40, bg: 'linear-gradient(#ffeaf0, #ffd0de)', swatch: '#ffd0de' },
  navy: { name: '밤하늘', price: 60, bg: 'linear-gradient(#4a5a86, #2f3b5e)', swatch: '#3b4870' },
};

export const FLOORS = {
  wood: { name: '우드', price: 0, bg: 'repeating-linear-gradient(90deg, #d9a867 0 46px, #cf9c5a 46px 48px)', swatch: '#d9a867' },
  light: { name: '밝은 우드', price: 40, bg: 'repeating-linear-gradient(90deg, #f1dcb8 0 46px, #e6cfa5 46px 48px)', swatch: '#f1dcb8' },
  tile: { name: '체크 타일', price: 50, bg: 'conic-gradient(#f4f4f6 25%, #d9dde6 0 50%, #f4f4f6 0 75%, #d9dde6 0) 0 0 / 56px 56px', swatch: '#d9dde6' },
};

// 처음부터 가진 물건 (방이 너무 휑하지 않게)
export const DEFAULT_OWNED = ['bowl', 'cushion', 'plant'];
export const DEFAULT_PLACED = ['bowl', 'cushion', 'plant'];

// 가구 그림 요소 (방과 상점 미리보기에서 공통으로 사용)
export function furnitureSvg(id) {
  const it = FURNITURE[id];
  if (!it) return '';
  return `<svg class="furn-svg" viewBox="0 0 ${it.vb[0]} ${it.vb[1]}" width="100%" height="100%" aria-hidden="true" focusable="false">${it.art}</svg>`;
}
