// One place for how the app feels. Every press, switch, success, warning, error and
// render start/finish goes through here, so haptics, sound and the on-button cue always
// agree with each other. Nothing in here may throw: feel is polish, never a reason to fail.
//
// Rules the rest of the app follows (see docs/feedback-system.md):
// - A press gives a light haptic only. Sound is kept for things that change state, so it
//   never gets tiring.
// - toast() calls notify(), so every toast already feels right. Do not add feel() next to a toast.
// - An action that runs for a while can wrap its promise in withFeel(el, promise).

import { useSyncExternalStore } from "react";
import { reducedMotion } from "../prefs";

export type Feel = "tap" | "toggle" | "success" | "warn" | "error" | "start" | "done";

/** Vibration, in ms. Short and soft: a tick, not a buzz. */
export const HAPTIC: Record<Feel, number | number[]> = {
  tap: 6,
  toggle: 8,
  success: [8, 40, 12],
  warn: [14, 50, 14],
  error: [18, 40, 18, 40, 26],
  start: 10,
  done: [8, 50, 14],
};

/** One soft tone: a start and end pitch (Hz), length (s) and loudness. Pure sine waves, low volume. */
export interface Tone {
  from: number;
  to?: number;
  at: number;
  len: number;
  gain: number;
}

/** Sound for each feel. `tap` is silent on purpose. */
export const SOUND: Record<Feel, Tone[]> = {
  tap: [],
  toggle: [{ from: 1040, to: 1240, at: 0, len: 0.05, gain: 0.02 }],
  success: [
    { from: 880, at: 0, len: 0.11, gain: 0.03 },
    { from: 1318, at: 0.08, len: 0.17, gain: 0.03 },
  ],
  warn: [{ from: 560, to: 500, at: 0, len: 0.16, gain: 0.03 }],
  error: [
    { from: 220, to: 196, at: 0, len: 0.14, gain: 0.04 },
    { from: 175, to: 147, at: 0.12, len: 0.2, gain: 0.04 },
  ],
  start: [{ from: 620, to: 840, at: 0, len: 0.14, gain: 0.025 }],
  done: [
    { from: 784, at: 0, len: 0.1, gain: 0.03 },
    { from: 1046, at: 0.08, len: 0.1, gain: 0.03 },
    { from: 1318, at: 0.16, len: 0.24, gain: 0.03 },
  ],
};

// ---------- settings (this device only) ----------

export interface FeelPrefs {
  /** Off until the person turns it on: sound should never surprise. */
  sound: boolean;
  haptics: boolean;
}

const KEY = "drs2.feel";
const DEFAULTS: FeelPrefs = { sound: false, haptics: true };
const listeners = new Set<() => void>();

function read(): FeelPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const v = JSON.parse(raw) as Partial<FeelPrefs>;
    return { sound: v.sound === true, haptics: v.haptics !== false };
  } catch {
    return { ...DEFAULTS };
  }
}

let prefs: FeelPrefs = read();

export function getFeel(): FeelPrefs {
  return prefs;
}

export function setFeel(patch: Partial<FeelPrefs>): void {
  prefs = { ...prefs, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* lasts for this visit only */
  }
  for (const l of listeners) l();
}

export function useFeel(): FeelPrefs {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => prefs,
    () => prefs,
  );
}

// ---------- haptics and sound ----------

let ctx: AudioContext | null = null;
const lastAt = new Map<string, number>();

/** "success" and "done" mean the same thing to the ear, so they share a cooldown. */
const GROUP: Record<Feel, string> = { tap: "tap", toggle: "toggle", success: "good", done: "good", warn: "warn", error: "error", start: "start" };

function playTones(tones: Tone[]): void {
  if (!tones.length || typeof window === "undefined") return;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  ctx ??= new AC();
  if (ctx.state === "suspended") void ctx.resume();
  const t0 = ctx.currentTime + 0.01;
  for (const t of tones) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(t.from, t0 + t.at);
    if (t.to) osc.frequency.exponentialRampToValueAtTime(t.to, t0 + t.at + t.len);
    // A quick rise and a long fall, so there is never a click at either end.
    g.gain.setValueAtTime(0.0001, t0 + t.at);
    g.gain.exponentialRampToValueAtTime(t.gain, t0 + t.at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + t.at + t.len);
    osc.connect(g).connect(ctx.destination);
    osc.start(t0 + t.at);
    osc.stop(t0 + t.at + t.len + 0.02);
  }
}

