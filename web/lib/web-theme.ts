export type WebTheme = "dark" | "light" | "system";

export const themeStorageKey = "looper.theme";
export const systemThemeMigrationKey = "looper.web.system-theme-default.v1";

type ThemeStorage = Pick<Storage, "getItem" | "setItem">;

export function migrateToSystemTheme(storage: ThemeStorage): WebTheme {
  if (storage.getItem(systemThemeMigrationKey) !== "1") {
    storage.setItem(themeStorageKey, "system");
    storage.setItem(systemThemeMigrationKey, "1");
    return "system";
  }

  const storedTheme = storage.getItem(themeStorageKey);
  return storedTheme === "dark" || storedTheme === "light" || storedTheme === "system"
    ? storedTheme
    : "system";
}

export function resolveWebTheme(theme: WebTheme, systemPrefersDark: boolean): "dark" | "light" {
  if (theme !== "system") return theme;
  return systemPrefersDark ? "dark" : "light";
}
