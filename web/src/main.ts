import { captureFromHost, start } from "./app";

declare global {
  interface Window {
    AIRSApp?: { captureFromHost: () => Promise<void> };
  }
}

window.AIRSApp = { captureFromHost };

const el = document.getElementById("app");
if (el) {
  start(el).catch((e) => {
    el.textContent = `Could not start: ${(e as Error).message}`;
  });
}
