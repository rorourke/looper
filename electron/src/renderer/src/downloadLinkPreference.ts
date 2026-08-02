export type DownloadAppButtonEnvironment = Readonly<{
  alwaysShow: boolean;
  runtimePlatform: string;
}>;

export type DesktopDownloadPlatform = "macos" | "windows";

export type DownloadPlatformEnvironment = Readonly<{
  configuredPlatform?: DesktopDownloadPlatform;
  runtimePlatform: string;
  spoofWindows: boolean;
}>;

export function shouldShowDownloadAppButton({
  alwaysShow,
  runtimePlatform
}: DownloadAppButtonEnvironment): boolean {
  return alwaysShow || runtimePlatform === "web";
}

export function resolveDownloadPlatform({
  configuredPlatform,
  runtimePlatform,
  spoofWindows
}: DownloadPlatformEnvironment): DesktopDownloadPlatform {
  if (spoofWindows) return "windows";
  return configuredPlatform ?? (runtimePlatform === "win32" ? "windows" : "macos");
}
