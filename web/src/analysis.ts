// Image analysis with a text-only vision model: Material DNA (one material
// tag per surface or object) and Analyse people (where people can go and
// what they do). The answer is plain text the user edits before it goes into
// the render prompt. Uses the same Kie.ai key as rendering (a Gemini flash
// chat model), or the Gemini API key when that is the backend.

import type { ImageData64, ProjectType } from "./types";
import { fetchTransport, KieProvider, type KieTransport } from "./providers/kie";
import { ProviderError } from "./providers/types";

export interface DnaTag {
  id: string;
  /** "Object: material", e.g. "Countertop: black Nero Marquina marble" */
  text: string;
  on: boolean;
}

// Kie's Gemini Flash chat routes, newest first. Kie retires old versions
// (3.5 is gone), so the next one is tried when a route fails. Checked on
// docs.kie.ai 2026-10-24.
export const KIE_VISION_URLS = [
  "https://api.kie.ai/gemini-3-8-flash-openai/v1/chat/completions",
  "https://api.kie.ai/gemini-3-6-flash-openai/v1/chat/completions",
  "https://api.kie.ai/gemini-3-7-flash-openai/v1/chat/completions",
];
export const KIE_VISION_URL = KIE_VISION_URLS[0];

// Google's own Flash models for a Gemini API key, newest first.
export const GEMINI_TEXT_MODELS = ["gemini-3.8-flash", "gemini-flash-latest", "gemini-2.5-flash"];

export type Analyser = (prompt: string, image: ImageData64) => Promise<string>;

type ChatReply = { code?: number; msg?: string; choices?: { message?: { content?: unknown } }[] };

function chatText(res: ChatReply): string {
  const content = res.choices?.[0]?.message?.content;
  return typeof content === "string" ? content : Array.isArray(content) ? content.map((c) => (c as { text?: string }).text ?? "").join("") : "";
}

/** Key or credit problems: trying another route will not help. */
const fatal = (code: number) => code === 401 || code === 402 || code === 403;

export function kieAnalyser(key: string, transport: KieTransport = fetchTransport): Analyser {
  return async (prompt, image) => {
    if (!key) throw new ProviderError("Analysis uses your Kie.ai key. Add it in Settings.");
    const uploader = new KieProvider(key, "nano-banana-2-1", "1K", transport);
    // A hosted link first (what Kie documents); the image itself inline as a
    // last try, in case Kie's model cannot fetch the link.
    const links: string[] = [];
    try {
      links.push(await uploader.upload(image, 0));
    } catch (e) {
      if (e instanceof ProviderError && typeof e.status === "number" && fatal(e.status)) throw e;
    }
    links.push(`data:${image.mimeType};base64,${image.data}`);
    let last = "";
    for (const link of links) {
      for (const url of KIE_VISION_URLS) {
        let status = 0;
        let res: ChatReply = {};
        try {
          const r = await transport.json("POST", url, key, {
            messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: link } }] }],
            stream: false,
          });
          status = r.status;
          res = (r.body ?? {}) as ChatReply;
        } catch (e) {
          last = (e as Error).message;
          continue;
        }
        const code = typeof res.code === "number" ? res.code : status;
        if (status < 400 && (code === 200 || res.code === undefined)) {
          const text = chatText(res);
          if (text.trim()) return text;
          last = "the answer came back empty";
          continue;
        }
        if (fatal(code)) throw new ProviderError(code === 401 ? "Kie.ai rejected the API key. Check it in Settings." : code === 402 ? "Not enough Kie credits for analysis. Top up at kie.ai." : `Kie.ai refused the analysis: ${res.msg ?? code}`, code);
        last = `${res.msg ?? "error"} (${code}, ${url.split("/")[3]})`;
      }
    }
    throw new ProviderError(`Kie.ai could not analyse the image. Kie said: ${last}. A free Gemini key in Settings is another way to run analysis.`);
  };
}

