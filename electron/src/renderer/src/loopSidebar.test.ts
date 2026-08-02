import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import {
  clampLoopVariablesDrawerHeight,
  clampLoopSidebarWidth,
  defaultLoopVariablesDrawerHeight,
  defaultLoopSidebarWidth,
  loopIndexedSyntaxSegments,
  loopIterationLabel,
  loopSidebarAutoCollapseWidth,
  loopSidebarIsVisible,
  loopSidebarPublishHintLineIndex,
  loopSidebarShouldAutoCollapse,
  maximumLoopVariablesDrawerHeight,
  minimumLoopVariablesDrawerHeight,
  parseLoopSidebarVisibilityPreferences,
  storedLoopVariablesDrawerHeight,
  storedLoopSidebarWidth
} from "./loopSidebar.ts";
import type { SyntaxSegment } from "./syntaxHighlighting.ts";

describe("loop sidebar preferences", () => {
  test("opens every sheet by default and keeps each sheet's explicit choice", () => {
    const preferences = parseLoopSidebarVisibilityPreferences(
      JSON.stringify({ closed: false, open: true })
    );

    assert.equal(loopSidebarIsVisible(preferences, "new-sheet"), true);
    assert.equal(loopSidebarIsVisible(preferences, "closed"), false);
    assert.equal(loopSidebarIsVisible(preferences, "open"), true);
    assert.equal(loopSidebarIsVisible(preferences), false);
  });

  test("ignores malformed and non-boolean stored preferences", () => {
    assert.deepEqual(parseLoopSidebarVisibilityPreferences("not-json"), {});
    assert.deepEqual(
      parseLoopSidebarVisibilityPreferences(
        JSON.stringify({ closed: false, invalid: "false", missing: null })
      ),
      { closed: false }
    );
  });
});

