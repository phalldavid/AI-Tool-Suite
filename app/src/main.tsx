import { createRoot } from "react-dom/client";
import { App } from "./App";
import { initStore } from "./store";
import { checkKey, init, updateSettings } from "./actions";
import { applyPrefs, watchPrefs } from "./prefs";
import { initSlidingPills } from "./ui/slide";

applyPrefs();
watchPrefs();

void (async () => {
  const state = await init();
  // New here with no key: start on the free copy-paste path.
  if (!state.settings.onboarded && !state.settings.kieKey && !state.settings.geminiKey) {
    state.settings = { ...state.settings, backend: "browser", onboarded: true };
  }
  initStore(state);
  createRoot(document.getElementById("root")!).render(<App />);
  initSlidingPills();
  void updateSettings({});
  void checkKey();
})();
