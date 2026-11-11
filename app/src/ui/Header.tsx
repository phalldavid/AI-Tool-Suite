import { getState, setState, useApp } from "../store";
import type { Tab } from "../store";
import { backendStatus } from "../lib/status";
import { isLight, setPrefs, usePrefs } from "../prefs";
import { Icon } from "./Icon";

const TABS: { id: Tab; label: string }[] = [
  { id: "render", label: "Render" },
  { id: "result", label: "Result" },
  { id: "history", label: "History" },
];

export function Header() {
  const tab = useApp((s) => s.tab);
  const settings = useApp((s) => s.settings);
  const check = useApp((s) => s.keyCheck);
  const credits = useApp((s) => s.kieCredits);
  const customise = useApp((s) => s.customiseOpen);
  const hasResult = useApp((s) => s.versions.length > 0);
  const prefs = usePrefs();
  const light = isLight(prefs);
  const st = backendStatus(settings, check);
  const navTab = tab === "sun" ? "render" : tab === "camera" ? "result" : tab;
  return (
    <header className="topbar glass">
      <div className="left">
        <div className="logo" aria-hidden="true">
          <span>D</span>
        </div>
        <div className="brand display">David Render Studio</div>
        <nav className="nav" aria-label="Main">
          {TABS.filter((t) => t.id !== "result" || hasResult).map((t) => (
            <button key={t.id} type="button" aria-current={navTab === t.id ? "page" : undefined} onClick={() => setState({ tab: t.id })}>
              {t.label}
            </button>
          ))}
        </nav>
      </div>
      <button type="button" className="search" aria-label="Search, Ctrl K" title="Search · Ctrl K" onClick={() => setState({ dialog: "palette" })}>
        <Icon name="search" />
        <span className="t" style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          Search 932 styles, light, places, actions
        </span>
        <span className="kbd t">Ctrl K</span>
      </button>
      <div className="right">
        <button type="button" className={`status ${st.tone}`} title={st.detail} aria-label={`${st.label}. ${st.detail} Open Settings.`} onClick={() => setState({ dialog: "settings" })}>
          <span className={`dot${st.tone === "ok" ? " pulse" : ""}`} />
          <span className="t num">
            {st.label}
            {settings.backend === "kie" && credits !== null && st.tone === "ok" ? ` · ${Math.floor(credits)} cr` : ""}
          </span>
        </button>
        <button type="button" className="icon-btn theme" aria-label={light ? "Switch to night mode" : "Switch to day mode"} title={light ? "Night mode" : "Day mode"} onClick={() => setPrefs({ theme: light ? "dark" : "light" })}>
          <Icon name={light ? "moon" : "sun"} size={18} style={{ transition: "transform 400ms", transform: light ? "rotate(-20deg)" : "none" }} />
        </button>
        <button type="button" className="pill-btn" aria-expanded={customise} onClick={() => setState({ customiseOpen: !getState().customiseOpen })}>
          <Icon name="palette" size={18} />
          <span className="t">Customise</span>
        </button>
        <button type="button" className="icon-btn" aria-label="Settings" title="Settings" onClick={() => setState({ dialog: "settings" })}>
          <Icon name="settings" size={18} />
        </button>
      </div>
    </header>
  );
}

/** Stays until the problem is fixed (audit H-01, M-08). */
export function KeyBanner() {
  const settings = useApp((s) => s.settings);
  const check = useApp((s) => s.keyCheck);
  const st = backendStatus(settings, check);
  if (st.tone !== "bad") return null;
  return (
    <div className="banner" role="alert">
      <Icon name="warn" size={18} style={{ color: "var(--bad)" }} />
      <div className="grow">
        <b>{st.label}</b>
        <small>{st.detail}</small>
      </div>
      <button type="button" className="btn danger" onClick={() => setState({ dialog: "settings" })}>
        {st.label === "Key rejected" ? "Fix key" : "Open Settings"}
      </button>
      <button
        type="button"
        className="btn ghost"
        onClick={() => {
          const s = getState().settings;
          void import("../actions").then((a) => a.updateSettings({ backend: "browser", browserSite: s.browserSite || "gemini" }));
        }}
      >
        Use free Gemini
      </button>
    </div>
  );
}
