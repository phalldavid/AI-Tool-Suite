// First start: pick a language, then a short tour with a spotlight on each part.
// Skip any time; "Don't show this again" (on by default) stops it next time.
// Settings and Ctrl K can start it again.

import { useEffect, useLayoutEffect, useState } from "react";
import { getState, setState, useApp } from "../store";
import { updateSettings } from "../actions";
import { KIE_KEY_PAGE } from "../core/providers/kie";
import { setPrefs, usePrefs } from "../prefs";
import { t } from "../lib/i18n";
import { FlagGB, FlagKH } from "./LangSwitch";
import { Icon } from "./Icon";

const KEY = "drs2.tour";
/** A YouTube search for sign-up videos; swap in your own video link here. */
export const KIE_VIDEO = "https://www.youtube.com/results?search_query=kie.ai+how+to+get+api+key";

export function tourDone(): boolean {
  try {
    return localStorage.getItem(KEY) === "done";
  } catch {
    return false;
  }
}

export function startTour(withLanguage = false): void {
  setState({ tab: "render", dialog: null, langPick: withLanguage, tourStep: withLanguage ? null : 0 });
}

interface Step {
  target?: string;
  title: { en: string; km: string };
  body: { en: string; km: string };
  kind?: "choice" | "kie";
}

const STEPS: Step[] = [
  {
    title: { en: "Welcome to David Render Studio", km: "សូមស្វាគមន៍មកកាន់ David Render Studio" },
    body: { en: "Turn a SketchUp view, CAD screenshot or iPad sketch into a photo-real render. Your design stays exactly as modelled. This takes one minute.", km: "ប្ដូររូបពី SketchUp, CAD ឬគំនូរព្រាង iPad ឲ្យទៅជារូបដូចពិត។ ការរចនារបស់អ្នកនៅដដែល។ ការណែនាំនេះប្រើពេលតែមួយនាទី។" },
  },
  {
    target: "stage",
    title: { en: "1 · Add your view", km: "១ · បញ្ចូលទិដ្ឋភាពរបស់អ្នក" },
    body: { en: "Press Ctrl V anywhere to paste a screenshot, drop a file here, or upload one. In SketchUp you can capture the current view.", km: "ចុច Ctrl V ដើម្បីបិទភ្ជាប់រូប ទម្លាក់ឯកសារនៅទីនេះ ឬផ្ទុកឡើង។ ក្នុង SketchUp អ្នកអាចថតទិដ្ឋភាពបច្ចុប្បន្ន។" },
  },
  {
    target: "look",
    title: { en: "2 · Pick a look", km: "២ · ជ្រើសរចនាបថ" },
    body: { en: "Choose a style. Browse all opens 900+ looks by building or room. Star the ones you use most.", km: "ជ្រើសរចនាបថ។ «មើលទាំងអស់» បើករចនាបថជាង ៩០០ តាមប្រភេទអគារ ឬបន្ទប់។ ដាក់ផ្កាយលើអ្វីដែលអ្នកប្រើញឹកញាប់។" },
  },
  {
    target: "light",
    title: { en: "3 · Set the light", km: "៣ · កំណត់ពន្លឺ" },
    body: { en: "Drag the sun along the arch for the time of day. Switch Interior or Exterior, and pick the light fittings and their colour.", km: "អូសព្រះអាទិត្យតាមធ្នូដើម្បីកំណត់ម៉ោង។ ប្ដូរ ខាងក្នុង ឬ ខាងក្រៅ ហើយជ្រើសភ្លើង និងពណ៌របស់វា។" },
  },
  {
    target: "env",
    title: { en: "4 · Choose the surroundings", km: "៤ · ជ្រើសទីតាំងជុំវិញ" },
    body: { en: "A Phnom Penh street, a borey, rice fields, the river… or keep them as modelled.", km: "ផ្លូវភ្នំពេញ បុរី វាលស្រែ មាត់ទន្លេ… ឬទុកដូចក្នុងម៉ូដែល។" },
  },
  {
    target: "model",
    kind: "choice",
    title: { en: "5 · How do you want to render?", km: "៥ · តើអ្នកចង់រេនឌ័រដោយរបៀបណា?" },
    body: { en: "Pick an AI model here. With a Kie.ai key the app renders for you (a few cents each). Or just copy the prompt and render free in Gemini or ChatGPT with your own account.", km: "ជ្រើសម៉ូដែល AI នៅទីនេះ។ ជាមួយសោ Kie.ai កម្មវិធីរេនឌ័រឲ្យអ្នក (ប៉ុន្មានសេនក្នុងមួយរូប)។ ឬគ្រាន់តែចម្លង Prompt ហើយរេនឌ័រឥតគិតថ្លៃក្នុង Gemini ឬ ChatGPT។" },
  },
  {
    target: "settings",
    kind: "kie",
    title: { en: "6 · Get your Kie.ai key", km: "៦ · យកសោ Kie.ai" },
    body: { en: "Sign up at kie.ai, add credit, then copy your key from the API Keys page. Open Settings (this gear) and paste it into “Kie.ai API key”.", km: "ចុះឈ្មោះនៅ kie.ai បញ្ចូលទឹកប្រាក់ ហើយចម្លងសោពីទំព័រ API Keys។ បើកការកំណត់ (ប៊ូតុងនេះ) ហើយបិទភ្ជាប់ក្នុង «សោ API Kie.ai»។" },
  },
  {
    target: "tab-edit",
    title: { en: "7 · Edit any render", km: "៧ · កែរូបរេនឌ័រណាមួយ" },
    body: { en: "Spot edit an area (add LED, change a material), relight it, make more views with the same look, or copy the style of a reference photo.", km: "កែតំបន់មួយ (បន្ថែម LED ប្ដូរសម្ភារៈ) ប្ដូរពន្លឺ បង្កើតទិដ្ឋភាពថ្មីដោយរចនាបថដដែល ឬចម្លងរចនាបថពីរូបគំរូ។" },
  },
  {
    target: "search",
    title: { en: "Find anything with Ctrl K", km: "ស្វែងរកអ្វីៗដោយ Ctrl K" },
    body: { en: "Search styles, light, places and actions. You can replay this tour from Settings any time.", km: "ស្វែងរករចនាបថ ពន្លឺ ទីកន្លែង និងសកម្មភាព។ អ្នកអាចមើលការណែនាំនេះម្ដងទៀតពីការកំណត់។" },
  },
];

