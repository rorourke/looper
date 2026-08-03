import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

test("uses pointer cursors for bundled sheets on the web", () => {
  assert.match(
    styles,
    /:root\[data-platform="web"\] \.getting-started-grid \.document-card,\s*:root\[data-platform="web"\] \.getting-started-grid \.document-card-open,\s*:root\[data-platform="web"\] \.getting-started-grid \.library-card-menu-button\s*\{[^}]*cursor:\s*pointer;/s
  );
});
