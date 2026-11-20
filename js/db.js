// IndexedDB 저장소: 모든 기록은 사용자 폰(브라우저) 안에만 저장된다.
const DB_NAME = 'pet-memories';
const DB_VERSION = 1;
export const STORES = ['pets', 'posts', 'meta'];
// 백업에 포함할 저장소 (기능이 늘어나면 여기에 추가)
export const BACKUP_STORES = ['pets', 'posts'];

let dbPromise;
function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore('pets', { keyPath: 'id' });
      db.createObjectStore('posts', { keyPath: 'id' });
      db.createObjectStore('meta', { keyPath: 'key' });
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

// 반려동물과 그 기록을 한 번에 삭제
export async function removePetWithPosts(petId) {
  const db = await open();
  const tx = db.transaction(['pets', 'posts'], 'readwrite');
  tx.objectStore('pets').delete(petId);
  const posts = tx.objectStore('posts');
  const cur = posts.openCursor();
  cur.onsuccess = () => {
    const c = cur.result;
    if (!c) return;
    if (c.value.petId === petId) c.delete();
    c.continue();
  };
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
