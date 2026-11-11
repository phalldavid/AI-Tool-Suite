import { dismiss, pause, resume, useToasts } from "../toasts";
import { Icon } from "./Icon";

export function Toasts() {
  const list = useToasts();
  return (
    <div className="toasts" role="status" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`} onMouseEnter={() => pause(t.id)} onMouseLeave={() => resume(t.id)} onFocus={() => pause(t.id)} onBlur={() => resume(t.id)}>
          <span className="dot" />
          <span className="msg">{t.text}</span>
          {t.action ? (
            <button
              type="button"
              onClick={() => {
                t.action!.run();
                dismiss(t.id);
              }}
            >
              {t.action.label}
            </button>
          ) : null}
          <button type="button" className="x" aria-label="Dismiss" onClick={() => dismiss(t.id)}>
            <Icon name="close" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
