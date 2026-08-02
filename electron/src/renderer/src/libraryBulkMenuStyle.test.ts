import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

test("shows selected-sheet actions as a white ellipsis on the focus color", () => {
  assert.match(
    app,
    /className="compact-titlebar-icon"\s+icon=\{Ellipsis\}/s
  );
  assert.doesNotMatch(app, /className="library-bulk-menu-symbol"/);
  assert.match(
    styles,
    /\.library-bulk-menu-button\s*\{[^}]*color:\s*var\(--menu-highlight-text\);[^}]*background:\s*var\(--menu-highlight\);/s
  );
  assert.doesNotMatch(styles, /\.library-bulk-menu-symbol\s*\{/);
});
