import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import ComponentInspector from "./ComponentInspector";
import "./styles.css";

const showLegacyProof =
  new URLSearchParams(window.location.search).get("view") === "legacy";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {showLegacyProof ? <App /> : <ComponentInspector />}
  </StrictMode>,
);
