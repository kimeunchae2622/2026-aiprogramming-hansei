// 동물병원 지도: Leaflet(지도 화면) + OpenStreetMap(지도 이미지) + 공공데이터(data/hospitals.json)
// 지도 라이브러리는 지도 탭을 처음 열 때만 불러온다 (앱 시작을 느리게 하지 않기 위해).
import { h } from './util.js';
import { iconEl as ic } from './icons.js';

const url = path => new URL('../' + path, import.meta.url).href;
const KOREA = { center: [36.35, 127.8], zoom: 7 };

let map = null;
let generation = 0;           // 탭을 떠났다가 돌아올 때 이전 작업을 무시하기 위한 번호
let view = { ...KOREA };      // 마지막으로 보던 위치 (탭을 다녀와도 유지)
let libPromise = null;
let dataPromise = null;

function loadCss(path) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = url(path);
  document.head.append(link);
}
function loadScript(path) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = url(path);
    s.onload = resolve;
    s.onerror = () => reject(new Error('script'));
    document.head.append(s);
  });
}
function ensureLib() {
  if (!libPromise) {
    libPromise = (async () => {
      loadCss('lib/leaflet/leaflet.css');
      loadCss('lib/leaflet/MarkerCluster.css');
      loadCss('lib/leaflet/MarkerCluster.Default.css');
      await loadScript('lib/leaflet/leaflet.js');
      await loadScript('lib/leaflet/leaflet.markercluster.js');
    })();
    libPromise.catch(() => { libPromise = null; document.querySelectorAll('link[href*="lib/leaflet"]').forEach(l => l.remove()); });
  }
  return libPromise;
}
function loadHospitals() {
  if (!dataPromise) {
    dataPromise = fetch(url('data/hospitals.json')).then(r => {
      if (!r.ok) throw new Error('data');
      return r.json();
    });
    dataPromise.catch(() => { dataPromise = null; });
  }
  return dataPromise;
}

export function destroyMap() {
  generation++;
  if (map) { map.remove(); map = null; }
}

function popupNode(d) {
  const phone = (d.p || '').replace(/[^\d+\-]/g, '');
  const nav = `https://map.kakao.com/link/to/${encodeURIComponent(d.n)},${d.y},${d.x}`;
  return h('div', { class: 'hos-pop' },
    h('strong', {}, d.n),
    h('span', {}, d.a || '주소 정보 없음'),
    h('div', { class: 'hos-actions' },
      phone && h('a', { class: 'btn small primary', href: `tel:${phone}` }, ic('phone', { size: 16 }), '전화'),
      h('a', { class: 'btn small soft', href: nav, target: '_blank', rel: 'noopener' }, ic('navigation', { size: 16 }), '길 안내')));
}

