// Render history kept in IndexedDB on this machine. Falls back to memory
// when storage is blocked (private windows, some embedded browsers).

import type { HistoryItem } from "./types";

const DB_NAME = "ai-render-suite";
const STORE = "history";
const MAX_ITEMS = 60;

let memory: HistoryItem[] = [];

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function listHistory(): Promise<HistoryItem[]> {
  try {
    const all = await withStore<HistoryItem[]>("readonly", (s) => s.getAll() as IDBRequest<HistoryItem[]>);
    return all.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [...memory].sort((a, b) => b.createdAt - a.createdAt);
  }
}

export async function addHistory(item: HistoryItem): Promise<void> {
  try {
    await withStore("readwrite", (s) => s.put(item));
    const all = await listHistory();
    for (const old of all.slice(MAX_ITEMS)) await removeHistory(old.id);
  } catch {
    memory = [item, ...memory].slice(0, MAX_ITEMS);
  }
}

export async function removeHistory(id: string): Promise<void> {
  try {
    await withStore("readwrite", (s) => s.delete(id));
  } catch {
    memory = memory.filter((m) => m.id !== id);
  }
}
