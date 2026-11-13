import { flushSync } from "react-dom";
import { getState, setState, useApp } from "../store";
import type { Tab } from "../store";
import { backendStatus } from "../lib/status";
import { isLight, toggleTheme, usePrefs } from "../prefs";
import { Icon } from "./Icon";
import { LOGO_SVG } from "./logo";
import { LangSwitch } from "./LangSwitch";
import { useViewport } from "../layout";

const BEHANCE = "https://www.behance.net/phalldavid";

/** Day/Night: the icon morphs and the new theme grows out of the button. */
function ThemeButton({ className }: { className: string }) {
  const light = isLight(usePrefs());
  return (
    <button
      type="button"
      className={className}
      aria-label={light ? "Switch to night mode" : "Switch to day mode"}
      title={light ? "Night mode" : "Day mode"}
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        e.currentTarget.classList.remove("pop");
        void e.currentTarget.offsetWidth;
        e.currentTarget.classList.add("pop");
        toggleTheme({ x: r.left + r.width / 2, y: r.top + r.height / 2 }, flushSync);
      }}
    >
      <span className="theme-ic" data-light={light} aria-hidden="true">
        <Icon name="sun" size={18} className="ti-sun" />
        <Icon name="moon" size={18} className="ti-moon" />
      </span>
    </button>
  );
}

/** Settings gear: a short spin, then the sheet opens. */
export function openSettingsWithSpin(btn: HTMLElement | null): void {
  if (!btn) return setState({ dialog: "settings" });
  btn.classList.remove("gear-spin");
  void btn.offsetWidth;
  btn.classList.add("gear-spin");
  window.setTimeout(() => setState({ dialog: "settings" }), 240);
}

/**
 * Phones, Instagram-style: Day/Night on the left, the title in the middle (opens Behance),
 * Settings on the right. Under it Render / Edit / History and Search. Language and
 * Customise live inside Settings on phones.
 */
function PhoneHeader() {
  const tab = useApp((s) => s.tab);
  const navTab = tab === "sun" ? "render" : tab;
  return (
    <header className="topbar m-top">
      <div className="m-row">
        <ThemeButton className="m-ic m-theme" />
        <a className="m-title display" href={BEHANCE} target="_blank" rel="noopener" title="David's portfolio on Behance">
          David Render Studio
        </a>
        <button type="button" className="m-ic gear" data-tour="settings" aria-label="Settings" title="Settings" onClick={(e) => openSettingsWithSpin(e.currentTarget)}>
          <Icon name="settings" size={21} />
        </button>
      </div>
      <div className="m-row2">
        <nav className="tabs3 m-nav" aria-label="Main">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="radio" data-tour={`tab-${t.id}`} aria-checked={navTab === t.id} aria-current={navTab === t.id ? "page" : undefined} onClick={() => setState({ tab: t.id })}>
              {t.label}
            </button>
          ))}
        </nav>
        <button type="button" className="m-ic m-search" data-tour="search" aria-label="Search" title="Search" onClick={() => setState({ dialog: "palette" })}>
          <Icon name="search" size={18} />
        </button>
      </div>
    </header>
  );
}

const TABS: { id: Tab; label: string }[] = [
  { id: "render", label: "Render" },
  { id: "edit", label: "Edit" },
  { id: "history", label: "History" },
];

export function Header() {
  const vp = useViewport();
  return vp.phone ? <PhoneHeader /> : <DesktopHeader />;
}

function DesktopHeader() {
  const tab = useApp((s) => s.tab);
  const settings = useApp((s) => s.settings);
  const check = useApp((s) => s.keyCheck);
  const credits = useApp((s) => s.kieCredits);
  const customise = useApp((s) => s.customiseOpen);
  const prefs = usePrefs();
  const light = isLight(prefs);
  const st = backendStatus(settings, check);
  const navTab = tab === "sun" ? "render" : tab;
  return (
    <header className="topbar glass">
      <div className="left">
        <a className="logo" href={BEHANCE} target="_blank" rel="noopener" title="David's portfolio on Behance" aria-label="David's portfolio on Behance" dangerouslySetInnerHTML={{ __html: LOGO_SVG }} />
        <div className="brand display">David Render Studio</div>
        <nav className="nav" aria-label="Main">
          {TABS.map((t) => (
            <button key={t.id} type="button" data-tour={`tab-${t.id}`} aria-current={navTab === t.id ? "page" : undefined} onClick={() => setState({ tab: t.id })}>
              {t.label}
            </button>
          ))}
        </nav>
      </div>
      <button type="button" className="search" data-tour="search" aria-label="Search, Ctrl K" title="Search · Ctrl K" onClick={() => setState({ dialog: "palette" })}>
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
        <LangSwitch />
        <ThemeButton className="icon-btn theme" />
        <button type="button" className="pill-btn" aria-expanded={customise} onClick={() => setState({ customiseOpen: !getState().customiseOpen })}>
          <Icon name="palette" size={18} />
          <span className="t">Customise</span>
        </button>
        <button type="button" className="icon-btn gear" data-tour="settings" aria-label="Settings" title="Settings" onClick={(e) => openSettingsWithSpin(e.currentTarget)}>
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
