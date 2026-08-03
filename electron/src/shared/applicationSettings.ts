export const applicationSettingsIpcChannels = {
  command: "application-settings:command",
  updateMenuState: "application-settings:update-menu-state"
} as const;

export type ApplicationTheme = "dark" | "light" | "system";
export type ApplicationStartupView = "last-sheet" | "library";

export type ApplicationSettingsMenuState = Readonly<{
  accountEmail?: string;
  alwaysShowDownloadAppButton: boolean;
  defaultDecimalPlaces: number;
  isSigningOut: boolean;
  sheetCount: number;
  startupView: ApplicationStartupView;
  theme: ApplicationTheme;
}>;

export type ApplicationSettingsCommand =
  | Readonly<{ decimalPlaces: number; type: "set-default-decimal-places" }>
  | Readonly<{ startupView: ApplicationStartupView; type: "set-startup-view" }>
  | Readonly<{ theme: ApplicationTheme; type: "set-theme" }>
  | Readonly<{ type: "export-all-sheets" }>
  | Readonly<{ type: "open-looper-menu" }>
  | Readonly<{ type: "show-admin-panel" }>
  | Readonly<{ type: "toggle-always-show-download-app-button" }>
  | Readonly<{ type: "sign-out" }>;

export function isApplicationTheme(value: unknown): value is ApplicationTheme {
  return value === "dark" || value === "light" || value === "system";
}

export function isApplicationStartupView(
  value: unknown
): value is ApplicationStartupView {
  return value === "last-sheet" || value === "library";
}

export function isDefaultDecimalPlaces(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 3;
}

export function isApplicationSettingsCommand(
  value: unknown
): value is ApplicationSettingsCommand {
  if (!value || typeof value !== "object") return false;
  const command = value as {
    decimalPlaces?: unknown;
    startupView?: unknown;
    theme?: unknown;
    type?: unknown;
  };
  if (command.type === "set-theme") return isApplicationTheme(command.theme);
  if (command.type === "set-default-decimal-places") {
    return isDefaultDecimalPlaces(command.decimalPlaces);
  }
  if (command.type === "set-startup-view") {
    return isApplicationStartupView(command.startupView);
  }
  return (
    command.type === "export-all-sheets" ||
    command.type === "open-looper-menu" ||
    command.type === "show-admin-panel" ||
    command.type === "toggle-always-show-download-app-button" ||
    command.type === "sign-out"
  );
}

export function parseApplicationSettingsMenuState(
  value: unknown
): ApplicationSettingsMenuState | undefined {
  if (!value || typeof value !== "object") return undefined;
  const state = value as Record<string, unknown>;
  if (
    !isApplicationTheme(state.theme) ||
    !isApplicationStartupView(state.startupView) ||
    !isDefaultDecimalPlaces(state.defaultDecimalPlaces) ||
    !Number.isInteger(state.sheetCount) ||
    Number(state.sheetCount) < 0 ||
    typeof state.isSigningOut !== "boolean" ||
    typeof state.alwaysShowDownloadAppButton !== "boolean" ||
    (state.accountEmail !== undefined && typeof state.accountEmail !== "string")
  ) {
    return undefined;
  }

  const accountEmail =
    typeof state.accountEmail === "string" ? state.accountEmail.trim() : undefined;
  return {
    accountEmail: accountEmail || undefined,
    alwaysShowDownloadAppButton: state.alwaysShowDownloadAppButton,
    defaultDecimalPlaces: state.defaultDecimalPlaces as number,
    isSigningOut: state.isSigningOut,
    sheetCount: state.sheetCount as number,
    startupView: state.startupView,
    theme: state.theme
  };
}
