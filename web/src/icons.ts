// Line icons, 24 x 24, drawn with currentColor.

const P: Record<string, string> = {
  render: '<path d="M12 3l1.8 4.6L18.5 9l-4.7 1.4L12 15l-1.8-4.6L5.5 9l4.7-1.4z"/><path d="M18.5 15l.8 2 2 .8-2 .7-.8 2-.7-2-2-.7 2-.8z"/>',
  edit: '<path d="M4 20c2.5 0 4-1.2 4-3.4 0-1.2-.9-2.1-2-2.1S4 15.4 4 16.6V20z"/><path d="M8.3 14.6L18.8 4.1a1.6 1.6 0 0 1 2.3 2.3L10.6 16.9"/>',
  lights: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.3 1 2.2h5.2c0-.9.4-1.7 1-2.2A6 6 0 0 0 12 3z"/>',
  mirror: '<rect x="6" y="2.5" width="12" height="19" rx="6"/><path d="M9.5 8.5c.6-1.6 1.7-2.5 3.2-2.8M9.5 12.5l4-4"/>',
  history: '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3.5 4.5v4h4"/><path d="M12 7.5V12l3 2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  capture: '<path d="M3 8V5.5A2.5 2.5 0 0 1 5.5 3H8M16 3h2.5A2.5 2.5 0 0 1 21 5.5V8M21 16v2.5a2.5 2.5 0 0 1-2.5 2.5H16M8 21H5.5A2.5 2.5 0 0 1 3 18.5V16"/><path d="M7.5 16V10.5L12 7.5l4.5 3V16z"/>',
  upload: '<path d="M12 15V4M7.5 8.5L12 4l4.5 4.5"/><path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15"/>',
  save: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5"/><path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15"/>',
  folder: '<path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h4l2 2h8a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M3 3l18 18M10.6 6.1A9.6 9.6 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-3 3.6M6.4 7.1C3.9 8.8 2.5 12 2.5 12S6 18.5 12 18.5c1.6 0 3-.4 4.2-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  trash: '<path d="M4.5 7h15M10 11v6M14 11v6M6 7l1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.3-4.6L4 8.5M4 4v4.5h4.5"/><path d="M4 13a8 8 0 0 0 14.3 4.6l1.7-2.1M20 20v-4.5h-4.5"/>',
  exterior: '<path d="M3 21h18M5 21V10l7-5 7 5v11"/><path d="M9.5 21v-5h5v5M9 11.5h2M13 11.5h2"/>',
  interior: '<path d="M4 18v-5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v5M4 18h16M6 18v2M18 18v2"/><path d="M6 11V8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v3"/>',
  aerial: '<path d="M9 4L3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5z"/><path d="M9 4v13.5M15 6.5V20"/>',
  sketch: '<path d="M14.5 4.5l5 5L9 20H4v-5z"/><path d="M12.5 6.5l5 5"/>',
  wand: '<path d="M4 20L15 9M13 7l4 4"/><path d="M17 3v3M15.5 4.5h3M20 9v2M19 10h2"/>',
  spot: '<path d="M8.5 3h7l-1 3h-5z"/><path d="M9.5 6L5 20h14L14.5 6"/>',
  led: '<path d="M3 8h18"/><path d="M5 8c0 4 2 8 7 10 5-2 7-6 7-10" opacity=".5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  arrowDown: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  arrowUp: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  arrowLeft: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  palette: '<path d="M12 3a9 9 0 0 0 0 18c1.1 0 1.8-.8 1.8-1.7 0-.5-.2-.8-.5-1.2-.3-.3-.5-.7-.5-1.2 0-1 .8-1.7 1.8-1.7H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10.5" cy="7" r="1.2"/><circle cx="15" cy="7.5" r="1.2"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  plant: '<path d="M12 21v-9"/><path d="M12 12c0-4 3-7 7.5-7 0 4.5-3 7-7.5 7zM12 14.5C12 11 9.5 8.5 5 8.5c0 3.6 2.5 6 7 6z"/>',
  swap: '<path d="M7 4v13M3.5 13.5L7 17l3.5-3.5M17 20V7M13.5 10.5L17 7l3.5 3.5"/>',
  brush: '<path d="M4 20c2.5 0 4-1.2 4-3.4 0-1.2-.9-2.1-2-2.1S4 15.4 4 16.6V20z"/><path d="M8.3 14.6L18.8 4.1a1.6 1.6 0 0 1 2.3 2.3L10.6 16.9"/>',
  rect: '<rect x="4" y="5" width="16" height="14" rx="1" stroke-dasharray="3 2.5"/>',
  lasso: '<path d="M7 17.5C4.3 16.3 3 14.5 3 12.5 3 8.4 7 5 12 5s9 3.4 9 7.5-4 7.5-9 7.5c-1 0-2-.1-3-.4"/><path d="M8 17c0 1.7-1 3-2.5 3.5"/>',
  eraser: '<path d="M8.5 20H20M4.6 15.1l8.9-8.9a2 2 0 0 1 2.8 0l2.5 2.5a2 2 0 0 1 0 2.8L12 18.4a2 2 0 0 1-1.4.6H8.3a2 2 0 0 1-1.4-.6l-2.3-2.3a1 1 0 0 1 0-1z"/><path d="M9 10.7l5.3 5.3"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.3 1 2.2h5.2c0-.9.4-1.7 1-2.2A6 6 0 0 0 12 3z"/>',
  bulbOff: '<path d="M9 18h6M10 21h4M3 3l18 18"/><path d="M7.1 7.2A6 6 0 0 0 8.4 13.8c.6.5 1 1.3 1 2.2h5.2M16.9 12.6A6 6 0 0 0 9.3 3.6"/>',
  downlight: '<path d="M3 5h18"/><path d="M8.5 5v2.5h7V5"/><path d="M9.5 7.5L6 19M14.5 7.5L18 19" opacity=".55"/><path d="M6 19h12" opacity=".55"/>',
  strip: '<path d="M3 7h18"/><path d="M5 7.5c0 3 3 5.5 7 6 4-.5 7-3 7-6" opacity=".55"/><circle cx="6" cy="7" r=".9"/><circle cx="10" cy="7" r=".9"/><circle cx="14" cy="7" r=".9"/><circle cx="18" cy="7" r=".9"/>',
  cabinet: '<rect x="3.5" y="3.5" width="17" height="8" rx="1"/><path d="M12 3.5v8M6 15.5h12" /><path d="M6.5 12l-1.5 6M17.5 12l1.5 6" opacity=".55"/>',
  wallLight: '<path d="M4 4v16"/><path d="M4 9h4l3 3-3 3H4"/><path d="M12.5 9.5l4-2M13 12h5M12.5 14.5l4 2" opacity=".55"/>',
  monitor: '<rect x="3" y="4" width="18" height="12.5" rx="1.8"/><path d="M8.5 20.5h7M12 16.5v4"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l8.5-8.5M16 7l2.5 2.5M14 9l2 2"/>',
};

export function iconSvg(name: string, size = 18): string {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] ?? ""}</svg>`;
}

export function icon(name: string, size = 18): HTMLElement {
  const span = document.createElement("span");
  span.className = "icon";
  span.innerHTML = iconSvg(name, size);
  return span;
}

/** The app mark: a sun over a roof line. */
export function logo(size = 26): HTMLElement {
  const span = document.createElement("span");
  span.className = "logo";
  span.innerHTML = `<svg viewBox="0 0 32 32" width="${size}" height="${size}" aria-hidden="true"><rect width="32" height="32" rx="8" fill="var(--accent)"/><circle cx="16" cy="13" r="4.2" fill="var(--accent-ink)"/><path d="M6 24.5L16 17l10 7.5" fill="none" stroke="var(--accent-ink)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  return span;
}
