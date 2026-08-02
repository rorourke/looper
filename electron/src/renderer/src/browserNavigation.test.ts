import assert from "node:assert/strict";
import test from "node:test";
import {
  browserPathForDocument,
  documentIdFromBrowserLocation
} from "./browserNavigation.ts";

test("browser sheet paths round-trip document IDs", () => {
  const documentId = "sheet id/with punctuation";
  const path = browserPathForDocument(documentId);
  const url = new URL(path, "https://looper.app");

  assert.equal(path, "/?sheet=sheet+id%2Fwith+punctuation");
  assert.equal(documentIdFromBrowserLocation(url), documentId);
});

test("the root path represents the document library", () => {
  assert.equal(browserPathForDocument(), "/");
  assert.equal(
    documentIdFromBrowserLocation(new URL("https://looper.app/?login=1")),
    undefined
  );
});

test("shared and invalid paths do not resolve owned document IDs", () => {
  assert.equal(
    documentIdFromBrowserLocation(
      new URL("https://looper.app/s/share-token?sheet=owned-sheet")
    ),
    undefined
  );
  assert.equal(
    documentIdFromBrowserLocation(
      new URL(`https://looper.app/?sheet=${"x".repeat(257)}`)
    ),
    undefined
  );
});
