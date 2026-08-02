import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchLatestMacDownloadManifest,
  productionMacUpdateBaseUrl
} from "./latest-mac-download.ts";

test("loads the production release manifest without deployment configuration", async () => {
  const requestedUrls: string[] = [];
  const manifest = await fetchLatestMacDownloadManifest(
    undefined,
    (async (input: string | URL | Request) => {
      requestedUrls.push(String(input));
      return Response.json({
        version: "1.2.3",
        arm64Url: `${productionMacUpdateBaseUrl}/Looper-1.2.3-macOS-arm64.dmg`,
        arm64ZipUrl: `${productionMacUpdateBaseUrl}/Looper-1.2.3-macOS-arm64.zip`,
        installerUrl: `${productionMacUpdateBaseUrl}/Looper-Installer-1.2.3.dmg`,
        publishedAt: "2026-07-27T15:00:00.000Z",
        x64Url: `${productionMacUpdateBaseUrl}/Looper-1.2.3-macOS-x64.dmg`,
        x64ZipUrl: `${productionMacUpdateBaseUrl}/Looper-1.2.3-macOS-x64.zip`
      });
    }) as typeof fetch
  );

  assert.deepEqual(requestedUrls, [
    `${productionMacUpdateBaseUrl}/latest-download.json`
  ]);
  assert.equal(
    manifest?.installerUrl?.href,
    `${productionMacUpdateBaseUrl}/Looper-Installer-1.2.3.dmg?download=1`
  );
});
