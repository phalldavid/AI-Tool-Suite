// Additional Notes: one-tap prompt lines, plus the user's own saved ones.

export interface NotePreset {
  id: string;
  label: string;
  /** Sentence added to the prompt. "{colour}" is replaced by the picked colour. */
  text: string;
  custom?: boolean;
}

export const GLASS_COLOURS = ["red", "blue", "green", "yellow", "orange", "purple", "cyan", "magenta", "white", "black"];

export const BUILT_IN_NOTES: NotePreset[] = [
  { id: "glass", label: "Change {colour} to glass", text: "Turn the {colour} solid-colour surfaces into clear glass with natural reflections." },
  { id: "plates", label: "Cambodian plates", text: "Any vehicles carry realistic Cambodian number plates." },
  { id: "mist", label: "Ground mist", text: "Add a thin, low ground mist close to the ground, like an early humid morning." },
  { id: "led", label: "Orange to LED", text: "Turn the orange and yellow solid colors into glowing warm-white 3300K LED strips." },
  { id: "water", label: "Blue to water", text: "Turn the blue solid-colour surfaces into calm, clear water with soft reflections." },
  { id: "trees", label: "Add trees", text: "Add mature shade trees suited to Cambodia, placed naturally around the building." },
  { id: "shrubs", label: "Add shrubs", text: "Add layered tropical shrubs and flowering plants along the edges and beds." },
  { id: "ground", label: "Add ground cover", text: "Cover the bare ground with lawn and low tropical ground-cover planting." },
  { id: "clean", label: "Clean site", text: "Show a clean, finished site: no construction debris, no scaffolding, no stray materials." },
];

const KEY = "drs2.notes";

export function loadCustomNotes(): NotePreset[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]") as NotePreset[];
    return Array.isArray(raw) ? raw.filter((x) => x && typeof x.id === "string" && typeof x.text === "string").map((x) => ({ ...x, custom: true })) : [];
  } catch {
    return [];
  }
}

export function saveCustomNotes(list: NotePreset[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.map(({ id, label, text }) => ({ id, label, text }))));
  } catch {
    /* not saved */
  }
}

/** A short label from a sentence: first few words. */
export function labelFor(text: string): string {
  const words = text.trim().replace(/[.!]+$/, "").split(/\s+/).slice(0, 4).join(" ");
  return words.length > 28 ? `${words.slice(0, 27)}…` : words;
}

/** The prompt sentences for the picked notes, in the order shown. */
export function noteLines(picked: string[], all: NotePreset[], colour: string): string[] {
  return all.filter((n) => picked.includes(n.id)).map((n) => n.text.split("{colour}").join(colour));
}
