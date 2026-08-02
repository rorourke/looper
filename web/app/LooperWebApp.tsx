"use client";

import type { ComponentType } from "react";
import { useEffect, useLayoutEffect, useState } from "react";
import { createBrowserLooperApi } from "@/lib/browser-looper-api";
import { migrateToSystemTheme, resolveWebTheme } from "@/lib/web-theme";
import type { AppConfiguration } from "../../electron/src/renderer/src/App";

type LooperAppComponent = ComponentType<{
  configuration?: AppConfiguration;
}>;

export function LooperWebApp() {
  const [LooperApp, setLooperApp] = useState<LooperAppComponent | null>(null);
  const [loadError, setLoadError] = useState("");

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.platform = "web";

    try {
      const theme = migrateToSystemTheme(window.localStorage);
      const resolvedTheme = resolveWebTheme(
        theme,
        window.matchMedia("(prefers-color-scheme: dark)").matches
      );
      root.dataset.theme = resolvedTheme;
      root.style.colorScheme = resolvedTheme;
    } catch {
      // The shared app will still resolve the system theme when storage is unavailable.
    }
  }, []);

  useEffect(() => {
    let canceled = false;

    if (!window.looper) {
      window.looper = createBrowserLooperApi();
    }

    void import("../../electron/src/renderer/src/App")
      .then(({ App }) => {
        if (!canceled) setLooperApp(() => App);
      })
      .catch(() => {
        if (!canceled) setLoadError("Looper could not start. Refresh the page to try again.");
      });

    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let canceled = false;
    let followUpTimeout: number | undefined;

    const cacheLoadedAppShell = (
      registration: ServiceWorkerRegistration
    ): void => {
      if (canceled) return;
      const worker =
        registration.active ??
        registration.waiting ??
        registration.installing ??
        navigator.serviceWorker.controller;
      if (!worker) return;
      const urls = [
        new URL("/", window.location.origin).toString(),
        ...performance
          .getEntriesByType("resource")
          .map((entry) => entry.name)
          .filter((value) => {
            try {
              const url = new URL(value);
              return (
                url.origin === window.location.origin &&
                !url.pathname.startsWith("/api/")
              );
            } catch {
              return false;
            }
          })
      ];
      worker.postMessage({ type: "cache-app-shell", urls });
    };

    void navigator.serviceWorker
      .register("/looper-sw.js", { scope: "/" })
      .then(async (registration) => {
        await navigator.serviceWorker.ready;
        cacheLoadedAppShell(registration);
        followUpTimeout = window.setTimeout(
          () => cacheLoadedAppShell(registration),
          2_000
        );
      })
      .catch(() => {
        // The demo still works online if shell caching is unavailable.
      });

    return () => {
      canceled = true;
      if (followUpTimeout !== undefined) {
        window.clearTimeout(followUpTimeout);
      }
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    let fallbackMeta: HTMLMetaElement | null = null;

    const updateThemeColor = (): void => {
      const themeColor = window
        .getComputedStyle(root)
        .getPropertyValue("--bg-editor-opaque")
        .trim();
      if (!themeColor) return;

      let themeColorMetas = Array.from(
        document.head.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
      );
      if (themeColorMetas.length === 0) {
        fallbackMeta = document.createElement("meta");
        fallbackMeta.name = "theme-color";
        document.head.append(fallbackMeta);
        themeColorMetas = [fallbackMeta];
      }

      for (const meta of themeColorMetas) meta.content = themeColor;
    };

    const themeObserver = new MutationObserver(updateThemeColor);
    themeObserver.observe(root, {
      attributeFilter: ["data-theme"],
      attributes: true
    });
    updateThemeColor();

    return () => {
      themeObserver.disconnect();
      fallbackMeta?.remove();
    };
  }, []);

  if (loadError) {
    return (
      <main className="web-app-status" role="alert">
        <strong>Looper could not start</strong>
        <span>{loadError}</span>
      </main>
    );
  }

  if (!LooperApp) {
    return (
      <main aria-live="polite" className="web-app-status">
        <span className="web-app-loading-mark" aria-hidden="true">L</span>
        <span>Opening Looper…</span>
      </main>
    );
  }

  const configuration = {
    browserHistoryNavigation: true,
    editorContentStartsBelowHeader: true,
    headerControlSize: "compact",
    loopSidebarDefaultViewportRatio: 0.3,
    mobileWebLayout: true,
    publicDemoMode: true,
    supportsSystemTheme: true,
  } satisfies AppConfiguration;

  return <LooperApp configuration={configuration} />;
}
