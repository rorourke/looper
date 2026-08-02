const publicVercelBlobSuffix = ".public.blob.vercel-storage.com";
const releaseVersionPattern =
  "[0-9]+\\.[0-9]+\\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?";
const updateArtifactPattern = new RegExp(
  `^(?:latest-mac\\.yml|latest-download\\.json|Looper-Installer-${releaseVersionPattern}\\.dmg|Looper-${releaseVersionPattern}-macOS-(?:arm64|x64)\\.(?:dmg|zip))$`
);

function publicVercelBlobUrl(value: string | undefined): URL | null {
  if (!value) return null;

  try {
    const url = new URL(value.trim());
    const isPublicVercelBlob =
      url.hostname.length > publicVercelBlobSuffix.length &&
      url.hostname.endsWith(publicVercelBlobSuffix);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.hash ||
      !isPublicVercelBlob
    ) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

export function resolveMacDownloadUrl(value: string | undefined): URL | null {
  const url = publicVercelBlobUrl(value);
  if (!url) return null;

  const isMacArtifact = /\.(?:dmg|zip)$/i.test(url.pathname);
  const hasOnlyDownloadQuery = [...url.searchParams.keys()].every(
    (key) => key === "download"
  );
  if (!isMacArtifact || !hasOnlyDownloadQuery) return null;

  url.searchParams.set("download", "1");
  return url;
}

export function resolveWindowsDownloadUrl(
  value: string | undefined
): URL | null {
  const url = publicVercelBlobUrl(value);
  if (!url) return null;

  const isWindowsArtifact = /\.(?:exe|zip)$/i.test(url.pathname);
  const hasOnlyDownloadQuery = [...url.searchParams.keys()].every(
    (key) => key === "download"
  );
  if (!isWindowsArtifact || !hasOnlyDownloadQuery) return null;

  url.searchParams.set("download", "1");
  return url;
}

export function resolveMacUpdateArtifactUrl(
  baseValue: string | undefined,
  artifact: string
): URL | null {
  if (!updateArtifactPattern.test(artifact)) return null;
  const baseUrl = publicVercelBlobUrl(baseValue);
  if (!baseUrl || baseUrl.search) return null;

  baseUrl.pathname = `${baseUrl.pathname.replace(/\/+$/, "")}/${artifact}`;
  return baseUrl;
}

export type LatestMacDownloadManifest = {
  arm64Url: URL;
  arm64ZipUrl: URL;
  installerUrl?: URL;
  publishedAt: string;
  version: string;
  x64Url: URL;
  x64ZipUrl: URL;
};

export function preferredMacDownloadUrl(
  manifest: LatestMacDownloadManifest | null
): URL | null {
  return manifest?.installerUrl ?? manifest?.arm64Url ?? null;
}

export function resolveLatestMacDownloadManifest(
  value: unknown,
  manifestUrlValue?: string | URL
): LatestMacDownloadManifest | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const manifest = value as Record<string, unknown>;
  const version =
    typeof manifest.version === "string" ? manifest.version.trim() : "";
  if (!new RegExp(`^${releaseVersionPattern}$`).test(version)) return null;

  const arm64Url = resolveMacDownloadUrl(
    typeof manifest.arm64Url === "string" ? manifest.arm64Url : undefined
  );
  const x64Url = resolveMacDownloadUrl(
    typeof manifest.x64Url === "string" ? manifest.x64Url : undefined
  );
  const arm64ZipUrl = resolveMacDownloadUrl(
    typeof manifest.arm64ZipUrl === "string"
      ? manifest.arm64ZipUrl
      : undefined
  );
  const x64ZipUrl = resolveMacDownloadUrl(
    typeof manifest.x64ZipUrl === "string" ? manifest.x64ZipUrl : undefined
  );
  const hasInstallerUrl = Object.hasOwn(manifest, "installerUrl");
  const rawInstallerUrl =
    typeof manifest.installerUrl === "string"
      ? manifest.installerUrl
      : undefined;
  const installerUrl = rawInstallerUrl
    ? (resolveMacDownloadUrl(rawInstallerUrl) ?? undefined)
    : undefined;
  const publishedAt =
    typeof manifest.publishedAt === "string" ? manifest.publishedAt : "";
  const manifestUrl = publicVercelBlobUrl(manifestUrlValue?.toString());
  const manifestStoreWasProvided = manifestUrlValue !== undefined;
  const trustedReleaseDirectory = manifestUrl
    ? manifestUrl.pathname.slice(0, manifestUrl.pathname.lastIndexOf("/") + 1)
    : null;
  const artifactUrls = [arm64Url, arm64ZipUrl, x64Url, x64ZipUrl, installerUrl]
    .filter((url): url is URL => Boolean(url));
  const artifactsShareManifestStore =
    !manifestStoreWasProvided ||
    (manifestUrl !== null &&
      artifactUrls.every(
        (url) =>
          url.origin === manifestUrl.origin &&
          url.pathname.startsWith(trustedReleaseDirectory ?? "/")
      ));
  if (
    !arm64Url?.pathname.endsWith(`Looper-${version}-macOS-arm64.dmg`) ||
    !arm64ZipUrl?.pathname.endsWith(`Looper-${version}-macOS-arm64.zip`) ||
    !x64Url?.pathname.endsWith(`Looper-${version}-macOS-x64.dmg`) ||
    !x64ZipUrl?.pathname.endsWith(`Looper-${version}-macOS-x64.zip`) ||
    (hasInstallerUrl &&
      (!rawInstallerUrl ||
        !installerUrl?.pathname.endsWith(
          `Looper-Installer-${version}.dmg`
        ))) ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(publishedAt) ||
    !Number.isFinite(Date.parse(publishedAt)) ||
    !artifactsShareManifestStore
  ) {
    return null;
  }

  return {
    arm64Url,
    arm64ZipUrl,
    installerUrl,
    publishedAt,
    version,
    x64Url,
    x64ZipUrl
  };
}
