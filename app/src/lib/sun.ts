// Sun position for Phnom Penh, and the words the prompt uses for it.
// Angles relative to the camera: 0 = straight ahead (backlit), 90 = from the
// right, 180 = from behind the camera (front-lit), 270 = from the left.

export const PHNOM_PENH = { lat: 11.56, lon: 104.92, tz: 7 };

/** Sun height above the horizon and compass bearing (degrees from north), NOAA approximation. */
export function solar(dayOfYear: number, hour: number, place = PHNOM_PENH): { elevation: number; bearing: number } {
  const rad = Math.PI / 180;
  const g = ((2 * Math.PI) / 365) * (dayOfYear - 1 + (hour - 12) / 24);
  const decl =
    0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const eqt = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const tst = hour * 60 + eqt + 4 * place.lon - 60 * place.tz;
  const ha = (tst / 4 - 180) * rad;
  const la = place.lat * rad;
  const cz = Math.sin(la) * Math.sin(decl) + Math.cos(la) * Math.cos(decl) * Math.cos(ha);
  const elevation = 90 - Math.acos(Math.max(-1, Math.min(1, cz))) / rad;
  const az = Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(la) - Math.tan(decl) * Math.cos(la)) / rad + 180;
  return { elevation, bearing: (az + 360) % 360 };
}

export function dayOfYear(d: Date): number {
  const start = Date.UTC(d.getFullYear(), 0, 1);
  return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - start) / 86400000) + 1;
}

const norm = (a: number) => ((a % 360) + 360) % 360;

/** 0..7 sector, sticky by 5 degrees past each boundary so labels don't flicker. */
export function sector(angle: number, previous: number | null = null): number {
  const n = norm(angle);
  if (previous !== null) {
    let d = Math.abs(n - previous * 45) % 360;
    if (d > 180) d = 360 - d;
    if (d <= 27.5) return previous;
  }
  return Math.round(n / 45) % 8;
}

export const FROM_SHORT = ["Ahead · backlit", "Ahead-right", "Right", "Behind-right", "Behind you", "Behind-left", "Left", "Ahead-left"];
export const FALL_SHORT = ["Away", "Away-right", "Right", "Toward, right", "Toward you", "Toward, left", "Left", "Away-left"];
const FROM_LONG = [
  "straight ahead of the camera (backlit)",
  "ahead and to the right (backlit)",
  "the right side",
  "behind the camera, from the right",
  "directly behind the camera (front-lit)",
  "behind the camera, from the left",
  "the left side",
  "ahead and to the left (backlit)",
];
const FALL_LONG = [
  "away from the camera",
  "away and to the right",
  "to the right",
  "toward the camera, on the right",
  "toward the camera",
  "toward the camera, on the left",
  "to the left",
  "away and to the left",
];
const COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];

export function compass(bearing: number): string {
  return COMPASS[Math.round(norm(bearing) / 22.5) % 16];
}

export function heightWord(el: number): string {
  return el < 0 ? "below the horizon" : el < 10 ? "very low" : el < 25 ? "low" : el < 45 ? "mid-height" : el < 65 ? "high" : "almost overhead";
}

export interface SunDirection {
  /** Where the light comes from, relative to the camera, 0..359. */
  toCamera: number;
  elevation: number;
  /** Compass bearing, when north is known. */
  bearing?: number;
  /** Plain-words source, e.g. "11 Nov, 16:30, Phnom Penh". */
  when?: string;
}

/** The sentence the prompt gets: numbers and plain words together. */
export function sunPromptLine(s: SunDirection, sect = sector(s.toCamera)): string {
  const el = Math.round(s.elevation);
  const when = s.when ? ` (${s.when})` : "";
  if (el < 0) return `Night: the sun is below the horizon${when}. Warm 2700K artificial light only.`;
  const th = Math.round(norm(s.toCamera));
  const dev = th <= 180 ? th : 360 - th;
  const side = th === 0 || th === 180 ? "" : th < 180 ? "right" : "left";
  const devText = side ? `${dev}° to the ${side} of the camera’s line of sight` : "on the camera’s line of sight";
  const bearing = s.bearing === undefined ? "" : `, compass bearing ${Math.round(s.bearing)}° ${compass(s.bearing)}`;
  const length = el < 25 ? ", long" : el > 60 ? ", short" : "";
  return `Sun: light comes from ${FROM_LONG[sect]}, ${devText}, ${el}° above the horizon, ${heightWord(el)}${bearing}${when}. Shadows fall ${FALL_LONG[(sect + 4) % 8]}${length}.`;
}

/** Direction relative to the camera from a compass bearing and the view's north marker. */
export function toCamera(bearing: number, northOnRing: number): number {
  return norm(northOnRing + bearing);
}
