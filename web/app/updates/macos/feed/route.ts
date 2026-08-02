import { fetchLatestMacDownloadManifest } from "@/lib/latest-mac-download";
import {
  createMacUpdateFeed,
  macUpdateArchitecture,
  stableVersion
} from "@/lib/mac-update-feed";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const requestUrl = new URL(request.url);
  const currentVersion = stableVersion(requestUrl.searchParams.get("version"));
  const architecture = macUpdateArchitecture(
    requestUrl.searchParams.get("arch")
  );
  if (!currentVersion || !architecture) {
    return new Response("Invalid macOS update request.", {
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "Content-Type": "text/plain; charset=utf-8"
      },
      status: 400
    });
  }

  const manifest = await fetchLatestMacDownloadManifest(
    process.env.LOOPER_MAC_UPDATE_BASE_URL
  );
  if (!manifest) {
    return new Response("The macOS update feed is unavailable.", {
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "Content-Type": "text/plain; charset=utf-8"
      },
      status: 503
    });
  }

  const update = createMacUpdateFeed(
    manifest,
    currentVersion,
    architecture
  );
  if (!update) {
    return new Response(null, {
      headers: { "Cache-Control": "no-store, max-age=0" },
      status: 204
    });
  }

  return Response.json(update, {
    headers: { "Cache-Control": "no-store, max-age=0" }
  });
}
