import { useEffect } from "react";
import { getState, setState, useApp } from "./store";
import { importResult, openReview, useFile } from "./actions";
import { Header, KeyBanner } from "./ui/Header";
import { Customise } from "./ui/Customise";
import { SettingsSheet } from "./ui/SettingsSheet";
import { ReviewSheet } from "./ui/ReviewSheet";
import { HandoffSheet } from "./ui/HandoffSheet";
import { Palette } from "./ui/Palette";
import { Toasts } from "./ui/Toasts";
import { RenderScreen } from "./screens/Render";
import { EditScreen } from "./screens/Edit";
import { HistoryScreen } from "./screens/History";
import { SunScreen } from "./screens/Sun";
import { LibrarySheet } from "./ui/LibrarySheet";
import { EnvPicturesSheet } from "./ui/EnvPicturesSheet";
import { DynamicSheet } from "./ui/DynamicSheet";
import { Tour, useFirstStart } from "./ui/Tour";
import { usePrefs } from "./prefs";
import { setLanguage } from "./lib/i18n";

function typing(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  return Boolean(el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable));
}

export function App() {
  const tab = useApp((s) => s.tab);
  const lang = usePrefs().lang;
  useEffect(() => setLanguage(lang), [lang]);
  useFirstStart();
  const dragging = useApp((s) => s.dragging);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setState({ dialog: getState().dialog === "palette" ? null : "palette" });
        return;
      }
      if (e.key === "Escape" && getState().customiseOpen) {
        setState({ customiseOpen: false });
        return;
      }
      if (mod || e.altKey || typing(e.target) || getState().dialog || getState().review || getState().handoff || getState().libOpen || getState().dynOpen) return;
      const k = e.key.toLowerCase();
      // R opens Review: nothing is spent without the confirm step (audit M-04).
      if (k === "r" && getState().tab === "render") {
        e.preventDefault();
        void openReview();
      } else if (k === "1") setState({ tab: "render" });
      else if (k === "2") setState({ tab: "edit" });
      else if (k === "3") setState({ tab: "history" });
    };
    const onPaste = (e: ClipboardEvent) => {
      if (typing(e.target)) return;
      const f = [...(e.clipboardData?.files ?? [])].find((x) => x.type.startsWith("image/"));
      if (!f) return;
      e.preventDefault();
      if (getState().handoff) void importResult(f);
      else {
        if (getState().tab !== "render" && getState().tab !== "edit") setState({ tab: "render" });
        void useFile(f, "Pasted image");
      }
    };
    const onDragOver = (e: DragEvent) => {
      if ([...(e.dataTransfer?.types ?? [])].includes("Files")) e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      const f = [...(e.dataTransfer?.files ?? [])].find((x) => x.type.startsWith("image/"));
      if (!f) return;
      e.preventDefault();
      if (getState().handoff) void importResult(f);
      else void useFile(f);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("paste", onPaste);
    document.addEventListener("dragover", onDragOver);
    document.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("paste", onPaste);
      document.removeEventListener("dragover", onDragOver);
      document.removeEventListener("drop", onDrop);
    };
  }, []);

  return (
    <div className={`shell${dragging ? " dragging" : ""}`}>
      <div className="bg" aria-hidden="true">
        <div className="blob b1" />
        <div className="blob b2" />
        <div className="blob b3" />
      </div>
      <Header />
      <KeyBanner />
      {tab === "render" ? <RenderScreen /> : tab === "edit" ? <EditScreen /> : tab === "history" ? <HistoryScreen /> : <SunScreen />}
      <Customise />
      <SettingsSheet />
      <ReviewSheet />
      <HandoffSheet />
      <Palette />
      <LibrarySheet />
      <EnvPicturesSheet />
      <DynamicSheet />
      <Tour />
      <Toasts />
    </div>
  );
}
