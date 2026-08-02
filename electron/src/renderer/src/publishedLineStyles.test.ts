import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

test("uses one opaque surface for the published row and its arrow gutter", () => {
  assert.match(
    css,
    /--bg-published-editor-line:\s*color-mix\(\s*in srgb,\s*var\(--text-editor-subtitle\) 5%,\s*var\(--bg-editor-opaque\)\s*\)/s
  );
  assert.match(
    css,
    /\.highlight-row\.published-line\s*\{[^}]*background:\s*var\(--bg-published-editor-line\)/s
  );
  assert.match(
    css,
    /\.publish-line-button\.active\s*\{[^}]*background:\s*var\(--bg-published-editor-line\)/s
  );
});

test("keeps the publish arrow visible when hovered in either theme", () => {
  assert.match(
    css,
    /\.publish-line-button:hover,\s*\.publish-line-button:focus-visible\s*\{[^}]*color:\s*var\(--text-editor-expression\)/s
  );
});

test("keeps published results and arrows above the interactive highlight layer", () => {
  assert.match(
    css,
    /\.editor-highlight-viewport\.has-interactive-tokens\s*\{[^}]*z-index:\s*4/s
  );
  assert.match(
    css,
    /\.static-results\s*\{[^}]*position:\s*absolute;[^}]*z-index:\s*5/s
  );
});

test("fills a wrapped published row without moving its arrow off the first line", () => {
  assert.match(
    css,
    /\.publish-line-button\s*\{[^}]*height:\s*100%/s
  );
  assert.match(
    css,
    /\.publish-line-button \.ui-icon\s*\{[^}]*align-self:\s*start;[^}]*margin-top:\s*calc\(\(var\(--row-height\) - 13px\) \/ 2\)/s
  );
});
