import type { LineEvaluation, ParsedLine } from "./looperEngine.ts";

const duplicateGlobalDefinitionPattern =
  /^Global variable ".+" must be defined only once$/;

export function formatResultText(evaluation?: LineEvaluation): string {
  if (!evaluation) return "";

  if (evaluation.status === "success") {
    return evaluation.value?.formatted ?? "";
  }

  if (evaluation.status === "error") {
    return duplicateGlobalDefinitionPattern.test(evaluation.error ?? "")
      ? "Duplicate"
      : "!";
  }
  return "";
}

export function resultColumnCharacterCount(
  lines: readonly ParsedLine[],
  activeLoop: number
): number {
  return lines.reduce((longest, line) => {
    if (line.kind !== "equation") return longest;
    const evaluation = line.evaluations[activeLoop];
    const bracketCharacterCount = evaluation?.value?.isLooped ? 3 : 0;
    return Math.max(
      longest,
      Array.from(formatResultText(evaluation)).length + bracketCharacterCount
    );
  }, 1);
}
