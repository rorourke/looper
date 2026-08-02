import assert from "node:assert/strict";
import test from "node:test";
import {
  createMacUpdateFeed,
  isNewerStableVersion,
  macUpdateArchitecture,
  stableVersion
} from "./mac-update-feed.ts";
import type { LatestMacDownloadManifest } from "./download-url.ts";

const manifest: LatestMacDownloadManifest = {
  arm64Url: new URL(
    "https://example.public.blob.vercel-storage.com/Looper-1.2.3-macOS-arm64.dmg"
  ),
  arm64ZipUrl: new URL(
    "https://example.public.blob.vercel-storage.com/Looper-1.2.3-macOS-arm64.zip"
  ),
  publishedAt: "2026-07-23T03:30:00.000Z",
  version: "1.2.3",
  x64Url: new URL(
    "https://example.public.blob.vercel-storage.com/Looper-1.2.3-macOS-x64.dmg"
  ),
  x64ZipUrl: new URL(
    "https://example.public.blob.vercel-storage.com/Looper-1.2.3-macOS-x64.zip"
  )
};

test("accepts stable versions and supported Mac architectures", () => {
  assert.deepEqual(stableVersion("1.2.3"), [1, 2, 3]);
  assert.deepEqual(stableVersion("0.1.0"), [0, 1, 0]);
  assert.equal(stableVersion("1.2.3-beta.1"), null);
  assert.equal(stableVersion("01.2.3"), null);
  assert.equal(macUpdateArchitecture("arm64"), "arm64");
  assert.equal(macUpdateArchitecture("x64"), "x64");
  assert.equal(macUpdateArchitecture("universal"), null);
});

test("compares stable release versions without allowing downgrades", () => {
  assert.equal(isNewerStableVersion([1, 2, 4], [1, 2, 3]), true);
  assert.equal(isNewerStableVersion([1, 3, 0], [1, 2, 9]), true);
  assert.equal(isNewerStableVersion([2, 0, 0], [1, 99, 99]), true);
  assert.equal(isNewerStableVersion([1, 2, 3], [1, 2, 3]), false);
  assert.equal(isNewerStableVersion([1, 2, 2], [1, 2, 3]), false);
});

test("returns the architecture-specific signed ZIP only for newer versions", () => {
  assert.deepEqual(createMacUpdateFeed(manifest, [1, 2, 2], "arm64"), {
    name: "1.2.3",
    notes: "Looper 1.2.3 is ready to install.",
    pub_date: "2026-07-23T03:30:00.000Z",
    url: manifest.arm64ZipUrl.href
  });
  assert.equal(createMacUpdateFeed(manifest, [1, 2, 3], "x64"), null);
  assert.equal(createMacUpdateFeed(manifest, [2, 0, 0], "arm64"), null);
});