/** Haptic and sound for one kind of moment. Safe to call anywhere, any number of times. */
export function feel(kind: Feel): void {
  try {
    const group = GROUP[kind];
    const now = Date.now();
    if (now - (lastAt.get(group) ?? 0) < 300 && kind !== "tap") return;
    lastAt.set(group, now);
    if (prefs.haptics && typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(HAPTIC[kind]);
    if (prefs.sound) playTones(SOUND[kind]);
  } catch {
    /* polish only */
  }
}

// ---------- the cue on the button itself ----------

export type Cue = "ok" | "error" | "busy" | "pop";
const CUE_MS: Record<Cue, number> = { ok: 760, error: 460, busy: 0, pop: 340 };
const cueTimers = new WeakMap<Element, number>();

/** Shows a cue on an element (CSS reacts to data-feel). `busy` stays until clearCue. */
export function cue(el: Element | null | undefined, kind: Cue): void {
  if (!el || !el.isConnected) return;
  const old = cueTimers.get(el);
  if (old) window.clearTimeout(old);
  // Re-trigger the animation if the same cue is shown twice in a row.
  el.removeAttribute("data-feel");
  void (el as HTMLElement).offsetWidth;
  el.setAttribute("data-feel", kind);
  if (kind === "busy") el.setAttribute("aria-busy", "true");
  else {
    el.removeAttribute("aria-busy");
    cueTimers.set(el, window.setTimeout(() => el.removeAttribute("data-feel"), CUE_MS[kind]));
  }
}

export function clearCue(el: Element | null | undefined): void {
  if (!el) return;
  const old = cueTimers.get(el);
  if (old) window.clearTimeout(old);
  el.removeAttribute("data-feel");
  el.removeAttribute("aria-busy");
}

/**
 * For an action that takes a moment: the button breathes while it runs, then ticks or
 * shakes. The promise's own result is passed through; errors are re-thrown.
 */
export async function withFeel<T>(el: Element | null | undefined, work: Promise<T>): Promise<T> {
  cue(el, "busy");
  try {
    const out = await work;
    cue(el, "ok");
    return out;
  } catch (e) {
    cue(el, "error");
    throw e;
  }
}

// ---------- toasts and presses: every button feels right without being edited ----------

let lastPress: { el: Element; at: number } | null = null;
const PRESS_WINDOW_MS = 1800;

/**
 * withFeel for code that has no button in hand (shared actions such as download or copy):
 * the button that was just pressed breathes while the work runs, then ticks or shakes.
 */
export function feelPressed<T>(work: Promise<T>): Promise<T> {
  const el = lastPress && Date.now() - lastPress.at < PRESS_WINDOW_MS ? lastPress.el : null;
  return el ? withFeel(el, work) : work;
}

/** The button, tab or option under a pointer event, if it can be pressed. */
function pressable(target: EventTarget | null): HTMLElement | null {
  const el = (target as Element | null)?.closest?.('button, [role="tab"], [role="radio"], [role="option"], a[href], label.switch, label.tour-never, label.fontopt') as HTMLElement | null;
  if (!el || (el as HTMLButtonElement).disabled || el.getAttribute("aria-disabled") === "true") return null;
  return el;
}

/**
 * Called by toast(). The toast says what happened; this makes it felt: a tick or a shake
 * on the button that was just pressed, plus the haptic and sound for that kind of moment.
 */
export function notify(kind: "info" | "ok" | "error" | "warn"): void {
  try {
    if (kind === "info") return;
    const f: Feel = kind === "ok" ? "success" : kind;
    feel(f);
    const p = lastPress;
    if (p && Date.now() - p.at < PRESS_WINDOW_MS && p.el.isConnected && p.el.getAttribute("data-feel") !== "busy") {
      cue(p.el, kind === "error" ? "error" : kind === "ok" ? "ok" : "pop");
    }
  } catch {
    /* polish only */
  }
}

let installed = false;

/** Listens once for presses and switches anywhere in the app. */
/** The disabled button under a pointer, if any. Disabled buttons swallow events, so find it by position. */
function disabledAt(x: number, y: number): HTMLElement | null {
  for (const b of document.querySelectorAll<HTMLElement>("button:disabled[data-why]")) {
    const r = b.getBoundingClientRect();
    if (r.width && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return b;
  }
  return null;
}

/**
 * onWhy shows the reason (the app passes a toast). Tapping a button that is switched off
 * shakes it and says why, using its data-why text.
 */
export function installFeel(onWhy?: (text: string) => void): void {
  if (installed || typeof document === "undefined") return;
  installed = true;
  document.addEventListener(
    "pointerdown",
    (e) => {
      const off = disabledAt(e.clientX, e.clientY);
      if (!off) return;
      cue(off, "error");
      const why = off.getAttribute("data-why");
      if (why && onWhy) onWhy(why);
    },
    { capture: true, passive: true },
  );
  document.addEventListener(
    "pointerdown",
    (e) => {
      const el = pressable(e.target);
      if (!el) return;
      lastPress = { el, at: Date.now() };
      feel("tap");
    },
    { capture: true, passive: true },
  );
  document.addEventListener(
    "click",
    (e) => {
      const el = pressable(e.target);
      if (!el) return;
      const stateful = el.hasAttribute("aria-pressed") || el.hasAttribute("aria-checked") || el.matches("label.switch, label.tour-never, label.fontopt") || (e.target as HTMLElement).matches?.('input[type="checkbox"]');
      if (!stateful) return;
      feel("toggle");
      if (!reducedMotion()) cue(el, "pop");
    },
    { capture: true, passive: true },
  );
}
