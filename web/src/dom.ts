// Tiny DOM helpers so the interface needs no framework.

type Attrs = Record<string, string | number | boolean | EventListener | undefined>;
type Child = Node | string | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: (Child | Child[])[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k.startsWith("on") && typeof v === "function") {
      el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    } else if (k === "class") {
      el.className = String(v);
    } else if (k === "value" && "value" in el) {
      (el as HTMLInputElement).value = String(v);
    } else if (k === "checked" && "checked" in el) {
      (el as HTMLInputElement).checked = Boolean(v);
    } else if (v === true) {
      el.setAttribute(k, "");
    } else {
      el.setAttribute(k, String(v));
    }
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return el;
}

export function select(
  options: { value: string; label: string }[],
  value: string,
  onChange: (v: string) => void,
  attrs: Attrs = {},
): HTMLSelectElement {
  const el = h(
    "select",
    attrs,
    options.map((o) => h("option", { value: o.value, selected: o.value === value }, o.label)),
  );
  el.value = value;
  el.addEventListener("change", () => onChange(el.value));
  return el;
}

export function field(label: string, control: Node, hint?: string): HTMLElement {
  return h("label", { class: "field" }, h("span", { class: "field-label" }, label), control, hint ? h("small", {}, hint) : null);
}

export function clear(el: Element): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}