describe("loop sidebar iteration labels", () => {
  test("omits zero only for a sheet whose loop count is zero", () => {
    assert.equal(loopIterationLabel("Year", 0, 0), "Year");
    assert.equal(loopIterationLabel("Year", 0, 3), "Year 0");
    assert.equal(loopIterationLabel("Year", 1, 3), "Year 1");
  });

  test("uses a dedicated color instead of the regular subtitle color", () => {
    const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

    assert.match(css, /--text-loop-period-header:\s*#ff9d5c/);
    assert.match(
      css,
      /:root\[data-theme="light"\][\s\S]*--text-loop-period-header:\s*#a66300/
    );
    assert.match(
      css,
      /\.loop-header-row\s*{[^}]*color:\s*var\(--text-loop-period-header\)/s
    );
  });
});

describe("loop sidebar formula labels", () => {
  test("shows the current iteration beside each bare loop keyword", () => {
    const segments: SyntaxSegment[] = [
      { text: "10", className: "syntax-number" },
      { text: " * ", className: "syntax-operator" },
      { text: "loop", className: "syntax-loop" }
    ];

    assert.deepEqual(loopIndexedSyntaxSegments(segments, 2), [
      ...segments,
      { text: "[", className: "syntax-paren" },
      { text: "2", className: "syntax-number" },
      { text: "]", className: "syntax-paren" }
    ]);
  });

  test("annotates repeated bare references without changing loop helpers", () => {
    const segments: SyntaxSegment[] = [
      { text: "loop", className: "syntax-loop" },
      { text: ".last", className: "syntax-reserved" },
      { text: " - " },
      { text: "loop", className: "syntax-loop" }
    ];

    assert.equal(
      loopIndexedSyntaxSegments(segments, 3).map((segment) => segment.text).join(""),
      "loop.last - loop[3]"
    );
  });
});

describe("loop sidebar published variable labels", () => {
  test("show only the published row's variable name", () => {
    const appSource = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");

    assert.doesNotMatch(appSource, /loop-result-label-qualifier/);
    assert.match(appSource, /aria-label={`Options for \$\{variableName\}/);
  });
});

describe("loop sidebar result colors", () => {
  test("uses the loop color for values calculated from a loop", () => {
    const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

    assert.match(
      css,
      /\.result-value\.looped,\s*\.static-result-value\.looped\s*{[^}]*color:\s*var\(--text-editor-looped-number\)/s
    );
    assert.match(
      css,
      /\.loop-result-history-value\s*{[^}]*color:\s*var\(--text-editor-looped-number\)/s
    );
  });
});

describe("loop sidebar publishing hint", () => {
  test("points to the first content line only while nothing is published", () => {
    assert.equal(loopSidebarPublishHintLineIndex(["", "10 * loop"], 0, false), 1);
    assert.equal(loopSidebarPublishHintLineIndex(["", "   "], 0, false), undefined);
    assert.equal(loopSidebarPublishHintLineIndex(["10 * loop"], 1, false), undefined);
    assert.equal(loopSidebarPublishHintLineIndex(["10 * loop"], 0, true), undefined);
  });

  test("returns after blank content is replaced with new content", () => {
    assert.equal(loopSidebarPublishHintLineIndex(["10 * loop"], 0, false), 0);
    assert.equal(loopSidebarPublishHintLineIndex([""], 0, false), undefined);
    assert.equal(loopSidebarPublishHintLineIndex(["replacement"], 0, false), 0);
  });
});

describe("loop sidebar width", () => {
  test("auto-collapses only when the editor and minimum sidebar no longer fit", () => {
    assert.equal(loopSidebarAutoCollapseWidth, 640);
    assert.equal(loopSidebarShouldAutoCollapse(640), false);
    assert.equal(loopSidebarShouldAutoCollapse(639), true);
  });

  test("uses a responsive 350px default in a 1200px window", () => {
    assert.equal(defaultLoopSidebarWidth(1200), 350);
    assert.equal(defaultLoopSidebarWidth(1200, 0.3), 360);
  });

  test("keeps the responsive width inside the sidebar and editor limits", () => {
    assert.equal(defaultLoopSidebarWidth(700), 220);
    assert.equal(defaultLoopSidebarWidth(2400), 560);
    assert.equal(clampLoopSidebarWidth(500, 800), 380);
  });

  test("preserves custom widths but migrates the legacy fixed default", () => {
    assert.equal(storedLoopSidebarWidth("410", "340", 1200), 410);
    assert.equal(storedLoopSidebarWidth(null, "410", 1200), 410);
    assert.equal(storedLoopSidebarWidth(null, "340", 1200), 350);
  });
});

describe("loop variables drawer height", () => {
  test("defaults to five and a half visible variable rows", () => {
    assert.equal(defaultLoopVariablesDrawerHeight(900), 264);
    assert.equal(defaultLoopVariablesDrawerHeight(900, true), 294);
  });

  test("keeps both sidebar scroll views usable", () => {
    assert.equal(minimumLoopVariablesDrawerHeight(900), 120);
    assert.equal(maximumLoopVariablesDrawerHeight(900), 738);
    assert.equal(clampLoopVariablesDrawerHeight(100, 900), 120);
    assert.equal(clampLoopVariablesDrawerHeight(900, 900), 738);
  });

  test("adapts its minimum when the window becomes short", () => {
    assert.equal(minimumLoopVariablesDrawerHeight(240), 120);
    assert.equal(maximumLoopVariablesDrawerHeight(240), 120);
    assert.equal(clampLoopVariablesDrawerHeight(300, 240), 120);
  });

  test("restores a saved height inside the current sidebar bounds", () => {
    assert.equal(storedLoopVariablesDrawerHeight("420", 900), 420);
    assert.equal(storedLoopVariablesDrawerHeight("800", 600), 480);
    assert.equal(storedLoopVariablesDrawerHeight("invalid", 900), 264);
    assert.equal(storedLoopVariablesDrawerHeight("invalid", 900, true), 294);
  });
});
