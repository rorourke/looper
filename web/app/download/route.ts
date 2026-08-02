import {
  preferredMacDownloadUrl,
  resolveWindowsDownloadUrl
} from "@/lib/download-url";
import { requestedDownloadPlatform } from "@/lib/download-platform";
import { fetchLatestMacDownloadManifest } from "@/lib/latest-mac-download";

export const dynamic = "force-dynamic";

function unavailableDownloadResponse(platform: "macos" | "windows"): Response {
  return new Response(
    platform === "windows"
      ? "The Looper Windows download is not available yet."
      : "The Looper download is not available yet.",
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "Content-Type": "text/plain; charset=utf-8",
        Vary: "User-Agent"
      },
      status: 503
    }
  );
}

function downloadRedirect(downloadUrl: URL): Response {
  return new Response(null, {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      Location: downloadUrl.href,
      Vary: "User-Agent"
    },
    status: 307
  });
}

export async function GET(request: Request): Promise<Response> {
  const requestUrl = new URL(request.url);
  const platform = requestedDownloadPlatform(
    requestUrl.searchParams.get("platform"),
    request.headers.get("user-agent") ?? ""
  );
  if (!platform) {
    return new Response("Unsupported download platform.", {
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "Content-Type": "text/plain; charset=utf-8"
      },
      status: 400
    });
  }

  if (platform === "windows") {
    const windowsDownloadUrl = resolveWindowsDownloadUrl(
      process.env.LOOPER_WINDOWS_DOWNLOAD_URL
    );
    return windowsDownloadUrl
      ? downloadRedirect(windowsDownloadUrl)
      : unavailableDownloadResponse(platform);
  }

  const latestDownload = await fetchLatestMacDownloadManifest(
    process.env.LOOPER_MAC_UPDATE_BASE_URL
  );
  const latestDownloadUrl = preferredMacDownloadUrl(latestDownload);

  if (!latestDownloadUrl) {
    return unavailableDownloadResponse(platform);
  }

  return downloadRedirect(latestDownloadUrl);
}
