import {
  extractVariableAssignments,
  type VariableDefinitionMetadata
} from "./looperEngine.ts";

export type VariableOption = {
  definitionCount: number;
  id: string;
  isRedefinition: boolean;
  key: string;
  lineNumber: number;
  name: string;
  occurrence: number;
  qualifier?: string;
  sectionTitle?: string;
  source: string;
};

export type VariableGroup = {
  definitions: VariableOption[];
  key: string;
  name: string;
};

export type VariableDefinitionState = {
  definitions: VariableOption[];
  metadata: VariableDefinitionMetadata[];
  selectedLineNumbers: number[];
};

type Assignment = ReturnType<typeof extractVariableAssignments>[number];

function hashDefinitionSeed(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function newDefinitionId(
  assignment: Assignment,
  usedIds: Set<string>
): string {
  const base = `definition-${hashDefinitionSeed(
    `${assignment.normalizedName}\u0000${assignment.lineNumber}\u0000${assignment.source}`
  )}`;
  let id = base;
  let suffix = 2;
  while (usedIds.has(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  usedIds.add(id);
  return id;
}

function metadataForAssignments(
  assignments: readonly Assignment[],
  storedMetadata: readonly VariableDefinitionMetadata[]
): VariableDefinitionMetadata[] {
  const storedByLine = new Map(
    storedMetadata.map((definition) => [definition.lineNumber, definition])
  );
  const usedIds = new Set<string>();

  return assignments.map((assignment) => {
    const stored = storedByLine.get(assignment.lineNumber);
    const id = stored && !usedIds.has(stored.id)
      ? stored.id
      : newDefinitionId(assignment, usedIds);
    usedIds.add(id);
    return {
      id,
      lineNumber: assignment.lineNumber,
      normalizedName: assignment.normalizedName,
      source: assignment.source
    };
  });
}

function variableOptions(
  assignments: readonly Assignment[],
  metadata: readonly VariableDefinitionMetadata[]
): VariableOption[] {
  const metadataByLine = new Map(
    metadata.map((definition) => [definition.lineNumber, definition])
  );
  const assignmentsByName = new Map<string, Assignment[]>();
  for (const assignment of assignments) {
    if (assignment.normalizedName === "loop") continue;
    const group = assignmentsByName.get(assignment.normalizedName) ?? [];
    group.push(assignment);
    assignmentsByName.set(assignment.normalizedName, group);
  }

  return Array.from(assignmentsByName.values()).flatMap((group) => {
    const sectionCounts = new Map<string, number>();
    let unsectionedCount = 0;
    for (const assignment of group) {
      if (!assignment.sectionTitle) {
        unsectionedCount += 1;
        continue;
      }
      const key = assignment.sectionTitle.toLocaleLowerCase();
      sectionCounts.set(key, (sectionCounts.get(key) ?? 0) + 1);
    }

    const sectionOccurrences = new Map<string, number>();
    let unsectionedOccurrence = 0;
    return group.map((assignment, index) => {
      const occurrence = index + 1;
      let qualifier: string | undefined;
      if (group.length > 1) {
        if (assignment.sectionTitle) {
          const sectionKey = assignment.sectionTitle.toLocaleLowerCase();
          const sectionOccurrence = (sectionOccurrences.get(sectionKey) ?? 0) + 1;
          sectionOccurrences.set(sectionKey, sectionOccurrence);
          qualifier = (sectionCounts.get(sectionKey) ?? 0) > 1
            ? `${assignment.sectionTitle} #${sectionOccurrence}`
            : assignment.sectionTitle;
        } else {
          unsectionedOccurrence += 1;
          qualifier = unsectionedCount > 1
            ? `#${unsectionedOccurrence}`
            : "#1";
        }
      }

      const stored = metadataByLine.get(assignment.lineNumber);
      return {
        definitionCount: group.length,
        id: stored?.id ?? `definition-${assignment.lineNumber}`,
        isRedefinition: index > 0,
        key: assignment.normalizedName,
        lineNumber: assignment.lineNumber,
        name: assignment.name,
        occurrence,
        qualifier,
        sectionTitle: assignment.sectionTitle,
        source: assignment.source
      };
    });
  }).sort((left, right) => left.lineNumber - right.lineNumber);
}

export function variableDefinitionStateForText(
  text: string,
  storedMetadata: readonly VariableDefinitionMetadata[] = [],
  selectedLineNumbers: readonly number[] = []
): VariableDefinitionState {
  const assignments = extractVariableAssignments(text).filter(
    (assignment) => assignment.normalizedName !== "loop"
  );
  const metadata = metadataForAssignments(assignments, storedMetadata);
  const validLines = new Set(assignments.map((assignment) => assignment.lineNumber));
  return {
    definitions: variableOptions(assignments, metadata),
    metadata,
    selectedLineNumbers: Array.from(new Set(selectedLineNumbers))
      .filter((lineNumber) => validLines.has(lineNumber))
      .sort((left, right) => left - right)
  };
}

export function variableOptionsForText(
  text: string,
  storedMetadata: readonly VariableDefinitionMetadata[] = []
): VariableOption[] {
  return variableDefinitionStateForText(text, storedMetadata).definitions;
}

export function variableGroupsForOptions(
  options: readonly VariableOption[]
): VariableGroup[] {
  const groups = new Map<string, VariableGroup>();
  for (const option of options) {
    const group = groups.get(option.key);
    if (group) {
      group.definitions.push(option);
    } else {
      groups.set(option.key, {
        definitions: [option],
        key: option.key,
        name: option.name
      });
    }
  }
  return Array.from(groups.values());
}

function assignmentSourceCounts(assignments: readonly Assignment[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const assignment of assignments) {
    counts.set(assignment.source, (counts.get(assignment.source) ?? 0) + 1);
  }
  return counts;
}

export function reconcileVariableDefinitions(
  previousText: string,
  nextText: string,
  storedMetadata: readonly VariableDefinitionMetadata[],
  selectedLineNumbers: readonly number[]
): VariableDefinitionState {
  const previousState = variableDefinitionStateForText(
    previousText,
    storedMetadata,
    selectedLineNumbers
  );
  const previousAssignments = extractVariableAssignments(previousText).filter(
    (assignment) => assignment.normalizedName !== "loop"
  );
  const nextAssignments = extractVariableAssignments(nextText).filter(
    (assignment) => assignment.normalizedName !== "loop"
  );
  const previousByLine = new Map(
    previousState.metadata.map((definition) => [definition.lineNumber, definition])
  );
  const nextAssignmentByLine = new Map(
    nextAssignments.map((assignment) => [assignment.lineNumber, assignment])
  );
  const previousAssignmentByLine = new Map(
    previousAssignments.map((assignment) => [assignment.lineNumber, assignment])
  );
  const nextMetadataByLine = new Map<number, VariableDefinitionMetadata>();
  const usedPreviousIds = new Set<string>();
  const previousLines = previousText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const nextLines = nextText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const previousSourceCounts = assignmentSourceCounts(previousAssignments);
  const nextSourceCounts = assignmentSourceCounts(nextAssignments);

  const mapDefinition = (previousLine: number, nextLine: number): void => {
    const previous = previousByLine.get(previousLine);
    const assignment = nextAssignmentByLine.get(nextLine);
    if (!previous || !assignment || usedPreviousIds.has(previous.id)) return;
    nextMetadataByLine.set(nextLine, {
      id: previous.id,
      lineNumber: nextLine,
      normalizedName: assignment.normalizedName,
      source: assignment.source
    });
    usedPreviousIds.add(previous.id);
  };

  const exactAssignmentCanMap = (previousLine: number, nextLine: number): boolean => {
    const previousAssignment = previousAssignmentByLine.get(previousLine);
    const nextAssignment = nextAssignmentByLine.get(nextLine);
    if (!previousAssignment || !nextAssignment) return false;
    return (
      previousSourceCounts.get(previousAssignment.source) ===
      nextSourceCounts.get(nextAssignment.source)
    );
  };

  let prefix = 0;
  while (
    prefix < previousLines.length &&
    prefix < nextLines.length &&
    previousLines[prefix] === nextLines[prefix]
  ) {
    if (exactAssignmentCanMap(prefix, prefix)) mapDefinition(prefix, prefix);
    prefix += 1;
  }

  let previousSuffix = previousLines.length - 1;
  let nextSuffix = nextLines.length - 1;
  while (
    previousSuffix >= prefix &&
    nextSuffix >= prefix &&
    previousLines[previousSuffix] === nextLines[nextSuffix]
  ) {
    if (exactAssignmentCanMap(previousSuffix, nextSuffix)) {
      mapDefinition(previousSuffix, nextSuffix);
    }
    previousSuffix -= 1;
    nextSuffix -= 1;
  }

  const unmatchedPrevious = previousAssignments.filter(
    (assignment) => !usedPreviousIds.has(previousByLine.get(assignment.lineNumber)?.id ?? "")
  );
  const unmatchedNext = nextAssignments.filter(
    (assignment) => !nextMetadataByLine.has(assignment.lineNumber)
  );

  const previousBySource = new Map<string, Assignment[]>();
  const nextBySource = new Map<string, Assignment[]>();
  for (const assignment of unmatchedPrevious) {
    const matches = previousBySource.get(assignment.source) ?? [];
    matches.push(assignment);
    previousBySource.set(assignment.source, matches);
  }
  for (const assignment of unmatchedNext) {
    const matches = nextBySource.get(assignment.source) ?? [];
    matches.push(assignment);
    nextBySource.set(assignment.source, matches);
  }
  for (const [source, previousMatches] of previousBySource) {
    const nextMatches = nextBySource.get(source) ?? [];
    if (previousMatches.length !== 1 || nextMatches.length !== 1) continue;
    previousMatches.forEach((assignment, index) => {
      mapDefinition(assignment.lineNumber, nextMatches[index].lineNumber);
    });
  }

  const stillUnmatchedPrevious = previousAssignments.filter(
    (assignment) => !usedPreviousIds.has(previousByLine.get(assignment.lineNumber)?.id ?? "")
  );
  const stillUnmatchedNext = nextAssignments.filter(
    (assignment) => !nextMetadataByLine.has(assignment.lineNumber)
  );
  if (stillUnmatchedPrevious.length === 1 && stillUnmatchedNext.length === 1) {
    stillUnmatchedPrevious.forEach((assignment, index) => {
      mapDefinition(assignment.lineNumber, stillUnmatchedNext[index].lineNumber);
    });
  } else {
    const previousByName = new Map<string, Assignment[]>();
    const nextByName = new Map<string, Assignment[]>();
    for (const assignment of stillUnmatchedPrevious) {
      const matches = previousByName.get(assignment.normalizedName) ?? [];
      matches.push(assignment);
      previousByName.set(assignment.normalizedName, matches);
    }
    for (const assignment of stillUnmatchedNext) {
      const matches = nextByName.get(assignment.normalizedName) ?? [];
      matches.push(assignment);
      nextByName.set(assignment.normalizedName, matches);
    }
    for (const [name, previousMatches] of previousByName) {
      const nextMatches = nextByName.get(name) ?? [];
      if (previousMatches.length === 1 && nextMatches.length === 1) {
        mapDefinition(previousMatches[0].lineNumber, nextMatches[0].lineNumber);
      }
    }
  }

  const usedIds = new Set(
    previousState.metadata.map((definition) => definition.id)
  );
  for (const assignment of nextAssignments) {
    if (nextMetadataByLine.has(assignment.lineNumber)) continue;
    nextMetadataByLine.set(assignment.lineNumber, {
      id: newDefinitionId(assignment, usedIds),
      lineNumber: assignment.lineNumber,
      normalizedName: assignment.normalizedName,
      source: assignment.source
    });
  }

  const selectedIds = new Set(
    previousState.metadata
      .filter((definition) => previousState.selectedLineNumbers.includes(definition.lineNumber))
      .map((definition) => definition.id)
  );
  const metadata = Array.from(nextMetadataByLine.values()).sort(
    (left, right) => left.lineNumber - right.lineNumber
  );
  return {
    definitions: variableOptions(nextAssignments, metadata),
    metadata,
    selectedLineNumbers: metadata
      .filter((definition) => selectedIds.has(definition.id))
      .map((definition) => definition.lineNumber)
  };
}

export function reconcileSelectedVariableLines(
  previousText: string,
  nextText: string,
  selectedLineNumbers: readonly number[]
): number[] {
  return reconcileVariableDefinitions(
    previousText,
    nextText,
    [],
    selectedLineNumbers
  ).selectedLineNumbers;
}

/** Keeps line-based sidebar publication attached to edited rows, including titles and blanks. */
export function reconcilePublishedLineNumbers(
  previousText: string,
  nextText: string,
  selectedLineNumbers: readonly number[]
): number[] {
  const previousLines = previousText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const nextLines = nextText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const nextIndicesBySource = new Map<string, number[]>();
  nextLines.forEach((line, index) => {
    const indices = nextIndicesBySource.get(line) ?? [];
    indices.push(index);
    nextIndicesBySource.set(line, indices);
  });

  const mappedLines: number[] = [];
  const usedLines = new Set<number>();
  for (const lineNumber of [...selectedLineNumbers].sort((left, right) => left - right)) {
    if (lineNumber < 0 || lineNumber >= previousLines.length) return [];
    const source = previousLines[lineNumber] ?? "";
    const previousOccurrence = previousLines
      .slice(0, lineNumber + 1)
      .filter((line) => line === source).length - 1;
    const candidates = nextIndicesBySource.get(source) ?? [];
    const exactMatch = candidates[previousOccurrence];
    let mapped: number | undefined = exactMatch;
    if (mapped === undefined) {
      const previousSelected = mappedLines.at(-1);
      const previousLineNumber = [...selectedLineNumbers]
        .filter((selected) => selected < lineNumber)
        .at(-1);
      const translated = previousSelected !== undefined && previousLineNumber !== undefined
        ? lineNumber + previousSelected - previousLineNumber
        : lineNumber;
      mapped = translated >= 0 && translated < nextLines.length ? translated : undefined;
    }
    if (mapped !== undefined && !usedLines.has(mapped)) {
      usedLines.add(mapped);
      mappedLines.push(mapped);
    }
  }

  return mappedLines.sort((left, right) => left - right);
}

export function remapVariableDefinitionMetadata(
  metadata: readonly VariableDefinitionMetadata[],
  indexMap: ReadonlyMap<number, number>
): VariableDefinitionMetadata[] {
  return metadata.flatMap((definition) => {
    const lineNumber = indexMap.get(definition.lineNumber);
    return lineNumber === undefined ? [] : [{ ...definition, lineNumber }];
  }).sort((left, right) => left.lineNumber - right.lineNumber);
}
