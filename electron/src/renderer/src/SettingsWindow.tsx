import {
  FileSpreadsheet,
  FolderOpen,
  SlidersHorizontal,
  type LucideIcon
} from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useState,
  type ReactElement
} from "react";
import type {
  ApplicationSettingsMenuState,
  ApplicationSettingsPreferenceChange,
  ApplicationTheme
} from "../../shared/applicationSettings";
import type { SheetStorageSettings } from "../../shared/sheetStorage";
import "./settingsWindow.css";

type SettingsPane = "general" | "sheets";

type PaneDefinition = Readonly<{
  icon: LucideIcon;
  id: SettingsPane;
  label: string;
}>;

const paneStorageKey = "looper.settings.lastPane";
const panes: readonly PaneDefinition[] = [
  { icon: SlidersHorizontal, id: "general", label: "General" },
  { icon: FileSpreadsheet, id: "sheets", label: "Sheets" }
];

const initialSettings: ApplicationSettingsMenuState = {
  alwaysShowDownloadAppButton: false,
  defaultDecimalPlaces: 2,
  isSigningOut: false,
  sheetCount: 0,
  startupView: "last-sheet",
  theme: "system"
};

function readInitialPane(): SettingsPane {
  try {
    return window.localStorage.getItem(paneStorageKey) === "sheets"
      ? "sheets"
      : "general";
  } catch {
    return "general";
  }
}

