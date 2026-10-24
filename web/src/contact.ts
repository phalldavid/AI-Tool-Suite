// Contact and bug report. Both go to the maker's Telegram; the bug report is
// copied to the clipboard first so it can be pasted into the chat.

export const CONTACT_URL = "https://t.me/phalldavid";
export const CONTACT_LABEL = "t.me/phalldavid";
/** Keep in step with VERSION in plugin/ai_render_suite.rb. */
export const APP_VERSION = "0.1.0";

export interface ReportLine {
  at: number;
  kind: string;
  text: string;
  detail?: string;
}

export interface ReportInput {
  host: string;
  backend: string;
  model: string;
  userAgent: string;
  log: ReportLine[];
  /** saved API keys, removed from the text if they ever appear in it */
  secrets: string[];
}

/** Plain-text report: version, setup and the last log lines, with keys taken out. */
export function bugReport(r: ReportInput, maxLines = 15): string {
  const lines = r.log
    .slice(0, maxLines)
    .map((e) => `${new Date(e.at).toISOString().slice(11, 19)} [${e.kind}] ${e.text}${e.detail ? `\n    ${e.detail}` : ""}`);
  let text = [
    "Bug report, David Render Studio",
    `Version: ${APP_VERSION} (${r.host})`,
    `AI service: ${r.backend}${r.model ? `, ${r.model}` : ""}`,
    `Browser: ${r.userAgent}`,
    "",
    "What happened (please describe):",
    "",
    "",
    "Recent log:",
    ...(lines.length ? lines : ["(empty)"]),
  ].join("\n");
  for (const s of r.secrets) if (s.trim().length >= 6) text = text.split(s.trim()).join("[key removed]");
  // Anything else shaped like a key or bearer token.
  return text.replace(/\b(Bearer\s+)?(sk|AIza|key)[-_A-Za-z0-9]{16,}/g, "[key removed]");
}
