import type { SyntaxSegment } from "./syntaxHighlighting.ts";

export const loopSidebarVisibilityStorageKey = "looper.loopSidebarVisibilityBySheet";
export const loopSidebarWidthStorageKey = "looper.loopSidebarWidth.v2";
export const webLoopSidebarWidthStorageKey = "looper.loopSidebarWidth.web.v1";
export const legacyLoopSidebarWidthStorageKey = "looper.loopSidebarWidth";
export const loopVariablesDrawerHeightStorageKey = "looper.loopVariablesDrawerHeight.v3";

export function loopIterationLabel(
  periodLabel: string,
  loop: number,
  loopCount: number
): string {
  return loopCount === 0 && loop === 0 ? periodLabel : `${periodLabel} ${loop}`;
}

export function loopIndexedSyntaxSegments(
  segments: readonly SyntaxSegment[],
  loop: number
): SyntaxSegment[] {
  return segments.flatMap((segment, index) => {
    const nextSegment = segments[index + 1];
    const isLoopHelper =
      nextSegment?.className === "syntax-reserved" && nextSegment.text.startsWith(".");

    if (
      segment.className !== "syntax-loop" ||
      segment.text.toLocaleLowerCase() !== "loop" ||
      isLoopHelper
    ) {
      return [segment];
    }

    return [
      segment,
      { text: "[", className: "syntax-paren" },
      { text: String(loop), className: "syntax-number" },
      { text: "]", className: "syntax-paren" }
    ];
  });
}

export function loopSidebarPublishHintLineIndex(
  sourceLines: readonly string[],
  publishedLineCount: number,
  isLoopPublished: boolean
): number | undefined {
  if (publishedLineCount > 0 || isLoopPublished) return undefined;
  const firstContentLineIndex = sourceLines.findIndex((line) => line.trim().length > 0);
  return firstContentLineIndex >= 0 ? firstContentLineIndex : undefined;
}

export const loopSidebarMinWidth = 220;
export const loopSidebarMaxWidth = 560;
export const minimumEditorWidth = 420;
export const loopSidebarAutoCollapseWidth =
  minimumEditorWidth + loopSidebarMinWidth;

const legacyLoopSidebarDefaultWidth = 340;
const loopSidebarViewportRatio = 7 / 24;
const loopVariablesDrawerMaximumRatio = 0.82;
const loopVariablesDrawerMinimumHeight = 120;
const loopResultsMinimumHeight = 120;
const loopVariablesDrawerDefaultVisibleRows = 5.5;
const loopVariablesDrawerDesktopHeaderHeight = 44;
const loopVariablesDrawerDesktopRowHeight = 40;
const loopVariablesDrawerMobileHeaderHeight = 52;
const loopVariablesDrawerMobileRowHeight = 44;

export type LoopSidebarVisibilityPreferences = Record<string, boolean>;

function clampNumber(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export function maximumLoopSidebarWidth(viewportWidth: number): number {
  return Math.max(
    loopSidebarMinWidth,
    Math.min(loopSidebarMaxWidth, viewportWidth - minimumEditorWidth)
  );
}

export function clampLoopSidebarWidth(value: number, viewportWidth: number): number {
  return Math.round(
    clampNumber(value, loopSidebarMinWidth, maximumLoopSidebarWidth(viewportWidth))
  );
}

export function loopSidebarShouldAutoCollapse(viewportWidth: number): boolean {
  return viewportWidth < loopSidebarAutoCollapseWidth;
}

export function defaultLoopSidebarWidth(
  viewportWidth: number,
  viewportRatio = loopSidebarViewportRatio
): number {
  return clampLoopSidebarWidth(viewportWidth * viewportRatio, viewportWidth);
}

export function storedLoopSidebarWidth(
  storedValue: string | null,
  legacyStoredValue: string | null,
  viewportWidth: number,
  defaultViewportRatio = loopSidebarViewportRatio
): number {
  const storedWidth = Number.parseFloat(storedValue ?? "");
  if (Number.isFinite(storedWidth)) {
    return clampLoopSidebarWidth(storedWidth, viewportWidth);
  }

  const legacyStoredWidth = Number.parseFloat(legacyStoredValue ?? "");
  if (
    Number.isFinite(legacyStoredWidth) &&
    Math.round(legacyStoredWidth) !== legacyLoopSidebarDefaultWidth
  ) {
    return clampLoopSidebarWidth(legacyStoredWidth, viewportWidth);
  }

  return defaultLoopSidebarWidth(viewportWidth, defaultViewportRatio);
}

export function maximumLoopVariablesDrawerHeight(sidebarHeight: number): number {
  const normalizedHeight = Math.max(0, sidebarHeight);
  return Math.round(
    Math.max(
      0,
      Math.min(
        normalizedHeight - loopResultsMinimumHeight,
        normalizedHeight * loopVariablesDrawerMaximumRatio
      )
    )
  );
}

export function minimumLoopVariablesDrawerHeight(sidebarHeight: number): number {
  return Math.min(
    loopVariablesDrawerMinimumHeight,
    maximumLoopVariablesDrawerHeight(sidebarHeight)
  );
}

export function clampLoopVariablesDrawerHeight(value: number, sidebarHeight: number): number {
  const maximumHeight = maximumLoopVariablesDrawerHeight(sidebarHeight);
  return Math.round(
    clampNumber(
      value,
      minimumLoopVariablesDrawerHeight(sidebarHeight),
      maximumHeight
    )
  );
}

export function defaultLoopVariablesDrawerHeight(
  sidebarHeight: number,
  mobileWebLayout = false
): number {
  const headerHeight = mobileWebLayout
    ? loopVariablesDrawerMobileHeaderHeight
    : loopVariablesDrawerDesktopHeaderHeight;
  const rowHeight = mobileWebLayout
    ? loopVariablesDrawerMobileRowHeight
    : loopVariablesDrawerDesktopRowHeight;

  return clampLoopVariablesDrawerHeight(
    headerHeight + rowHeight * loopVariablesDrawerDefaultVisibleRows,
    sidebarHeight
  );
}

export function storedLoopVariablesDrawerHeight(
  storedValue: string | null,
  sidebarHeight: number,
  mobileWebLayout = false
): number {
  const storedHeight = Number.parseFloat(storedValue ?? "");
  return Number.isFinite(storedHeight)
    ? clampLoopVariablesDrawerHeight(storedHeight, sidebarHeight)
    : defaultLoopVariablesDrawerHeight(sidebarHeight, mobileWebLayout);
}

export function parseLoopSidebarVisibilityPreferences(
  storedValue: string | null
): LoopSidebarVisibilityPreferences {
  if (!storedValue) return {};

  try {
    const parsedValue: unknown = JSON.parse(storedValue);
    if (typeof parsedValue !== "object" || parsedValue === null || Array.isArray(parsedValue)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsedValue).filter(
        (entry): entry is [string, boolean] => typeof entry[1] === "boolean"
      )
    );
  } catch {
    return {};
  }
}

export function loopSidebarIsVisible(
  preferences: LoopSidebarVisibilityPreferences,
  sheetId?: string
): boolean {
  return Boolean(sheetId) && preferences[sheetId ?? ""] !== false;
}
