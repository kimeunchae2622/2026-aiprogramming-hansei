// IndexedDB 저장소: 모든 기록은 사용자 폰(브라우저) 안에만 저장된다.
const DB_NAME = 'pet-memories';
const DB_VERSION = 3;
export const STORES = ['pets', 'posts', 'events', 'characters', 'meta'];
// 백업에 포함할 저장소 (기능이 늘어나면 여기에 추가)
export const BACKUP_STORES = ['pets', 'posts', 'events', 'characters'];

let dbPromise;
function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = req.result;
      // 버전별로 필요한 저장소만 추가한다 (이미 쓰던 기록은 그대로 유지)
      if (e.oldVersion < 1) {
        db.createObjectStore('pets', { keyPath: 'id' });
        db.createObjectStore('posts', { keyPath: 'id' });
        db.createObjectStore('meta', { keyPath: 'key' });
      }
      if (e.oldVersion < 2) db.createObjectStore('events', { keyPath: 'id' });
      if (e.oldVersion < 3) db.createObjectStore('characters', { keyPath: 'id' }); // id = 반려동물 id
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('blocked'));
  });
  return dbPromise;
}

function reqValue(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAll(store) {
  const db = await open();
  return reqValue(db.transaction(store).objectStore(store).getAll());
}

export async function put(store, obj) {
  const db = await open();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).put(obj);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(obj);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('aborted'));
  });
}

export async function remove(store, id) {
  const db = await open();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).delete(id);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// 반려동물과 그 아이의 추억·일정을 한 번에 삭제
export async function removePetWithPosts(petId) {
  const db = await open();
  const tx = db.transaction(['pets', 'posts', 'events', 'characters'], 'readwrite');
  tx.objectStore('pets').delete(petId);
  tx.objectStore('characters').delete(petId);
  for (const name of ['posts', 'events']) {
    const cur = tx.objectStore(name).openCursor();
    cur.onsuccess = () => {
      const c = cur.result;
      if (!c) return;
      if (c.value.petId === petId) c.delete();
      c.continue();
    };
  }
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('aborted'));
  });
}

export async function getMeta(key) {
  const db = await open();
  const row = await reqValue(db.transaction('meta').objectStore('meta').get(key));
  return row ? row.value : undefined;
}

export function setMeta(key, value) {
  return put('meta', { key, value });
}

// 백업 복원: 지정한 저장소의 내용을 통째로 교체 (실패하면 기존 데이터 유지)
export async function replaceAll(data) {
  const db = await open();
  const tx = db.transaction(BACKUP_STORES, 'readwrite');
  for (const name of BACKUP_STORES) {
    const store = tx.objectStore(name);
    store.clear();
    for (const row of data[name] || []) store.put(row);
  }
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('aborted'));
  });
}
