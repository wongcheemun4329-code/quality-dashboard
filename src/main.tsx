import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AccessProvider } from "./context/AccessContext";
import "./index.css";
import { LanguageProvider } from "./i18n";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <LanguageProvider><AccessProvider><App /></AccessProvider></LanguageProvider>
  </React.StrictMode>
);
