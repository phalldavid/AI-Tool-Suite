// Render progress. Image APIs don't say how far along a job is, so the bar
// is paced to how long this model usually takes on this machine: quick to
// about 30%, slower after that, and never past 90% until the image arrives.

const KEY = "airs.durations";

/** Typical seconds before any render has been timed here. */
function defaultMs(model: string): number {
  return /pro|gpt|seedream-5-0-pro/i.test(model) ? 45_000 : 25_000;
}

function load(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

/** How long a render on this model usually takes, in ms. */
export function typicalMs(model: string): number {
  const ms = load()[model];
  return Number.isFinite(ms) && ms > 0 ? ms : defaultMs(model);
}

/** Folds one finished render's time into the model's running average. */
export function rememberDuration(model: string, ms: number): void {
  if (!(ms > 1000 && ms < 15 * 60_000)) return;
  const all = load();
  const old = all[model];
  all[model] = Number.isFinite(old) && old > 0 ? Math.round(old * 0.7 + ms * 0.3) : Math.round(ms);
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* storage blocked: keep the default pace */
  }
}

/** Bar fill from 0 to 0.9 for a render running `elapsed` ms. */
export function progressAt(elapsed: number, typical: number): number {
  const t = Math.max(0, elapsed);
  const fast = 0.3 * (1 - Math.exp(-t / 700));
  const slow = 0.6 * (1 - Math.exp((-2.2 * t) / Math.max(1000, typical)));
  return Math.min(0.9, fast + slow);
}

/** True once a render has run twice as long as usual. */
export function runningLong(elapsed: number, typical: number): boolean {
  return elapsed > 2 * typical;
}
