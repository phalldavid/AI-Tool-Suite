// Khmer / English switch with flags, next to the Night/Day button.

import { setPrefs, usePrefs } from "../prefs";

export function FlagKH({ size = 18 }: { size?: number }) {
  return (
    <svg width={size * 1.5} height={size} viewBox="0 0 30 20" aria-hidden="true" className="flag">
      <rect width="30" height="20" fill="#032ea1" />
      <rect y="5" width="30" height="10" fill="#e00025" />
      <path fill="#fff" d="M8 14.2h14v.8H8zM9 13.2h12v1H9zM10.5 10h9v3.2h-9zM12.4 7.6l.6-1.6.6 1.6v2.4h-1.2zM14.3 7l.7-2.2.7 2.2v3h-1.4zM16.4 7.6l.6-1.6.6 1.6v2.4h-1.2zM10.6 8.6l.5-1.2.5 1.2V10h-1zM18.4 8.6l.5-1.2.5 1.2V10h-1z" />
    </svg>
  );
}

export function FlagGB({ size = 18 }: { size?: number }) {
  return (
    <svg width={size * 1.5} height={size} viewBox="0 0 60 40" aria-hidden="true" className="flag">
      <clipPath id="gbc">
        <rect width="60" height="40" />
      </clipPath>
      <g clipPath="url(#gbc)">
        <rect width="60" height="40" fill="#012169" />
        <path d="M0 0l60 40M60 0L0 40" stroke="#fff" strokeWidth="8" />
        <path d="M0 0l60 40M60 0L0 40" stroke="#c8102e" strokeWidth="3" />
        <path d="M30 0v40M0 20h60" stroke="#fff" strokeWidth="12" />
        <path d="M30 0v40M0 20h60" stroke="#c8102e" strokeWidth="7" />
      </g>
    </svg>
  );
}

export function LangSwitch() {
  const p = usePrefs();
  return (
    <div className="seg-mini langsw" role="radiogroup" aria-label="Language" data-no-translate>
      <button type="button" role="radio" aria-checked={p.lang === "km"} title="ភាសាខ្មែរ" onClick={() => setPrefs({ lang: "km" })}>
        <FlagKH size={12} /> <span className="lbl-md">ខ្មែរ</span>
      </button>
      <button type="button" role="radio" aria-checked={p.lang === "en"} title="English" onClick={() => setPrefs({ lang: "en" })}>
        <FlagGB size={12} /> <span className="lbl-md">EN</span>
      </button>
    </div>
  );
}
