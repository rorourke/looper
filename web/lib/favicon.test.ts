import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const faviconUrl = new URL("../app/favicon.ico", import.meta.url);
const originalLooperFaviconSha256 =
  "1ebcd37bfe230c11fc888c2739af453d8444457076202a425edf7217653253b5";

test("uses the original Looper website favicon", async () => {
  const favicon = await readFile(faviconUrl);
  const digest = createHash("sha256").update(favicon).digest("hex");

  assert.equal(digest, originalLooperFaviconSha256);
});
