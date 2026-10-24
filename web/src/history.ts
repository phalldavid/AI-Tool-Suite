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

/** Saves the user's verdict on one render (usable or not). */
export async function rateHistory(id: string, rating: 1 | -1 | undefined): Promise<void> {
  try {
    const item = await withStore<HistoryItem | undefined>("readonly", (s) => s.get(id) as IDBRequest<HistoryItem | undefined>);
    if (item) await withStore("readwrite", (s) => s.put({ ...item, rating }));
  } catch {
    memory = memory.map((m) => (m.id === id ? { ...m, rating } : m));
  }
}

/** Usable / not usable counts per preset and model, best first. */
export function ratingSummary(items: HistoryItem[]): { preset: string; model: string; good: number; bad: number }[] {
  const rows = new Map<string, { preset: string; model: string; good: number; bad: number }>();
  for (const it of items) {
    if (!it.rating || it.tool !== "render") continue;
    const k = `${it.presetName ?? "Custom"}|${it.model}`;
    const r = rows.get(k) ?? { preset: it.presetName ?? "Custom", model: it.model, good: 0, bad: 0 };
    if (it.rating > 0) r.good++;
    else r.bad++;
    rows.set(k, r);
  }
  return [...rows.values()].sort((a, b) => b.good - b.bad - (a.good - a.bad) || b.good - a.good);
}
