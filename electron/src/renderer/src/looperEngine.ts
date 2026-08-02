import { evaluateAdvancedLooperText } from "./advancedLooperEvaluator.ts";
import type { StockQuoteMap } from "./advancedLooperEvaluator.ts";

export {
  extractGlobalVariableAssignments,
  extractStockSymbols,
  extractVariableAssignments
} from "./advancedLooperEvaluator.ts";
export type { StockQuote, StockQuoteMap } from "./advancedLooperEvaluator.ts";

export type LooperDocumentData = {
  title: string;
  text: string;
  fontScale: number;
  decimalPlaces: number;
  loopCount: number;
  loopPeriod: "Year" | "year" | "month" | "week" | "day" | string;
  loopedLines: number[];
  loopSidebarDividerLines?: number[];
  isLoopVariablePublished: boolean;
  isLoopEnabled: boolean;
  isResultsHidden: boolean;
  resultSortMode: ResultSortMode;
  stockSymbols?: string[];
  variableDefinitions?: VariableDefinitionMetadata[];
};

export type VariableDefinitionMetadata = {
  id: string;
  lineNumber: number;
  normalizedName: string;
  source: string;
};

export type ResultSortMode = "manual" | "ascending" | "descending";

export type ValueKind =
  | "decimal"
  | "integer"
  | "currency"
  | "percent"
  | "loop"
  | "unresolved";

export type EvaluatedValue = {
  value: number;
  exactValue?: string;
  kind: ValueKind;
  formatted: string;
  isLooped: boolean;
};

export type LineEvaluation = {
  loop: number;
  status: "success" | "error" | "empty" | "title";
  value?: EvaluatedValue;
  error?: string;
};

export type ParsedLine = {
  lineNumber: number;
  source: string;
  expression: string;
  variable?: string;
  title?: string;
  kind: "equation" | "title" | "empty" | "function";
  parseError?: string;
  dependsOnLoop: boolean;
  evaluations: LineEvaluation[];
};

export type LooperEvaluation = {
  text: string;
  loopCount: number;
  lines: ParsedLine[];
  variables: string[];
  errors: number;
};

const defaultTitle = "Untitled";
const defaultLoopCount = 3;
const maximumLoopCount = 1000;
const resultSortModes: ResultSortMode[] = ["manual", "ascending", "descending"];
export const DEFAULT_DECIMAL_PLACES = 2;
export const MAXIMUM_DECIMAL_PLACES = 3;
export const DEFAULT_LOOP_PERIOD_LABEL = "Year";
export const NONE_LOOP_PERIOD_LABEL = "None";

export function createInitialDocument(): LooperDocumentData {
  return {
    title: defaultTitle,
    text: "10 * loop",
    fontScale: 0,
    decimalPlaces: DEFAULT_DECIMAL_PLACES,
    loopCount: defaultLoopCount,
    loopPeriod: "Loop",
    loopedLines: [],
    loopSidebarDividerLines: [],
    isLoopVariablePublished: false,
    isLoopEnabled: true,
    isResultsHidden: false,
    resultSortMode: "manual",
    stockSymbols: [],
    variableDefinitions: []
  };
}

export function normalizeDocumentData(value: unknown): LooperDocumentData {
  if (typeof value === "string") {
    const migrated = migrateLegacyLoopRow(value, []);
    return {
      ...createInitialDocument(),
      title: titleFromText(value),
      text: migrated.text,
      loopCount: migrated.loopCount,
      loopedLines: migrated.loopedLines
    };
  }

  if (typeof value === "object" && value !== null && "text" in value) {
    const record = value as Partial<LooperDocumentData>;
    const storedLoopedLines = Array.isArray(record.loopedLines) ? record.loopedLines : [];
    const hasLoopCount = Number.isFinite(record.loopCount);
    const migrated = hasLoopCount
      ? {
          text: normalizeLineEndings(String(record.text ?? "")),
          loopCount: normalizeLoopCount(record.loopCount),
          loopedLines: storedLoopedLines
        }
      : migrateLegacyLoopRow(String(record.text ?? ""), storedLoopedLines);
    const lineCount = migrated.text.split("\n").length;
    return {
      title: normalizeTitle(record.title ?? titleFromText(String(record.text ?? ""))),
      text: migrated.text,
      fontScale: Number.isFinite(record.fontScale) ? Number(record.fontScale) : 0,
      decimalPlaces: normalizeDecimalPlaces(record.decimalPlaces),
      loopCount: migrated.loopCount,
      loopPeriod: normalizeLoopPeriodLabel(record.loopPeriod, migrated.loopCount),
      loopedLines: normalizeStoredLineNumbers(migrated.loopedLines, lineCount),
      loopSidebarDividerLines: Array.isArray(record.loopSidebarDividerLines)
        ? normalizeStoredLineNumbers(
            record.loopSidebarDividerLines,
            Number.MAX_SAFE_INTEGER
          )
        : [],
      isLoopVariablePublished: record.isLoopVariablePublished !== false,
      // Kept in the document shape for backwards compatibility with saved files.
      isLoopEnabled: true,
      isResultsHidden: Boolean(record.isResultsHidden),
      resultSortMode: normalizeResultSortMode(record.resultSortMode),
      stockSymbols: Array.isArray(record.stockSymbols) ? record.stockSymbols : [],
      variableDefinitions: normalizeVariableDefinitionMetadata(
        record.variableDefinitions
      )
    };
  }

  return createInitialDocument();
}

