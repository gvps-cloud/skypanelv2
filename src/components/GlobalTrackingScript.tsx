import { useEffect } from "react";

const TRACKING_SCRIPT_ID = "gvps-global-tracking-script";
const TRACKING_SCRIPT_SRC = import.meta.env.VITE_TRACKING_SCRIPT_URL?.trim();

export default function GlobalTrackingScript() {
  useEffect(() => {
    if (!TRACKING_SCRIPT_SRC) {
      return;
    }

    const existingScript = document.getElementById(
      TRACKING_SCRIPT_ID,
    ) as HTMLScriptElement | null;

    if (existingScript?.src === TRACKING_SCRIPT_SRC) {
      return;
    }

    if (existingScript) {
      existingScript.remove();
    }

    const script = document.createElement("script");
    script.id = TRACKING_SCRIPT_ID;
    script.src = TRACKING_SCRIPT_SRC;
    script.defer = true;
    script.dataset.siteId = "1";
    script.dataset.debounce = "5000";
    script.dataset.trackErrors = "true";
    script.dataset.sessionReplay = "true";

    document.head.appendChild(script);
  }, []);

  return null;
}
