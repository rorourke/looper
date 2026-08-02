import type { LineEvaluation, LooperEvaluation } from "./looperEngine.ts";

type CsvCell = number | string | { numeric: string };

function evaluationCell(evaluation: LineEvaluation | undefined): CsvCell {
  if (evaluation?.status === "success" && evaluation.value) {
    return evaluation.value.exactValue
      ? { numeric: evaluation.value.exactValue }
      : evaluation.value.value;
  }
  if (evaluation?.status === "error") {
    return `Error: ${evaluation.error ?? "Unable to evaluate"}`;
  }
  return "";
}

function textCell(value: string): string {
  // Prevent spreadsheet applications from interpreting exported source text as a formula.
  return /^\s*[=+\-@]/.test(value) ? `'${value}` : value;
}

function encodeCell(value: CsvCell): string {
  if (typeof value === "number") return String(value);
  if (typeof value === "object") return value.numeric;

  const safeValue = textCell(value);
  return /[",\r\n]/.test(safeValue)
    ? `"${safeValue.replaceAll('"', '""')}"`
    : safeValue;
}

function encodeRow(values: readonly CsvCell[]): string {
  return values.map(encodeCell).join(",");
}

export function exportLooperCsv(
  evaluation: LooperEvaluation,
  loopPeriod: string
): string {
  const periodLabel = loopPeriod.trim().toLowerCase() === "none"
    ? ""
    : loopPeriod.trim() || "Loop";
  const loopHeaders = Array.from(
    { length: evaluation.loopCount + 1 },
    (_, loop) => periodLabel ? `${periodLabel} ${loop}` : String(loop)
  );
  const rows: CsvCell[][] = [
    ["Calculation", "Summary", ...loopHeaders]
  ];
  let finalSourceLine = evaluation.lines.length - 1;
  while (
    finalSourceLine >= 0 &&
    evaluation.lines[finalSourceLine].source.trim() === ""
  ) {
    finalSourceLine -= 1;
  }

  for (const line of evaluation.lines.slice(0, finalSourceLine + 1)) {
    const source = line.source.trim();
    if (line.kind !== "equation") {
      rows.push([source, "", ...loopHeaders.map(() => "")]);
      continue;
    }

    rows.push([
      source,
      evaluationCell(line.evaluations[evaluation.loopCount]),
      ...line.evaluations.map(evaluationCell)
    ]);
  }

  return `${rows.map(encodeRow).join("\r\n")}\r\n`;
}
