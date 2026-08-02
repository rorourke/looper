import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

test("keeps cross-sheet global references clickable without intercepting definitions", () => {
  assert.match(
    appSource,
    /className="editor-highlight-viewport has-interactive-tokens"/
  );
  assert.match(
    appSource,
    /definition\.documentId === activeDocumentId\) return undefined;/
  );
  assert.match(
    styles,
    /\.editor-highlight-viewport\s*\{[^}]*pointer-events:\s*none;/s
  );
  assert.match(
    styles,
    /\.global-reference\s*\{[^}]*pointer-events:\s*auto;/s
  );
});