function normalizeStoredLineNumbers(value: unknown, lineCount: number): number[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value.filter(
        (lineNumber): lineNumber is number =>
          Number.isInteger(lineNumber) && lineNumber >= 0 && lineNumber < lineCount
      )
    )
  ).sort((left, right) => left - right);
}

export function evaluateLooperText(
  text: string,
  loopCount = defaultLoopCount,
  stockQuotes: StockQuoteMap = {},
  decimalPlaces = DEFAULT_DECIMAL_PLACES
): LooperEvaluation {
  return evaluateAdvancedLooperText(
    normalizeLineEndings(text),
    normalizeLoopCount(loopCount),
    stockQuotes,
    normalizeDecimalPlaces(decimalPlaces)
  );
}

export function visibleLooperText(text: string, _legacyIsLoopEnabled: boolean): string {
  return normalizeLineEndings(text);
}

export function normalizeLoopCount(value: unknown, fallback = defaultLoopCount): number {
  const count = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(count)) return fallback;
  return Math.max(0, Math.min(maximumLoopCount, Math.trunc(count)));
}

export function normalizeDecimalPlaces(
  value: unknown,
  fallback = DEFAULT_DECIMAL_PLACES
): number {
  const places = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(places)) return fallback;
  return Math.max(0, Math.min(MAXIMUM_DECIMAL_PLACES, Math.trunc(places)));
}

export function normalizeLoopPeriodLabel(
  value: unknown,
  loopCount: unknown = defaultLoopCount
): string {
  const label = typeof value === "string" ? value.trim() : "";
  const hasLoops = normalizeLoopCount(loopCount) > 0;

  if (!label || label.toLowerCase() === NONE_LOOP_PERIOD_LABEL.toLowerCase()) {
    return hasLoops ? DEFAULT_LOOP_PERIOD_LABEL : NONE_LOOP_PERIOD_LABEL;
  }
  if (label.toLowerCase() === DEFAULT_LOOP_PERIOD_LABEL.toLowerCase()) {
    return DEFAULT_LOOP_PERIOD_LABEL;
  }
  return label;
}

function normalizeTitle(value: unknown): string {
  const title = typeof value === "string" ? value.trim().replace(/\.loop$/i, "") : "";
  return title || defaultTitle;
}

function normalizeResultSortMode(value: unknown): ResultSortMode {
  return resultSortModes.includes(value as ResultSortMode) ? (value as ResultSortMode) : "manual";
}

function normalizeVariableDefinitionMetadata(
  value: unknown
): VariableDefinitionMetadata[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((candidate) => {
    if (typeof candidate !== "object" || candidate === null) return [];
    const record = candidate as Partial<VariableDefinitionMetadata>;
    if (
      typeof record.id !== "string" ||
      !record.id ||
      !Number.isInteger(record.lineNumber) ||
      Number(record.lineNumber) < 0 ||
      typeof record.normalizedName !== "string" ||
      !record.normalizedName ||
      typeof record.source !== "string"
    ) {
      return [];
    }
    return [{
      id: record.id,
      lineNumber: Number(record.lineNumber),
      normalizedName: record.normalizedName,
      source: record.source
    }];
  });
}

function titleFromText(text: string): string {
  const firstLine = normalizeLineEndings(text)
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, "").trim())
    .find((line) => line.length > 0 && !/^loop\s*=/i.test(line));
  return normalizeTitle(firstLine?.replace(/:$/, ""));
}

function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function migrateLegacyLoopRow(
  text: string,
  loopedLines: number[]
): { text: string; loopCount: number; loopedLines: number[] } {
  const normalized = normalizeLineEndings(text);
  const lines = normalized.split("\n");
  const legacyAssignment = lines[0]?.match(/^\s*loop\s*=\s*([\d,]+(?:\.\d+)?)\s*(?:\/\/.*)?$/i);
  if (!legacyAssignment) {
    return { text: normalized, loopCount: defaultLoopCount, loopedLines };
  }

  const parsedCount = Number(legacyAssignment[1].replaceAll(",", ""));
  if (!Number.isFinite(parsedCount)) {
    return { text: normalized, loopCount: defaultLoopCount, loopedLines };
  }

  let removedLineCount = 1;
  if (lines[1]?.trim() === "") removedLineCount = 2;

  return {
    text: lines.slice(removedLineCount).join("\n"),
    loopCount: normalizeLoopCount(parsedCount),
    loopedLines: loopedLines
      .filter((lineNumber) => lineNumber >= removedLineCount)
      .map((lineNumber) => lineNumber - removedLineCount)
  };
}
