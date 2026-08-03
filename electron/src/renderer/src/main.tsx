import React from "react";
import ReactDOM from "react-dom/client";
import { App, type AppConfiguration } from "./App";
import "./styles.css";

document.documentElement.dataset.platform = String(window.looper.platform);

const initialThemeSource = (() => {
  try {
    const storedTheme = window.localStorage.getItem("looper.theme");
    if (storedTheme === "dark" || storedTheme === "light") return storedTheme;
    if (storedTheme === "system" && window.looper.platform === "darwin") return "system";
    return window.looper.platform === "darwin" ? "system" : "dark";
  } catch {
    return window.looper.platform === "darwin" ? "system" : "dark";
  }
})();

const initialTheme =
  initialThemeSource === "system"
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light"
    : initialThemeSource;

document.documentElement.dataset.theme = initialTheme;
document.documentElement.style.colorScheme = initialTheme;

const desktopAppConfiguration = {
  editorContentStartsBelowHeader: true,
  headerControlSize: "compact",
  mobileWebLayout: false,
  supportsSystemTheme: true
} satisfies AppConfiguration;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App configuration={desktopAppConfiguration} />
  </React.StrictMode>
);
