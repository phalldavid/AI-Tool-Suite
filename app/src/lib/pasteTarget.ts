// Which picture slot the mouse is over on the Edit tab, so Ctrl V pastes there.

export type PasteSlot = "base" | "ref" | "shot";

let current: PasteSlot | null = null;
const listeners = new Set<() => void>();

export function hoverSlot(t: PasteSlot | null): void {
  if (current === t) return;
  current = t;
  for (const l of listeners) l();
}

export function hoveredSlot(): PasteSlot | null {
  return current;
}

export function onHoverSlot(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
