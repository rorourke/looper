export const contentZoomChannel = "content:zoom";

export type ContentZoomCommand = "increase" | "decrease" | "reset";

export type ContentZoomKeyInput = {
  alt: boolean;
  control: boolean;
  key: string;
  meta: boolean;
  type: string;
};

export const minimumContentFontScale = -7;
export const maximumContentFontScale = 11;
export const defaultContentFontSize = 16;

export function contentZoomCommandForKeyInput(
  input: ContentZoomKeyInput,
  platform: NodeJS.Platform
): ContentZoomCommand | undefined {
  if (input.type !== "keyDown" || input.alt) return undefined;

  const hasPrimaryModifier = platform === "darwin" ? input.meta : input.control;
  if (!hasPrimaryModifier) return undefined;

  if (input.key === "+" || input.key === "=") return "increase";
  if (input.key === "-" || input.key === "_") return "decrease";
  if (input.key === "0") return "reset";
  return undefined;
}

export function isContentZoomCommand(value: unknown): value is ContentZoomCommand {
  return value === "increase" || value === "decrease" || value === "reset";
}

export function normalizeContentFontScale(value: unknown): number {
  const scale = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : 0;
  return Math.min(maximumContentFontScale, Math.max(minimumContentFontScale, scale));
}

export function nextContentFontScale(
  current: unknown,
  command: ContentZoomCommand
): number {
  const normalized = normalizeContentFontScale(current);
  if (command === "reset") return 0;
  return normalizeContentFontScale(normalized + (command === "increase" ? 1 : -1));
}

export function contentFontSize(fontScale: unknown): number {
  return defaultContentFontSize + normalizeContentFontScale(fontScale);
}
