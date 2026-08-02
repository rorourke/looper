import assert from "node:assert/strict";
import test from "node:test";
import {
  contentFontSize,
  contentZoomCommandForKeyInput,
  maximumContentFontScale,
  minimumContentFontScale,
  nextContentFontScale,
  normalizeContentFontScale
} from "../shared/contentZoom.ts";

const macInput = {
  alt: false,
  control: false,
  key: "+",
  meta: true,
  type: "keyDown"
};

test("maps macOS page-zoom shortcuts to content zoom commands", () => {
  assert.equal(contentZoomCommandForKeyInput(macInput, "darwin"), "increase");
  assert.equal(
    contentZoomCommandForKeyInput({ ...macInput, key: "=" }, "darwin"),
    "increase"
  );
  assert.equal(
    contentZoomCommandForKeyInput({ ...macInput, key: "-" }, "darwin"),
    "decrease"
  );
  assert.equal(
    contentZoomCommandForKeyInput({ ...macInput, key: "0" }, "darwin"),
    "reset"
  );
});

test("supports the control-key equivalent outside macOS", () => {
  assert.equal(
    contentZoomCommandForKeyInput(
      { ...macInput, control: true, meta: false },
      "win32"
    ),
    "increase"
  );
});

test("leaves unrelated and modified key input alone", () => {
  assert.equal(
    contentZoomCommandForKeyInput({ ...macInput, meta: false }, "darwin"),
    undefined
  );
  assert.equal(
    contentZoomCommandForKeyInput({ ...macInput, alt: true }, "darwin"),
    undefined
  );
  assert.equal(
    contentZoomCommandForKeyInput({ ...macInput, type: "keyUp" }, "darwin"),
    undefined
  );
  assert.equal(
    contentZoomCommandForKeyInput({ ...macInput, key: "s" }, "darwin"),
    undefined
  );
});

test("normalizes and clamps persisted content font scales", () => {
  assert.equal(normalizeContentFontScale(2.6), 3);
  assert.equal(normalizeContentFontScale(Number.NaN), 0);
  assert.equal(normalizeContentFontScale(maximumContentFontScale + 10), maximumContentFontScale);
  assert.equal(normalizeContentFontScale(minimumContentFontScale - 10), minimumContentFontScale);
  assert.equal(nextContentFontScale(maximumContentFontScale, "increase"), maximumContentFontScale);
  assert.equal(nextContentFontScale(minimumContentFontScale, "decrease"), minimumContentFontScale);
  assert.equal(nextContentFontScale(5, "reset"), 0);
  assert.equal(contentFontSize(0), 16);
  assert.equal(contentFontSize(3), 19);
});
