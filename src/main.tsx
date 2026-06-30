import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "leaflet/dist/leaflet.css";
import "./index.css";

// #region agent log
fetch("http://127.0.0.1:7578/ingest/50506bb6-019f-48cf-b599-974a082e015e", {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "264723" },
  body: JSON.stringify({
    sessionId: "264723",
    runId: "fix-main",
    hypothesisId: "A",
    location: "main.tsx:boot",
    message: "main.tsx executing",
    data: {
      baseUrl: import.meta.env.BASE_URL,
      href: typeof location !== "undefined" ? location.href : null,
      rootExists: !!document.getElementById("root"),
    },
    timestamp: Date.now(),
  }),
}).catch(() => {});
// #endregion

createRoot(document.getElementById("root")!).render(<App />);
