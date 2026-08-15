import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { initCapacitor } from "@/lib/capacitor-bridge";
import { initWebPushServiceWorker } from "@/lib/web-push";

setAuthTokenGetter(() => { try { return localStorage.getItem("fnashha_token"); } catch { return null; } });

initCapacitor();

createRoot(document.getElementById("root")!).render(<App />);

// Registers the merged PWA cache + Firebase Web Push service worker and sets
// up foreground message delivery. Safe no-op on native builds / unsupported
// browsers. Notification *permission* is requested separately, only when
// appropriate — see <WebPushRegistrar/>.
window.addEventListener("load", () => {
  initWebPushServiceWorker().catch((err) => {
    console.warn("[WebPush] initWebPushServiceWorker unhandled rejection:", err);
  });
});
