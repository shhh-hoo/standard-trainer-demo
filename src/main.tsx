import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import ComponentInspector from "./ComponentInspector";
import "./styles.css";

const showComponentInspector =
  new URLSearchParams(window.location.search).get("view") === "inspector";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {showComponentInspector ? <ComponentInspector /> : <App />}
  </StrictMode>,
);
