// Native <dialog>: focus trap, Esc, inert background, focus returns to the opener.

import { useEffect, useRef, useState } from "react";
import { reducedMotion } from "../prefs";
import type { ReactNode } from "react";
import { Icon } from "./Icon";

export function Sheet({ open, onClose, title, children, foot, small, className, labelledBy }: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  foot?: ReactNode;
  small?: boolean;
  className?: string;
  labelledBy?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<Element | null>(null);
  // Closing plays the same motion as opening, in reverse, before the dialog is really closed.
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open) {
      setLeaving(false);
      if (!d.open) {
        opener.current = document.activeElement;
        d.showModal();
      }
      return;
    }
    if (!d.open) return;
    const finish = () => {
      setLeaving(false);
      if (d.open) d.close();
      (opener.current as HTMLElement | null)?.focus?.();
    };
    if (reducedMotion()) return finish();
    setLeaving(true);
    const t = window.setTimeout(finish, 220);
    return () => window.clearTimeout(t);
  }, [open]);
  // Phones: drag the handle or the title bar down to close.
  const drag = useRef<{ y: number; dy: number } | null>(null);
  const grab = {
    onPointerDown: (e: React.PointerEvent) => {
      if (window.innerWidth >= 700 || (e.target as HTMLElement).closest("button")) return;
      drag.current = { y: e.clientY, dy: 0 };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: React.PointerEvent) => {
      const d = drag.current;
      if (!d || !ref.current) return;
      d.dy = Math.max(0, e.clientY - d.y);
      ref.current.style.transition = "none";
      ref.current.style.transform = `translateY(${d.dy}px)`;
    },
    onPointerUp: () => {
      const d = drag.current;
      drag.current = null;
      if (!d || !ref.current) return;
      ref.current.style.transition = "";
      ref.current.style.transform = "";
      if (d.dy > 90) onClose();
    },
  };
  return (
    <dialog
      ref={ref}
      className={`sheet${small ? " small" : ""}${className ? ` ${className}` : ""}`}
      aria-labelledby={labelledBy}
      data-leaving={leaving ? "" : undefined}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {open || leaving ? (
        <>
          <div className="sheet-grab" aria-hidden="true" {...grab}><span /></div>
          {title ? (
            <div className="sheet-head" {...grab}>
              <h2 id={labelledBy}>{title}</h2>
              <button type="button" className="icon-btn close" aria-label="Close" onClick={onClose}>
                <Icon name="close" />
              </button>
            </div>
          ) : null}
          {children}
          {foot ? <div className="sheet-foot">{foot}</div> : null}
        </>
      ) : null}
    </dialog>
  );
}
