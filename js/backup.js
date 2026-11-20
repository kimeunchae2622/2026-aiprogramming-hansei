// 백업 파일 만들기 / 읽기. 사진도 파일 안에 함께 담는다.
import { getAll, setMeta, BACKUP_STORES } from './db.js';
import { blobToDataURL, dataURLToBlob } from './util.js';

const APP_ID = 'pet-memories';
const FORMAT = 1;

async function serializeRow(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = v instanceof Blob ? { __blob: await blobToDataURL(v) } : v;
  }
  return out;
}

async function reviveRow(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (v && typeof v === 'object' && typeof v.__blob === 'string') {
      if (!v.__blob.startsWith('data:image/')) throw new Error('bad-file');
      out[k] = await dataURLToBlob(v.__blob);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function backupFileName(now = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  return `추억저장소_백업_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}.json`;
}

export async function createBackupFile() {
  const data = { app: APP_ID, format: FORMAT, exportedAt: Date.now() };
  for (const name of BACKUP_STORES) {
    data[name] = await Promise.all((await getAll(name)).map(serializeRow));
  }
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  return { blob, name: backupFileName(), counts: { pets: data.pets.length, posts: data.posts.length } };
}

export async function downloadBackup() {
  const { blob, name, counts } = await createBackupFile();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  await setMeta('lastBackup', Date.now());
  return { name, counts };
}

// 백업 파일을 읽어 검사한다. 문제가 있으면 Error('bad-file') 를 던진다.
export async function parseBackup(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('bad-file'); }
  if (!data || data.app !== APP_ID || data.format !== FORMAT) throw new Error('bad-file');
  if (!Array.isArray(data.pets) || !Array.isArray(data.posts)) throw new Error('bad-file');
  const petIds = new Set();
  const pets = [];
  for (const p of data.pets) {
    if (!p || typeof p.id !== 'string' || typeof p.name !== 'string') throw new Error('bad-file');
    petIds.add(p.id);
    pets.push(await reviveRow(p));
  }
  const posts = [];
  for (const p of data.posts) {
    if (!p || typeof p.id !== 'string' || typeof p.petId !== 'string' ||
        typeof p.createdAt !== 'number' || typeof (p.text ?? '') !== 'string') throw new Error('bad-file');
    if (!petIds.has(p.petId)) continue; // 주인 없는 기록은 건너뜀
    posts.push(await reviveRow(p));
  }
  return { pets, posts };
}
