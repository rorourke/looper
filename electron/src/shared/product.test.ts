import assert from "node:assert/strict";
import test from "node:test";
import {
  isLooperPublicPageUrl,
  isLooperSupportEmailUrl,
  looperPrivacyUrl,
  looperSupportUrl,
  looperTermsUrl
} from "./product.ts";

test("allows only canonical public Looper policy and support links", () => {
  for (const url of [looperPrivacyUrl, looperSupportUrl, looperTermsUrl]) {
    assert.equal(isLooperPublicPageUrl(url), true);
  }
  for (const url of [
    "http://looper.app/privacy",
    "https://looper.app/privacy?redirect=https://example.com",
    "https://looper.app/support#token",
    "https://looper.app.evil.test/terms",
    "https://looper.app/download"
  ]) {
    assert.equal(isLooperPublicPageUrl(url), false);
  }
  assert.equal(isLooperSupportEmailUrl("mailto:support@looper.app"), true);
  assert.equal(isLooperSupportEmailUrl("mailto:other@looper.app"), false);
});