function resolvedTheme(theme: ApplicationTheme): "dark" | "light" {
  if (theme === "dark" || theme === "light") return theme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function SettingsWindow(): ReactElement {
  const [activePane, setActivePane] = useState<SettingsPane>(readInitialPane);
  const [settings, setSettings] =
    useState<ApplicationSettingsMenuState>(initialSettings);
  const [storageSettings, setStorageSettings] =
    useState<SheetStorageSettings>();
  const [errorMessage, setErrorMessage] = useState("");
  const [isChangingFolder, setIsChangingFolder] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    document.body.classList.add("settings-window-body");
    return () => document.body.classList.remove("settings-window-body");
  }, []);

  useEffect(() => {
    let canceled = false;
    const stopListening = window.looper.onApplicationSettingsStateChanged(
      (nextSettings) => {
        if (!canceled) setSettings(nextSettings);
      }
    );

    void window.looper
      .getApplicationSettings()
      .then((nextSettings) => {
        if (!canceled) setSettings(nextSettings);
      })
      .catch((error: unknown) => {
        if (!canceled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Settings could not be loaded."
          );
        }
      });

    return () => {
      canceled = true;
      stopListening();
    };
  }, []);

  useEffect(() => {
    let canceled = false;
    const stopListening = window.looper.onSheetStorageSettingsChanged(
      (nextSettings) => {
        if (!canceled) setStorageSettings(nextSettings);
      }
    );
    void window.looper
      .getSheetStorageSettings()
      .then((nextSettings) => {
        if (!canceled) setStorageSettings(nextSettings);
      })
      .catch((error: unknown) => {
        if (!canceled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "The sheet folder could not be loaded."
          );
        }
      });
    return () => {
      canceled = true;
      stopListening();
    };
  }, []);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      window.close();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(paneStorageKey, activePane);
    } catch {
      // The pane remains available for this window session.
    }
    document.title = `${activePane === "general" ? "General" : "Sheets"} — Looper Settings`;
  }, [activePane]);

  useLayoutEffect(() => {
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = (): void => {
      const theme = resolvedTheme(settings.theme);
      document.documentElement.dataset.theme = theme;
      document.documentElement.style.colorScheme = theme;
    };

    applyTheme();
    if (settings.theme === "system") {
      systemTheme.addEventListener("change", applyTheme);
    }
    return () => systemTheme.removeEventListener("change", applyTheme);
  }, [settings.theme]);

  const updatePreference = (
    change: ApplicationSettingsPreferenceChange
  ): void => {
    setErrorMessage("");
    setSettings((current) => {
      if (change.type === "set-theme") {
        return { ...current, theme: change.theme };
      }
      if (change.type === "set-default-decimal-places") {
        return { ...current, defaultDecimalPlaces: change.decimalPlaces };
      }
      return { ...current, startupView: change.startupView };
    });
    void window.looper
      .setApplicationSettingsPreference(change)
      .then(setSettings)
      .catch((error: unknown) => {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "That setting could not be changed."
        );
        void window.looper.getApplicationSettings().then(setSettings);
      });
  };

  const exportAllSheets = async (): Promise<void> => {
    if (isExporting || settings.sheetCount === 0) return;
    setErrorMessage("");
    setIsExporting(true);
    try {
      await window.looper.requestExportAllSheetsFromSettings();
      window.close();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The export could not be started."
      );
      setIsExporting(false);
    }
  };

  const revealSheetFolder = async (): Promise<void> => {
    setErrorMessage("");
    try {
      await window.looper.revealLocalSheetDirectory();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The sheet folder could not be opened."
      );
    }
  };

  const changeSheetFolder = async (): Promise<void> => {
    if (isChangingFolder) return;
    setErrorMessage("");
    setIsChangingFolder(true);
    try {
      const nextSettings = await window.looper.setSheetStorageProvider(
        "local",
        true
      );
      setStorageSettings(nextSettings);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The sheet folder could not be changed."
      );
    } finally {
      setIsChangingFolder(false);
    }
  };

  return (
    <div className="settings-window">
      <header className="settings-window-toolbar">
        <div className="settings-window-titlebar">
          <h1>{activePane === "general" ? "General" : "Sheets"}</h1>
        </div>
        <nav aria-label="Settings panes" className="settings-pane-picker">
          {panes.map((pane) => {
            const Icon = pane.icon;
            const selected = pane.id === activePane;
            return (
              <button
                aria-selected={selected}
                className={selected ? "selected" : undefined}
                key={pane.id}
                onClick={() => setActivePane(pane.id)}
                role="tab"
                type="button"
              >
                <span className="settings-pane-icon">
                  <Icon aria-hidden="true" />
                </span>
                <span>{pane.label}</span>
              </button>
            );
          })}
        </nav>
      </header>

      <main
        aria-label={`${activePane === "general" ? "General" : "Sheets"} settings`}
        className="settings-window-content"
        role="tabpanel"
      >
        {activePane === "general" ? (
          <div className="settings-pane">
            <section aria-labelledby="appearance-heading">
              <h2 id="appearance-heading">Appearance</h2>
              <div className="settings-group">
                <div className="settings-form-row settings-form-row-stacked">
                  <div className="settings-row-heading">
                    <strong>Theme</strong>
                    <span>
                      Choose how Looper looks on this{" "}
                      {window.looper.platform === "win32" ? "Windows PC" : "Mac"}.
                    </span>
                  </div>
                  <div
                    aria-label="Theme"
                    className="settings-segmented-control"
                    role="group"
                  >
                    {(["system", "light", "dark"] as const).map((theme) => (
                      <button
                        aria-pressed={settings.theme === theme}
                        className={settings.theme === theme ? "selected" : undefined}
                        key={theme}
                        onClick={() =>
                          updatePreference({ theme, type: "set-theme" })
                        }
                        type="button"
                      >
                        {theme === "system"
                          ? "System"
                          : theme === "light"
                            ? "Light"
                            : "Dark"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section aria-labelledby="startup-heading">
              <h2 id="startup-heading">Startup</h2>
              <div className="settings-group">
                <label className="settings-form-row" htmlFor="startup-view">
                  <span className="settings-control-label">
                    When Looper opens
                  </span>
                  <select
                    id="startup-view"
                    onChange={(event) =>
                      updatePreference({
                        startupView:
                          event.currentTarget.value === "library"
                            ? "library"
                            : "last-sheet",
                        type: "set-startup-view"
                      })
                    }
                    value={settings.startupView}
                  >
                    <option value="last-sheet">Resume Last Sheet</option>
                    <option value="library">Show Library</option>
                  </select>
                </label>
              </div>
              <p className="settings-section-note">
                Choose where you want to pick up each time you launch Looper.
              </p>
            </section>

          </div>
        ) : (
          <div className="settings-pane">
            <section aria-labelledby="new-sheets-heading">
              <h2 id="new-sheets-heading">New Sheets</h2>
              <div className="settings-group">
                <label
                  className="settings-form-row"
                  htmlFor="default-decimal-places"
                >
                  <span className="settings-control-label">
                    Default decimal places
                  </span>
                  <select
                    id="default-decimal-places"
                    onChange={(event) =>
                      updatePreference({
                        decimalPlaces: Number(event.currentTarget.value),
                        type: "set-default-decimal-places"
                      })
                    }
                    value={settings.defaultDecimalPlaces}
                  >
                    {[0, 1, 2, 3].map((decimalPlaces) => (
                      <option key={decimalPlaces} value={decimalPlaces}>
                        {decimalPlaces}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="settings-section-note">
                Existing sheets keep their own number formatting.
              </p>
            </section>

            <section aria-labelledby="storage-heading">
              <h2 id="storage-heading">Storage</h2>
              <div className="settings-group">
                <div className="settings-form-row settings-folder-row">
                  <span className="settings-row-heading settings-folder-heading">
                    <strong>Sheet folder</strong>
                    <span title={storageSettings?.localDirectoryPath}>
                      {storageSettings?.localDirectoryPath ?? "Preparing local storage…"}
                    </span>
                  </span>
                  <div className="settings-folder-actions">
                    <button
                      aria-label="Show sheet folder"
                      className="settings-push-button settings-icon-button"
                      disabled={!storageSettings?.localDirectoryPath}
                      onClick={() => void revealSheetFolder()}
                      title="Show in Finder or File Explorer"
                      type="button"
                    >
                      <FolderOpen aria-hidden="true" />
                      Show
                    </button>
                    <button
                      className="settings-push-button"
                      disabled={isChangingFolder}
                      onClick={() => void changeSheetFolder()}
                      type="button"
                    >
                      {isChangingFolder ? "Choosing…" : "Change…"}
                    </button>
                  </div>
                </div>
              </div>
              <p className="settings-section-note">
                Looper saves each sheet as a portable .loop file in this folder.
              </p>
            </section>

            <section aria-labelledby="data-heading">
              <h2 id="data-heading">Data</h2>
              <div className="settings-group">
                <div className="settings-form-row settings-export-row">
                  <span className="settings-row-heading">
                    <strong>Export all sheets</strong>
                    <span>
                      {settings.sheetCount === 0
                        ? "There are no sheets to export."
                        : `Save ${settings.sheetCount} ${
                            settings.sheetCount === 1 ? "sheet" : "sheets"
                          } as CSV files.`}
                    </span>
                  </span>
                  <button
                    className="settings-push-button"
                    disabled={isExporting || settings.sheetCount === 0}
                    onClick={() => void exportAllSheets()}
                    type="button"
                  >
                    {isExporting ? "Opening…" : "Export All…"}
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}

        {errorMessage ? (
          <p className="settings-error" role="alert">
            {errorMessage}
          </p>
        ) : null}
      </main>
    </div>
  );
}
