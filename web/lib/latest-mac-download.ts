import {
  resolveLatestMacDownloadManifest,
  resolveMacUpdateArtifactUrl,
  type LatestMacDownloadManifest
} from "./download-url.ts";

const maximumManifestBytes = 16_384;
export const productionMacUpdateBaseUrl =
  "https://nvs3k3uv7zi86ha8.public.blob.vercel-storage.com/releases/macos";

export async function fetchLatestMacDownloadManifest(
  baseUrl: string | undefined,
  fetchImplementation: typeof fetch = fetch
): Promise<LatestMacDownloadManifest | null> {
  const manifestUrl = resolveMacUpdateArtifactUrl(
    baseUrl || productionMacUpdateBaseUrl,
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
    return resolveLatestMacDownloadManifest(JSON.parse(text), manifestUrl);
  } catch {
    return null;
  }
}