export function geminiAnalyser(key: string, models = GEMINI_TEXT_MODELS): Analyser {
  return async (prompt, image) => {
    if (!key) throw new ProviderError("Analysis needs your Gemini API key in Settings.");
    let last = "";
    for (const model of models) {
      let res: Response;
      try {
        res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }, { inlineData: { mimeType: image.mimeType, data: image.data } }] }] }),
        });
      } catch {
        throw new ProviderError("Could not reach Google. Check the internet connection.");
      }
      const json = (await res.json().catch(() => ({}))) as { candidates?: { content?: { parts?: { text?: string }[] } }[]; error?: { message?: string } };
      // A retired model name: try the next one.
      if (res.status === 404) {
        last = json.error?.message ?? `${model} not found`;
        continue;
      }
      if (res.status === 429) throw new ProviderError("Your Gemini key hit Google's limit for now (free keys have a daily allowance). Try later, or analyse with Kie.ai.", 429);
      if (!res.ok) throw new ProviderError(`Gemini could not analyse the image${json.error?.message ? `: ${json.error.message}` : "."}`, res.status);
      const text = (json.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
      if (!text.trim()) throw new ProviderError("The analysis came back empty. Try again.");
      return text;
    }
    throw new ProviderError(`Gemini could not analyse the image: ${last}`);
  };
}

// ---------- Material DNA ----------

export function dnaPrompt(type: ProjectType): string {
  const what = type === "interior" ? "interior" : type === "aerial" ? "site seen from above" : "building and its surroundings";
  return [
    `Look at this ${what} (a SketchUp model or a photo) and list its materials for a photorealistic render.`,
    "Answer with TAG lines only, one per line, in the form: Object or surface: material, colour and finish.",
    "One line for each surface and each key object, never grouped together: floor, walls, ceiling, roof, facade, windows and frames, doors, railings, countertops, cabinetry, furniture, fabrics, metals, lighting fixtures, planting, paving.",
    "Name real materials a builder in Cambodia could buy (for example porcelain tiles, terrazzo, laterite, teak, white render, aluminium frames).",
    "Colour-coded flat surfaces in the model stand for materials: guess the most likely real one.",
    "No introduction, no numbering, no notes. Example lines:",
    "Floor: large-format light grey porcelain tiles, matt",
    "Countertop: black Nero Marquina marble, polished",
    "Window frames: dark grey powder-coated aluminium",
  ].join("\n");
}

let tagSeq = 0;
const tagId = () => `t${Date.now().toString(36)}${(tagSeq++).toString(36)}`;

/** Turns the model's answer into tags; skips headings, numbering and empty lines. */
export function parseDna(text: string): DnaTag[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").replace(/^TAG:\s*/i, "").replace(/\*\*/g, "").trim())
    .filter((l) => /^[^:]{2,60}:\s*\S/.test(l))
    .map((text) => ({ id: tagId(), text, on: true }));
}

export function newTag(text = ""): DnaTag {
  return { id: tagId(), text, on: true };
}

export const DNA_GROUPS: { id: string; label: string; match: RegExp }[] = [
  { id: "structure", label: "Walls, roof and facade", match: /wall|facade|façade|roof|ceiling|column|beam|slab|cladding|render|louver|louvre|soffit|parapet|structure/i },
  { id: "floors", label: "Floors and paving", match: /floor|paving|deck|driveway|path|terrace|step|stair|tile(?!.*wall)|ground/i },
  { id: "openings", label: "Windows, doors and glass", match: /window|door|glass|glazing|frame|grille|shutter|railing|balustrade|screen/i },
  { id: "joinery", label: "Joinery and furniture", match: /cabinet|vanity|counter|shelf|wardrobe|table|chair|sofa|bed|desk|joinery|furniture|bench|stool|island/i },
  { id: "fabrics", label: "Fabrics", match: /curtain|fabric|rug|carpet|cushion|upholster|linen|blind/i },
  { id: "metals", label: "Fixtures and metals", match: /tap|faucet|handle|metal|steel|brass|chrome|fixture|sink|basin|toilet|shower|mirror/i },
  { id: "lighting", label: "Lighting", match: /light|lamp|pendant|sconce|downlight|led|chandelier/i },
  { id: "planting", label: "Planting and outdoors", match: /plant|tree|palm|lawn|garden|hedge|pool|water|sky|landscape/i },
];

