// Plain messages for the errors people actually hit, each with one fix.
// The original text still goes to the log.

export type FixAction = "retry" | "topup" | "settings" | null;

export interface Friendly {
  text: string;
  action: FixAction;
}

export const KIE_TOPUP_URL = "https://kie.ai/pricing";

const RULES: [RegExp, Friendly][] = [
  [/needs a kie\.ai key or a gemini/i, { text: "Add a Kie or Gemini key in Settings", action: "settings" }],
  [/insufficient|not enough credit|credits? (are )?(too low|exhausted|insufficient)|balance|\b402\b/i, { text: "Not enough Kie credits for this render", action: "topup" }],
  [/\b40[13]\b|invalid (api )?key|api key not valid|unauthori[sz]ed|permission denied|forbidden/i, { text: "Your API key wasn't accepted. Check it in Settings", action: "settings" }],
  [/\b429\b|rate.?limit|too many requests|quota|resource.?exhausted/i, { text: "Too many requests right now. Wait a minute, then try again", action: "retry" }],
  [/safety|blocked|content policy|moderation|nsfw|prohibited/i, { text: "The AI refused this image. Try other notes or another model", action: null }],
  [/timed? ?out|timeout|took too long/i, { text: "It took too long. Try again", action: "retry" }],
  [/failed to fetch|network|offline|ERR_INTERNET|ENOTFOUND|connection/i, { text: "No connection to the AI service. Check your internet, then try again", action: "retry" }],
  [/\b50[0234]\b|internal (server )?error|busy|overloaded|unavailable|try again later|server error/i, { text: "The AI service is busy. Try again in a minute", action: "retry" }],
];

/** A short message and fix for an error, or null when there is no better wording. */
export function friendlyError(message: string): Friendly | null {
  for (const [re, f] of RULES) if (re.test(message)) return f;
  return null;
}