export function renderMapTab(toast) {
  const myGen = ++generation;
  if (map) { map.remove(); map = null; }

  const status = h('p', { class: 'map-status', role: 'status' }, '지도를 불러오는 중…');
  const mapEl = h('div', { class: 'map-box', role: 'region', 'aria-label': '동물병원 지도' });
  const input = h('input', {
    class: 'input', type: 'search', placeholder: '병원 이름이나 동네로 찾기 (예: 강남)',
    'aria-label': '병원 찾기', autocomplete: 'off',
  });
  const locBtn = h('button', { class: 'btn soft', type: 'button', disabled: true }, ic('locate-fixed', { size: 18 }), '내 주변');
  const results = h('div', { class: 'map-results', role: 'list' });
  const root = h('div', { class: 'page mapview' },
    h('section', { class: 'card map-tools' }, h('div', { class: 'map-search' }, input, locBtn), results),
    mapEl, status,
    h('p', { class: 'map-note' },
      '병원 정보: 행정안전부 지방행정인허가 데이터(공공데이터포털, 2025년 11월 기준). 폐업·이전 등으로 실제와 다를 수 있어요. 내 위치는 저장되거나 전송되지 않아요.'));

  async function init() {
    let hospitals;
    try {
      [hospitals] = await Promise.all([loadHospitals(), ensureLib()]);
    } catch {
      if (myGen !== generation) return;
      status.replaceChildren('지도를 불러오지 못했어요. 인터넷 연결을 확인해 주세요. ',
        h('button', { class: 'btn small primary', onclick: () => { status.textContent = '지도를 불러오는 중…'; init(); } }, '다시 시도'));
      return;
    }
    if (myGen !== generation || !mapEl.isConnected) return; // 그 사이 다른 탭으로 이동함

    const L = window.L;
    map = L.map(mapEl, { preferCanvas: true, zoomControl: true }).setView(view.center, view.zoom);
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
    }).addTo(map);
    let tileFailed = false;
    tiles.on('tileerror', () => {
      if (tileFailed) return;
      tileFailed = true;
      status.textContent = '지도 그림을 불러오지 못했어요. 인터넷 연결을 확인해 주세요.';
    });
    tiles.on('tileload', () => {
      if (tileFailed) { tileFailed = false; status.textContent = summary; }
    });
    map.on('moveend', () => { const c = map.getCenter(); view = { center: [c.lat, c.lng], zoom: map.getZoom() }; });

    const cluster = L.markerClusterGroup({ chunkedLoading: true, maxClusterRadius: 50, showCoverageOnHover: false });
    const items = hospitals.map(d => {
      const m = L.circleMarker([d.y, d.x], { radius: 9, color: '#fff', weight: 2, fillColor: '#e8574a', fillOpacity: 1 });
      m.bindPopup(() => popupNode(d), { minWidth: 200 });
      return { d, m, key: `${d.n} ${d.a}`.toLowerCase() };
    });
    cluster.addLayers(items.map(i => i.m));
    map.addLayer(cluster);

    const summary = `전국 동물병원 ${hospitals.length.toLocaleString('ko-KR')}곳 · 빨간 점을 눌러 보세요`;
    status.textContent = summary;
    setTimeout(() => map && map.invalidateSize(), 100);

    // 병원 찾기
    let timer;
    const showResults = () => {
      const q = input.value.trim().toLowerCase();
      results.replaceChildren();
      if (!q) return;
      const hits = items.filter(i => i.key.includes(q))
        .sort((a, b) => (b.d.n.toLowerCase().includes(q) ? 1 : 0) - (a.d.n.toLowerCase().includes(q) ? 1 : 0))
        .slice(0, 20);
      if (!hits.length) { results.append(h('p', { class: 'muted pad' }, '찾는 병원이 없어요. 다른 이름이나 동네로 검색해 보세요.')); return; }
      results.append(...hits.map(i => h('button', {
        class: 'result-row', role: 'listitem',
        onclick: () => {
          results.replaceChildren();
          input.blur();
          cluster.zoomToShowLayer(i.m, () => i.m.openPopup());
          mapEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        },
      }, h('strong', {}, i.d.n), h('small', {}, i.d.a))));
    };
    input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(showResults, 150); });

    // 내 주변
    let here = null;
    locBtn.disabled = false;
    locBtn.addEventListener('click', () => {
      if (!navigator.geolocation) { toast('이 브라우저에서는 내 위치를 쓸 수 없어요.'); return; }
      locBtn.disabled = true;
      locBtn.replaceChildren('위치 찾는 중…');
      navigator.geolocation.getCurrentPosition(pos => {
        locBtn.disabled = false; locBtn.replaceChildren(ic('locate-fixed', { size: 18 }), '내 주변');
        if (myGen !== generation || !map) return;
        const ll = [pos.coords.latitude, pos.coords.longitude];
        if (here) here.remove();
        here = L.circleMarker(ll, { radius: 9, color: '#fff', weight: 3, fillColor: '#3b78d8', fillOpacity: 1 }).addTo(map);
        map.setView(ll, 14);
      }, err => {
        locBtn.disabled = false; locBtn.replaceChildren(ic('locate-fixed', { size: 18 }), '내 주변');
        toast(err && err.code === 1
          ? '위치 사용이 꺼져 있어요. 폰 설정에서 이 사이트의 위치를 허용해 주세요.'
          : '내 위치를 찾지 못했어요. 잠시 뒤 다시 시도해 주세요.');
      }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
    });
  }

  setTimeout(init, 0); // 화면에 붙은 뒤에 지도를 만들어야 크기를 알 수 있다
  return root;
}
