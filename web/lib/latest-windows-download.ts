import {
  resolveLatestWindowsDownloadManifest,
  resolveWindowsReleaseArtifactUrl,
  type LatestWindowsDownloadManifest
} from "./download-url.ts";

const maximumManifestBytes = 16_384;
export const productionWindowsReleaseBaseUrl =
  "https://nvs3k3uv7zi86ha8.public.blob.vercel-storage.com/releases/windows";

export async function fetchLatestWindowsDownloadManifest(
  baseUrl: string | undefined,
  fetchImplementation: typeof fetch = fetch
): Promise<LatestWindowsDownloadManifest | null> {
  const manifestUrl = resolveWindowsReleaseArtifactUrl(
    baseUrl || productionWindowsReleaseBaseUrl,
    "latest-download.json"
  );
  if (!manifestUrl) return null;

  try {
    const response = await fetchImplementation(manifestUrl, {
      cache: "no-store",
      redirect: "error"
    });
    const declaredLength = Number(response.headers.get("content-length"));
    if (
      !response.ok ||
      (Number.isFinite(declaredLength) &&
        declaredLength > maximumManifestBytes)
    ) {
      return null;
    }
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > maximumManifestBytes) return null;
    return resolveLatestWindowsDownloadManifest(JSON.parse(text), manifestUrl);
  } catch {
    return null;
  }
}
