// One small store for the whole app. Components read slices with useApp().

import { useSyncExternalStore } from "react";
import type { Capture, HistoryItem, ImageData64, Preset } from "./core/types";
import type { Settings } from "./core/settings";
import { DEFAULT_SETTINGS } from "./core/settings";
import type { Host } from "./core/host";
import type { KeyCheck } from "./lib/status";
import type { CameraMove } from "./lib/camera";
import type { LintResult } from "./lib/lint";

export type Tab = "render" | "edit" | "history" | "sun";

export type EditMode = "compare" | "spot" | "relight" | "view" | "style";

export interface SunState {
  mode: "time" | "free" | "sketchup";
  /** Light direction relative to the camera, 0..359 (Free mode). */
  toCamera: number;
  elevation: number;
  /** Where north sits on the ring, 0..359, set once per view. */
  north: number;
  dayOfYear: number;
  /** Use the ring's exact direction in the prompt (else the dial's time words). */
  exact: boolean;
}

/** What a render was made with, for the summary on the Edit tab. */
export interface VersionMeta {
  scene?: string;
  look?: string;
  light?: string;
  environment?: string;
  model?: string;
  at: number;
}

export interface Version {
  image: ImageData64;
  label: string;
  prompt: string;
  historyId?: string;
  /** "view" = a new angle (shown in the Views row), else a version of the same angle. */
  kind?: "version" | "view";
  meta?: VersionMeta;
  /** What "Before" shows for this version, when it differs from the main before image. */
  before?: ImageData64;
}

export interface Shot {
  image: ImageData64;
  name: string;
}

export interface Busy {
  label: string;
  since: number;
  typical: number;
}

export interface ReviewState {
  prompt: string;
  lint: LintResult;
  images: ImageData64[];
  aspectRatio: string;
  kind: "render" | "edit" | "view" | "shots" | "style";
  /** "shots": one image set per screenshot, all with the same prompt. */
  batch?: ImageData64[][];
}

export interface AppState {
  host: Host;
  settings: Settings;
  ready: boolean;
  tab: Tab;
  capture: Capture | null;
  captureName: string;
  preset: Preset;
  /** Building-type words removed from the preset this time, shown in Review. */
  frameId: string;
  portrait: boolean;
  /** Sun dial clock time, 5.5..19.5 */
  hour: number;
  /** Lighting card picked; "time" = the dial drives it. */
  lighting: string;
  sun: SunState;
  camera: CameraMove;
  notes: string;
  /** Additional Notes chips picked. */
  noteChips: string[];
  glassColour: string;
  advancedOpen: boolean;
  /** Full-screen pickers: the look library, the environment list, a dynamic prompt form. */
  libOpen: null | "look" | "env" | "env-pics" | "look-pics";
  dynOpen: string | null;
  editMode: EditMode;
  viewSource: "camera" | "shot";
  shots: Shot[];
  /** Version the new view copies its look from. */
  lookIndex: number;
  /** Interior or exterior lighting; null follows the Scene chips. */
  lightScene: "interior" | "exterior" | null;
  /** Style Copy: the reference photo, and where its light comes from. */
  styleRef: Shot | null;
  styleLight: "reference" | "dial";
  /** First start: language choice, then the tour step (null = no tour). */
  langPick: boolean;
  tourStep: number | null;
  /** Light fittings, one set for interior and one for exterior lighting. */
  fittings: Record<"interior" | "exterior", import("./lib/fittings").FittingState>;
  keyCheck: KeyCheck;
  kieCredits: number | null;
  busy: Busy | null;
  before: ImageData64 | null;
  versions: Version[];
  activeVersion: number;
  history: HistoryItem[];
  review: ReviewState | null;
  handoff: {
    prompt: string;
    images: ImageData64[];
    before: ImageData64 | null;
    /** "edit": a spot edit or relight; the pasted result becomes a new version of the image being edited. */
    kind?: "render" | "edit";
    /** names for the images, e.g. "Painted image" */
    names?: string[];
  } | null;
  dialog: null | "settings" | "palette" | "confirm-cost" | "import";
  customiseOpen: boolean;
  dragging: boolean;
  /** Bumped whenever a spot-edit selection changes. */
  paintRev: number;
}

type Listener = () => void;
let state: AppState;
const listeners = new Set<Listener>();

export function initStore(initial: AppState): void {
  state = initial;
}

export function getState(): AppState {
  return state;
}

export function setState(patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)): void {
  const next = typeof patch === "function" ? patch(state) : patch;
  state = { ...state, ...next };
  for (const l of listeners) l();
}

export function subscribe(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useApp<T>(select: (s: AppState) => T): T {
  return useSyncExternalStore(subscribe, () => select(state), () => select(state));
}

export const EMPTY_SETTINGS = DEFAULT_SETTINGS;
