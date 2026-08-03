import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchLatestWindowsDownloadManifest,
  productionWindowsReleaseBaseUrl
} from "./latest-windows-download.ts";

test("loads the production Windows release manifest without deployment configuration", async () => {
  const requestedUrls: string[] = [];
  const manifest = await fetchLatestWindowsDownloadManifest(
    undefined,
    (async (input: string | URL | Request) => {
      requestedUrls.push(String(input));
      return Response.json({
        version: "1.2.3",
        arm64Url: `${productionWindowsReleaseBaseUrl}/Looper-1.2.3-Windows-arm64.exe`,
        arm64ZipUrl: `${productionWindowsReleaseBaseUrl}/Looper-1.2.3-Windows-arm64.zip`,
        publishedAt: "2026-08-03T05:30:00.000Z",
        x64Url: `${productionWindowsReleaseBaseUrl}/Looper-1.2.3-Windows-x64.exe`,
        x64ZipUrl: `${productionWindowsReleaseBaseUrl}/Looper-1.2.3-Windows-x64.zip`
      });
    }) as typeof fetch
  );

  assert.deepEqual(requestedUrls, [
    `${productionWindowsReleaseBaseUrl}/latest-download.json`
  ]);
  assert.equal(
    manifest?.x64Url.href,
    `${productionWindowsReleaseBaseUrl}/Looper-1.2.3-Windows-x64.exe?download=1`
  );
});
