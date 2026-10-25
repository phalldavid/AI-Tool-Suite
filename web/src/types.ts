// Shared types for the render suite.

/** An image held in memory as base64 (no data: prefix). */
export interface ImageData64 {
  mimeType: string;
  data: string;
  width?: number;
  height?: number;
}

/** Facts read from the SketchUp model, used to enrich the prompt. */
export interface SceneFacts {
  /** 35 mm-equivalent focal length, rounded. */
  focalLengthMm?: number;
  perspective?: boolean;
  /** Shadow time as ISO string, local to the model's location. */
  shadowTime?: string;
  northAngleDeg?: number;
  location?: string;
  modelName?: string;
  sceneName?: string;
  lights?: LightSummary;
}

/** AI light previews and mirrors placed in the model. */
export interface LightSummary {
  spots: number;
  leds: number;
  mirrors: number;
  kelvin: number[];
  visible: boolean;
}

/** What the SketchUp plugin (or an upload) hands to the interface. */
export interface Capture {
  view: ImageData64;
  /** Hidden-line pass, used to hold geometry. */
  lines?: ImageData64;
  /** View with transparent background; alpha marks the building. */
  mask?: ImageData64;
  facts?: SceneFacts;
  /** Render frame inside `view`, [x, y, w, h] px. The panel crops to it. */
  frame?: [number, number, number, number];
  source: "sketchup" | "upload";
}

export type ToolId = "render" | "lighting" | "spot-edit" | "style-match";

export type ProjectType = "exterior" | "interior" | "aerial" | "sketch";

export interface Preset {
  id: string;
  name: string;
  projectType: ProjectType;
  lighting: string;
  environment: string;
  /** Style and material description written by the user. */
  style: string;
  builtIn?: boolean;
}

export interface RenderRequest {
  prompt: string;
  /** Images in the order the prompt refers to them. */
  images: ImageData64[];
  aspectRatio?: string;
  /** Called once the backend has accepted the job, with its job id (Kie). */
  onJob?: (jobId: string) => void;
}

export interface RenderResult {
  image: ImageData64;
  /** Any text the model returned alongside the image. */
  note?: string;
}

export interface HistoryItem {
  id: string;
  createdAt: number;
  tool: ToolId;
  presetName?: string;
  prompt: string;
  before: ImageData64;
  after: ImageData64;
  provider: string;
  model: string;
  presetId?: string;
  /** The user's verdict: 1 usable, -1 not usable. */
  rating?: 1 | -1;
  /** Kie credits this image cost, when known. */
  credits?: number;
  /** Project (job) name the render belongs to. */
  project?: string;
  /** Set while a Kie job is still running; lets a render finish after a crash. */
  pending?: { jobId: string; model: string };
  /** What the render was made with, so the look can be made again. */
  setup?: RenderSetup;
  /** What the AI read in the image first (Auto render), as JSON text. */
  analysis?: string;
}

/** Style, notes and choices behind a render ("Use this setup" in History). */
export interface RenderSetup {
  preset: Preset;
  notes: string;
  people: string;
  dna: { id: string; text: string; on: boolean }[];
  /** "photo" or "cgi" */
  look: string;
  simple: boolean;
  dynamic: Record<string, unknown>;
  kieModel: string;
  kieResolution: string;
  frameId: string;
  /** The user's own wording of the prompt, when they edited it. */
  promptEdit: string | null;
  /** Style, mood and materials read from the reference photo. */
  borrowedLook?: string;
}
