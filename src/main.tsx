import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initializeFirebase, isFirebaseConfigured } from "./services/firebase";

// Initialize Firebase if configured
if (isFirebaseConfigured()) {
  initializeFirebase();
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
