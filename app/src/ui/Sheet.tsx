// Native <dialog>: focus trap, Esc, inert background, focus returns to the opener.

import { useEffect, useRef } from "react";
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
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      opener.current = document.activeElement;
      d.showModal();
    } else if (!open && d.open) {
      d.close();
      (opener.current as HTMLElement | null)?.focus?.();
    }
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={`sheet${small ? " small" : ""}${className ? ` ${className}` : ""}`}
      aria-labelledby={labelledBy}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {open ? (
        <>
          {title ? (
            <div className="sheet-head">
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