export function useFirstStart(): void {
  useEffect(() => {
    if (!tourDone()) startTour(true);
  }, []);
}

function finish(never: boolean): void {
  try {
    if (never) localStorage.setItem(KEY, "done");
    else localStorage.removeItem(KEY);
  } catch {
    /* this visit only */
  }
  setState({ tourStep: null, langPick: false });
}

export function Tour() {
  const pick = useApp((s) => s.langPick);
  const step = useApp((s) => s.tourStep);
  const p = usePrefs();
  const [never, setNever] = useState(true);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const s = step === null ? null : STEPS[step];

  useLayoutEffect(() => {
    if (!s?.target) return setRect(null);
    const phone = window.innerWidth < 700;
    // The first visible match (a phone and a desktop copy can both exist); things tucked away
    // on phones (language, Customise) point at Settings instead.
    const shown = (x: HTMLElement) => x.getClientRects().length > 0 && x.getBoundingClientRect().width > 0;
    const el = [...document.querySelectorAll<HTMLElement>(`[data-tour="${s.target}"]`)].find(shown) ?? (phone ? [...document.querySelectorAll<HTMLElement>('[data-tour="settings"]')].find(shown) : undefined);
    if (!el) return setRect(null);
    if (phone) {
      // Keep the target in the top part of the screen, above the tour panel.
      const r = el.getBoundingClientRect();
      if (r.bottom > window.innerHeight * 0.5 || r.top < 0) window.scrollBy({ top: r.top - window.innerHeight * 0.18, behavior: "auto" });
    } else el.scrollIntoView({ block: "nearest", behavior: "auto" });
    const measure = () => setRect(el.getBoundingClientRect());
    measure();
    const id = window.setTimeout(measure, 120);
    window.addEventListener("resize", measure);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("resize", measure);
    };
  }, [s]);

  useEffect(() => {
    if (step === null && !pick) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pick) finish(never);
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [step, pick, never]);

  if (pick) {
    const choose = (lang: "en" | "km") => {
      setPrefs({ lang });
      setState({ langPick: false, tourStep: 0 });
    };
    return (
      <div className="tour-veil center" role="dialog" aria-modal="true" aria-label="Choose your language" data-no-translate>
        <div className="langpick rise">
          <h2>ជ្រើសរើសភាសា · Choose your language</h2>
          <div className="langpick-row">
            <button type="button" className="langcard lift" onClick={() => choose("km")}>
              <FlagKH size={40} />
              <b>ភាសាខ្មែរ</b>
              <small>Khmer</small>
            </button>
            <button type="button" className="langcard lift" onClick={() => choose("en")}>
              <FlagGB size={40} />
              <b>English</b>
              <small>អង់គ្លេស</small>
            </button>
          </div>
          <small style={{ color: "var(--muted)" }}>{window.innerWidth < 700 ? "ប្ដូរបានពេលក្រោយនៅក្នុងការកំណត់ · You can switch any time in Settings" : "ប្ដូរបានពេលក្រោយនៅជាប់ប៊ូតុងថ្ងៃ/យប់ · You can switch any time next to the Day/Night button"}</small>
        </div>
      </div>
    );
  }
  if (!s || step === null) return null;
  const km = p.lang === "km";
  const L = (x: { en: string; km: string }) => (km ? x.km : x.en);
  const last = step === STEPS.length - 1;
  const next = () => (last ? finish(never) : setState({ tourStep: step + 1 }));
  const back = () => setState({ tourStep: Math.max(0, step - 1) });

  // Card next to the spotlight: to the left of things on the right, else below or above.
  const pad = 10;
  const W = 360;
  const phone = window.innerWidth < 700;
  let style: React.CSSProperties = { left: "max(16px, calc(50% - 180px))", top: "max(16px, calc(50% - 160px))" };
  if (phone) style = {};
  else if (rect) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (rect.left > vw / 2 && rect.left - W - 24 > 0) style = { left: rect.left - W - 24, top: Math.min(Math.max(16, rect.top), vh - 300) };
    else if (rect.bottom + 260 < vh) style = { left: Math.min(Math.max(16, rect.left), vw - W - 16), top: rect.bottom + 16 };
    else style = { left: Math.min(Math.max(16, rect.left), vw - W - 16), top: Math.max(16, rect.top - 280) };
  }
  return (
    <div className="tour-veil" role="dialog" aria-modal="true" aria-labelledby="tour-title" data-no-translate>
      {rect ? (
        <div className="tour-hole" style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }} />
      ) : (
        <div className="tour-dim" />
      )}
      <div className={`tour-card ${phone ? "m-sheet" : "rise"}`} style={phone ? undefined : { ...style, width: W }} key={step}>
        {phone ? <div className="sheet-grab" aria-hidden="true"><span /></div> : null}
        <div className="tour-top">
          <span className="num">{km ? `ជំហាន ${step + 1} នៃ ${STEPS.length}` : `Step ${step + 1} of ${STEPS.length}`}</span>
          <div className="tour-dots" aria-hidden="true">
            {STEPS.map((_, i) => <span key={i} className={i === step ? "on" : i < step ? "done" : ""} />)}
          </div>
        </div>
        <h3 id="tour-title">{L(s.title)}</h3>
        <p>{L(s.body)}</p>
        {s.kind === "choice" ? (
          <div className="tour-choice">
            <button type="button" className="btn primary" onClick={() => setState({ tourStep: step + 1 })}>
              <Icon name="aperture" /> {km ? "ខ្ញុំនឹងប្រើ Kie.ai" : "I'll render with Kie.ai"}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                void updateSettings({ backend: "browser", testMode: false });
                setState({ tourStep: step + 2 });
              }}
            >
              <Icon name="clipboard" /> {km ? "ខ្ញុំគ្រាន់តែចង់ចម្លង Prompt (ឥតគិតថ្លៃ)" : "I just want to copy prompts (free)"}
            </button>
          </div>
        ) : null}
        {s.kind === "kie" ? (
          <div className="tour-choice">
            <a className="btn" href={KIE_VIDEO} target="_blank" rel="noopener">
              <Icon name="external" /> {km ? "មើលវីដេអូចុះឈ្មោះ (YouTube)" : "Watch how to sign up (YouTube)"}
            </a>
            <a className="btn" href={KIE_KEY_PAGE} target="_blank" rel="noopener">
              <Icon name="external" /> {km ? "បើកទំព័រ API Keys នៅ kie.ai" : "Open the API Keys page on kie.ai"}
            </a>
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                finish(never);
                setState({ dialog: "settings" });
              }}
            >
              <Icon name="settings" /> {km ? "បញ្ចូលសោរបស់ខ្ញុំឥឡូវនេះ" : "Enter my key now"}
            </button>
          </div>
        ) : null}
        <div className="tour-foot">
          <label className="tour-never">
            <input type="checkbox" checked={never} onChange={(e) => setNever(e.target.checked)} style={{ accentColor: "var(--accent)" }} />
            {km ? "កុំបង្ហាញម្ដងទៀត" : "Don't show this again"}
          </label>
          <button type="button" className="btn ghost" onClick={() => finish(never)}>{km ? "រំលង" : "Skip"}</button>
          {step > 0 ? <button type="button" className="btn ghost" onClick={back}>{km ? "ថយក្រោយ" : "Back"}</button> : null}
          {s.kind === "choice" ? null : (
            <button type="button" className="btn primary" onClick={next} autoFocus>
              {last ? (km ? "ចាប់ផ្ដើម" : "Start") : km ? "បន្ទាប់" : "Next"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

void getState;
void t;
