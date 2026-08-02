import type { LatestMacDownloadManifest } from "./download-url";

type StableVersion = [major: number, minor: number, patch: number];

export type MacUpdateArchitecture = "arm64" | "x64";

export function stableVersion(value: string | null): StableVersion | null {
  if (!value || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value)) {
    return null;
  }
  const parts = value.split(".").map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isSafeInteger(part))) {
    return null;
  }
  return parts as StableVersion;
}

export function macUpdateArchitecture(
  value: string | null
): MacUpdateArchitecture | null {
  return value === "arm64" || value === "x64" ? value : null;
}

export function isNewerStableVersion(
  candidate: StableVersion,
  current: StableVersion
): boolean {
  for (let index = 0; index < candidate.length; index += 1) {
    if (candidate[index] !== current[index]) {
      return (candidate[index] ?? 0) > (current[index] ?? 0);
    }
  }
  return false;
}

export function createMacUpdateFeed(
  manifest: LatestMacDownloadManifest,
  currentVersion: StableVersion,
  architecture: MacUpdateArchitecture
): Record<string, string> | null {
  const latestVersion = stableVersion(manifest.version);
  if (!latestVersion || !isNewerStableVersion(latestVersion, currentVersion)) {
    return null;
  }

  return {
    name: manifest.version,
    notes: `Looper ${manifest.version} is ready to install.`,
    pub_date: manifest.publishedAt,
    url:
      architecture === "arm64"
        ? manifest.arm64ZipUrl.href
        : manifest.x64ZipUrl.href
  };
}
