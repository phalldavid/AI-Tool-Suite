import { createRoot } from "react-dom/client";
import { App } from "./App";
import { getState, initStore } from "./store";
import { checkKey, init, updateSettings } from "./actions";
import { applyPrefs, getPrefs, watchPrefs } from "./prefs";
import { startTranslating } from "./lib/i18n";
import { initSlidingPills } from "./ui/slide";
import { initGuard } from "./ui/guard";

applyPrefs();
watchPrefs();
initGuard();
// Closing or reloading mid-render would lose the result (Kie keeps the job, but this page wouldn't get it).
window.addEventListener("beforeunload", (e) => {
  try {
    if (!getState()?.busy) return;
  } catch {
    return;
  }
  e.preventDefault();
  e.returnValue = "";
});

void (async () => {
  const state = await init();
  // New here with no key: start on the free copy-paste path.
  if (!state.settings.onboarded && !state.settings.kieKey && !state.settings.geminiKey) {
    state.settings = { ...state.settings, backend: "browser", onboarded: true };
  }
  initStore(state);
  createRoot(document.getElementById("root")!).render(<App />);
  initSlidingPills();
  startTranslating(getPrefs().lang);
  void updateSettings({});
  void checkKey();
})();
