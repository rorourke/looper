import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isDividerLine, shouldDisplayDivider, toggleDividerAboveLine } from "./dividerLine.ts";

test("recognizes only standalone runs of three or more dashes", () => {
  assert.equal(isDividerLine("---"), true);
  assert.equal(isDividerLine("  ----  "), true);
  assert.equal(isDividerLine("--"), false);
  assert.equal(isDividerLine("--- note"), false);
  assert.equal(isDividerLine("value = ---3"), false);
  assert.equal(isDividerLine(""), false);
});

test("keeps divider shorthand visible while its line has the cursor", () => {
  assert.equal(shouldDisplayDivider("---", true), false);
  assert.equal(shouldDisplayDivider("---", false), true);
  assert.equal(shouldDisplayDivider("ordinary text", false), false);
});

test("inserts and removes a divider directly above a variable line", () => {
  const inserted = toggleDividerAboveLine("first = 1\nsecond = 2", 1);
  assert.deepEqual(inserted, {
    inserted: true,
    targetLineNumber: 2,
    text: "first = 1\n---\nsecond = 2"
  });

  assert.deepEqual(toggleDividerAboveLine(inserted.text, inserted.targetLineNumber), {
    inserted: false,
    targetLineNumber: 1,
    text: "first = 1\nsecond = 2"
  });
});

test("keeps rendered dividers out of the publish arrow gutter", () => {
  const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

  assert.match(
    css,
    /\.highlight-row\.divider::before\s*\{[^}]*right:\s*var\(--publish-gutter-width\)/s
  );
  assert.match(
    css,
    /\.native-workspace\.results-hidden \.highlight-row\.divider::before\s*\{[^}]*right:\s*0/s
  );
});
