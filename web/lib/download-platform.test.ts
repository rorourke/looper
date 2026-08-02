import assert from "node:assert/strict";
import test from "node:test";

import {
  downloadPlatformForUserAgent,
  requestedDownloadPlatform
} from "./download-platform.ts";

test("selects the Windows download for Windows PCs", () => {
  assert.equal(
    downloadPlatformForUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36"
    ),
    "windows"
  );
  assert.equal(
    downloadPlatformForUserAgent(
      "Mozilla/5.0 (Windows Phone 10.0; Android 6.0.1; Microsoft; Lumia 950 XL Dual SIM)"
    ),
    "windows"
  );
});

test("keeps macOS as the default desktop download", () => {
  assert.equal(
    downloadPlatformForUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15"
    ),
    "macos"
  );
});

test("honors valid explicit platform links and rejects invalid ones", () => {
  const windowsUserAgent =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

  assert.equal(requestedDownloadPlatform("macos", windowsUserAgent), "macos");
  assert.equal(requestedDownloadPlatform("windows", "Macintosh"), "windows");
  assert.equal(requestedDownloadPlatform(null, windowsUserAgent), "windows");
  assert.equal(requestedDownloadPlatform("linux", windowsUserAgent), null);
});