/** Group for one tag, judged by the object name before the colon. */
export function dnaGroup(text: string): string {
  const name = text.split(":")[0];
  for (const g of [DNA_GROUPS[6], DNA_GROUPS[2], DNA_GROUPS[3], DNA_GROUPS[5], DNA_GROUPS[4], DNA_GROUPS[7], DNA_GROUPS[1], DNA_GROUPS[0]]) {
    if (g.match.test(name)) return g.id;
  }
  return "other";
}

const STOP = new Set(["the", "and", "with", "this", "that", "into", "make", "turn", "from", "more", "less", "real", "realistic", "material", "colour", "color", "like", "look"]);

/**
 * Tags whose object or material shares a word with the user's notes, so the
 * panel can say the notes will win. Returns tag texts.
 */
export function dnaConflicts(notes: string, tags: string[]): string[] {
  const words = new Set(
    notes
      .toLowerCase()
      .split(/[^a-zក-៿]+/)
      .filter((w) => w.length > 3 && !STOP.has(w)),
  );
  if (!words.size) return [];
  return tags.filter((t) =>
    t
      .toLowerCase()
      .split(/[^a-z]+/)
      .some((w) => words.has(w) || (w.length > 4 && words.has(w.replace(/s$/, "")))),
  );
}

// ---------- Analyse people ----------

export interface PeopleOptions {
  scene: string;
  count: string;
  who: string;
}

export const PEOPLE_SCENES = [
  { id: "private", label: "Private", text: "a private space (bedroom, bathroom, spa)" },
  { id: "domestic", label: "Home", text: "a domestic space (living room, kitchen, home office)" },
  { id: "semi", label: "Semi-public", text: "a semi-public space (corridor, restaurant, gym, office)" },
  { id: "public", label: "Public", text: "a public or commercial space (lobby, mall, plaza, street, park)" },
  { id: "hall", label: "Large hall", text: "a large hall or stadium" },
];

export const PEOPLE_COUNTS = [
  { id: "1", label: "1", text: "exactly one person" },
  { id: "2", label: "2", text: "exactly two people" },
  { id: "few", label: "3–5", text: "three to five people spread across foreground, middle ground and background" },
  { id: "busy", label: "Busy", text: "a busy scene with more than five people" },
];

export const PEOPLE_WHO = [
  { id: "everyday", label: "Everyday adults", text: "everyday Cambodian adults in casual clothes, not models" },
  { id: "families", label: "Families", text: "Cambodian families with children" },
  { id: "students", label: "Students", text: "students and young people" },
  { id: "business", label: "Professionals", text: "business professionals" },
  { id: "seniors", label: "Seniors", text: "older people" },
  { id: "lifestyle", label: "Lifestyle", text: "well-dressed lifestyle models" },
];

export function peoplePrompt(o: PeopleOptions): string {
  const scene = PEOPLE_SCENES.find((x) => x.id === o.scene)?.text ?? o.scene;
  const count = PEOPLE_COUNTS.find((x) => x.id === o.count)?.text ?? o.count;
  const who = PEOPLE_WHO.find((x) => x.id === o.who)?.text ?? o.who;
  return [
    `Look at this image of ${scene}. Plan ${count}: ${who}.`,
    "Write the people part of an image prompt, one short sentence per person or group: who they are, their pose, exactly where they stand or sit (name the real spot you can see, like 'by the kitchen island' or 'on the front steps'), and what they are doing.",
    "Only use places where a person could really be: on floors, seats and paths, never inside furniture, walls or water features. Respect real scale and the room size; do not crowd small rooms.",
    "People are Southeast Asian unless the scene says otherwise. Natural candid poses, nobody looking at the camera.",
    "Answer with the sentences only, no heading, no list numbers.",
  ].join("\n");
}

export const PEOPLE_CLOSER =
  "Match the camera perspective, light direction, exposure, scale and depth of field for every person, with soft contact shadows; natural faces and hands. Keep the architecture unchanged.";

export function cleanPeople(text: string): string {
  const body = text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").replace(/\*\*/g, "").trim())
    .filter(Boolean)
    .join(" ");
  return `${body} ${PEOPLE_CLOSER}`.trim();
}
