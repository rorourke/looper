import {
  DEFAULT_DECIMAL_PLACES,
  MAXIMUM_DECIMAL_PLACES
} from "./looperEngine.ts";
import type { ApplicationTheme } from "../../shared/applicationSettings.ts";

export type StartupView = "last-sheet" | "library";

export const defaultDecimalPlacesStorageKey =
  "looper.defaultDecimalPlaces.v1";
export const showGettingStartedFilesStorageKey =
  "looper.showGettingStartedFiles";
export const startupViewStorageKey = "looper.startupView";

export function parseDefaultDecimalPlaces(value: unknown): number {
  if (value === null || value === undefined || value === "") {
    return DEFAULT_DECIMAL_PLACES;
  }
  const decimalPlaces =
    typeof value === "number" ? value : Number(value);
  if (
    !Number.isInteger(decimalPlaces) ||
    decimalPlaces < 0 ||
    decimalPlaces > MAXIMUM_DECIMAL_PLACES
  ) {
    return DEFAULT_DECIMAL_PLACES;
  }
  return decimalPlaces;
}

export function parseStartupView(value: unknown): StartupView {
  return value === "library" ? "library" : "last-sheet";
}

export function parseShowGettingStartedFiles(value: unknown): boolean {
  return value !== false && value !== "false";
}

export function nextApplicationTheme(
  theme: ApplicationTheme,
  supportsSystemTheme: boolean
): ApplicationTheme {
  if (!supportsSystemTheme) return theme === "light" ? "dark" : "light";
  if (theme === "system") return "dark";
  if (theme === "dark") return "light";
  return "system";
}
