import {
  AdvancedLooperDocumentEvaluator,
  extractGlobalVariableAssignments,
  type GlobalVariableAssignment,
  type ResolvedGlobalValue,
  type StockQuoteMap
} from "./advancedLooperEvaluator.ts";
import type { LooperEvaluation } from "./looperEngine.ts";

export type GlobalVariableDocument = {
  decimalPlaces: number;
  id: string;
  loopCount: number;
  text: string;
  title: string;
};

export type GlobalVariableDefinition = GlobalVariableAssignment & {
  documentId: string;
  documentTitle: string;
};

export class GlobalVariableWorkbook {
  readonly definitions: ReadonlyMap<string, readonly GlobalVariableDefinition[]>;

  private readonly activeGlobalCells = new Set<string>();
  private readonly documentsById: ReadonlyMap<string, GlobalVariableDocument>;
  private readonly evaluators = new Map<string, AdvancedLooperDocumentEvaluator>();
  private readonly invalidGlobalDefinitionErrorsByDocument: ReadonlyMap<
    string,
    ReadonlyMap<number, string>
  >;

  constructor(
    documents: readonly GlobalVariableDocument[],
    private readonly stockQuotes: StockQuoteMap = {}
  ) {
    this.documentsById = new Map(documents.map((document) => [document.id, document]));

    const definitions = new Map<string, GlobalVariableDefinition[]>();
    for (const document of documents) {
      for (const assignment of extractGlobalVariableAssignments(document.text)) {
        const current = definitions.get(assignment.normalizedName) ?? [];
        current.push({
          ...assignment,
          documentId: document.id,
          documentTitle: document.title
        });
        definitions.set(assignment.normalizedName, current);
      }
    }

    this.definitions = definitions;
    const invalidErrorsByDocument = new Map<string, Map<number, string>>();
    for (const candidates of definitions.values()) {
      const original = candidates[0];
      if (!original || candidates.length < 2) continue;
      const error = duplicateGlobalDefinitionError(original.name);
      for (const definition of candidates) {
        const documentErrors =
          invalidErrorsByDocument.get(definition.documentId) ?? new Map();
        documentErrors.set(definition.lineNumber, error);
        invalidErrorsByDocument.set(definition.documentId, documentErrors);
      }
    }
    this.invalidGlobalDefinitionErrorsByDocument = invalidErrorsByDocument;
  }

  definition(name: string): GlobalVariableDefinition | undefined {
    const candidates = this.definitions.get(normalizeName(name)) ?? [];
    return candidates.length === 1 ? candidates[0] : undefined;
  }

  evaluateDocument(documentId: string): LooperEvaluation {
    const evaluation = this.evaluateDocumentIfPresent(documentId);
    if (!evaluation) throw new Error(`Unknown sheet "${documentId}"`);
    return evaluation;
  }

  evaluateDocumentIfPresent(documentId: string): LooperEvaluation | undefined {
    return this.evaluator(documentId)?.evaluate();
  }

  private evaluator(documentId: string): AdvancedLooperDocumentEvaluator | undefined {
    const existing = this.evaluators.get(documentId);
    if (existing) return existing;

    const document = this.documentsById.get(documentId);
    if (!document) return undefined;

    const evaluator = new AdvancedLooperDocumentEvaluator(
      document.text,
      document.loopCount,
      this.stockQuotes,
      document.decimalPlaces,
      {
        invalidGlobalDefinitionErrors:
          this.invalidGlobalDefinitionErrorsByDocument.get(documentId),
        resolveGlobal: (name, loop) => this.resolveGlobal(name, loop)
      }
    );
    this.evaluators.set(documentId, evaluator);
    return evaluator;
  }

  private resolveGlobal(name: string, loop: number): ResolvedGlobalValue {
    const normalizedName = normalizeName(name);
    const candidates = this.definitions.get(normalizedName) ?? [];
    if (candidates.length === 0) {
      throw new Error(`Unresolved global variable "${name}"`);
    }
    if (candidates.length > 1) {
      throw new Error(duplicateGlobalDefinitionError(name));
    }
    const definition = candidates[0];
    const definitionDocument = this.documentsById.get(definition.documentId);
    if (!definitionDocument) {
      throw new Error(`The sheet defining "${name}" is unavailable`);
    }
    const definitionLoop = Math.min(
      Math.max(0, Math.trunc(loop)),
      Math.max(0, Math.trunc(definitionDocument.loopCount))
    );
    const key = `${normalizedName}:${definitionLoop}`;
    if (this.activeGlobalCells.has(key)) {
      throw new Error(`Circular global dependency involving "${name}"`);
    }

    const evaluator = this.evaluator(definition.documentId);
    if (!evaluator) {
      throw new Error(`The sheet defining "${name}" is unavailable`);
    }

    this.activeGlobalCells.add(key);
    try {
      return evaluator.evaluateLineValue(definition.lineNumber, definitionLoop);
    } finally {
      this.activeGlobalCells.delete(key);
    }
  }
}

function normalizeName(value: string): string {
  return value.toLocaleLowerCase();
}

function duplicateGlobalDefinitionError(name: string): string {
  return `Global variable "${name}" must be defined only once`;
}
