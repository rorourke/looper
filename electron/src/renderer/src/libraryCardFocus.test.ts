import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

test("draws keyboard focus around the entire library card with a gap", () => {
  assert.match(
    styles,
    /\.document-card:has\(> \.document-card-open:focus-visible\)\s*\{[^}]*outline:\s*2px solid var\(--menu-highlight\);[^}]*outline-offset:\s*3px;/s
  );
  assert.doesNotMatch(
    styles,
    /\.document-card-open:focus-visible\s*\{[^}]*box-shadow:/s
  );
});
