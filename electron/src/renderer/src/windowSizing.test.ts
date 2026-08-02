import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

const mainSource = readFileSync(
  new URL("../../main/index.ts", import.meta.url),
  "utf8"
);
const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

describe("Electron window sizing", () => {
  test("allows the app to fit in a narrow tiled window", () => {
    assert.match(mainSource, /new BrowserWindow\(\{[\s\S]*minWidth:\s*600,/);
    assert.match(styles, /body\s*\{[^}]*min-width:\s*600px;/s);
  });

  test("lets the editor shrink after the loop sidebar auto-collapses", () => {
    assert.match(
      styles,
      /@media \(max-width: 639px\)[\s\S]*\.native-workspace\.results-hidden\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\) 0;/s
    );
  });
});
