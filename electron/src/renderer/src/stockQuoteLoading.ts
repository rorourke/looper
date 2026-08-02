import type { LineEvaluation } from "./looperEngine.ts";

export function evaluationWaitsForStockQuote(
  evaluation: LineEvaluation | undefined,
  loadingSymbols: ReadonlySet<string>
): boolean {
  if (evaluation?.status !== "error" || loadingSymbols.size === 0) return false;

  const error = evaluation.error ?? "";
  return [...loadingSymbols].some((symbol) =>
    error.includes(`$${symbol.toUpperCase()} is loading or unavailable`)
  );
}
