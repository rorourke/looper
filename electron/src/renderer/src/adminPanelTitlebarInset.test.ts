import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const adminPanelStylesUrl = new URL("./adminPanelDialog.css", import.meta.url);

test("keeps the desktop admin panel below the native titlebar controls", async () => {
  const styles = await readFile(adminPanelStylesUrl, "utf8");

  assert.match(
    styles,
    /\.admin-panel-dialog\s*\{[\s\S]*width:\s*100vw;[\s\S]*height:\s*100vh;/
  );
  assert.match(
    styles,
    /:root\[data-platform="darwin"\] \.admin-panel-dialog\s*\{[\s\S]*inset:\s*38px 0 0;[\s\S]*height:\s*calc\(100vh - 38px\);/
  );
});
