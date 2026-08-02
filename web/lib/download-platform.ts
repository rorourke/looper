export type DesktopDownloadPlatform = "macos" | "windows";

export function downloadPlatformForUserAgent(
  userAgent: string
): DesktopDownloadPlatform {
  return /\bWindows(?: NT| Phone)?\b/i.test(userAgent) ? "windows" : "macos";
}

export function requestedDownloadPlatform(
  requestedPlatform: string | null,
  userAgent: string
): DesktopDownloadPlatform | null {
  if (requestedPlatform === "macos" || requestedPlatform === "windows") {
    return requestedPlatform;
  }
  if (requestedPlatform) return null;
  return downloadPlatformForUserAgent(userAgent);
}
