import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  Bug,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Code2,
  Download,
  Ellipsis,
  FileInput,
  FilePlus,
  FolderCog,
  FolderOpen,
  GripHorizontal,
  Minus,
  ListFilter,
  Lock,
  LogOut,
  Palette,
  PanelRightClose,
  PanelRightOpen,
  Search,
  ShieldCheck,
  Trash2,
  X,
  type LucideIcon
} from "lucide-react";
import type {
  ClipboardEvent as ReactClipboardEvent,
  CSSProperties,
  FocusEvent as ReactFocusEvent,
  FormEvent as ReactFormEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactElement,
  ReactNode,
  SyntheticEvent as ReactSyntheticEvent,
  UIEvent as ReactUIEvent
} from "react";
import looperIcon from "../../../build/icon.png";
import {
  AccountDialog,
  type AccountDialogAccount
} from "./AccountDialog";
import { AdminPanelDialog } from "./AdminPanelDialog";
import { AdminMfaDialog } from "./AdminMfaDialog";
import { BillingDialog } from "./BillingDialog";
import type { AdminAccessStatus } from "../../shared/admin";
import type {
  AccountSummary,
  CloudSheet,
  CloudSheetDraft,
  JsonObject
} from "../../shared/cloudAccount";
import {
  SHEET_PACK_SIZE,
  billingStatusAllowsSheetCreation,
  quotaBillingStatus,
  type BillingStatus,
  type SheetPackProduct
} from "../../shared/billing";
import type { BillingPreviewMode } from "../../shared/debugSettings";
import {
  idleAppUpdateState,
  type AppUpdateState
} from "../../shared/appUpdates";
import {
  createGettingStartedDocuments,
  gettingStartedExampleOrder,
  gettingStartedExampleSection,
  GETTING_STARTED_TEMPLATE_REVISION_STORAGE_KEY,
  isGettingStartedExampleDocumentId,
  isPristineLegacyGettingStartedDocument,
  isPristinePreviousGettingStartedExampleDocument,
  LEGACY_GETTING_STARTED_DOCUMENT_ID,
  restoreGettingStartedExampleDocuments,
  seedGettingStartedDocuments
} from "./gettingStartedDocument";
import {
  DEMO_ACCOUNT_EMAIL,
  DEMO_ACCOUNT_ID,
  createDemoTimeLibraryDocuments
} from "./demoTime";
import {
  createInitialDocument,
  DEFAULT_DECIMAL_PLACES,
  DEFAULT_LOOP_PERIOD_LABEL,
  evaluateLooperText,
  extractGlobalVariableAssignments,
  extractStockSymbols,
  normalizeLoopCount,
  normalizeDecimalPlaces,
  normalizeDocumentData,
  normalizeLoopPeriodLabel,
  NONE_LOOP_PERIOD_LABEL
} from "./looperEngine";
import {
  GlobalVariableWorkbook,
  type GlobalVariableDefinition,
  type GlobalVariableDocument
} from "./globalVariables";
import {
  completeGlobalVariableToken,
  globalVariableAutocompleteSuggestions,
  globalVariableTokenAtCaret,
  type GlobalVariableAutocompleteDefinition,
  type GlobalVariableAutocompleteToken
} from "./globalVariableAutocomplete";
import {
  formatResultText,
  resultColumnCharacterCount
} from "./resultFormatting";
import type {
  LineEvaluation,
  LooperDocumentData,
  ParsedLine,
  StockQuoteMap
} from "./looperEngine";
import {
  buildSyntaxHighlightContext,
  highlightLineSegments,
  type SyntaxHighlightContext
} from "./syntaxHighlighting";
import {
  insertDedentedClosingBrace,
  insertIndentedNewline,
  type EditorTextEdit
} from "./editorIndentation";
import { toggleLineComments } from "./editorCommenting";
import { autoTitleForSheet } from "./documentTitle";
import { isDividerLine, shouldDisplayDivider, toggleDividerAboveLine } from "./dividerLine";
import {
  conciseCloudIssueMessage,
  isSheetLimitIssue
} from "./cloudIssueCopy";
import {
  editorRowsMatchText,
  lineIndexAtVerticalOffset,
  lineUsesFullEditorWidth,
  rowDragShiftDirection
} from "./lineLayout";
import { evaluationWaitsForStockQuote } from "./stockQuoteLoading";
import {
  reconcilePublishedLineNumbers,
  remapVariableDefinitionMetadata,
  variableDefinitionStateForText,
  variableGroupsForOptions,
  type VariableGroup,
  type VariableOption
} from "./variableSelection";
import { exportLooperCsv } from "./csvExport";
import { enableShareableUrlAfterCreate } from "./shareableCloudSheet";
import { LoopPeriodMenu } from "./LoopPeriodMenu";
import { MobileLoopSheet } from "./MobileLoopSheet";
import {
  buildSectionSortLineOrder,
  canSafelySortSection,
  createSectionSortUndoSnapshot,
  nextSectionSortDirection,
  restoreSectionSortSnapshot,
  type SectionSortUndoSnapshot
} from "./sectionSorting";
import {
  contentFontSize,
  defaultContentFontSize,
  nextContentFontScale,
  normalizeContentFontScale,
  type ContentZoomCommand
} from "../../shared/contentZoom";
import {
  resolveDownloadPlatform,
  shouldShowDownloadAppButton
} from "./downloadLinkPreference";
import { sortSheetsByLastModified } from "./librarySorting";
import { shouldEscapeToDocumentLibrary } from "./sheetNavigation";
import {
  defaultDecimalPlacesStorageKey,
  nextApplicationTheme,
  parseDefaultDecimalPlaces,
  parseStartupView,
  startupViewStorageKey,
  type StartupView
} from "./applicationPreferences";
import {
  browserPathForDocument,
  documentIdFromBrowserLocation
} from "./browserNavigation";
import {
  libraryConcepts,
  type LibraryConceptDefinition
} from "./libraryConcepts";
import {
  clampLoopVariablesDrawerHeight,
  clampLoopSidebarWidth,
  defaultLoopVariablesDrawerHeight,
  defaultLoopSidebarWidth,
  legacyLoopSidebarWidthStorageKey,
  loopIndexedSyntaxSegments,
  loopIterationLabel,
  loopSidebarIsVisible,
  loopSidebarMinWidth,
  loopSidebarPublishHintLineIndex,
  loopSidebarShouldAutoCollapse,
  loopSidebarVisibilityStorageKey,
  loopSidebarWidthStorageKey,
  loopVariablesDrawerHeightStorageKey,
  maximumLoopVariablesDrawerHeight,
  maximumLoopSidebarWidth,
  minimumLoopVariablesDrawerHeight,
  parseLoopSidebarVisibilityPreferences,
  storedLoopVariablesDrawerHeight,
  storedLoopSidebarWidth,
  webLoopSidebarWidthStorageKey,
  type LoopSidebarVisibilityPreferences
} from "./loopSidebar";

type AppTheme = "dark" | "light" | "system";
type ResolvedAppTheme = Exclude<AppTheme, "system">;
type HeaderControlSize = "compact" | "comfortable";
type ViewMode = "editor" | "library";
type LibrarySettingsMenuView = "debug" | "root";

const SHOW_LOOP_VARIABLES_DRAWER = false;
const billingPreviewMenuOptions: ReadonlyArray<
  Readonly<{ label: string; mode: BillingPreviewMode }>
> = [
  { label: "Live", mode: "live" },
  { label: "1 of 5 Sheets Unused", mode: "quota-near-limit" },
  { label: "No Sheets Unused", mode: "quota-at-limit" },
  { label: "2 of 55 Sheets Unused", mode: "quota-expanded" }
];

export type AppConfiguration = Readonly<{
  browserHistoryNavigation?: boolean;
  downloadPlatform?: "macos" | "windows";
  editorContentStartsBelowHeader: boolean;
  headerControlSize: HeaderControlSize;
  loopSidebarDefaultViewportRatio?: number;
  mobileWebLayout: boolean;
  openAccountDialogOnLaunch?: boolean;
  publicDemoMode?: boolean;
  sharedSheet?: CloudSheet;
  supportsSystemTheme: boolean;
}>;

type AppProps = {
  configuration?: AppConfiguration;
};

type CloudDocumentMetadata = {
  clientCreatedId: string;
  createdAt: string;
  revision: number;
  shareEnabled: boolean;
  shareToken?: string;
  schemaVersion: 1;
};

type LocalDocumentMetadata = {
  createdAt: string;
  path: string;
  revision: number;
  schemaVersion: 1;
};

type LibraryDocument = {
  cloud?: CloudDocumentMetadata;
  demo?: true;
  local?: LocalDocumentMetadata;
  id: string;
  title: string;
  updatedAt: string;
  path?: string;
  data: LooperDocumentData;
};

type AccountState =
  | { status: "loading" }
  | { status: "anonymous" }
  | { account: AccountSummary; status: "authenticated" }
  | { message: string; status: "unavailable" };

type AccountDialogPurpose = "delete-account" | "sign-in";

type SharedSheetOwnership = "checking" | "owner" | "visitor";

type OwnedSheetIntent = {
  clientCreatedId: string;
  copyShareableUrlAfterCreate?: boolean;
  data: LooperDocumentData;
  path?: string;
  replaceDocumentId?: string;
  requireShareableUrlAfterCreate?: boolean;
  stayInLibrary?: boolean;
  successMessage: string;
};

function previewBillingStatus(mode: BillingPreviewMode): BillingStatus | undefined {
  switch (mode) {
    case "quota-near-limit":
      return quotaBillingStatus(4);
    case "quota-at-limit":
      return quotaBillingStatus(5);
    case "quota-expanded":
      return quotaBillingStatus(53, 55);
    case "live":
      return undefined;
  }
}

type CloudSyncState = "idle" | "saving" | "saved" | "offline" | "error";

type InitialLibraryState = {
  activeDocumentId: string;
  documents: LibraryDocument[];
  gettingStartedTemplateRevisionToPersist?: string;
  initialViewMode: ViewMode;
};

type RowDragState = {
  grabOffsetY: number;
  pointerId: number;
  previewTop: number;
  sourceHeight: number;
  sourceIndex: number;
  targetIndex: number;
};

type LoopSidebarDragState = {
  pointerId: number;
  startX: number;
  startWidth: number;
};

type LoopVariablesDrawerDragState = {
  pointerId: number;
  startHeight: number;
  startY: number;
};

type LoopResultPopoverState = {
  lineNumber: number;
  maxHeight: number;
  right: number;
  top: number;
};

type LoopPeriodSidebarMenuState = {
  loop: number;
  right: number;
  top: number;
};

type LoopVariableSidebarMenuState = {
  left?: number;
  lineNumber?: number;
  name: string;
  right?: number;
  source: "editor" | "sidebar";
  top: number;
  triggerKey: string;
};

type EditorSelection = {
  end: number;
  start: number;
};

type GlobalVariableAutocompleteState = {
  left: number;
  maxHeight: number;
  options: GlobalVariableAutocompleteDefinition[];
  selectedIndex: number;
  token: GlobalVariableAutocompleteToken;
  top: number;
};

const loopPeriodPresets = ["Loop", "Year", "Month", "Week", "Day", "Iteration"] as const;
const decimalPlaceOptions = [0, 1, 2, 3] as const;
const defaultDocumentTitle = "Untitled";
const runtimePlatform = String(window.looper.platform);
const localDeviceLabel =
  runtimePlatform === "win32" ? "this PC" : "this Mac";
const primaryShortcutPrefix =
  runtimePlatform === "darwin" ? "⌘" : "Ctrl+";
const appUpdateProgressCircumference = 2 * Math.PI * 9;
const appUpdatePreviewDurationMs = 2_400;
const appUpdatePreviewCompletionHoldMs = 650;
const themeStorageKey = "looper.theme";
const documentsStorageKey = "looper.documents";
const activeDocumentStorageKey = "looper.activeDocumentId";
const loopResultPopoverGap = 6;
const loopResultPopoverMaxHeight = 336;
const loopResultPopoverViewportInset = 8;
const loopPeriodSidebarMenuGap = 4;
const loopPeriodSidebarMenuBaseHeight = 204;
const loopPeriodSidebarMenuWidth = 164;
const loopPeriodSidebarMenuViewportInset = 8;
const loopVariableSidebarMenuGap = 4;
const loopVariableSidebarMenuHeight = 136;
const loopVariableSidebarMenuWidth = 190;
const loopVariableSidebarMenuViewportInset = 8;
const globalVariableAutocompleteGap = 5;
const globalVariableAutocompleteMaxHeight = 280;
const globalVariableAutocompleteOptionHeight = 42;
const globalVariableAutocompleteViewportInset = 8;
const globalVariableAutocompleteWidth = 286;
const defaultEditorFontSize = defaultContentFontSize;
const defaultEditorRowHeight = 32;
const defaultEditorLeftInset = 48;
const defaultEditorTopSpacing = 2;
const headerContentSpacing = 6;
const defaultStaticResultTrailingSpace = 0;
const defaultLoopSidebarXInset = 16;
const mobileWebLayoutMediaQuery = "(max-width: 767px)";

function importedImageSource(value: string | { src: string }): string {
  return typeof value === "string" ? value : value.src;
}

const looperIconSource = importedImageSource(looperIcon);
const looperSourceUrl = "https://github.com/rorourke/looper";
const looperCreatorUrl = "https://rorkery.com/";

function fileName(path?: string): string {
  if (!path) return "Untitled.loop";
  return path.split("/").at(-1) || path;
}

function displayName(path?: string): string {
  return normalizeDocumentTitle(fileName(path));
}

function cleanDocumentTitle(value: unknown): string {
  const title = typeof value === "string" ? value.trim().replace(/\.loop$/i, "") : "";
  return title;
}

function normalizeDocumentTitle(value: unknown): string {
  return cleanDocumentTitle(value) || defaultDocumentTitle;
}

function nextDuplicateTitle(title: string, documents: LibraryDocument[]): string {
  const existingTitles = new Set(documents.map((document) => document.title.toLocaleLowerCase()));
  const baseTitle = `${normalizeDocumentTitle(title)} copy`;
  if (!existingTitles.has(baseTitle.toLocaleLowerCase())) return baseTitle;

  let copyNumber = 2;
  while (existingTitles.has(`${baseTitle} ${copyNumber}`.toLocaleLowerCase())) {
    copyNumber += 1;
  }
  return `${baseTitle} ${copyNumber}`;
}

function readStoredTheme(supportsSystemTheme: boolean): AppTheme {
  try {
    const storedTheme = window.localStorage.getItem(themeStorageKey);
    if (storedTheme === "dark" || storedTheme === "light") return storedTheme;
    if (supportsSystemTheme && storedTheme === "system") return "system";
    return supportsSystemTheme ? "system" : "dark";
  } catch {
    return supportsSystemTheme ? "system" : "dark";
  }
}

function readStoredDefaultDecimalPlaces(): number {
  try {
    return parseDefaultDecimalPlaces(
      window.localStorage.getItem(defaultDecimalPlacesStorageKey)
    );
  } catch {
    return DEFAULT_DECIMAL_PLACES;
  }
}

function readStoredStartupView(): StartupView {
  try {
    return parseStartupView(
      window.localStorage.getItem(startupViewStorageKey)
    );
  } catch {
    return "last-sheet";
  }
}

function resolveTheme(theme: AppTheme, systemThemeQuery: MediaQueryList): ResolvedAppTheme {
  if (theme !== "system") return theme;
  return systemThemeQuery.matches ? "dark" : "light";
}

function themeName(theme: AppTheme): string {
  return theme.charAt(0).toUpperCase() + theme.slice(1);
}

function createDocumentId(): string {
  return globalThis.crypto.randomUUID();
}

function titleFromDocument(data: LooperDocumentData, path?: string): string {
  return cleanDocumentTitle(data.title) || (path ? displayName(path) : defaultDocumentTitle);
}

function editorRows(target: HTMLElement): HTMLElement[] {
  return Array.from(target.children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement
  );
}

function editorTextFromDom(target: HTMLElement): string {
  return editorRows(target)
    .map((row) => row.textContent ?? "")
    .join("\n");
}

function editorRowClassName(source: string): string {
  return `editor-input-row ${lineUsesFullEditorWidth(source) ? "comment-only" : ""}`.trim();
}

function renderEditorText(target: HTMLElement, text: string): void {
  const fragment = document.createDocumentFragment();
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

  for (const line of lines) {
    const row = document.createElement("div");
    row.className = editorRowClassName(line);
    if (line) {
      row.textContent = line;
    } else {
      row.append(document.createElement("br"));
    }
    fragment.append(row);
  }

  target.replaceChildren(fragment);
}

function syncEditorRowClasses(target: HTMLElement): void {
  for (const row of editorRows(target)) {
    row.className = editorRowClassName(row.textContent ?? "");
  }
}

function editorOffsetForDomPoint(target: HTMLElement, node: Node, nodeOffset: number): number {
  const rows = editorRows(target);

  if (node === target) {
    const childOffset = Math.max(0, Math.min(nodeOffset, rows.length));
    return rows
      .slice(0, childOffset)
      .reduce((offset, row, index) => offset + (row.textContent?.length ?? 0) + (index < rows.length - 1 ? 1 : 0), 0);
  }

  const rowIndex = rows.findIndex((row) => row === node || row.contains(node));
  if (rowIndex < 0) return 0;

  const precedingOffset = rows
    .slice(0, rowIndex)
    .reduce((offset, row) => offset + (row.textContent?.length ?? 0) + 1, 0);
  const range = document.createRange();
  range.selectNodeContents(rows[rowIndex]);

  try {
    range.setEnd(node, nodeOffset);
  } catch {
    return precedingOffset;
  }

  return precedingOffset + range.toString().length;
}

function editorSelection(target: HTMLElement): EditorSelection {
  const selection = window.getSelection();
  if (
    !selection ||
    selection.rangeCount === 0 ||
    !selection.anchorNode ||
    !selection.focusNode ||
    !target.contains(selection.anchorNode) ||
    !target.contains(selection.focusNode)
  ) {
    return { end: 0, start: 0 };
  }

  const anchor = editorOffsetForDomPoint(target, selection.anchorNode, selection.anchorOffset);
  const focus = editorOffsetForDomPoint(target, selection.focusNode, selection.focusOffset);
  return { end: Math.max(anchor, focus), start: Math.min(anchor, focus) };
}

function focusedEditorLineIndex(target: HTMLElement): number | undefined {
  const selection = window.getSelection();
  if (!selection?.focusNode || !target.contains(selection.focusNode)) {
    return undefined;
  }

  const focusOffset = editorOffsetForDomPoint(
    target,
    selection.focusNode,
    selection.focusOffset
  );
  return editorTextFromDom(target).slice(0, focusOffset).split("\n").length - 1;
}

function domPointAtEditorOffset(target: HTMLElement, requestedOffset: number): [Node, number] {
  const rows = editorRows(target);
  if (rows.length === 0) return [target, 0];

  let remaining = Math.max(0, requestedOffset);
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const rowLength = row.textContent?.length ?? 0;
    if (remaining <= rowLength) {
      const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
      let textNode = walker.nextNode();
      let textOffset = remaining;

      while (textNode) {
        const length = textNode.textContent?.length ?? 0;
        if (textOffset <= length) return [textNode, textOffset];
        textOffset -= length;
        textNode = walker.nextNode();
      }

      return [row, 0];
    }

    remaining -= rowLength;
    if (rowIndex < rows.length - 1) remaining = Math.max(0, remaining - 1);
  }

  const finalRow = rows.at(-1) ?? target;
  return [finalRow, finalRow.childNodes.length];
}

function setEditorSelection(target: HTMLElement, start: number, end = start): void {
  const selection = window.getSelection();
  if (!selection) return;

  const [startNode, startOffset] = domPointAtEditorOffset(target, start);
  const [endNode, endOffset] = domPointAtEditorOffset(target, end);
  const range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  selection.removeAllRanges();
  selection.addRange(range);
}

function editorCaretBounds(
  target: HTMLElement,
  offset: number
): { bottom: number; left: number; top: number } | undefined {
  const [node, nodeOffset] = domPointAtEditorOffset(target, offset);
  const range = document.createRange();
  try {
    range.setStart(node, nodeOffset);
    range.collapse(true);
  } catch {
    return undefined;
  }

  let bounds = range.getBoundingClientRect();
  if (bounds.height <= 0 && node.nodeType === Node.TEXT_NODE && nodeOffset > 0) {
    try {
      range.setStart(node, nodeOffset - 1);
      range.setEnd(node, nodeOffset);
      const previousCharacterBounds = range.getBoundingClientRect();
      if (previousCharacterBounds.height > 0) {
        return {
          bottom: previousCharacterBounds.bottom,
          left: previousCharacterBounds.right,
          top: previousCharacterBounds.top
        };
      }
    } catch {
      return undefined;
    }
  }

  if (bounds.height <= 0) {
    const row = node instanceof HTMLElement
      ? node.closest(".editor-input-row")
      : node.parentElement?.closest(".editor-input-row");
    if (!(row instanceof HTMLElement)) return undefined;
    bounds = row.getBoundingClientRect();
  }

  return { bottom: bounds.bottom, left: bounds.left, top: bounds.top };
}

function anchorEditorSelectionToRows(target: HTMLElement, fallbackToStart = false): void {
  const selection = window.getSelection();
  if (
    !selection ||
    selection.rangeCount === 0 ||
    !selection.anchorNode ||
    !selection.focusNode ||
    !target.contains(selection.anchorNode) ||
    !target.contains(selection.focusNode)
  ) {
    if (fallbackToStart) setEditorSelection(target, 0);
    return;
  }

  if (selection.anchorNode !== target && selection.focusNode !== target) return;

  const { end, start } = editorSelection(target);
  setEditorSelection(target, start, end);
}

function documentLineDetail(data: LooperDocumentData): string {
  const lines = data.text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n");

  while (lines.length > 1 && lines.at(-1)?.trim() === "") {
    lines.pop();
  }

  return `${lines.length}-line sheet`;
}

function documentActivityDetail(updatedAt: string): string {
  const activityDate = new Date(updatedAt);
  if (Number.isNaN(activityDate.getTime())) return "Last active recently";

  return `Last edited ${activityDate.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short"
  })}`;
}

function refreshLibraryDocument(document: LibraryDocument): LibraryDocument {
  const title = normalizeDocumentTitle(document.data.title);
  return {
    ...document,
    title,
    data: {
      ...document.data,
      title
    },
    updatedAt: new Date().toISOString()
  };
}

function createLibraryDocument(data = createInitialDocument(), path?: string): LibraryDocument {
  const title = cleanDocumentTitle(data.title) || (path ? displayName(path) : defaultDocumentTitle);
  return refreshLibraryDocument({
    id: createDocumentId(),
    title,
    updatedAt: new Date().toISOString(),
    path,
    data: {
      ...data,
      title
    }
  });
}

function createDemoLibraryDocument(intent: OwnedSheetIntent): LibraryDocument {
  const title = normalizeDocumentTitle(intent.data.title);
  return refreshLibraryDocument({
    data: { ...intent.data, title },
    demo: true,
    id: intent.clientCreatedId,
    path: intent.path,
    title,
    updatedAt: new Date().toISOString()
  });
}

function cloudDocumentFingerprint(document: LibraryDocument): string {
  return JSON.stringify({
    data: document.data,
    title: document.title
  });
}

function isCloudConnectionError(error: unknown): boolean {
  if (navigator.onLine === false) return true;
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return [
    "check your connection",
    "cloud request failed",
    "fetch failed",
    "network",
    "offline",
    "timed out",
    "temporarily unavailable"
  ].some((fragment) => message.includes(fragment));
}

function isCloudRevisionConflict(error: unknown): boolean {
  if (typeof error === "object" && error !== null) {
    const record = error as { apiCode?: unknown; status?: unknown };
    if (record.status === 409 || record.apiCode === "revision_conflict") return true;
  }
  return error instanceof Error &&
    error.message.toLowerCase().includes("changed on another device");
}

function localDocumentFingerprint(document: LibraryDocument): string {
  return JSON.stringify({
    data: document.data,
    title: document.title
  });
}

function cloudDraftFingerprint(document: LibraryDocument): string | undefined {
  if (!document.cloud) return undefined;
  return JSON.stringify({
    data: document.data,
    expectedRevision: document.cloud.revision,
    title: document.title
  });
}

function storedCloudDraftFingerprint(draft: CloudSheetDraft): string {
  const data = normalizeDocumentData(draft.document);
  const title = normalizeDocumentTitle(draft.title || data.title);
  return JSON.stringify({
    data: { ...data, title },
    expectedRevision: draft.expectedRevision,
    title
  });
}

function applyCloudDraft(
  document: LibraryDocument,
  draft: CloudSheetDraft
): LibraryDocument | undefined {
  if (
    !document.cloud ||
    draft.sheetId !== document.id ||
    draft.schemaVersion !== 1 ||
    !Number.isSafeInteger(draft.expectedRevision) ||
    draft.expectedRevision < 1 ||
    draft.expectedRevision > document.cloud.revision
  ) {
    return undefined;
  }

  const data = normalizeDocumentData(draft.document);
  const title = normalizeDocumentTitle(draft.title || data.title);
  return {
    ...document,
    data: { ...data, title },
    title,
    updatedAt: draft.savedAt
  };
}

function cloudSheetToLibraryDocument(value: unknown, path?: string): LibraryDocument | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    typeof record.clientCreatedId !== "string" ||
    typeof record.title !== "string" ||
    typeof record.createdAt !== "string" ||
    typeof record.updatedAt !== "string" ||
    typeof record.shareEnabled !== "boolean" ||
    (record.shareToken !== undefined &&
      (typeof record.shareToken !== "string" ||
        !/^[0-9a-f]{64}$/.test(record.shareToken))) ||
    (record.shareEnabled && record.shareToken === undefined) ||
    record.schemaVersion !== 1 ||
    typeof record.revision !== "number" ||
    !Number.isSafeInteger(record.revision) ||
    record.revision < 1
  ) {
    return undefined;
  }

  const data = normalizeDocumentData(record.document);
  const title = normalizeDocumentTitle(record.title || data.title);
  return {
    cloud: {
      clientCreatedId: record.clientCreatedId,
      createdAt: record.createdAt,
      revision: record.revision,
      shareEnabled: record.shareEnabled,
      ...(record.shareToken === undefined ? {} : { shareToken: record.shareToken }),
      schemaVersion: 1
    },
    data: { ...data, title },
    id: record.id,
    path,
    title,
    updatedAt: record.updatedAt
  };
}

function localSheetToLibraryDocument(value: unknown): LibraryDocument | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    typeof record.title !== "string" ||
    typeof record.path !== "string" ||
    typeof record.createdAt !== "string" ||
    typeof record.updatedAt !== "string" ||
    record.schemaVersion !== 1 ||
    typeof record.revision !== "number" ||
    !Number.isSafeInteger(record.revision) ||
    record.revision < 1
  ) {
    return undefined;
  }

  const data = normalizeDocumentData(record.document);
  const title = normalizeDocumentTitle(record.title || data.title);
  return {
    data: { ...data, title },
    id: record.id,
    local: {
      createdAt: record.createdAt,
      path: record.path,
      revision: record.revision,
      schemaVersion: 1
    },
    title,
    updatedAt: record.updatedAt
  };
}

function normalizeLibraryDocument(value: unknown): LibraryDocument | undefined {
  if (typeof value !== "object" || value === null || !("id" in value) || !("data" in value)) {
    return undefined;
  }

  const record = value as Partial<LibraryDocument>;
  if (typeof record.id !== "string" || record.id.length === 0) return undefined;

  const data = normalizeDocumentData(record.data);
  const title = normalizeDocumentTitle(record.title || titleFromDocument(data, record.path));
  const local =
    record.local &&
    typeof record.local.path === "string" &&
    typeof record.local.createdAt === "string" &&
    record.local.schemaVersion === 1 &&
    typeof record.local.revision === "number" &&
    Number.isSafeInteger(record.local.revision) &&
    record.local.revision > 0
      ? record.local
      : undefined;
  return {
    id: record.id,
    ...(local ? { local } : {}),
    title,
    updatedAt: record.updatedAt || new Date().toISOString(),
    path: typeof record.path === "string" ? record.path : undefined,
    data: {
      ...data,
      title
    }
  };
}

function upgradeGettingStartedExampleLibraryDocument(
  document: LibraryDocument,
  storedTemplateRevision: string | null
): LibraryDocument {
  if (
    !isPristinePreviousGettingStartedExampleDocument(
      document,
      storedTemplateRevision
    )
  ) {
    return document;
  }

  const latestDocument = createGettingStartedDocuments().find(
    (candidate) => candidate.id === document.id
  );
  if (!latestDocument) return document;

  return {
    ...document,
    title: latestDocument.title,
    updatedAt: latestDocument.updatedAt,
    data: latestDocument.data
  };
}

function restoreBundledExampleDocuments(
  documents: readonly LibraryDocument[]
): LibraryDocument[] {
  return restoreGettingStartedExampleDocuments<LibraryDocument>(
    documents,
    createGettingStartedDocuments()
  );
}

function readInitialLibraryState(
  sharedSheet?: CloudSheet,
  startupView: StartupView = "last-sheet",
  publicDemoMode = false
): InitialLibraryState {
  if (sharedSheet) {
    const sharedDocument = cloudSheetToLibraryDocument(sharedSheet);
    if (sharedDocument) {
      return {
        activeDocumentId: sharedDocument.id,
        documents: [sharedDocument],
        initialViewMode: "editor"
      };
    }
  }

  if (publicDemoMode) {
    const documents = createGettingStartedDocuments();
    return {
      activeDocumentId: documents[0]?.id ?? "",
      documents,
      initialViewMode: "library"
    };
  }

  let storedTemplateRevision: string | null = null;
  let rawDocuments: string | null = null;
  let storedActiveDocumentId = "";
  try {
    storedTemplateRevision = window.localStorage.getItem(
      GETTING_STARTED_TEMPLATE_REVISION_STORAGE_KEY
    );
    rawDocuments = window.localStorage.getItem(documentsStorageKey);
    storedActiveDocumentId = window.localStorage.getItem(activeDocumentStorageKey) ?? "";
  } catch {
    // Treat unavailable local storage like a fresh, in-memory launch.
  }

  let storedDocuments: LibraryDocument[] = [];
  if (rawDocuments) {
    try {
      const parsedDocuments = JSON.parse(rawDocuments);
      storedDocuments = Array.isArray(parsedDocuments)
        ? parsedDocuments
            .map((item) => normalizeLibraryDocument(item))
            .filter((item): item is LibraryDocument => Boolean(item))
        : [];
    } catch {
      // A malformed document payload should not prevent the bundled examples from loading.
    }
  }

  const isFreshInstall = rawDocuments === null && storedTemplateRevision === null;
  const seedResult = seedGettingStartedDocuments<LibraryDocument>(
    storedDocuments,
    storedTemplateRevision,
    createGettingStartedDocuments,
    isPristineLegacyGettingStartedDocument,
    upgradeGettingStartedExampleLibraryDocument
  );
  const documents = restoreBundledExampleDocuments(seedResult.documents);
  const removedActiveLegacyDocument =
    seedResult.removedLegacyDocument &&
    storedActiveDocumentId === LEGACY_GETTING_STARTED_DOCUMENT_ID;
  const fallbackActiveDocumentId = removedActiveLegacyDocument
    ? seedResult.preferredActiveDocumentId ?? documents[0]?.id ?? ""
    : documents[0]?.id ?? "";
  const activeDocumentId = documents.some(
    (document) => document.id === storedActiveDocumentId
  )
    ? storedActiveDocumentId
    : fallbackActiveDocumentId;

  return {
    activeDocumentId,
    documents,
    gettingStartedTemplateRevisionToPersist: seedResult.templateRevisionToPersist,
    initialViewMode:
      startupView === "library" ||
      isFreshInstall ||
      removedActiveLegacyDocument ||
      !activeDocumentId ||
      isGettingStartedExampleDocumentId(activeDocumentId)
        ? "library"
        : "editor"
  };
}

function formatEvaluation(
  evaluation?: LineEvaluation,
  isLoading = false
): ReactNode {
  if (isLoading) {
    return <span aria-hidden="true" className="result-spinner" />;
  }

  return formatResultText(evaluation);
}

function resultClassName(
  evaluation?: LineEvaluation,
  baseClass = "result-value",
  isLoading = false
): string {
  const classNames = [baseClass];

  if (isLoading) {
    classNames.push("loading");
    return classNames.join(" ");
  }

  if (!evaluation || evaluation.status === "empty" || evaluation.status === "title") {
    classNames.push("empty");
    return classNames.join(" ");
  }

  if (evaluation.status === "error") {
    classNames.push("error");
    return classNames.join(" ");
  }

  classNames.push(evaluation.value?.isLooped ? "looped" : "number");
  return classNames.join(" ");
}

function resultLineLabel(line: ParsedLine): string {
  if (line.kind !== "equation") return "";
  return line.variable ?? line.expression;
}

function clampLineIndex(index: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, index));
}

function clampNumber(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

type InitialLoopSidebarWidth = {
  isCustom: boolean;
  width: number;
};

function readInitialLoopSidebarWidth(
  defaultViewportRatio?: number
): InitialLoopSidebarWidth {
  try {
    if (defaultViewportRatio !== undefined) {
      const storedWidth = Number.parseFloat(
        window.localStorage.getItem(webLoopSidebarWidthStorageKey) ?? ""
      );
      return Number.isFinite(storedWidth)
        ? {
            isCustom: true,
            width: clampLoopSidebarWidth(storedWidth, window.innerWidth)
          }
        : {
            isCustom: false,
            width: defaultLoopSidebarWidth(window.innerWidth, defaultViewportRatio)
          };
    }

    return {
      isCustom: true,
      width: storedLoopSidebarWidth(
        window.localStorage.getItem(loopSidebarWidthStorageKey),
        window.localStorage.getItem(legacyLoopSidebarWidthStorageKey),
        window.innerWidth
      )
    };
  } catch {
    return {
      isCustom: false,
      width: defaultLoopSidebarWidth(window.innerWidth, defaultViewportRatio)
    };
  }
}

function readStoredLoopVariablesDrawerHeight(mobileWebLayout = false): number {
  try {
    return storedLoopVariablesDrawerHeight(
      window.localStorage.getItem(loopVariablesDrawerHeightStorageKey),
      window.innerHeight,
      mobileWebLayout
    );
  } catch {
    return defaultLoopVariablesDrawerHeight(window.innerHeight, mobileWebLayout);
  }
}

function hasStoredLoopVariablesDrawerHeight(): boolean {
  try {
    const storedHeight = Number.parseFloat(
      window.localStorage.getItem(loopVariablesDrawerHeightStorageKey) ?? ""
    );
    return Number.isFinite(storedHeight);
  } catch {
    return false;
  }
}

function readStoredLoopSidebarVisibility(): LoopSidebarVisibilityPreferences {
  try {
    return parseLoopSidebarVisibilityPreferences(
      window.localStorage.getItem(loopSidebarVisibilityStorageKey)
    );
  } catch {
    return {};
  }
}

function buildMovedLineOrder(lineCount: number, sourceIndex: number, targetIndex: number): number[] {
  const lineOrder = Array.from({ length: lineCount }, (_, index) => index);
  const [movedLine] = lineOrder.splice(sourceIndex, 1);
  lineOrder.splice(targetIndex, 0, movedLine);
  return lineOrder;
}

function rowDragRowClassName(rowDrag: RowDragState | undefined, rowIndex: number): string {
  if (!rowDrag) return "";
  if (rowDrag.sourceIndex === rowIndex) return "row-drag-source";

  const shiftDirection = rowDragShiftDirection(
    rowDrag.sourceIndex,
    rowDrag.targetIndex,
    rowIndex
  );
  return shiftDirection ? `row-drag-shift-${shiftDirection}` : "";
}

function indexMapFromLineOrder(lineOrder: number[]): Map<number, number> {
  return new Map(lineOrder.map((oldIndex, newIndex) => [oldIndex, newIndex]));
}

function remapLineNumbers(lineNumbers: number[], indexMap: Map<number, number>): number[] {
  return Array.from(
    new Set(
      lineNumbers
        .map((lineNumber) => indexMap.get(lineNumber))
        .filter((lineNumber): lineNumber is number => typeof lineNumber === "number")
    )
  ).sort((a, b) => a - b);
}

type GlobalReferenceTarget = {
  definition: GlobalVariableDefinition;
  title: string;
};

function highlightLine(
  source: string,
  line: ParsedLine | undefined,
  lineNumber: number,
  context: SyntaxHighlightContext,
  globalReferenceTarget?: (name: string) => GlobalReferenceTarget | undefined,
  onGlobalReference?: (definition: GlobalVariableDefinition) => void,
  displayLoopIndex?: number
): ReactNode {
  const sourceSegments = highlightLineSegments(source, line, lineNumber, context);
  const displaySegments = displayLoopIndex === undefined
    ? sourceSegments
    : loopIndexedSyntaxSegments(sourceSegments, displayLoopIndex);

  return displaySegments.map((segment, index) => {
    const reference = segment.globalName
      ? globalReferenceTarget?.(segment.globalName)
      : undefined;
    const redefinitionError = segment.globalName && line?.parseError?.startsWith(
      "Cannot redefine a global variable"
    )
      ? line.parseError
      : undefined;
    const isInteractive = reference !== undefined;
    return (
      <span
        className={[
          segment.className,
          reference ? "global-reference" : ""
        ]
          .filter(Boolean)
          .join(" ") || undefined}
        key={`line-${lineNumber}-syntax-${index}`}
        onClick={reference ? () => onGlobalReference?.(reference.definition) : undefined}
        onPointerDown={isInteractive
          ? (event) => {
              event.preventDefault();
              event.stopPropagation();
            }
          : undefined}
        title={
          redefinitionError ?? reference?.title
        }
      >
        {segment.text}
      </span>
    );
  });
}

type UiIconProps = {
  className?: string;
  icon: LucideIcon;
};

function UiIcon({ className = "", icon: Icon }: UiIconProps): ReactElement {
  return (
    <Icon
      aria-hidden="true"
      className={`ui-icon ${className}`.trim()}
      focusable="false"
      strokeWidth={2}
    />
  );
}

type DocumentCardPreviewProps = {
  data: LooperDocumentData;
};

function DocumentCardPreview({ data }: DocumentCardPreviewProps): ReactElement {
  const preview = useMemo(() => {
    const text = data.text;
    const evaluation = evaluateLooperText(
      text,
      data.loopCount,
      {},
      data.decimalPlaces
    );
    const context = buildSyntaxHighlightContext(text, evaluation);
    const sourceLines = text
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n")
      .slice(0, 18);

    return { context, evaluation, sourceLines };
  }, [data.decimalPlaces, data.loopCount, data.text]);

  return (
    <div className="document-card-preview" aria-hidden="true">
      {preview.sourceLines.map((source, lineNumber) => (
        <div className="document-card-preview-line" key={`preview-${lineNumber}`}>
          {highlightLine(
            source,
            preview.evaluation.lines[lineNumber],
            lineNumber,
            preview.context
          )}
        </div>
      ))}
    </div>
  );
}

type MobileMarketingConceptProps = {
  concept: LibraryConceptDefinition;
};

function MobileMarketingConcept({
  concept
}: MobileMarketingConceptProps): ReactElement {
  const preview = useMemo(() => {
    const evaluation = evaluateLooperText(
      concept.source,
      concept.loopCount,
      concept.stockQuotes
    );
    return {
      context: buildSyntaxHighlightContext(concept.source, evaluation),
      evaluation,
      sourceLines: concept.source.split("\n")
    };
  }, [concept]);

  return (
    <article className="mobile-marketing-concept">
      <header>
        <h3>{concept.title}</h3>
        <p>{concept.description}</p>
      </header>
      <div className="mobile-marketing-concept-code">
        {preview.sourceLines.map((source, lineNumber) => {
          const line = preview.evaluation.lines[lineNumber];
          const item = line?.evaluations[concept.loopCount];
          const isLooped =
            item?.status === "success" && Boolean(item.value?.isLooped);

          return (
            <div
              className="mobile-marketing-concept-row"
              key={`${concept.id}-${lineNumber}`}
            >
              <code className="mobile-marketing-concept-source">
                {highlightLine(
                  source,
                  line,
                  lineNumber,
                  preview.context
                )}
              </code>
              <output
                className={`mobile-marketing-concept-result ${
                  isLooped ? "looped" : ""
                }`}
              >
                {formatResultText(item)}
              </output>
            </div>
          );
        })}
      </div>
    </article>
  );
}

type MobileMarketingLibraryProps = {
  downloadHref: string;
  iconSource: string;
};

function MobileMarketingLibrary({
  downloadHref,
  iconSource
}: MobileMarketingLibraryProps): ReactElement {
  return (
    <div className="mobile-marketing-library">
      <section className="mobile-marketing-intro">
        <img
          alt=""
          className="mobile-marketing-icon"
          draggable={false}
          src={iconSource}
        />
        <h1>
          <strong>Looper</strong>
          <span>{" is an open source desktop notebook calculator. It uses the magic word "}</span>
          <span className="mobile-marketing-loop">loop</span>
          <span>{" to manipulate calculations over time."}</span>
        </h1>
        <div className="mobile-marketing-actions">
          <a
            className="mobile-marketing-action mobile-marketing-download"
            href={downloadHref}
          >
            <UiIcon icon={Download} />
            <span>Get Mac App</span>
          </a>
          <a
            className="mobile-marketing-action mobile-marketing-source"
            href={looperSourceUrl}
            rel="noreferrer"
            target="_blank"
          >
            <UiIcon icon={Code2} />
            <span>View Source</span>
          </a>
        </div>
      </section>

      <section
        aria-label="Looper examples"
        className="mobile-marketing-concepts"
      >
        <div className="mobile-marketing-concept-list">
          {libraryConcepts.map((concept) => (
            <MobileMarketingConcept concept={concept} key={concept.id} />
          ))}
        </div>
      </section>
    </div>
  );
}

function PublicWebsiteFooter(): ReactElement {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="public-website-footer">
      <div className="public-website-footer-content">
        <span>© {currentYear}</span>
        <a href={looperCreatorUrl} rel="noreferrer" target="_blank">
          Ryan Rorke
        </a>
        <span aria-hidden="true">·</span>
        <a href={looperSourceUrl} rel="noreferrer" target="_blank">
          View source
        </a>
      </div>
    </footer>
  );
}

type LibraryDocumentCardProps = {
  active: boolean;
  actionsHidden?: boolean;
  displayTitle?: string;
  document: LibraryDocument;
  menuOpen: boolean;
  onDelete: (document: LibraryDocument) => void;
  onDuplicate: (document: LibraryDocument) => void;
  onExport: (document: LibraryDocument) => void;
  onMenuClose: () => void;
  onMenuOpen: (id: string) => void;
  onRename: (document: LibraryDocument, title: string) => void;
  onSelect: (id: string) => void;
  onToggleSelection: (id: string) => void;
  selected: boolean;
};

function LibraryDocumentCard({
  active,
  actionsHidden = false,
  displayTitle,
  document,
  menuOpen,
  onDelete,
  onDuplicate,
  onExport,
  onMenuClose,
  onMenuOpen,
  onRename,
  onSelect,
  onToggleSelection,
  selected
}: LibraryDocumentCardProps): ReactElement {
  const isBundledExample = isGettingStartedExampleDocumentId(document.id);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(document.title);
  const menuControlRef = useRef<HTMLDivElement>(null);
  const renameFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!menuOpen) {
      setIsRenaming(false);
      setRenameValue(document.title);
      return;
    }

    const handlePointerDown = (event: globalThis.PointerEvent): void => {
      const target = event.target;
      if (target instanceof Node && menuControlRef.current?.contains(target)) return;
      onMenuClose();
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [document.title, menuOpen, onMenuClose]);

  useEffect(() => {
    if (!isRenaming) return;
    renameFieldRef.current?.focus();
    renameFieldRef.current?.select();
  }, [isRenaming]);

  return (
    <article className={`document-card ${active ? "active" : ""} ${selected ? "selected" : ""} ${menuOpen && !actionsHidden ? "menu-open" : ""}`}>
      <button
        aria-current={active ? "page" : undefined}
        aria-pressed={actionsHidden ? undefined : selected}
        className="document-card-open"
        onClick={(event: ReactMouseEvent<HTMLButtonElement>) => {
          if (!actionsHidden && (event.metaKey || event.ctrlKey)) {
            onToggleSelection(document.id);
            return;
          }
          onSelect(document.id);
        }}
        type="button"
      >
        <DocumentCardPreview data={document.data} />
        <div className="document-card-meta">
          <span className="document-card-title">{displayTitle ?? document.title}</span>
          <span className="document-card-detail">
            {documentLineDetail(document.data)}
            {document.cloud || document.demo || isBundledExample
              ? ""
              : ` · On ${localDeviceLabel}`}
          </span>
        </div>
      </button>

      {!actionsHidden ? (
        <div className="library-card-menu-control" ref={menuControlRef}>
        <button
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          aria-label={`Options for ${document.title}`}
          className={`library-card-menu-button ${menuOpen ? "active" : ""}`}
          onClick={() => {
            if (menuOpen) {
              onMenuClose();
            } else {
              onMenuOpen(document.id);
            }
          }}
          title="Sheet options"
          type="button"
        >
          <UiIcon icon={Ellipsis} />
        </button>

        {menuOpen ? (
          isRenaming ? (
            <form
              aria-label={`Rename ${document.title}`}
              className="document-menu document-rename-form library-card-menu"
              onSubmit={(event) => {
                event.preventDefault();
                onRename(document, renameValue);
                onMenuClose();
              }}
              role="dialog"
            >
              <label htmlFor={`library-card-rename-${document.id}`}>Rename sheet</label>
              <input
                id={`library-card-rename-${document.id}`}
                onChange={(event) => setRenameValue(event.currentTarget.value)}
                ref={renameFieldRef}
                spellCheck={false}
                value={renameValue}
              />
              <div className="document-rename-actions">
                <button onClick={() => setIsRenaming(false)} type="button">
                  Cancel
                </button>
                <button className="primary" disabled={!renameValue.trim()} type="submit">
                  Rename
                </button>
              </div>
            </form>
          ) : (
            <div className="document-menu library-card-menu" role="menu" aria-label={`${document.title} options`}>
              {!isBundledExample ? (
                <button
                  className="document-menu-item"
                  onClick={() => {
                    setRenameValue(document.title);
                    setIsRenaming(true);
                  }}
                  role="menuitem"
                  type="button"
                >
                  <span>Rename</span>
                </button>
              ) : null}
              <button
                className="document-menu-item"
                onClick={() => {
                  onMenuClose();
                  onDuplicate(document);
                }}
                role="menuitem"
                type="button"
              >
                <span>Duplicate</span>
              </button>
              <button
                className="document-menu-item"
                onClick={() => {
                  onMenuClose();
                  onExport(document);
                }}
                role="menuitem"
                type="button"
              >
                <span>Export CSV</span>
              </button>
              {!isBundledExample ? (
                <>
                  <div className="document-menu-separator" role="separator" />
                  <button
                    className="document-menu-item danger"
                    onClick={() => {
                      onMenuClose();
                      onDelete(document);
                    }}
                    role="menuitem"
                    type="button"
                  >
                    <span>Delete</span>
                  </button>
                </>
              ) : null}
            </div>
          )
        ) : null}
        </div>
      ) : null}
    </article>
  );
}

type TitlebarIconButtonProps = {
  active?: boolean;
  children: ReactNode;
  className?: string;
  label: string;
  onClick: () => void;
};

function TitlebarIconButton({
  active,
  children,
  className,
  label,
  onClick
}: TitlebarIconButtonProps): ReactElement {
  return (
    <button
      aria-label={label}
      aria-pressed={active}
      className={`icon-button titlebar-icon-button ${className ?? ""} ${
        active ? "active" : ""
      }`}
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}

type LoopVariablesDrawerProps = {
  availableCount: number;
  drawerHeight: number;
  groups: readonly VariableGroup[];
  isLoopPublished: boolean;
  loopedLines: readonly number[];
  maximumHeight: number;
  minimumHeight: number;
  onResizeCancel: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onResizeFinish: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onResizeKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
  onResizeMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onResizeStart: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
  onToggle: () => void;
  onToggleGroup: (group: VariableGroup) => void;
  onToggleLine: (lineNumber: number, variableName: string) => void;
  onToggleLoop: () => void;
  open: boolean;
  visibleCount: number;
};

function LoopVariablesDrawer({
  availableCount,
  drawerHeight,
  groups,
  isLoopPublished,
  loopedLines,
  maximumHeight,
  minimumHeight,
  onResizeCancel,
  onResizeFinish,
  onResizeKeyDown,
  onResizeMove,
  onResizeStart,
  onSelectAll,
  onSelectNone,
  onToggle,
  onToggleGroup,
  onToggleLine,
  onToggleLoop,
  open,
  visibleCount
}: LoopVariablesDrawerProps): ReactElement {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() =>
    new Set(groups.filter((group) => group.definitions.length > 1).map((group) => group.key))
  );

  const toggleGroupExpansion = (key: string): void => {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className={`loop-sidebar-footer-controls ${open ? "expanded" : ""}`}>
      <div
        aria-hidden={!open}
        aria-label="Resize Variables section"
        aria-orientation="horizontal"
        aria-valuemax={maximumHeight}
        aria-valuemin={minimumHeight}
        aria-valuenow={drawerHeight}
        className="loop-sidebar-variables-resize-handle"
        onKeyDown={onResizeKeyDown}
        onPointerCancel={onResizeCancel}
        onPointerDown={onResizeStart}
        onPointerMove={onResizeMove}
        onPointerUp={onResizeFinish}
        role="separator"
        tabIndex={open ? 0 : -1}
        title="Drag to resize Variables"
      />
      <div className="loop-sidebar-variables-header">
        <button
          aria-controls="loop-sidebar-variables-list"
          aria-expanded={open}
          aria-label={`Variables, ${visibleCount} of ${availableCount} shown`}
          className="loop-sidebar-variables-toggle"
          onClick={onToggle}
          type="button"
        >
          <span className="loop-sidebar-variables-title">Variables</span>
          <span className="loop-sidebar-variables-count" aria-hidden="true">
            {visibleCount} of {availableCount}
          </span>
          <UiIcon className="loop-sidebar-variables-chevron" icon={ChevronDown} />
        </button>
        {open ? (
          <div
            aria-label="Variable visibility shortcuts"
            className="loop-sidebar-variables-actions"
          >
            <button
              className="loop-sidebar-variables-action"
              disabled={visibleCount === availableCount}
              onClick={onSelectAll}
              title="Show all variables"
              type="button"
            >
              <span className="loop-sidebar-variables-action-pill">All</span>
            </button>
            <button
              className="loop-sidebar-variables-action"
              disabled={visibleCount === 0}
              onClick={onSelectNone}
              title="Hide all variables"
              type="button"
            >
              <span className="loop-sidebar-variables-action-pill">None</span>
            </button>
          </div>
        ) : null}
      </div>
      <div
        aria-hidden={!open}
        className="loop-sidebar-variables-panel"
        id="loop-sidebar-variables-list"
      >
        <div
          aria-label="Choose variables shown in the loop sidebar"
          className="loop-sidebar-variables-list"
          role="group"
        >
          <button
            aria-checked={isLoopPublished}
            className={`loop-sidebar-variable-option loop-identity ${
              isLoopPublished ? "selected" : ""
            }`}
            onClick={onToggleLoop}
            role="checkbox"
            title={`${isLoopPublished ? "Hide" : "Show"} loop in the sidebar`}
            type="button"
          >
            <span className="loop-sidebar-variable-name">loop</span>
            <span className="loop-sidebar-variable-checkbox" aria-hidden="true">
              {isLoopPublished ? <UiIcon icon={Check} /> : null}
            </span>
          </button>
          {groups.map((group) => {
            if (group.definitions.length === 1) {
              const variable = group.definitions[0];
              const isLooped = loopedLines.includes(variable.lineNumber);
              return (
                <button
                  aria-checked={isLooped}
                  className={`loop-sidebar-variable-option ${isLooped ? "selected" : ""}`}
                  key={`variable-option-${variable.id}`}
                  onClick={() => onToggleLine(variable.lineNumber, variable.name)}
                  role="checkbox"
                  title={`${isLooped ? "Hide" : "Show"} ${variable.name} in the sidebar`}
                  type="button"
                >
                  <span
                    className={`loop-sidebar-variable-name ${variable.name.startsWith("@") ? "syntax-global-variable" : ""}`}
                  >
                    {variable.name}
                  </span>
                  <span className="loop-sidebar-variable-checkbox" aria-hidden="true">
                    {isLooped ? <UiIcon icon={Check} /> : null}
                  </span>
                </button>
              );
            }

            const selectedCount = group.definitions.filter((definition) =>
              loopedLines.includes(definition.lineNumber)
            ).length;
            const allSelected = selectedCount === group.definitions.length;
            const isExpanded = expandedGroups.has(group.key);
            return (
              <div
                className={`loop-sidebar-variable-group ${isExpanded ? "expanded" : ""}`}
                key={`variable-group-${group.key}`}
                role="group"
              >
                <div className="loop-sidebar-variable-group-row">
                  <button
                    aria-expanded={isExpanded}
                    className="loop-sidebar-variable-group-disclosure"
                    onClick={() => toggleGroupExpansion(group.key)}
                    title={`${group.definitions.length} definitions of ${group.name}`}
                    type="button"
                  >
                    <UiIcon
                      className="loop-sidebar-variable-group-chevron"
                      icon={ChevronDown}
                    />
                    <span className="loop-sidebar-variable-group-name">{group.name}</span>
                    <span className="loop-sidebar-variable-group-badge">
                      {group.definitions.length} definitions
                    </span>
                  </button>
                  <button
                    aria-checked={allSelected ? true : selectedCount > 0 ? "mixed" : false}
                    aria-label={`${allSelected ? "Hide" : "Show"} all ${group.name} definitions`}
                    className="loop-sidebar-variable-group-checkbox"
                    onClick={() => onToggleGroup(group)}
                    role="checkbox"
                    type="button"
                  >
                    {allSelected ? (
                      <UiIcon icon={Check} />
                    ) : selectedCount > 0 ? (
                      <UiIcon icon={Minus} />
                    ) : null}
                  </button>
                </div>
                {isExpanded ? (
                  <div className="loop-sidebar-variable-definitions">
                    {group.definitions.map((definition) => {
                      const isLooped = loopedLines.includes(definition.lineNumber);
                      const context = definition.qualifier ?? `#${definition.occurrence}`;
                      return (
                        <button
                          aria-checked={isLooped}
                          className={`loop-sidebar-variable-definition ${isLooped ? "selected" : ""}`}
                          key={`variable-definition-${definition.id}`}
                          onClick={() => onToggleLine(definition.lineNumber, definition.name)}
                          role="checkbox"
                          title={`${isLooped ? "Hide" : "Show"} ${definition.name} · ${context} in the sidebar`}
                          type="button"
                        >
                          <span className="loop-sidebar-variable-definition-context">
                            {context}
                          </span>
                          <span className="loop-sidebar-variable-definition-detail">
                            {definition.isRedefinition ? "redefinition" : "original"} · line {definition.lineNumber}
                          </span>
                          <span className="loop-sidebar-variable-checkbox" aria-hidden="true">
                            {isLooped ? <UiIcon icon={Check} /> : null}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function App({ configuration }: AppProps = {}): ReactElement {
  const browserHistoryNavigationEnabled =
    configuration?.browserHistoryNavigation === true &&
    window.looper.platform === "web";
  const editorContentStartsBelowHeader =
    configuration?.editorContentStartsBelowHeader ?? false;
  const headerControlSize = configuration?.headerControlSize ?? "compact";
  const loopSidebarDefaultViewportRatio =
    typeof configuration?.loopSidebarDefaultViewportRatio === "number" &&
    Number.isFinite(configuration.loopSidebarDefaultViewportRatio) &&
    configuration.loopSidebarDefaultViewportRatio > 0
      ? configuration.loopSidebarDefaultViewportRatio
      : undefined;
  const mobileWebLayoutEnabled = configuration?.mobileWebLayout ?? false;
  const openAccountDialogOnLaunch =
    configuration?.openAccountDialogOnLaunch === true;
  const publicDemoMode =
    configuration?.publicDemoMode === true &&
    window.looper.platform === "web" &&
    configuration?.sharedSheet === undefined;
  const initialMobileWebLayout =
    mobileWebLayoutEnabled && window.matchMedia(mobileWebLayoutMediaQuery).matches;
  const supportsSystemTheme = configuration?.supportsSystemTheme ?? false;
  const sharedSheet = configuration?.sharedSheet;
  const isSharedAccess = sharedSheet !== undefined;
  const localOnlyMode = true;
  const [defaultDecimalPlaces, setDefaultDecimalPlaces] = useState(
    readStoredDefaultDecimalPlaces
  );
  const [startupView, setStartupView] = useState<StartupView>(
    readStoredStartupView
  );
  const [initialLibraryState] = useState<InitialLibraryState>(() => {
    const initialState = readInitialLibraryState(
      sharedSheet,
      startupView,
      publicDemoMode
    );
    if (initialMobileWebLayout && !sharedSheet) {
      return { ...initialState, initialViewMode: "library" };
    }
    if (!browserHistoryNavigationEnabled || sharedSheet) return initialState;

    const requestedDocumentId = documentIdFromBrowserLocation(window.location);
    if (!requestedDocumentId) {
      return { ...initialState, initialViewMode: "library" };
    }
    if (
      !initialState.documents.some((document) => document.id === requestedDocumentId)
    ) {
      return { ...initialState, initialViewMode: "library" };
    }
    return {
      ...initialState,
      activeDocumentId: requestedDocumentId,
      initialViewMode: "editor"
    };
  });
  const [actualLibraryDocuments, setActualLibraryDocuments] = useState<LibraryDocument[]>(
    initialLibraryState.documents
  );
  const [demoLibraryDocuments, setDemoLibraryDocuments] = useState<LibraryDocument[]>(
    createDemoTimeLibraryDocuments
  );
  const [demoTimeEnabled, setDemoTimeEnabled] = useState(false);
  const [debugSettingsAvailableFromMain, setDebugSettingsAvailableFromMain] =
    useState(false);
  const [hasAdminAccess, setHasAdminAccess] = useState(false);
  const [adminAccessStatus, setAdminAccessStatus] =
    useState<AdminAccessStatus>("denied");
  const [isAdminMfaDialogOpen, setIsAdminMfaDialogOpen] = useState(false);
  const [windowsClientSpoofEnabled, setWindowsClientSpoofEnabled] =
    useState(false);
  const libraryDocuments = demoTimeEnabled
    ? demoLibraryDocuments
    : actualLibraryDocuments;
  const setLibraryDocuments = demoTimeEnabled
    ? setDemoLibraryDocuments
    : setActualLibraryDocuments;
  const [activeDocumentId, setActiveDocumentId] = useState(initialLibraryState.activeDocumentId);
  const [viewMode, setViewMode] = useState<ViewMode>(initialLibraryState.initialViewMode);
  const [isLibraryScrolled, setIsLibraryScrolled] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [message, setMessage] = useState("Ready");
  const [theme, setTheme] = useState<AppTheme>(() => readStoredTheme(supportsSystemTheme));
  const [isWindowFullScreen, setIsWindowFullScreen] = useState(false);
  const [
    alwaysShowDownloadAppButton,
    setAlwaysShowDownloadAppButton
  ] = useState(false);
  const [isLibrarySearchOpen, setIsLibrarySearchOpen] = useState(false);
  const [librarySearchQuery, setLibrarySearchQuery] = useState("");
  const [isLibrarySearchOverflowing, setIsLibrarySearchOverflowing] = useState(false);
  const [isLibrarySettingsMenuOpen, setIsLibrarySettingsMenuOpen] = useState(false);
  const [isLocalSheetDropActive, setIsLocalSheetDropActive] = useState(false);
  const [librarySettingsMenuView, setLibrarySettingsMenuView] =
    useState<LibrarySettingsMenuView>("root");
  const localSheetDropDepthRef = useRef(0);
  const [openLibraryDocumentMenuId, setOpenLibraryDocumentMenuId] = useState<string>();
  const [selectedLibraryDocumentIds, setSelectedLibraryDocumentIds] = useState<Set<string>>(
    () => new Set()
  );
  const [isLibraryBulkMenuOpen, setIsLibraryBulkMenuOpen] = useState(false);
  const [isDocumentMenuOpen, setIsDocumentMenuOpen] = useState(false);
  const [isRenameEditing, setIsRenameEditing] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");
  const [isLoopCountMenuOpen, setIsLoopCountMenuOpen] = useState(false);
  const [isLoopPeriodMenuOpen, setIsLoopPeriodMenuOpen] = useState(false);
  const [isLoopPeriodCustomEditing, setIsLoopPeriodCustomEditing] = useState(false);
  const [loopPeriodDraft, setLoopPeriodDraft] = useState(DEFAULT_LOOP_PERIOD_LABEL);
  const [initialLoopSidebarWidth] = useState(() =>
    readInitialLoopSidebarWidth(loopSidebarDefaultViewportRatio)
  );
  const [loopSidebarWidth, setLoopSidebarWidth] = useState(
    initialLoopSidebarWidth.width
  );
  const [loopVariablesDrawerHeight, setLoopVariablesDrawerHeight] = useState(() =>
    readStoredLoopVariablesDrawerHeight(initialMobileWebLayout)
  );
  const [loopResultsHeight, setLoopResultsHeight] = useState(window.innerHeight);
  const [loopSidebarVisibility, setLoopSidebarVisibility] =
    useState<LoopSidebarVisibilityPreferences>(readStoredLoopSidebarVisibility);
  const [isLoopSidebarAutoCollapsed, setIsLoopSidebarAutoCollapsed] = useState(
    () =>
      window.looper.platform !== "web" &&
      loopSidebarShouldAutoCollapse(window.innerWidth)
  );
  const [isLoopSidebarResizing, setIsLoopSidebarResizing] = useState(false);
  const [isLoopVariablesDrawerResizing, setIsLoopVariablesDrawerResizing] = useState(false);
  const [rowDrag, setRowDrag] = useState<RowDragState | undefined>();
  const [focusedEditorLine, setFocusedEditorLine] = useState<number>();
  const [stockQuotes, setStockQuotes] = useState<StockQuoteMap>({});
  const [loadingStockSymbols, setLoadingStockSymbols] = useState<ReadonlySet<string>>(
    () => new Set()
  );
  const [accountState, setAccountState] = useState<AccountState>(() =>
    publicDemoMode || localOnlyMode
      ? { status: "anonymous" }
      : { status: "loading" }
  );
  const [signedOutPreviewEnabled, setSignedOutPreviewEnabled] = useState(false);
  const [billingPreviewMode, setBillingPreviewMode] =
    useState<BillingPreviewMode>("live");
  const [appUpdateState, setAppUpdateState] =
    useState<AppUpdateState>(idleAppUpdateState);
  const [billingStatus, setBillingStatus] = useState<BillingStatus>();
  const [isBillingDialogOpen, setIsBillingDialogOpen] = useState(false);
  const [sharedSheetOwnership, setSharedSheetOwnership] =
    useState<SharedSheetOwnership>(isSharedAccess ? "checking" : "owner");
  const [isAccountDialogOpen, setIsAccountDialogOpen] = useState(false);
  const [accountDialogPurpose, setAccountDialogPurpose] =
    useState<AccountDialogPurpose>("sign-in");
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [pendingSheetIntent, setPendingSheetIntent] = useState<OwnedSheetIntent>();
  const [isLoadingSheetStorage, setIsLoadingSheetStorage] = useState(
    localOnlyMode && !publicDemoMode
  );
  const [isCheckingBillingAccess, setIsCheckingBillingAccess] = useState(false);
  const [isCreatingLocalSheet, setIsCreatingLocalSheet] = useState(false);
  const [isCreatingCloudSheet, setIsCreatingCloudSheet] = useState(false);
  const [isLoadingCloudSheets, setIsLoadingCloudSheets] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [cloudSyncState, setCloudSyncState] = useState<CloudSyncState>("idle");
  const [cloudSyncErrorMessage, setCloudSyncErrorMessage] = useState("");
  const [isUpdatingShareSettings, setIsUpdatingShareSettings] = useState(false);
  const [loopResultPopover, setLoopResultPopover] = useState<LoopResultPopoverState>();
  const [loopPeriodSidebarMenu, setLoopPeriodSidebarMenu] =
    useState<LoopPeriodSidebarMenuState>();
  const [loopVariableSidebarMenu, setLoopVariableSidebarMenu] =
    useState<LoopVariableSidebarMenuState>();
  const [isLoopVariablesDrawerOpen, setIsLoopVariablesDrawerOpen] = useState(false);
  const [isMobileWebLayout, setIsMobileWebLayout] = useState(initialMobileWebLayout);
  const [isMobileLoopSidebarOpen, setIsMobileLoopSidebarOpen] = useState(false);

  const librarySearchControlRef = useRef<HTMLDivElement>(null);
  const librarySearchInputRef = useRef<HTMLInputElement>(null);
  const librarySearchResultsRef = useRef<HTMLDivElement>(null);
  const libraryBulkMenuRef = useRef<HTMLDivElement>(null);
  const librarySettingsMenuRef = useRef<HTMLDivElement>(null);
  const libraryScrollRef = useRef<HTMLElement>(null);
  const libraryScrollTopRef = useRef(0);
  const documentMenuRef = useRef<HTMLDivElement>(null);
  const loopCountMenuRef = useRef<HTMLDivElement>(null);
  const loopCountMenuPopupRef = useRef<HTMLDivElement>(null);
  const loopPeriodSidebarMenuRef = useRef<HTMLDivElement>(null);
  const loopVariableSidebarMenuRef = useRef<HTMLDivElement>(null);
  const loopResultPopoverRef = useRef<HTMLDivElement>(null);
  const rowDragRef = useRef<RowDragState | undefined>(undefined);
  const rowDragCaptureTargetRef = useRef<HTMLButtonElement | undefined>(undefined);
  const loopSidebarDragRef = useRef<LoopSidebarDragState | undefined>(undefined);
  const loopSidebarWidthIsCustomRef = useRef(initialLoopSidebarWidth.isCustom);
  const loopSidebarCompactOverrideRef = useRef(false);
  const loopVariablesDrawerDragRef = useRef<LoopVariablesDrawerDragState | undefined>(
    undefined
  );
  const loopVariablesDrawerHasCustomHeightRef = useRef(
    hasStoredLoopVariablesDrawerHeight()
  );
  const loopResultsRef = useRef<HTMLElement>(null);
  const loopPeriodInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const highlightLayerRef = useRef<HTMLPreElement>(null);
  const rowHandlesInnerRef = useRef<HTMLDivElement>(null);
  const staticResultsInnerRef = useRef<HTMLDivElement>(null);
  const scrollbarHideTimeoutsRef = useRef<Map<HTMLElement, number>>(new Map());
  const sectionSortUndoRef = useRef<SectionSortUndoSnapshot | undefined>(undefined);
  const cloudSyncTimeoutsRef = useRef<Map<string, number>>(new Map());
  const localSyncTimeoutsRef = useRef<Map<string, number>>(new Map());
  const appUpdatePreviewRunRef = useRef(0);
  const cloudSyncInFlightRef = useRef<Map<string, string>>(new Map());
  const localSyncInFlightRef = useRef<Map<string, string>>(new Map());
  const cloudDraftInFlightRef = useRef<Map<string, string>>(new Map());
  const cloudSyncBlockedRef = useRef<Set<string>>(new Set());
  const cloudDraftBlockedRef = useRef<Set<string>>(new Set());
  const savedCloudFingerprintsRef = useRef<Map<string, string>>(new Map());
  const savedLocalFingerprintsRef = useRef<Map<string, string>>(new Map());
  const savedCloudDraftFingerprintsRef = useRef<Map<string, string>>(new Map());
  const pendingCloudDraftFingerprintsRef = useRef<Map<string, string>>(new Map());
  const pendingGlobalNavigationRef = useRef<GlobalVariableDefinition | undefined>(undefined);
  const latestLibraryDocumentsRef = useRef<LibraryDocument[]>(initialLibraryState.documents);
  const actualLibraryDocumentsRef = useRef<LibraryDocument[]>(initialLibraryState.documents);
  const activeDocumentIdRef = useRef(initialLibraryState.activeDocumentId);
  const demoTimeEnabledRef = useRef(false);
  const normalLibraryPresentationRef = useRef({
    activeDocumentId: initialLibraryState.activeDocumentId,
    viewMode: initialLibraryState.initialViewMode
  });
  const accountGenerationRef = useRef(0);
  const currentAccountIdRef = useRef<string | undefined>(undefined);
  const cloudCreateOperationRef = useRef<string | undefined>(undefined);
  const cloudLoadOperationRef = useRef<string | undefined>(undefined);
  const signOutOperationRef = useRef<string | undefined>(undefined);
  const cloudDeleteInFlightRef = useRef<Set<string>>(new Set());
  const sharedSyncTimeoutRef = useRef<number | undefined>(undefined);
  const sharedSyncInFlightRef = useRef<string | undefined>(undefined);
  const savedSharedFingerprintRef = useRef(
    sharedSheet && initialLibraryState.documents[0]
      ? cloudDocumentFingerprint(initialLibraryState.documents[0])
      : ""
  );
  const contentFontScaleRef = useRef(0);

  const pushBrowserView = useCallback(
    (documentId?: string): void => {
      if (!browserHistoryNavigationEnabled || isSharedAccess) return;
      const nextPath = browserPathForDocument(documentId);
      const currentPath = `${window.location.pathname}${window.location.search}`;
      if (currentPath === nextPath) return;
      window.history.pushState({ looperDocumentId: documentId ?? null }, "", nextPath);
    },
    [browserHistoryNavigationEnabled, isSharedAccess]
  );

  const applySignedOutPreview = useCallback(
    (enabled: boolean): void => {
      setSignedOutPreviewEnabled(enabled);
      setIsLibrarySettingsMenuOpen(false);
      setIsLibrarySearchOpen(false);
      setLibrarySearchQuery("");
      if (!enabled || isSharedAccess) return;

      // The authenticated library can be substantially taller than the
      // signed-out library. Reusing its scroll offset can land below all
      // preview content and make the window look blank.
      libraryScrollTopRef.current = 0;
      setViewMode("library");
      pushBrowserView();
      requestAnimationFrame(() => {
        if (libraryScrollRef.current) libraryScrollRef.current.scrollTop = 0;
      });
    },
    [isSharedAccess, pushBrowserView]
  );

  const applyDemoTime = useCallback(
    (enabled: boolean): void => {
      if (demoTimeEnabledRef.current === enabled) return;

      if (enabled) {
        normalLibraryPresentationRef.current = {
          activeDocumentId: activeDocumentIdRef.current,
          viewMode
        };
        const demoDocuments = createDemoTimeLibraryDocuments();
        demoTimeEnabledRef.current = true;
        setDemoLibraryDocuments(demoDocuments);
        setDemoTimeEnabled(true);
        setActiveDocumentId(demoDocuments[0]?.id ?? "");
        setViewMode("library");
        setMessage("Demo Time — 19 sample sheets are ready");
      } else {
        demoTimeEnabledRef.current = false;
        setDemoTimeEnabled(false);
        const normalPresentation = normalLibraryPresentationRef.current;
        const normalDocuments = actualLibraryDocumentsRef.current;
        setActiveDocumentId(
          normalDocuments.some(
            (document) => document.id === normalPresentation.activeDocumentId
          )
            ? normalPresentation.activeDocumentId
            : normalDocuments[0]?.id ?? ""
        );
        setViewMode(normalPresentation.viewMode);
        setMessage("Demo Time off — your library is unchanged");
      }

      setIsDirty(false);
      setIsLibrarySettingsMenuOpen(false);
      setLibrarySettingsMenuView("root");
      setIsLibrarySearchOpen(false);
      setLibrarySearchQuery("");
      setSelectedLibraryDocumentIds(new Set());
      setOpenLibraryDocumentMenuId(undefined);
      pushBrowserView();
      libraryScrollTopRef.current = 0;
      requestAnimationFrame(() => {
        if (libraryScrollRef.current) libraryScrollRef.current.scrollTop = 0;
      });
    },
    [pushBrowserView, viewMode]
  );

  useEffect(() => {
    let active = true;
    void window.looper.getDebugSettingsAvailable().then((available) => {
      if (active) setDebugSettingsAvailableFromMain(available);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    let receivedChange = false;
    const unsubscribe = window.looper.onDemoTimeChanged((enabled) => {
      receivedChange = true;
      applyDemoTime(enabled);
    });
    void window.looper.getDemoTime().then((enabled) => {
      if (active && !receivedChange) applyDemoTime(enabled);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [applyDemoTime]);

  useEffect(() => {
    let active = true;
    let receivedChange = false;
    const unsubscribe = window.looper.onWindowsClientSpoofChanged((enabled) => {
      receivedChange = true;
      setWindowsClientSpoofEnabled(enabled);
    });
    void window.looper.getWindowsClientSpoof().then((enabled) => {
      if (active && !receivedChange) setWindowsClientSpoofEnabled(enabled);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (String(window.looper.platform) !== "darwin") return;

    let active = true;
    let receivedChange = false;
    const unsubscribe = window.looper.onWindowFullScreenChanged((fullScreen) => {
      receivedChange = true;
      setIsWindowFullScreen(fullScreen);
    });
    void window.looper.getWindowFullScreen().then((fullScreen) => {
      if (active && !receivedChange) setIsWindowFullScreen(fullScreen);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;
    let receivedChange = false;
    const unsubscribe = window.looper.onSignedOutPreviewChanged((enabled) => {
      receivedChange = true;
      applySignedOutPreview(enabled);
    });
    void window.looper.getSignedOutPreview().then((enabled) => {
      if (!active || receivedChange) return;
      applySignedOutPreview(enabled);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [applySignedOutPreview]);

  useEffect(() => {
    let active = true;
    const unsubscribePreview = window.looper.onBillingPreviewChanged((mode) => {
      setBillingPreviewMode(mode);
    });
    const unsubscribeDialog = window.looper.onShowBillingDialog(() => {
      setIsLibrarySettingsMenuOpen(false);
      setIsBillingDialogOpen(true);
    });
    void window.looper.getBillingPreview().then((mode) => {
      if (active) setBillingPreviewMode(mode);
    });
    return () => {
      active = false;
      unsubscribePreview();
      unsubscribeDialog();
    };
  }, []);

  useEffect(() => {
    let active = true;
    let receivedChange = false;
    const unsubscribe = window.looper.onAppUpdateStateChanged((state) => {
      receivedChange = true;
      if (state.status === "idle" || !state.preview) {
        appUpdatePreviewRunRef.current += 1;
      }
      setAppUpdateState(state);
    });
    void window.looper.getAppUpdateState().then((state) => {
      if (active && !receivedChange) setAppUpdateState(state);
    });

    return () => {
      active = false;
      appUpdatePreviewRunRef.current += 1;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!mobileWebLayoutEnabled) {
      setIsMobileWebLayout(false);
      return;
    }

    const mediaQuery = window.matchMedia(mobileWebLayoutMediaQuery);
    const updateMobileLayout = (): void => setIsMobileWebLayout(mediaQuery.matches);
    updateMobileLayout();
    mediaQuery.addEventListener("change", updateMobileLayout);
    return () => mediaQuery.removeEventListener("change", updateMobileLayout);
  }, [mobileWebLayoutEnabled]);

  useEffect(() => {
    if (!isMobileWebLayout || viewMode !== "editor") return;
    setIsMobileLoopSidebarOpen(false);
  }, [activeDocumentId, isMobileWebLayout, viewMode]);

  useEffect(() => {
    setIsLoopVariablesDrawerOpen(false);
  }, [activeDocumentId, viewMode]);

  useEffect(() => {
    if (viewMode !== "editor") return;
    const sidebar = loopResultsRef.current;
    if (!sidebar) return;

    const updateHeight = (height: number): void => {
      const normalizedHeight = Math.max(0, Math.round(height));
      if (normalizedHeight === 0) return;
      setLoopResultsHeight(normalizedHeight);
      setLoopVariablesDrawerHeight((currentHeight) =>
        clampLoopVariablesDrawerHeight(currentHeight, normalizedHeight)
      );
    };

    updateHeight(sidebar.getBoundingClientRect().height);
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) updateHeight(entry.contentRect.height);
    });
    observer.observe(sidebar);
    return () => observer.disconnect();
  }, [viewMode]);

  useEffect(() => {
    if (!browserHistoryNavigationEnabled || isSharedAccess) return;

    const applyBrowserLocation = (): void => {
      const requestedDocumentId = documentIdFromBrowserLocation(window.location);
      setIsLibrarySearchOpen(false);
      setLibrarySearchQuery("");
      setIsLibrarySettingsMenuOpen(false);
      setOpenLibraryDocumentMenuId(undefined);
      setIsDocumentMenuOpen(false);
      setIsRenameEditing(false);
      setIsLoopCountMenuOpen(false);
      setIsLoopPeriodMenuOpen(false);
      setIsLoopPeriodCustomEditing(false);

      if (!requestedDocumentId) {
        setViewMode("library");
        setMessage("All documents");
        return;
      }

      const requestedDocument = latestLibraryDocumentsRef.current.find(
        (document) => document.id === requestedDocumentId
      );
      if (!requestedDocument) {
        setViewMode("library");
        return;
      }

      setActiveDocumentId(requestedDocument.id);
      setViewMode("editor");
      setIsDirty(false);
      setMessage("Opened document");
      requestAnimationFrame(() => editorRef.current?.focus());
    };

    window.addEventListener("popstate", applyBrowserLocation);
    return () => window.removeEventListener("popstate", applyBrowserLocation);
  }, [browserHistoryNavigationEnabled, isSharedAccess]);

  useEffect(() => {
    if (!browserHistoryNavigationEnabled || isSharedAccess) return;
    const requestedDocumentId = documentIdFromBrowserLocation(window.location);
    if (!requestedDocumentId) return;
    if (viewMode === "editor" && activeDocumentId === requestedDocumentId) return;
    const requestedDocument = libraryDocuments.find(
      (document) => document.id === requestedDocumentId
    );
    if (!requestedDocument) return;

    setActiveDocumentId(requestedDocument.id);
    setViewMode("editor");
    setIsDirty(false);
  }, [
    activeDocumentId,
    browserHistoryNavigationEnabled,
    isSharedAccess,
    libraryDocuments,
    viewMode
  ]);

  const activeDocument = useMemo(
    () =>
      libraryDocuments.find((document) => document.id === activeDocumentId) ??
      libraryDocuments[0],
    [activeDocumentId, libraryDocuments]
  );
  const activeDocumentIsSharedVisitor = Boolean(
    isSharedAccess &&
      sharedSheet &&
      activeDocument?.id === sharedSheet.id &&
      (signedOutPreviewEnabled || sharedSheetOwnership !== "owner")
  );
  const userLibraryDocuments = useMemo(
    () =>
      libraryDocuments.filter(
        (document) => !isGettingStartedExampleDocumentId(document.id)
      ),
    [libraryDocuments]
  );
  const presentedUserLibraryDocuments = useMemo(
    () => {
      if (publicDemoMode) return [];
      if (localOnlyMode && !demoTimeEnabled) {
        return sortSheetsByLastModified(
          userLibraryDocuments.filter((document) => Boolean(document.local))
        );
      }
      if (
        !demoTimeEnabled &&
        (accountState.status !== "authenticated" || signedOutPreviewEnabled)
      ) {
        return [];
      }

      return sortSheetsByLastModified(
        userLibraryDocuments.filter(
          (document) => Boolean(document.cloud) || document.demo === true
        )
      );
    },
    [
      accountState.status,
      demoTimeEnabled,
      localOnlyMode,
      publicDemoMode,
      signedOutPreviewEnabled,
      userLibraryDocuments
    ]
  );
  const gettingStartedLibraryDocuments = useMemo(
    () =>
      libraryDocuments
        .filter((document) => isGettingStartedExampleDocumentId(document.id))
        .sort(
          (left, right) =>
            gettingStartedExampleOrder(left.id) - gettingStartedExampleOrder(right.id)
        ),
    [libraryDocuments]
  );
  const learningLibraryDocuments = useMemo(
    () =>
      gettingStartedLibraryDocuments.filter(
        (document) => gettingStartedExampleSection(document.id) === "learn"
      ),
    [gettingStartedLibraryDocuments]
  );
  const templateLibraryDocuments = useMemo(
    () =>
      gettingStartedLibraryDocuments.filter(
        (document) => gettingStartedExampleSection(document.id) === "template"
      ),
    [gettingStartedLibraryDocuments]
  );
  const searchableLibraryDocuments = useMemo(
    () => [...presentedUserLibraryDocuments, ...gettingStartedLibraryDocuments],
    [gettingStartedLibraryDocuments, presentedUserLibraryDocuments]
  );
  const selectedLibraryDocuments = useMemo(
    () =>
      searchableLibraryDocuments.filter((document) =>
        selectedLibraryDocumentIds.has(document.id)
      ),
    [searchableLibraryDocuments, selectedLibraryDocumentIds]
  );
  const selectedLibraryDocumentCount = selectedLibraryDocuments.length;
  const selectionIncludesBundledExample = selectedLibraryDocuments.some((document) =>
    isGettingStartedExampleDocumentId(document.id)
  );
  const librarySearchResults = useMemo(() => {
    const query = librarySearchQuery.trim().toLocaleLowerCase();
    if (!query) return searchableLibraryDocuments;

    return searchableLibraryDocuments.filter((document) =>
      document.title.toLocaleLowerCase().includes(query)
    );
  }, [librarySearchQuery, searchableLibraryDocuments]);
  const authenticatedAccount =
    accountState.status === "authenticated" ? accountState.account : undefined;
  const applyAdminAccessStatus = useCallback((status: AdminAccessStatus): void => {
    setAdminAccessStatus(status);
    setHasAdminAccess(status === "granted");
    setIsAdminMfaDialogOpen(status === "mfa_required");
    if (status !== "granted") setIsAdminPanelOpen(false);
    if (status === "mfa_activation_required") {
      setMessage(
        "Authenticator verified. Admin data remains locked until this account is added to the server MFA-ready allowlist."
      );
    }
  }, []);
  useEffect(() => {
    let active = true;
    applyAdminAccessStatus("denied");
    if (localOnlyMode) return () => {
      active = false;
    };
    if (!authenticatedAccount) return () => {
      active = false;
    };

    void window.looper
      .getAdminAccess()
      .then((status) => {
        if (active) applyAdminAccessStatus(status);
      })
      .catch(() => {
        if (active) applyAdminAccessStatus("denied");
      });

    return () => {
      active = false;
    };
  }, [applyAdminAccessStatus, authenticatedAccount?.id, localOnlyMode]);

  useEffect(
    () =>
      window.looper.onAdminAccessChanged((status) => {
        applyAdminAccessStatus(status);
      }),
    [applyAdminAccessStatus]
  );

  useEffect(() => {
    if (!hasAdminAccess) setIsAdminPanelOpen(false);
  }, [hasAdminAccess]);

  const effectiveBillingStatus =
    demoTimeEnabled
      ? quotaBillingStatus(userLibraryDocuments.length, 55)
      : previewBillingStatus(billingPreviewMode) ?? billingStatus;
  const billingDialogStatus =
    effectiveBillingStatus ?? quotaBillingStatus(
      userLibraryDocuments.filter(
        (document) => Boolean(document.cloud) || document.demo === true
      ).length,
      undefined,
      false
    );
  const sheetUsageIsAtLimit =
    !billingStatusAllowsSheetCreation(billingDialogStatus);
  const sheetUsagePercent =
    billingDialogStatus.sheetLimit > 0
      ? Math.min(
          100,
          (billingDialogStatus.sheetCount / billingDialogStatus.sheetLimit) * 100
        )
      : 0;
  const presentedAccountState: AccountState =
    publicDemoMode
      ? { status: "anonymous" }
      : demoTimeEnabled
        ? {
            account: { email: DEMO_ACCOUNT_EMAIL, id: DEMO_ACCOUNT_ID },
            status: "authenticated"
          }
        : signedOutPreviewEnabled && accountState.status === "authenticated"
          ? { status: "anonymous" }
          : accountState;
  const presentedAccountEmail =
    presentedAccountState.status === "authenticated"
      ? presentedAccountState.account.email
      : undefined;
  const presentedAccountHasAdminAccess =
    hasAdminAccess &&
    !demoTimeEnabled &&
    presentedAccountState.status === "authenticated" &&
    authenticatedAccount?.id === presentedAccountState.account.id;
  const presentedAccountNeedsAdminMfa =
    adminAccessStatus === "mfa_required" &&
    !demoTimeEnabled &&
    presentedAccountState.status === "authenticated" &&
    authenticatedAccount?.id === presentedAccountState.account.id;
  const debugSettingsAreAvailable =
    debugSettingsAvailableFromMain ||
    demoTimeEnabled ||
    hasAdminAccess;
  const updateButtonPreviewEnabled =
    appUpdateState.status !== "idle" && appUpdateState.preview;
  const shouldShowLibrarySettingsControl =
    !publicDemoMode &&
    (localOnlyMode ||
      presentedAccountState.status === "authenticated" ||
      debugSettingsAreAvailable);
  const downloadAppButtonIsVisible = shouldShowDownloadAppButton({
    alwaysShow: alwaysShowDownloadAppButton,
    runtimePlatform: window.looper.platform
  });
  const downloadPlatform = resolveDownloadPlatform({
    configuredPlatform: configuration?.downloadPlatform,
    runtimePlatform,
    spoofWindows: windowsClientSpoofEnabled
  });
  const downloadAppLabel =
    downloadPlatform === "windows" ? "Get Windows App" : "Get Mac App";
  const downloadPath = `/download?platform=${downloadPlatform}`;
  const downloadHref =
    runtimePlatform === "web"
      ? downloadPath
      : `https://looper.app${downloadPath}`;
  const nextAppearanceTheme = nextApplicationTheme(
    theme,
    supportsSystemTheme
  );
  const areCloudActionsDisabled =
    accountState.status === "loading" ||
    accountState.status === "unavailable" ||
    isCheckingBillingAccess ||
    isCreatingCloudSheet ||
    isLoadingCloudSheets ||
    isSigningOut;
  const areSheetActionsDisabled =
    isLoadingSheetStorage ||
    (localOnlyMode ? isCreatingLocalSheet : areCloudActionsDisabled);
  const isUsingOffline =
    !localOnlyMode &&
    !demoTimeEnabled &&
    !signedOutPreviewEnabled &&
    accountState.status !== "unavailable" &&
    cloudSyncState === "offline";
  const cloudIssueDetail = localOnlyMode || demoTimeEnabled || signedOutPreviewEnabled
    ? ""
    : accountState.status === "unavailable"
      ? accountState.message
      : cloudSyncState === "error" || cloudSyncState === "offline"
        ? cloudSyncErrorMessage || "Your account needs attention."
        : "";
  const visibleCloudIssue = cloudIssueDetail
    ? conciseCloudIssueMessage(
        cloudIssueDetail,
        accountState.status !== "unavailable" && cloudSyncState === "offline"
      )
    : "";

  latestLibraryDocumentsRef.current = libraryDocuments;
  actualLibraryDocumentsRef.current = actualLibraryDocuments;
  activeDocumentIdRef.current = activeDocumentId;

  useEffect(() => {
    sectionSortUndoRef.current = undefined;
  }, [activeDocumentId]);

  const documentData = activeDocument?.data ?? createInitialDocument();
  const documentPath = activeDocument?.path;
  const documentTitle = normalizeDocumentTitle(documentData.title ?? activeDocument?.title);
  const activeDocumentIsBundledExample = Boolean(
    activeDocument && isGettingStartedExampleDocumentId(activeDocument.id)
  );
  const editorText = documentData.text;
  const normalizedContentFontScale = normalizeContentFontScale(documentData.fontScale);
  const normalizedContentFontSize = contentFontSize(normalizedContentFontScale);
  const decimalPlaces = normalizeDecimalPlaces(
    documentData.decimalPlaces,
    DEFAULT_DECIMAL_PLACES
  );
  contentFontScaleRef.current = normalizedContentFontScale;
  const globalVariableDocuments = useMemo<GlobalVariableDocument[]>(
    () =>
      activeDocumentIsSharedVisitor
        ? []
        : searchableLibraryDocuments.map((document) => ({
            decimalPlaces: normalizeDecimalPlaces(document.data.decimalPlaces),
            id: document.id,
            loopCount: normalizeLoopCount(document.data.loopCount),
            text: document.data.text,
            title: document.title
          })),
    [activeDocumentIsSharedVisitor, searchableLibraryDocuments]
  );
  const stockSymbols = useMemo(() => {
    const symbols = new Set(extractStockSymbols(editorText));
    for (const document of globalVariableDocuments) {
      if (extractGlobalVariableAssignments(document.text).length === 0) continue;
      for (const symbol of extractStockSymbols(document.text)) symbols.add(symbol);
    }
    return Array.from(symbols).sort((left, right) => left.localeCompare(right));
  }, [editorText, globalVariableDocuments]);
  const stockSymbolKey = stockSymbols.join(",");

  const globalVariableWorkbook = useMemo(
    () =>
      activeDocumentIsSharedVisitor
        ? undefined
        : new GlobalVariableWorkbook(globalVariableDocuments, stockQuotes),
    [activeDocumentIsSharedVisitor, globalVariableDocuments, stockQuotes]
  );

  const evaluation = useMemo(() => {
    const workbookEvaluation =
      globalVariableWorkbook && activeDocument
        ? globalVariableWorkbook.evaluateDocumentIfPresent(activeDocument.id)
        : undefined;
    return (
      workbookEvaluation ??
      evaluateLooperText(editorText, documentData.loopCount, stockQuotes, decimalPlaces)
    );
  }, [
    activeDocument,
    decimalPlaces,
    documentData.loopCount,
    editorText,
    globalVariableWorkbook,
    stockQuotes
  ]);
  const syntaxHighlightContext = useMemo(
    () => buildSyntaxHighlightContext(editorText, evaluation),
    [editorText, evaluation]
  );

  useLayoutEffect(() => {
    let canceled = false;
    let interval: number | undefined;
    const symbols = stockSymbolKey ? stockSymbolKey.split(",") : [];

    if (symbols.length === 0) {
      setStockQuotes({});
      setLoadingStockSymbols(new Set());
      return;
    }

    const refreshQuotes = async (): Promise<void> => {
      try {
        const quotes = await window.looper.fetchStockQuotes(symbols);
        if (!canceled) setStockQuotes(quotes);
      } catch {
        // The completed request state below turns unresolved symbols into errors.
      } finally {
        if (!canceled) setLoadingStockSymbols(new Set());
      }
    };

    const loadedSymbols = new Set(Object.keys(stockQuotes));
    setLoadingStockSymbols(
      new Set(symbols.filter((symbol) => !loadedSymbols.has(symbol)))
    );
    setStockQuotes((current) =>
      Object.fromEntries(
        symbols.flatMap((symbol) =>
          current[symbol] ? [[symbol, current[symbol]]] : []
        )
      )
    );
    const initialRefresh = window.setTimeout(() => {
      void refreshQuotes();
      interval = window.setInterval(() => void refreshQuotes(), 60_000);
    }, 300);
    return () => {
      canceled = true;
      window.clearTimeout(initialRefresh);
      if (interval !== undefined) window.clearInterval(interval);
    };
  }, [stockSymbolKey]);

  const sourceLines = useMemo(
    () => editorText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n"),
    [editorText]
  );
  const isLoopSidebarRequestedVisible = loopSidebarIsVisible(
    loopSidebarVisibility,
    activeDocument?.id
  );
  const isLoopSidebarVisible = isMobileWebLayout
    ? isMobileLoopSidebarOpen
    : isLoopSidebarRequestedVisible && !isLoopSidebarAutoCollapsed;
  const isMobileLoopSidebarVisible = isMobileWebLayout && isMobileLoopSidebarOpen;
  const showsSheetBackButton =
    !browserHistoryNavigationEnabled || isMobileWebLayout;
  const loopCount = normalizeLoopCount(documentData.loopCount);
  const loopCountSliderMaximum = Math.max(100, loopCount);
  const activeResultLoop = evaluation.loopCount;
  const staticResultCharacterCount = useMemo(
    () => resultColumnCharacterCount(evaluation.lines, activeResultLoop),
    [activeResultLoop, evaluation.lines]
  );
  const loopPeriodLabel = normalizeLoopPeriodLabel(documentData.loopPeriod, loopCount);
  const loopPeriodSidebarMenuHeight =
    loopPeriodSidebarMenuBaseHeight + (loopCount === 0 ? 27 : 0);
  const isCustomLoopPeriod =
    loopPeriodLabel !== NONE_LOOP_PERIOD_LABEL &&
    !loopPeriodPresets.some((preset) => preset === loopPeriodLabel);
  const minimumReorderLineIndex = 0;
  const sidebarVisibilityIcon = isLoopSidebarVisible ? PanelRightClose : PanelRightOpen;
  const hasDismissiblePopoverOpen =
    isLibrarySearchOpen ||
    isLibrarySettingsMenuOpen ||
    isLibraryBulkMenuOpen ||
    openLibraryDocumentMenuId !== undefined ||
    isDocumentMenuOpen ||
    isLoopCountMenuOpen ||
    isLoopPeriodMenuOpen ||
    loopPeriodSidebarMenu !== undefined ||
    loopVariableSidebarMenu !== undefined ||
    loopResultPopover !== undefined;
  const shellStyle = useMemo(() => {
    const contentScale = normalizedContentFontSize / defaultEditorFontSize;
    const scaledPixels = (value: number): string => `${value * contentScale}px`;
    const editorTopInset =
      editorContentStartsBelowHeader
        ? `calc(var(--titlebar-height) + ${scaledPixels(headerContentSpacing)})`
        : scaledPixels(defaultEditorTopSpacing);

    return {
      "--editor-font-size": `${normalizedContentFontSize}px`,
      "--editor-left-inset": scaledPixels(defaultEditorLeftInset),
      "--editor-top-inset": editorTopInset,
      "--loop-sidebar-width": `${loopSidebarWidth}px`,
      "--loop-sidebar-x-inset": scaledPixels(defaultLoopSidebarXInset),
      "--row-height": scaledPixels(defaultEditorRowHeight),
      "--static-result-trailing-space": scaledPixels(defaultStaticResultTrailingSpace),
      "--static-results-width": `calc(${staticResultCharacterCount}ch + var(--static-results-padding))`
    } as CSSProperties;
  }, [
    editorContentStartsBelowHeader,
    loopSidebarWidth,
    normalizedContentFontSize,
    staticResultCharacterCount
  ]);
  const loopPeriodSidebarMenuStyle = useMemo<CSSProperties | undefined>(
    () =>
      loopPeriodSidebarMenu
        ? {
            right: loopPeriodSidebarMenu.right,
            top: loopPeriodSidebarMenu.top
          }
        : undefined,
    [loopPeriodSidebarMenu]
  );
  const draggedSource = rowDrag ? (sourceLines[rowDrag.sourceIndex] ?? "") : "";
  const draggedEvaluationLine = rowDrag ? evaluation.lines[rowDrag.sourceIndex] : undefined;
  const draggedResult = draggedEvaluationLine?.evaluations[activeResultLoop];
  const draggedResultIsLoading = evaluationWaitsForStockQuote(
    draggedResult,
    loadingStockSymbols
  );

  const loopIndices = useMemo(
    () => Array.from({ length: evaluation.loopCount + 1 }, (_, index) => index),
    [evaluation.loopCount]
  );

  const variableDefinitionState = useMemo(
    () => variableDefinitionStateForText(
      editorText,
      documentData.variableDefinitions ?? [],
      documentData.loopedLines
    ),
    [
      documentData.loopedLines,
      documentData.variableDefinitions,
      editorText
    ]
  );
  const loopVariableOptions = variableDefinitionState.definitions;
  const loopVariableGroups = useMemo(
    () => variableGroupsForOptions(loopVariableOptions),
    [loopVariableOptions]
  );
  const loopVariableOptionsByLine = useMemo(
    () => new Map(loopVariableOptions.map((variable) => [variable.lineNumber, variable])),
    [loopVariableOptions]
  );
  const loopedLineNumbers = useMemo(
    () => new Set(documentData.loopedLines),
    [documentData.loopedLines]
  );

  const activeLoopedLines = useMemo(() => {
    return evaluation.lines.filter((line) => loopedLineNumbers.has(line.lineNumber));
  }, [evaluation.lines, loopedLineNumbers]);
  const activeLoopedVariableLines = useMemo(
    () => activeLoopedLines.filter((line) => line.kind === "equation" && Boolean(line.variable)),
    [activeLoopedLines]
  );
  const sidebarPublishHintLineIndex = loopSidebarPublishHintLineIndex(
    sourceLines,
    activeLoopedLines.length,
    documentData.isLoopVariablePublished
  );
  const shouldShowSidebarPublishHint = sidebarPublishHintLineIndex !== undefined;
  const sidebarPublishHintOffset = Math.max(
    0,
    defaultEditorRowHeight *
      (normalizedContentFontSize / defaultEditorFontSize) *
      ((sidebarPublishHintLineIndex ?? 0) + 0.5) -
      7
  );
  const availableLoopVariableCount = loopVariableOptions.length + 1;
  const visibleLoopVariableCount =
    activeLoopedVariableLines.length + (documentData.isLoopVariablePublished ? 1 : 0);
  const selectedVariableMenuIsPublished = loopVariableSidebarMenu
    ? loopVariableSidebarMenu.lineNumber === undefined
      ? documentData.isLoopVariablePublished
      : loopedLineNumbers.has(loopVariableSidebarMenu.lineNumber)
    : false;
  const selectedVariableMenuDefinition = loopVariableSidebarMenu?.lineNumber === undefined
    ? undefined
    : loopVariableOptionsByLine.get(loopVariableSidebarMenu.lineNumber);
  const selectedVariableMenuHasDivider = loopVariableSidebarMenu
    ? loopVariableSidebarMenu.source === "editor" && loopVariableSidebarMenu.lineNumber !== undefined
      ? loopVariableSidebarMenu.lineNumber > 0 &&
        isDividerLine(sourceLines[loopVariableSidebarMenu.lineNumber - 1] ?? "")
      : (documentData.loopSidebarDividerLines ?? []).includes(
          loopVariableSidebarMenu.lineNumber ?? 0
        )
    : false;
  const loopVariablesDrawerMaximumHeight =
    maximumLoopVariablesDrawerHeight(loopResultsHeight);
  const loopVariablesDrawerMinimumHeight =
    minimumLoopVariablesDrawerHeight(loopResultsHeight);

  const hideLoopResultPopover = useCallback((): void => {
    setLoopResultPopover(undefined);
  }, []);

  const showLoopResultPopover = useCallback(
    (target: HTMLElement, line: ParsedLine): void => {
      const bounds = target.getBoundingClientRect();
      const desiredHeight = Math.min(
        loopResultPopoverMaxHeight,
        line.evaluations.length * 28 + 10
      );
      const spaceBelow =
        window.innerHeight - bounds.bottom - loopResultPopoverGap - loopResultPopoverViewportInset;
      const spaceAbove =
        bounds.top - loopResultPopoverGap - loopResultPopoverViewportInset;
      const placeBelow = spaceBelow >= desiredHeight || spaceBelow >= spaceAbove;
      const availableHeight = Math.max(56, placeBelow ? spaceBelow : spaceAbove);
      const maxHeight = Math.min(loopResultPopoverMaxHeight, availableHeight);
      const top = placeBelow
        ? bounds.bottom + loopResultPopoverGap
        : Math.max(
            loopResultPopoverViewportInset,
            bounds.top - loopResultPopoverGap - Math.min(desiredHeight, maxHeight)
          );

      setLoopResultPopover({
        lineNumber: line.lineNumber,
        maxHeight,
        right: Math.max(loopResultPopoverViewportInset, window.innerWidth - bounds.right),
        top
      });
    },
    []
  );

  const toggleLoopResultPopover = useCallback(
    (target: HTMLElement, line: ParsedLine): void => {
      if (loopResultPopover?.lineNumber === line.lineNumber) {
        hideLoopResultPopover();
        return;
      }
      showLoopResultPopover(target, line);
    },
    [hideLoopResultPopover, loopResultPopover?.lineNumber, showLoopResultPopover]
  );

  const loopResultPopoverLine = loopResultPopover
    ? evaluation.lines[loopResultPopover.lineNumber]
    : undefined;

  const syncWrappedRowHeights = useCallback((): void => {
    const highlightRows = highlightLayerRef.current?.children;
    const handleRows = rowHandlesInnerRef.current?.children;
    const resultRows = staticResultsInnerRef.current?.children;
    if (!highlightRows || !handleRows || !resultRows) return;

    for (let index = 0; index < highlightRows.length; index += 1) {
      const highlightRow = highlightRows.item(index);
      const handleRow = handleRows.item(index);
      const resultRow = resultRows.item(index);
      if (
        !(highlightRow instanceof HTMLElement) ||
        !(handleRow instanceof HTMLElement) ||
        !(resultRow instanceof HTMLElement)
      ) {
        continue;
      }

      const height = `${highlightRow.offsetHeight}px`;
      handleRow.style.height = height;
      resultRow.style.height = height;
    }
  }, []);

  const syncEditorScroll = useCallback((target: HTMLElement): void => {
    const y = `translateY(${-target.scrollTop}px)`;
    if (rowHandlesInnerRef.current) rowHandlesInnerRef.current.style.transform = y;
    if (staticResultsInnerRef.current) staticResultsInnerRef.current.style.transform = y;
    if (highlightLayerRef.current) {
      highlightLayerRef.current.style.transform = `translate(${-target.scrollLeft}px, ${-target.scrollTop}px)`;
    }
  }, []);

  const hideTransientScrollbar = useCallback((target: HTMLElement): void => {
    const currentTimeout = scrollbarHideTimeoutsRef.current.get(target);
    if (currentTimeout !== undefined) {
      window.clearTimeout(currentTimeout);
      scrollbarHideTimeoutsRef.current.delete(target);
    }

    target.classList.remove("scrollbar-active");
  }, []);

  const revealTransientScrollbar = useCallback(
    (target: HTMLElement): void => {
      if (target.scrollTop <= 0 && target.scrollLeft <= 0) {
        hideTransientScrollbar(target);
        return;
      }

      const currentTimeout = scrollbarHideTimeoutsRef.current.get(target);
      if (currentTimeout !== undefined) {
        window.clearTimeout(currentTimeout);
      }

      target.classList.add("scrollbar-active");
      scrollbarHideTimeoutsRef.current.set(
        target,
        window.setTimeout(() => {
          target.classList.remove("scrollbar-active");
          scrollbarHideTimeoutsRef.current.delete(target);
        }, 900)
      );
    },
    [hideTransientScrollbar]
  );

  const handleTransientScrollbarScroll = useCallback(
    (event: ReactUIEvent<HTMLElement>): void => {
      revealTransientScrollbar(event.currentTarget);
    },
    [revealTransientScrollbar]
  );

  const handleLibraryScroll = useCallback(
    (event: ReactUIEvent<HTMLElement>): void => {
      libraryScrollTopRef.current = event.currentTarget.scrollTop;
      setIsLibraryScrolled(event.currentTarget.scrollTop > 0);
      handleTransientScrollbarScroll(event);
      if (!isMobileWebLayout) return;

      const shell = event.currentTarget.parentElement;
      const titlebar = shell?.querySelector(":scope > .native-titlebar");
      if (!(shell instanceof HTMLElement) || !(titlebar instanceof HTMLElement)) return;

      const offset = Math.min(event.currentTarget.scrollTop, titlebar.offsetHeight);
      shell.style.setProperty("--mobile-library-header-translate-y", `${-offset}px`);
    },
    [handleTransientScrollbarScroll, isMobileWebLayout]
  );

  const handleEditorScroll = useCallback(
    (event: ReactUIEvent<HTMLDivElement>): void => {
      hideLoopResultPopover();
      syncEditorScroll(event.currentTarget);
      revealTransientScrollbar(event.currentTarget);
    },
    [hideLoopResultPopover, revealTransientScrollbar, syncEditorScroll]
  );

  const updateActiveDocumentData = useCallback(
    (
      updater: (current: LooperDocumentData) => LooperDocumentData,
      preserveSectionSortUndo = false
    ): void => {
      if (!preserveSectionSortUndo) sectionSortUndoRef.current = undefined;
      setLibraryDocuments((currentDocuments) =>
        currentDocuments.map((document) => {
          if (document.id !== activeDocumentId) return document;

          return refreshLibraryDocument({
            ...document,
            data: updater(document.data)
          });
        })
      );
    },
    [activeDocumentId]
  );

  const applyContentZoom = useCallback(
    (command: ContentZoomCommand): void => {
      if (viewMode !== "editor") return;

      const currentScale = contentFontScaleRef.current;
      const nextScale = nextContentFontScale(currentScale, command);
      if (nextScale === currentScale) {
        setMessage(command === "reset" ? "Content size is already 100%" : "Content size limit reached");
        return;
      }

      contentFontScaleRef.current = nextScale;
      updateActiveDocumentData((current) => ({ ...current, fontScale: nextScale }));
      setIsDirty(true);
      setMessage(`Content text size ${contentFontSize(nextScale)} pt`);
    },
    [updateActiveDocumentData, viewMode]
  );

  const setDocumentDecimalPlaces = useCallback(
    (value: number): void => {
      if (activeDocumentIsSharedVisitor) {
        setMessage("Only the sheet owner can change decimal places");
        return;
      }
      const nextDecimalPlaces = normalizeDecimalPlaces(value);
      updateActiveDocumentData((current) => ({
        ...current,
        decimalPlaces: nextDecimalPlaces
      }));
      setIsDirty(true);
      setMessage(
        `Results show up to ${nextDecimalPlaces} decimal ${nextDecimalPlaces === 1 ? "place" : "places"}`
      );
    },
    [activeDocumentIsSharedVisitor, updateActiveDocumentData]
  );

  const applyLineOrder = useCallback(
    (
      lineOrder: number[],
      nextMessage: string,
      preserveSectionSortUndo = false
    ): void => {
      if (lineOrder.length !== sourceLines.length) return;

      const nextLines = lineOrder.map((lineIndex) => sourceLines[lineIndex] ?? "");
      const indexMap = indexMapFromLineOrder(lineOrder);
      const nextEditorText = nextLines.join("\n");

      updateActiveDocumentData(
        (current) => {
          return {
            ...current,
            text: nextEditorText,
            loopedLines: remapLineNumbers(current.loopedLines, indexMap),
            variableDefinitions: remapVariableDefinitionMetadata(
              current.variableDefinitions?.length
                ? current.variableDefinitions
                : variableDefinitionState.metadata,
              indexMap
            ),
            resultSortMode: "manual"
          };
        },
        preserveSectionSortUndo
      );
      setIsDirty(true);
      setMessage(nextMessage);
      requestAnimationFrame(() => {
        if (editorRef.current) {
          syncEditorScroll(editorRef.current);
          editorRef.current.focus();
        }
      });
    },
    [sourceLines, syncEditorScroll, updateActiveDocumentData, variableDefinitionState.metadata]
  );

  const sortSection = useCallback(
    (titleLineIndex: number): void => {
      if (!canSafelySortSection(evaluation.lines, titleLineIndex, activeResultLoop)) {
        setMessage("This section can't be safely sorted");
        return;
      }

      const direction = nextSectionSortDirection(
        evaluation.lines,
        titleLineIndex,
        activeResultLoop
      );
      const lineOrder = buildSectionSortLineOrder(
        evaluation.lines,
        titleLineIndex,
        activeResultLoop,
        direction
      );
      const changed = lineOrder.some((lineIndex, index) => lineIndex !== index);

      if (!changed) {
        setMessage("Section is already sorted");
        return;
      }

      sectionSortUndoRef.current = createSectionSortUndoSnapshot(
        activeDocumentId,
        documentData,
        isDirty
      );
      applyLineOrder(
        lineOrder,
        direction === "descending"
          ? "Section sorted high to low"
          : "Section sorted low to high",
        true
      );
    },
    [activeDocumentId, activeResultLoop, applyLineOrder, documentData, evaluation.lines, isDirty]
  );

  const undoSectionSort = useCallback((): boolean => {
    const snapshot = sectionSortUndoRef.current;
    if (!snapshot || snapshot.documentId !== activeDocumentId) return false;

    sectionSortUndoRef.current = undefined;
    updateActiveDocumentData((current) => restoreSectionSortSnapshot(current, snapshot));
    setIsDirty(snapshot.wasDirty);
    setMessage("Section sort undone");
    requestAnimationFrame(() => {
      const target = editorRef.current;
      if (!target) return;
      syncEditorScroll(target);
      target.focus();
      setEditorSelection(target, snapshot.text.length);
    });
    return true;
  }, [activeDocumentId, syncEditorScroll, updateActiveDocumentData]);

  const updateText = useCallback(
    (text: string): void => {
      updateActiveDocumentData((current) => {
        const title = activeDocumentIsSharedVisitor
          ? current.title
          : autoTitleForSheet(current.title, text);
        const nextVariableState = variableDefinitionStateForText(
          text,
          current.variableDefinitions ?? [],
          current.loopedLines
        );
        return {
          ...current,
          title,
          text,
          loopedLines: reconcilePublishedLineNumbers(
            current.text,
            text,
            current.loopedLines
          ),
          loopSidebarDividerLines: [
            ...((current.loopSidebarDividerLines ?? []).includes(0) ? [0] : []),
            ...reconcilePublishedLineNumbers(
              current.text,
              text,
              (current.loopSidebarDividerLines ?? []).filter((lineNumber) => lineNumber !== 0)
            )
          ],
          stockSymbols: extractStockSymbols(text),
          variableDefinitions: nextVariableState.metadata,
          resultSortMode: "manual"
        };
      });
      setIsDirty(true);
      requestAnimationFrame(() => {
        if (editorRef.current) {
          syncEditorScroll(editorRef.current);
        }
      });
    },
    [activeDocumentIsSharedVisitor, syncEditorScroll, updateActiveDocumentData]
  );

  const applyEditorTextEdit = useCallback(
    (edit: EditorTextEdit): void => {
      const target = editorRef.current;
      if (target) {
        renderEditorText(target, edit.text);
        setEditorSelection(target, edit.selectionStart, edit.selectionEnd);
        setFocusedEditorLine(
          edit.text.slice(0, edit.selectionEnd).split("\n").length - 1
        );
      }
      updateText(edit.text);
    },
    [updateText]
  );

  const handleEditorKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>): void => {
    anchorEditorSelectionToRows(event.currentTarget);

    if (
      (event.metaKey || event.ctrlKey) &&
      !event.altKey &&
      !event.shiftKey &&
      event.key === "/" &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      const value = editorTextFromDom(event.currentTarget);
      const selection = editorSelection(event.currentTarget);
      applyEditorTextEdit(toggleLineComments(value, selection.start, selection.end));
      return;
    }

    if (
      (event.metaKey || event.ctrlKey) &&
      !event.altKey &&
      !event.shiftKey &&
      event.key.toLowerCase() === "z" &&
      !event.nativeEvent.isComposing &&
      undoSectionSort()
    ) {
      event.preventDefault();
      return;
    }

    if (
      event.key === "Enter" &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      const value = editorTextFromDom(event.currentTarget);
      const selection = editorSelection(event.currentTarget);
      applyEditorTextEdit(
        insertIndentedNewline(
          value,
          selection.start,
          selection.end
        )
      );
      return;
    }

    if (event.key !== "}" || event.nativeEvent.isComposing) return;

    const value = editorTextFromDom(event.currentTarget);
    const selection = editorSelection(event.currentTarget);
    const edit = insertDedentedClosingBrace(value, selection.start, selection.end);
    if (!edit) return;

    event.preventDefault();
    applyEditorTextEdit(edit);
  }, [applyEditorTextEdit, undoSectionSort]);

  const handleEditorBeforeInput = useCallback((event: ReactFormEvent<HTMLDivElement>): void => {
    anchorEditorSelectionToRows(event.currentTarget);
  }, []);

  const handleEditorFocus = useCallback((event: ReactFocusEvent<HTMLDivElement>): void => {
    const target = event.currentTarget;
    requestAnimationFrame(() => {
      if (document.activeElement === target) {
        anchorEditorSelectionToRows(target, true);
        setFocusedEditorLine(focusedEditorLineIndex(target));
      }
    });
  }, []);

  const handleEditorSelect = useCallback((event: ReactSyntheticEvent<HTMLDivElement>): void => {
    anchorEditorSelectionToRows(event.currentTarget);
    setFocusedEditorLine(focusedEditorLineIndex(event.currentTarget));
  }, []);

  const handleEditorBlur = useCallback((): void => {
    setFocusedEditorLine(undefined);
  }, []);

  const handleEditorCut = useCallback((event: ReactClipboardEvent<HTMLDivElement>): void => {
    const selection = editorSelection(event.currentTarget);
    if (selection.start === selection.end) return;

    const value = editorTextFromDom(event.currentTarget);
    event.preventDefault();
    event.clipboardData.setData("text/plain", value.slice(selection.start, selection.end));
    applyEditorTextEdit({
      selectionEnd: selection.start,
      selectionStart: selection.start,
      text: `${value.slice(0, selection.start)}${value.slice(selection.end)}`
    });
  }, [applyEditorTextEdit]);

  const handleEditorPaste = useCallback((event: ReactClipboardEvent<HTMLDivElement>): void => {
    const selection = editorSelection(event.currentTarget);
    const value = editorTextFromDom(event.currentTarget);
    const pastedText = event.clipboardData.getData("text/plain").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const caret = selection.start + pastedText.length;
    event.preventDefault();
    applyEditorTextEdit({
      selectionEnd: caret,
      selectionStart: caret,
      text: `${value.slice(0, selection.start)}${pastedText}${value.slice(selection.end)}`
    });
  }, [applyEditorTextEdit]);

  const handleEditorInput = useCallback((event: ReactFormEvent<HTMLDivElement>): void => {
    syncEditorRowClasses(event.currentTarget);
    setFocusedEditorLine(focusedEditorLineIndex(event.currentTarget));
    updateText(editorTextFromDom(event.currentTarget));
  }, [updateText]);

  const canReorderLine = useCallback(
    (lineIndex: number): boolean =>
      lineIndex >= minimumReorderLineIndex &&
      lineIndex < sourceLines.length &&
      sourceLines.length - minimumReorderLineIndex > 1,
    [minimumReorderLineIndex, sourceLines.length]
  );

  const lineIndexFromPointer = useCallback(
    (clientY: number): number => {
      const maximumLineIndex = sourceLines.length - 1;
      if (maximumLineIndex < minimumReorderLineIndex) return maximumLineIndex;

      const target = editorRef.current;
      if (!target) return minimumReorderLineIndex;

      const styles = window.getComputedStyle(target);
      const rowHeight =
        Number.parseFloat(styles.lineHeight) ||
        Number.parseFloat(styles.getPropertyValue("--row-height")) ||
        30;
      const topPadding = Number.parseFloat(styles.paddingTop) || 0;
      const relativeY = clientY - target.getBoundingClientRect().top + target.scrollTop - topPadding;
      const rowHeights = Array.from(rowHandlesInnerRef.current?.children ?? []).map((row) =>
        row instanceof HTMLElement ? row.offsetHeight : rowHeight
      );
      const lineIndex = lineIndexAtVerticalOffset(
        rowHeights,
        relativeY,
        minimumReorderLineIndex
      );

      return clampLineIndex(lineIndex, minimumReorderLineIndex, maximumLineIndex);
    },
    [minimumReorderLineIndex, sourceLines.length]
  );

  const reorderRow = useCallback(
    (sourceIndex: number, targetIndex: number): void => {
      if (!canReorderLine(sourceIndex)) return;

      const maximumLineIndex = sourceLines.length - 1;
      const safeTargetIndex = clampLineIndex(targetIndex, minimumReorderLineIndex, maximumLineIndex);
      if (sourceIndex === safeTargetIndex) return;

      applyLineOrder(
        buildMovedLineOrder(sourceLines.length, sourceIndex, safeTargetIndex),
        "Row moved"
      );
    },
    [applyLineOrder, canReorderLine, minimumReorderLineIndex, sourceLines.length]
  );

  const clearRowDrag = useCallback((pointerId?: number): void => {
    const currentDrag = rowDragRef.current;
    if (!currentDrag || (pointerId !== undefined && currentDrag.pointerId !== pointerId)) return;

    rowDragRef.current = undefined;
    setRowDrag(undefined);

    const captureTarget = rowDragCaptureTargetRef.current;
    rowDragCaptureTargetRef.current = undefined;
    if (captureTarget?.hasPointerCapture(currentDrag.pointerId)) {
      captureTarget.releasePointerCapture(currentDrag.pointerId);
    }
  }, []);

  const beginRowDrag = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>, sourceIndex: number): void => {
      if (!canReorderLine(sourceIndex) || !event.isPrimary || event.button !== 0) return;

      const rowElement = event.currentTarget.closest(".row-reorder-row");
      const editor = editorRef.current;
      if (!(rowElement instanceof HTMLElement) || !editor) return;

      event.preventDefault();
      event.stopPropagation();
      window.getSelection()?.removeAllRanges();
      clearRowDrag();

      const rowBounds = rowElement.getBoundingClientRect();
      const editorBounds = editor.getBoundingClientRect();
      const nextDrag: RowDragState = {
        grabOffsetY: event.clientY - rowBounds.top,
        pointerId: event.pointerId,
        previewTop: rowBounds.top - editorBounds.top,
        sourceHeight: rowBounds.height,
        sourceIndex,
        targetIndex: sourceIndex
      };

      rowDragCaptureTargetRef.current = event.currentTarget;
      rowDragRef.current = nextDrag;
      setRowDrag(nextDrag);
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        rowDragCaptureTargetRef.current = undefined;
      }
    },
    [canReorderLine, clearRowDrag]
  );

  const updateRowDragAtPointer = useCallback(
    (pointerId: number, clientY: number): void => {
      const currentDrag = rowDragRef.current;
      const editor = editorRef.current;
      if (!currentDrag || currentDrag.pointerId !== pointerId || !editor) return;

      const editorBounds = editor.getBoundingClientRect();
      const rawPreviewTop = clientY - editorBounds.top - currentDrag.grabOffsetY;
      const previewEdgeInset = 6;
      const maximumPreviewTop = Math.max(
        previewEdgeInset,
        editorBounds.height - currentDrag.sourceHeight - previewEdgeInset
      );
      const previewTop = Math.max(
        previewEdgeInset,
        Math.min(maximumPreviewTop, rawPreviewTop)
      );
      const previewCenterY =
        clientY - currentDrag.grabOffsetY + currentDrag.sourceHeight / 2;
      const targetIndex = lineIndexFromPointer(previewCenterY);
      if (
        targetIndex === currentDrag.targetIndex &&
        Math.abs(previewTop - currentDrag.previewTop) < 0.5
      ) {
        return;
      }

      const nextDrag = { ...currentDrag, previewTop, targetIndex };
      rowDragRef.current = nextDrag;
      setRowDrag(nextDrag);
    },
    [lineIndexFromPointer]
  );

  const finishRowDragAtPointer = useCallback(
    (pointerId: number, clientY: number): void => {
      const currentDrag = rowDragRef.current;
      if (!currentDrag || currentDrag.pointerId !== pointerId) return;

      const previewCenterY =
        clientY - currentDrag.grabOffsetY + currentDrag.sourceHeight / 2;
      const targetIndex = lineIndexFromPointer(previewCenterY);
      clearRowDrag(pointerId);
      reorderRow(currentDrag.sourceIndex, targetIndex);
    },
    [clearRowDrag, lineIndexFromPointer, reorderRow]
  );

  const finishRowDrag = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>): void => {
      event.preventDefault();
      event.stopPropagation();
      finishRowDragAtPointer(event.pointerId, event.clientY);
    },
    [finishRowDragAtPointer]
  );

  const cancelRowDrag = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>): void => {
      event.preventDefault();
      event.stopPropagation();
      clearRowDrag(event.pointerId);
    },
    [clearRowDrag]
  );

  const resizeLoopSidebar = useCallback((width: number): number => {
    const nextWidth = clampLoopSidebarWidth(width, window.innerWidth);
    loopSidebarWidthIsCustomRef.current = true;
    setLoopSidebarWidth(nextWidth);
    return nextWidth;
  }, []);

  const beginLoopSidebarResize = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>): void => {
      if (!isLoopSidebarVisible) return;

      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      loopSidebarDragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startWidth: loopSidebarWidth
      };
      setIsLoopSidebarResizing(true);
    },
    [isLoopSidebarVisible, loopSidebarWidth]
  );

  const updateLoopSidebarResize = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>): void => {
      const currentDrag = loopSidebarDragRef.current;
      if (!currentDrag || currentDrag.pointerId !== event.pointerId) return;

      event.preventDefault();
      event.stopPropagation();
      resizeLoopSidebar(currentDrag.startWidth + currentDrag.startX - event.clientX);
    },
    [resizeLoopSidebar]
  );

  const finishLoopSidebarResize = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>): void => {
      const currentDrag = loopSidebarDragRef.current;
      if (!currentDrag || currentDrag.pointerId !== event.pointerId) return;

      event.preventDefault();
      event.stopPropagation();
      const nextWidth = resizeLoopSidebar(currentDrag.startWidth + currentDrag.startX - event.clientX);
      loopSidebarDragRef.current = undefined;
      setIsLoopSidebarResizing(false);
      setMessage(`Loop sidebar ${nextWidth}px`);

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    [resizeLoopSidebar]
  );

  const cancelLoopSidebarResize = useCallback((event: ReactPointerEvent<HTMLDivElement>): void => {
    const currentDrag = loopSidebarDragRef.current;
    if (!currentDrag || currentDrag.pointerId !== event.pointerId) return;

    loopSidebarDragRef.current = undefined;
    setIsLoopSidebarResizing(false);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const handleLoopSidebarResizeKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>): void => {
      const step = event.shiftKey ? 40 : 16;
      let nextWidth: number | undefined;

      if (event.key === "ArrowLeft") {
        nextWidth = loopSidebarWidth + step;
      }

      if (event.key === "ArrowRight") {
        nextWidth = loopSidebarWidth - step;
      }

      if (event.key === "Home") {
        nextWidth = loopSidebarMinWidth;
      }

      if (event.key === "End") {
        nextWidth = maximumLoopSidebarWidth(window.innerWidth);
      }

      if (nextWidth === undefined) return;

      event.preventDefault();
      const resizedWidth = resizeLoopSidebar(nextWidth);
      setMessage(`Loop sidebar ${resizedWidth}px`);
    },
    [loopSidebarWidth, resizeLoopSidebar]
  );

  const resizeLoopVariablesDrawer = useCallback(
    (height: number): number => {
      const sidebarHeight =
        loopResultsRef.current?.getBoundingClientRect().height ?? loopResultsHeight;
      const nextHeight = clampLoopVariablesDrawerHeight(height, sidebarHeight);
      setLoopVariablesDrawerHeight(nextHeight);
      return nextHeight;
    },
    [loopResultsHeight]
  );

  const persistLoopVariablesDrawerHeight = useCallback((height: number): void => {
    loopVariablesDrawerHasCustomHeightRef.current = true;
    try {
      window.localStorage.setItem(loopVariablesDrawerHeightStorageKey, String(height));
    } catch {
      // Local storage can be unavailable in unusual browser contexts.
    }
  }, []);

  const beginLoopVariablesDrawerResize = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>): void => {
      if (!isLoopVariablesDrawerOpen) return;

      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      loopVariablesDrawerDragRef.current = {
        pointerId: event.pointerId,
        startHeight: loopVariablesDrawerHeight,
        startY: event.clientY
      };
      setIsLoopVariablesDrawerResizing(true);
    },
    [isLoopVariablesDrawerOpen, loopVariablesDrawerHeight]
  );

  const updateLoopVariablesDrawerResize = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>): void => {
      const currentDrag = loopVariablesDrawerDragRef.current;
      if (!currentDrag || currentDrag.pointerId !== event.pointerId) return;

      event.preventDefault();
      event.stopPropagation();
      resizeLoopVariablesDrawer(
        currentDrag.startHeight + currentDrag.startY - event.clientY
      );
    },
    [resizeLoopVariablesDrawer]
  );

  const finishLoopVariablesDrawerResize = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>): void => {
      const currentDrag = loopVariablesDrawerDragRef.current;
      if (!currentDrag || currentDrag.pointerId !== event.pointerId) return;

      event.preventDefault();
      event.stopPropagation();
      const nextHeight = resizeLoopVariablesDrawer(
        currentDrag.startHeight + currentDrag.startY - event.clientY
      );
      loopVariablesDrawerDragRef.current = undefined;
      setIsLoopVariablesDrawerResizing(false);
      persistLoopVariablesDrawerHeight(nextHeight);
      setMessage(`Variables section ${nextHeight}px`);

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    [persistLoopVariablesDrawerHeight, resizeLoopVariablesDrawer]
  );

  const cancelLoopVariablesDrawerResize = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>): void => {
      const currentDrag = loopVariablesDrawerDragRef.current;
      if (!currentDrag || currentDrag.pointerId !== event.pointerId) return;

      loopVariablesDrawerDragRef.current = undefined;
      setIsLoopVariablesDrawerResizing(false);

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    []
  );

  const handleLoopVariablesDrawerResizeKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>): void => {
      const step = event.shiftKey ? 48 : 16;
      let nextHeight: number | undefined;

      if (event.key === "ArrowUp") nextHeight = loopVariablesDrawerHeight + step;
      if (event.key === "ArrowDown") nextHeight = loopVariablesDrawerHeight - step;
      if (event.key === "Home") {
        nextHeight = minimumLoopVariablesDrawerHeight(loopResultsHeight);
      }
      if (event.key === "End") {
        nextHeight = maximumLoopVariablesDrawerHeight(loopResultsHeight);
      }
      if (nextHeight === undefined) return;

      event.preventDefault();
      const resizedHeight = resizeLoopVariablesDrawer(nextHeight);
      persistLoopVariablesDrawerHeight(resizedHeight);
      setMessage(`Variables section ${resizedHeight}px`);
    },
    [
      loopResultsHeight,
      loopVariablesDrawerHeight,
      persistLoopVariablesDrawerHeight,
      resizeLoopVariablesDrawer
    ]
  );

  const closeDocumentMenu = useCallback((): void => {
    setIsDocumentMenuOpen(false);
    setIsRenameEditing(false);
  }, []);

  const closeLibraryDocumentMenu = useCallback((): void => {
    setOpenLibraryDocumentMenuId(undefined);
  }, []);

  const closeLibraryBulkMenu = useCallback((): void => {
    setIsLibraryBulkMenuOpen(false);
  }, []);

  const clearLibrarySelection = useCallback((): void => {
    setSelectedLibraryDocumentIds(new Set());
    setIsLibraryBulkMenuOpen(false);
  }, []);

  const toggleLibraryDocumentSelection = useCallback((id: string): void => {
    closeLibraryDocumentMenu();
    setIsLibrarySearchOpen(false);
    setLibrarySearchQuery("");
    setIsLibrarySettingsMenuOpen(false);
    if (selectedLibraryDocumentIds.size === 1 && selectedLibraryDocumentIds.has(id)) {
      setIsLibraryBulkMenuOpen(false);
    }
    setSelectedLibraryDocumentIds((currentIds) => {
      const nextIds = new Set(currentIds);
      if (nextIds.has(id)) {
        nextIds.delete(id);
      } else {
        nextIds.add(id);
      }
      return nextIds;
    });
  }, [closeLibraryDocumentMenu, selectedLibraryDocumentIds]);

  const openLibraryDocumentMenu = useCallback((id: string): void => {
    setIsLibrarySettingsMenuOpen(false);
    setIsLibraryBulkMenuOpen(false);
    setOpenLibraryDocumentMenuId(id);
  }, []);

  const toggleDocumentMenu = useCallback((): void => {
    setIsLoopCountMenuOpen(false);
    setIsLoopPeriodMenuOpen(false);
    setIsLoopPeriodCustomEditing(false);
    setRenameDraft(documentTitle);
    setIsRenameEditing(false);
    setIsDocumentMenuOpen((current) => !current);
  }, [documentTitle]);

  const activateAccount = useCallback((account: AccountSummary): number => {
    const generation = accountGenerationRef.current + 1;
    accountGenerationRef.current = generation;
    currentAccountIdRef.current = account.id;
    setAccountState({ account, status: "authenticated" });
    setBillingStatus(undefined);
    return generation;
  }, []);

  const isCurrentAccountOperation = useCallback(
    (generation: number, accountId: string): boolean =>
      accountGenerationRef.current === generation &&
      currentAccountIdRef.current === accountId,
    []
  );

  const loadCloudSheetsForAccount = useCallback(
    async (account: AccountSummary): Promise<void> => {
      const generation = accountGenerationRef.current;
      if (!isCurrentAccountOperation(generation, account.id)) return;
      const operationId = `${generation}:${createDocumentId()}`;
      cloudLoadOperationRef.current = operationId;
      setIsLoadingCloudSheets(true);
      cloudSyncBlockedRef.current.clear();
      cloudDraftBlockedRef.current.clear();
      let cachedSheetCount = 0;
      let cachedCloudSheets: CloudSheet[] = [];
      let cloudDrafts: CloudSheetDraft[] = [];

      const applyCloudSheets = async (
        cloudSheets: CloudSheet[],
        drafts: CloudSheetDraft[],
        authoritative: boolean
      ): Promise<{ cleanupFailed: boolean; documentCount: number }> => {
        const baseCloudDocuments = cloudSheets
          .map((sheet) => cloudSheetToLibraryDocument(sheet))
          .filter((document): document is LibraryDocument => Boolean(document));
        const baseCloudDocumentsById = new Map(
          baseCloudDocuments.map((document) => [document.id, document] as const)
        );
        const restoredCloudDocumentsById = new Map(baseCloudDocumentsById);
        const nextDraftFingerprints = new Map<string, string>();
        const draftIdsToDelete = new Set<string>();

        for (const draft of drafts) {
          const baseDocument = baseCloudDocumentsById.get(draft.sheetId);
          if (!baseDocument) {
            if (authoritative) draftIdsToDelete.add(draft.sheetId);
            continue;
          }

          nextDraftFingerprints.set(
            draft.sheetId,
            storedCloudDraftFingerprint(draft)
          );
          const restoredDocument = applyCloudDraft(baseDocument, draft);
          if (!restoredDocument) continue;
          if (
            cloudDocumentFingerprint(restoredDocument) ===
            cloudDocumentFingerprint(baseDocument)
          ) {
            if (authoritative) {
              draftIdsToDelete.add(draft.sheetId);
              nextDraftFingerprints.delete(draft.sheetId);
            }
            continue;
          }
          restoredCloudDocumentsById.set(draft.sheetId, restoredDocument);
        }

        const cleanupResults = authoritative
          ? await Promise.allSettled(
              [...draftIdsToDelete].map((sheetId) =>
                window.looper.deleteCloudDraft({ sheetId })
              )
            )
          : [];
        if (
          cloudLoadOperationRef.current !== operationId ||
          !isCurrentAccountOperation(generation, account.id)
        ) {
          return { cleanupFailed: false, documentCount: 0 };
        }

        const cloudDocuments = [...restoredCloudDocumentsById.values()];
        const previousSavedFingerprints = new Map(
          savedCloudFingerprintsRef.current
        );
        setLibraryDocuments((currentDocuments) => {
          const localDocuments = currentDocuments.filter(
            (document) =>
              !document.cloud && !baseCloudDocumentsById.has(document.id)
          );
          const currentCloudDocumentsById = new Map(
            currentDocuments.flatMap((document) =>
              document.cloud ? [[document.id, document] as const] : []
            )
          );
          const cloudDocumentsById = new Map<string, LibraryDocument>();
          for (const document of cloudDocuments) {
            const currentDocument = currentCloudDocumentsById.get(document.id);
            const currentFingerprint = currentDocument?.cloud
              ? cloudDocumentFingerprint(currentDocument)
              : undefined;
            const savedFingerprint = previousSavedFingerprints.get(document.id);
            cloudDocumentsById.set(
              document.id,
              currentDocument?.cloud &&
                currentFingerprint !== undefined &&
                savedFingerprint !== undefined &&
                currentFingerprint !== savedFingerprint
                ? {
                    ...currentDocument,
                    cloud: document.cloud,
                    updatedAt: document.updatedAt
                  }
                : document
            );
          }
          return [...cloudDocumentsById.values(), ...localDocuments];
        });

        savedCloudFingerprintsRef.current.clear();
        for (const document of baseCloudDocuments) {
          savedCloudFingerprintsRef.current.set(
            document.id,
            cloudDocumentFingerprint(document)
          );
        }
        savedCloudDraftFingerprintsRef.current.clear();
        pendingCloudDraftFingerprintsRef.current.clear();
        for (const [sheetId, fingerprint] of nextDraftFingerprints) {
          savedCloudDraftFingerprintsRef.current.set(sheetId, fingerprint);
        }
        return {
          cleanupFailed: cleanupResults.some(
            (result) => result.status === "rejected"
          ),
          documentCount: cloudDocuments.length
        };
      };

      try {
        const [cachedSheetsResult, draftsResult] = await Promise.allSettled([
          window.looper.listCachedCloudSheets(),
          window.looper.listCloudDrafts()
        ]);
        if (
          cloudLoadOperationRef.current !== operationId ||
          !isCurrentAccountOperation(generation, account.id)
        ) {
          return;
        }
        if (cachedSheetsResult.status === "fulfilled") {
          cachedCloudSheets = cachedSheetsResult.value;
          cachedSheetCount = cachedCloudSheets.length;
        }
        if (draftsResult.status === "fulfilled") {
          cloudDrafts = draftsResult.value;
        }
        if (cachedCloudSheets.length > 0) {
          await applyCloudSheets(cachedCloudSheets, cloudDrafts, false);
        }

        const [cloudSheets, loadedBillingStatus] = await Promise.all([
          window.looper.listCloudSheets(),
          window.looper.getBillingStatus().catch(() => undefined)
        ]);
        if (
          cloudLoadOperationRef.current !== operationId ||
          !isCurrentAccountOperation(generation, account.id)
        ) {
          return;
        }
        if (loadedBillingStatus) setBillingStatus(loadedBillingStatus);

        let cacheRefreshFailed = false;
        try {
          await window.looper.replaceCachedCloudSheets(cloudSheets);
        } catch {
          cacheRefreshFailed = true;
        }
        const { cleanupFailed, documentCount } = await applyCloudSheets(
          cloudSheets,
          cloudDrafts,
          true
        );
        if (
          cloudLoadOperationRef.current !== operationId ||
          !isCurrentAccountOperation(generation, account.id)
        ) {
          return;
        }
        if (cleanupFailed || cacheRefreshFailed) {
          const cleanupMessage =
            cacheRefreshFailed
              ? "Your sheets synced, but the offline copy could not be refreshed."
              : "Your sheets loaded, but an obsolete secure draft could not be removed.";
          setCloudSyncState("error");
          setCloudSyncErrorMessage(cleanupMessage);
          setMessage(cleanupMessage);
        } else {
          setCloudSyncState("saved");
          setCloudSyncErrorMessage("");
          setMessage(
            documentCount === 1
              ? `Loaded 1 sheet for ${account.email}`
              : `Loaded ${documentCount} sheets for ${account.email}`
          );
        }
      } catch (error) {
        if (
          cloudLoadOperationRef.current !== operationId ||
          !isCurrentAccountOperation(generation, account.id)
        ) {
          return;
        }
        for (const sheet of cachedCloudSheets) {
          cloudSyncBlockedRef.current.add(sheet.id);
        }
        const offlineMessage =
          cachedSheetCount > 0
            ? "Cloud is unavailable. Your sheets and edits are saved on this device and will sync automatically when the connection returns."
            : "Cloud is unavailable, and this device does not have an offline copy yet.";
        setCloudSyncState("offline");
        setCloudSyncErrorMessage(offlineMessage);
        setMessage(offlineMessage);
      } finally {
        if (cloudLoadOperationRef.current === operationId) {
          cloudLoadOperationRef.current = undefined;
          if (isCurrentAccountOperation(generation, account.id)) {
            setIsLoadingCloudSheets(false);
          }
        }
      }
    },
    [isCurrentAccountOperation]
  );

  const createLocalOwnedSheet = useCallback(
    async (intent: OwnedSheetIntent): Promise<void> => {
      if (window.looper.platform === "web") {
        throw new Error("On This Mac storage is available in the Looper desktop app.");
      }
      if (intent.requireShareableUrlAfterCreate) {
        throw new Error("Shareable sheets must be stored in Looper Cloud.");
      }
      setIsCreatingLocalSheet(true);
      try {
        const title = normalizeDocumentTitle(intent.data.title);
        const sheet = await window.looper.createLocalSheet({
          id: intent.clientCreatedId,
          document: intent.data as unknown as JsonObject,
          title
        });
        const nextDocument = localSheetToLibraryDocument(sheet);
        if (!nextDocument) {
          throw new Error("Local storage returned an invalid sheet.");
        }

        savedLocalFingerprintsRef.current.set(
          nextDocument.id,
          localDocumentFingerprint(nextDocument)
        );
        setLibraryDocuments((currentDocuments) => {
          if (!intent.replaceDocumentId) {
            return [
              nextDocument,
              ...currentDocuments.filter(
                (document) => document.id !== nextDocument.id
              )
            ];
          }

          const replacedDocumentIndex = currentDocuments.findIndex(
            (document) => document.id === intent.replaceDocumentId
          );
          const nextDocuments = currentDocuments.filter(
            (document) =>
              document.id !== intent.replaceDocumentId &&
              document.id !== nextDocument.id
          );
          nextDocuments.splice(
            replacedDocumentIndex < 0
              ? 0
              : Math.min(replacedDocumentIndex, nextDocuments.length),
            0,
            nextDocument
          );
          return nextDocuments;
        });
        if (!intent.stayInLibrary) {
          setActiveDocumentId(nextDocument.id);
          setViewMode("editor");
          pushBrowserView(nextDocument.id);
        }
        setIsLibrarySettingsMenuOpen(false);
        setIsLoopCountMenuOpen(false);
        closeLibraryDocumentMenu();
        closeDocumentMenu();
        setPendingSheetIntent(undefined);
        setIsDirty(false);
        setMessage(intent.successMessage);
        if (!intent.stayInLibrary) {
          requestAnimationFrame(() => editorRef.current?.focus());
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Could not create a local sheet.";
        setMessage(errorMessage);
        throw error;
      } finally {
        setIsCreatingLocalSheet(false);
      }
    },
    [
      closeDocumentMenu,
      closeLibraryDocumentMenu,
      pushBrowserView
    ]
  );

  const createOwnedSheet = useCallback(
    async (intent: OwnedSheetIntent): Promise<void> => {
      if (localOnlyMode && !demoTimeEnabled) {
        await createLocalOwnedSheet(intent);
        return;
      }
      if (demoTimeEnabled) {
        if (intent.requireShareableUrlAfterCreate) {
          setMessage("Sharing is disabled in Demo Time");
          return;
        }
        const nextDocument = createDemoLibraryDocument(intent);
        setLibraryDocuments((currentDocuments) => {
          if (!intent.replaceDocumentId) {
            return [
              nextDocument,
              ...currentDocuments.filter(
                (document) => document.id !== nextDocument.id
              )
            ];
          }

          const replacedDocumentIndex = currentDocuments.findIndex(
            (document) => document.id === intent.replaceDocumentId
          );
          const nextDocuments = currentDocuments.filter(
            (document) =>
              document.id !== intent.replaceDocumentId &&
              document.id !== nextDocument.id
          );
          nextDocuments.splice(
            replacedDocumentIndex < 0
              ? 0
              : Math.min(replacedDocumentIndex, nextDocuments.length),
            0,
            nextDocument
          );
          return nextDocuments;
        });
        if (!intent.stayInLibrary) {
          setActiveDocumentId(nextDocument.id);
          setViewMode("editor");
          requestAnimationFrame(() => editorRef.current?.focus());
        }
        setIsLibrarySettingsMenuOpen(false);
        setIsLoopCountMenuOpen(false);
        closeLibraryDocumentMenu();
        closeDocumentMenu();
        setPendingSheetIntent(undefined);
        setIsDirty(false);
        setMessage(intent.successMessage.replace("saved to your account", "created for this demo"));
        return;
      }

      const accountId = currentAccountIdRef.current;
      const generation = accountGenerationRef.current;
      if (!accountId || !isCurrentAccountOperation(generation, accountId)) {
        throw new Error("Sign in before creating a sheet.");
      }
      if (cloudCreateOperationRef.current) return;
      const operationId = `${generation}:${intent.clientCreatedId}`;
      cloudCreateOperationRef.current = operationId;
      setIsCreatingCloudSheet(true);
      setCloudSyncState("saving");
      setCloudSyncErrorMessage("");
      try {
        const title = normalizeDocumentTitle(intent.data.title);
        let sheet = await window.looper.createCloudSheet({
          clientCreatedId: intent.clientCreatedId,
          document: intent.data as unknown as JsonObject,
          title
        });
        let offlineCacheFailed = false;
        if (
          cloudCreateOperationRef.current !== operationId ||
          !isCurrentAccountOperation(generation, accountId)
        ) {
          return;
        }
        sheet = await enableShareableUrlAfterCreate(
          sheet,
          Boolean(intent.requireShareableUrlAfterCreate),
          window.looper.updateCloudSheet
        );
        if (
          cloudCreateOperationRef.current !== operationId ||
          !isCurrentAccountOperation(generation, accountId)
        ) {
          return;
        }
        try {
          await window.looper.cacheCloudSheet(sheet);
        } catch {
          offlineCacheFailed = true;
        }
        const nextDocument = cloudSheetToLibraryDocument(sheet, intent.path);
        if (!nextDocument) {
          throw new Error("The server returned an invalid sheet.");
        }

        savedCloudFingerprintsRef.current.set(
          nextDocument.id,
          cloudDocumentFingerprint(nextDocument)
        );
        setBillingStatus((current) =>
          current
            ? {
                ...current,
                canCreateSheet:
                  current.sheetCount + 1 < current.sheetLimit,
                sheetCount: current.sheetCount + 1,
                unusedSheetCount: Math.max(
                  0,
                  current.sheetLimit - current.sheetCount - 1
                )
              }
            : current
        );
        setLibraryDocuments((currentDocuments) => {
          if (!intent.replaceDocumentId) {
            return [
              nextDocument,
              ...currentDocuments.filter((document) => document.id !== nextDocument.id)
            ];
          }

          const replacedDocumentIndex = currentDocuments.findIndex(
            (document) => document.id === intent.replaceDocumentId
          );
          const nextDocuments = currentDocuments.filter(
            (document) =>
              document.id !== intent.replaceDocumentId && document.id !== nextDocument.id
          );
          nextDocuments.splice(
            replacedDocumentIndex < 0
              ? 0
              : Math.min(replacedDocumentIndex, nextDocuments.length),
            0,
            nextDocument
          );
          return nextDocuments;
        });
        if (!intent.stayInLibrary) {
          setActiveDocumentId(nextDocument.id);
          setViewMode("editor");
          pushBrowserView(nextDocument.id);
          if (
            isSharedAccess &&
            window.looper.platform === "web" &&
            nextDocument.cloud?.shareToken
          ) {
            window.history.replaceState(
              null,
              "",
              `/s/${nextDocument.cloud.shareToken}`
            );
          }
        }
        setIsLibrarySettingsMenuOpen(false);
        setIsLoopCountMenuOpen(false);
        closeLibraryDocumentMenu();
        closeDocumentMenu();
        setPendingSheetIntent((currentIntent) =>
          currentIntent?.clientCreatedId === intent.clientCreatedId
            ? undefined
            : currentIntent
        );
        setIsDirty(false);
        const offlineCacheMessage =
          "The sheet saved to cloud, but its offline copy could not be refreshed.";
        setCloudSyncState(offlineCacheFailed ? "error" : "saved");
        setCloudSyncErrorMessage(
          offlineCacheFailed ? offlineCacheMessage : ""
        );
        if (
          intent.requireShareableUrlAfterCreate &&
          (!nextDocument.cloud?.shareEnabled || !nextDocument.cloud.shareToken)
        ) {
          const errorMessage =
            "Shareable URLs are not available from the connected Looper web service yet.";
          setCloudSyncState("error");
          setCloudSyncErrorMessage(errorMessage);
          setMessage(errorMessage);
        } else if (
          intent.copyShareableUrlAfterCreate &&
          nextDocument.cloud?.shareEnabled &&
          nextDocument.cloud.shareToken
        ) {
          try {
            await window.looper.copyShareableUrl({
              shareToken: nextDocument.cloud.shareToken
            });
            setMessage("Shareable URL copied");
          } catch (error) {
            const errorMessage =
              error instanceof Error
                ? error.message
                : "The sheet is shareable, but its URL could not be copied.";
            setCloudSyncState("error");
            setCloudSyncErrorMessage(errorMessage);
            setMessage(errorMessage);
          }
        } else {
          setMessage(
            offlineCacheFailed ? offlineCacheMessage : intent.successMessage
          );
        }
        if (!intent.stayInLibrary) {
          requestAnimationFrame(() => editorRef.current?.focus());
        }
      } catch (error) {
        if (
          cloudCreateOperationRef.current !== operationId ||
          !isCurrentAccountOperation(generation, accountId)
        ) {
          return;
        }
        const errorMessage =
          error instanceof Error ? error.message : "Could not create your sheet.";
        const reportedSheetLimit = isSheetLimitIssue(errorMessage);
        let latestBillingStatus = effectiveBillingStatus;
        if (
          reportedSheetLimit ||
          !latestBillingStatus ||
          latestBillingStatus.unusedSheetCount <= 1
        ) {
          try {
            latestBillingStatus = await window.looper.getBillingStatus();
            if (
              cloudCreateOperationRef.current !== operationId ||
              !isCurrentAccountOperation(generation, accountId)
            ) {
              return;
            }
            setBillingStatus(latestBillingStatus);
          } catch {
            // Preserve the original create failure when quota cannot be refreshed.
          }
        }
        if (
          reportedSheetLimit ||
          (latestBillingStatus &&
            !billingStatusAllowsSheetCreation(latestBillingStatus))
        ) {
          setIsBillingDialogOpen(true);
          setCloudSyncState("saved");
          setCloudSyncErrorMessage("");
          setMessage("No unused sheets. Add more sheets to continue.");
          return;
        }
        setCloudSyncState("error");
        setCloudSyncErrorMessage(errorMessage);
        setMessage(errorMessage);
        throw error;
      } finally {
        if (cloudCreateOperationRef.current === operationId) {
          cloudCreateOperationRef.current = undefined;
          setIsCreatingCloudSheet(false);
        }
      }
    },
    [
      closeDocumentMenu,
      closeLibraryDocumentMenu,
      createLocalOwnedSheet,
      demoTimeEnabled,
      effectiveBillingStatus,
      isSharedAccess,
      isCurrentAccountOperation,
      localOnlyMode,
      pushBrowserView
    ]
  );

  const createSheetForIntent = useCallback(
    (intent: OwnedSheetIntent): Promise<void> => createOwnedSheet(intent),
    [createOwnedSheet]
  );

  const requestOwnedSheet = useCallback(
    (intent: OwnedSheetIntent): void => {
      if (localOnlyMode && !demoTimeEnabled) {
        setPendingSheetIntent(intent);
        void createLocalOwnedSheet(intent).catch(() => {
          // The status message keeps local file errors visible without creating a card.
        });
        return;
      }
      if (demoTimeEnabled) {
        void createOwnedSheet(intent);
        return;
      }
      if (presentedAccountState.status === "loading") {
        setMessage("Checking your account…");
        return;
      }
      if (presentedAccountState.status === "unavailable") {
        setCloudSyncErrorMessage(presentedAccountState.message);
        setCloudSyncState("error");
        setMessage(presentedAccountState.message);
        return;
      }
      if (presentedAccountState.status === "authenticated") {
        if (isCheckingBillingAccess) {
          setMessage("Checking your cloud storage…");
          return;
        }
        if (isLoadingCloudSheets || isSigningOut) {
          setMessage(
            isSigningOut
              ? "Wait for sign out to finish."
              : "Wait for your account sheets to finish loading."
          );
          return;
        }
        if (cloudCreateOperationRef.current) {
          setMessage("Wait for the current sheet to finish saving.");
          return;
        }
        if (!effectiveBillingStatus) {
          setPendingSheetIntent(intent);
          setIsLibrarySettingsMenuOpen(false);
          closeLibraryDocumentMenu();
          closeDocumentMenu();
          setIsCheckingBillingAccess(true);
          setMessage("Checking your cloud storage…");
          void window.looper
            .getBillingStatus()
            .then((nextStatus) => {
              setBillingStatus(nextStatus);
              if (!billingStatusAllowsSheetCreation(nextStatus)) {
                setIsBillingDialogOpen(true);
                return;
              }
              return createOwnedSheet(intent);
            })
            .catch((error) => {
              const errorMessage =
                error instanceof Error
                  ? error.message
                  : "Could not check your cloud storage.";
              setCloudSyncState("error");
              setCloudSyncErrorMessage(errorMessage);
              setMessage(errorMessage);
            })
            .finally(() => setIsCheckingBillingAccess(false));
          return;
        }
        if (
          effectiveBillingStatus &&
          !billingStatusAllowsSheetCreation(effectiveBillingStatus)
        ) {
          setPendingSheetIntent(intent);
          setIsLibrarySettingsMenuOpen(false);
          closeLibraryDocumentMenu();
          closeDocumentMenu();
          setIsBillingDialogOpen(true);
          return;
        }
        setPendingSheetIntent(intent);
        void createOwnedSheet(intent).catch(() => {
          // The status message above keeps the failure visible without creating a card.
        });
        return;
      }

      setPendingSheetIntent(intent);
      setIsLibrarySettingsMenuOpen(false);
      closeLibraryDocumentMenu();
      closeDocumentMenu();
      setAccountDialogPurpose("sign-in");
      setIsAccountDialogOpen(true);
    },
    [
      closeDocumentMenu,
      closeLibraryDocumentMenu,
      createLocalOwnedSheet,
      createOwnedSheet,
      demoTimeEnabled,
      effectiveBillingStatus,
      isCheckingBillingAccess,
      isLoadingCloudSheets,
      localOnlyMode,
      presentedAccountState,
      isSigningOut
    ]
  );

  const newDocument = useCallback((): void => {
    requestOwnedSheet({
      clientCreatedId: createDocumentId(),
      data: {
        ...createInitialDocument(),
        decimalPlaces: defaultDecimalPlaces
      },
      successMessage: localOnlyMode
        ? `New sheet saved on ${localDeviceLabel}`
        : "New sheet saved to your account"
    });
  }, [defaultDecimalPlaces, localOnlyMode, requestOwnedSheet]);

  const refreshBillingAccess = useCallback(async (): Promise<void> => {
    if (billingPreviewMode !== "live") return;
    if (!authenticatedAccount) throw new Error("Sign in to refresh your purchase.");
    const nextStatus = await window.looper.getBillingStatus();
    setBillingStatus(nextStatus);
    if (
      billingStatusAllowsSheetCreation(nextStatus) &&
      pendingSheetIntent
    ) {
      setIsBillingDialogOpen(false);
      await createOwnedSheet(pendingSheetIntent);
    }
  }, [
    authenticatedAccount,
    billingPreviewMode,
    createOwnedSheet,
    pendingSheetIntent
  ]);

  const startBillingCheckout = useCallback(async (
    product: SheetPackProduct
  ): Promise<void> => {
    if (demoTimeEnabled || billingPreviewMode !== "live") return;
    await window.looper.startBillingCheckout(product);
  }, [billingPreviewMode, demoTimeEnabled]);

  useEffect(
    () =>
      window.looper.onBillingCheckoutCompleted(() => {
        setIsBillingDialogOpen(true);
        void refreshBillingAccess();
      }),
    [refreshBillingAccess]
  );

  const importDocument = useCallback(async (
    path: string,
    rawData: unknown
  ): Promise<void> => {
    const parsedData = normalizeDocumentData(rawData);
    const data = {
      ...parsedData,
      title:
        cleanDocumentTitle(parsedData.title) === defaultDocumentTitle
          ? displayName(path)
          : normalizeDocumentTitle(parsedData.title)
    };
    const existingDocument = libraryDocuments.find((document) => document.path === path);
    if (!existingDocument) {
      const intent: OwnedSheetIntent = {
        clientCreatedId: createDocumentId(),
        data,
        path,
        successMessage: localOnlyMode
          ? `Imported ${fileName(path)}`
          : `Imported ${fileName(path)} to your account`
      };
      if (localOnlyMode) {
        await createOwnedSheet(intent);
      } else {
        requestOwnedSheet(intent);
      }
      return;
    }
    const nextDocument = refreshLibraryDocument({
      ...existingDocument,
      data,
      path
    });

    setLibraryDocuments((currentDocuments) =>
      currentDocuments.map((document) =>
        document.id === existingDocument.id ? nextDocument : document
      )
    );
    setActiveDocumentId(nextDocument.id);
    setViewMode("editor");
    pushBrowserView(nextDocument.id);
    setIsLibrarySettingsMenuOpen(false);
    setIsLoopCountMenuOpen(false);
    closeLibraryDocumentMenu();
    closeDocumentMenu();
    setIsDirty(false);
    setMessage(`Opened ${fileName(path)}`);
    requestAnimationFrame(() => {
      editorRef.current?.focus();
    });
  }, [
    closeDocumentMenu,
    closeLibraryDocumentMenu,
    createOwnedSheet,
    libraryDocuments,
    localOnlyMode,
    pushBrowserView,
    requestOwnedSheet
  ]);

  const openDocument = useCallback(async (): Promise<void> => {
    try {
      const result = await window.looper.openDocument();
      if (result.canceled) return;
      await importDocument(result.path, result.data);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "The Looper sheet could not be imported."
      );
    }
  }, [importDocument]);

  const importDroppedDocuments = useCallback(
    async (files: readonly File[]): Promise<void> => {
      try {
        const results = await window.looper.openDroppedDocuments(files);
        for (const result of results) {
          if (!result.canceled) await importDocument(result.path, result.data);
        }
        if (results.length > 1) {
          setMessage(`Imported ${results.length} Looper sheets`);
        }
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "The dropped Looper sheet could not be imported."
        );
      }
    },
    [importDocument]
  );

  const revealLocalSheetDirectory = useCallback(async (): Promise<void> => {
    setIsLibrarySettingsMenuOpen(false);
    try {
      await window.looper.revealLocalSheetDirectory();
      setMessage(
        runtimePlatform === "darwin"
          ? "Opened the sheet folder in Finder"
          : "Opened the sheet folder in File Explorer"
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "The sheet folder could not be opened."
      );
    }
  }, []);

  const changeLocalSheetDirectory = useCallback(async (): Promise<void> => {
    setIsLibrarySettingsMenuOpen(false);
    try {
      const current = await window.looper.getSheetStorageSettings();
      const next = await window.looper.setSheetStorageProvider("local", true);
      setMessage(
        next.localDirectoryPath === current.localDirectoryPath
          ? "Sheet folder unchanged"
          : "Sheet folder changed"
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "The sheet folder could not be changed."
      );
    }
  }, []);

  useEffect(() => {
    if (!localOnlyMode || window.looper.platform === "web") return;

    const hasFiles = (event: DragEvent): boolean =>
      Array.from(event.dataTransfer?.types ?? []).includes("Files");
    const handleDragEnter = (event: DragEvent): void => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      localSheetDropDepthRef.current += 1;
      setIsLocalSheetDropActive(true);
    };
    const handleDragOver = (event: DragEvent): void => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    };
    const handleDragLeave = (event: DragEvent): void => {
      if (!hasFiles(event)) return;
      localSheetDropDepthRef.current = Math.max(
        0,
        localSheetDropDepthRef.current - 1
      );
      if (localSheetDropDepthRef.current === 0) {
        setIsLocalSheetDropActive(false);
      }
    };
    const handleDrop = (event: DragEvent): void => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      localSheetDropDepthRef.current = 0;
      setIsLocalSheetDropActive(false);
      const files = Array.from(event.dataTransfer?.files ?? []).filter((file) =>
        file.name.toLocaleLowerCase().endsWith(".loop")
      );
      if (files.length === 0) {
        setMessage("Only .loop files can be imported");
        return;
      }
      void importDroppedDocuments(files);
    };
    const clearDropState = (): void => {
      localSheetDropDepthRef.current = 0;
      setIsLocalSheetDropActive(false);
    };

    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("drop", handleDrop);
    window.addEventListener("dragend", clearDropState);
    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("drop", handleDrop);
      window.removeEventListener("dragend", clearDropState);
    };
  }, [importDroppedDocuments, localOnlyMode]);

  const saveDocument = useCallback(
    async (saveAs = false): Promise<void> => {
      if (demoTimeEnabled) {
        setIsDirty(false);
        setMessage("Saved for this Demo Time session");
        return;
      }
      if (isGettingStartedExampleDocumentId(activeDocumentId)) {
        setMessage("Duplicate this example to save your changes");
        return;
      }

      if (!saveAs && activeDocument?.local) {
        if (localSyncInFlightRef.current.has(activeDocument.id)) {
          setMessage("Wait for this local sheet to finish saving.");
          return;
        }
        const pendingTimeout = localSyncTimeoutsRef.current.get(activeDocument.id);
        if (pendingTimeout !== undefined) window.clearTimeout(pendingTimeout);
        localSyncTimeoutsRef.current.delete(activeDocument.id);
        try {
          const savedSheet = await window.looper.updateLocalSheet({
            document: documentData as unknown as JsonObject,
            expectedRevision: activeDocument.local.revision,
            id: activeDocument.id,
            title: normalizeDocumentTitle(documentData.title)
          });
          const savedDocument = localSheetToLibraryDocument(savedSheet);
          if (!savedDocument?.local) {
            throw new Error("Local storage returned an invalid sheet.");
          }
          const fingerprint = localDocumentFingerprint({
            ...activeDocument,
            data: documentData,
            title: savedDocument.title
          });
          savedLocalFingerprintsRef.current.set(activeDocument.id, fingerprint);
          setLibraryDocuments((currentDocuments) =>
            currentDocuments.map((document) =>
              document.id === activeDocument.id
                ? {
                    ...document,
                    data: documentData,
                    local: savedDocument.local,
                    title: savedDocument.title,
                    updatedAt: savedDocument.updatedAt
                  }
                : document
            )
          );
          setIsDirty(false);
          setMessage("Saved on this Mac");
        } catch (error) {
          setMessage(
            error instanceof Error
              ? error.message
              : "This local sheet could not be saved."
          );
        }
        return;
      }

      const result = saveAs
        ? await window.looper.saveDocumentAs(documentData)
        : await window.looper.saveDocument(documentPath, documentData);

      if (result.canceled) return;

      sectionSortUndoRef.current = undefined;
      setLibraryDocuments((currentDocuments) =>
        currentDocuments.map((document) =>
          document.id === activeDocumentId
            ? refreshLibraryDocument({ ...document, data: documentData, path: result.path })
            : document
        )
      );
      setIsDirty(false);
      setMessage(`Saved ${fileName(result.path)}`);
    },
    [activeDocument, activeDocumentId, demoTimeEnabled, documentData, documentPath]
  );

  const duplicateDocument = useCallback((): void => {
    const title = nextDuplicateTitle(documentTitle, libraryDocuments);
    requestOwnedSheet({
      clientCreatedId: createDocumentId(),
      data: {
        ...documentData,
        title,
        loopedLines: [...documentData.loopedLines],
        stockSymbols: documentData.stockSymbols ? [...documentData.stockSymbols] : []
      },
      successMessage: `Duplicated as ${title}`
    });
    closeDocumentMenu();
  }, [
    closeDocumentMenu,
    documentData,
    documentTitle,
    libraryDocuments,
    requestOwnedSheet
  ]);

  const exportDocument = useCallback(async (): Promise<void> => {
    closeDocumentMenu();
    const result = await window.looper.exportDocument(
      documentTitle,
      exportLooperCsv(evaluation, loopPeriodLabel)
    );
    if (result.canceled) return;
    setMessage(`Exported ${fileName(result.path)}`);
  }, [closeDocumentMenu, documentTitle, evaluation, loopPeriodLabel]);

  const setShareableUrlsEnabled = useCallback(
    async (enabled: boolean): Promise<void> => {
      if (demoTimeEnabled) {
        closeDocumentMenu();
        setMessage("Sharing is disabled in Demo Time");
        return;
      }
      const document = activeDocument;
      if (!document || activeDocumentIsSharedVisitor) {
        setMessage("Only the sheet owner can change sharing.");
        return;
      }
      if (!document.cloud) {
        if (!enabled) return;
        closeDocumentMenu();
        requestOwnedSheet({
          clientCreatedId: document.id,
          data: document.data,
          path: document.path,
          requireShareableUrlAfterCreate: true,
          successMessage: "Cloud copy created with shareable URLs"
        });
        return;
      }
      if (!document.cloud.shareToken) {
        closeDocumentMenu();
        setCloudSyncState("idle");
        setCloudSyncErrorMessage("");
        setMessage(
          "Shareable URLs will be available after the Looper web service is updated."
        );
        return;
      }

      const accountId = currentAccountIdRef.current;
      const generation = accountGenerationRef.current;
      if (
        !accountId ||
        !isCurrentAccountOperation(generation, accountId)
      ) {
        setMessage("Sign in as the sheet owner to change sharing.");
        return;
      }
      if (
        isUpdatingShareSettings ||
        cloudSyncInFlightRef.current.has(document.id) ||
        cloudDraftInFlightRef.current.has(document.id) ||
        cloudDeleteInFlightRef.current.has(document.id)
      ) {
        setMessage("Wait for this sheet to finish saving before changing sharing.");
        return;
      }

      const pendingTimeout = cloudSyncTimeoutsRef.current.get(document.id);
      if (pendingTimeout !== undefined) window.clearTimeout(pendingTimeout);
      cloudSyncTimeoutsRef.current.delete(document.id);
      const fingerprint = cloudDocumentFingerprint(document);
      setIsUpdatingShareSettings(true);
      setCloudSyncState("saving");
      setCloudSyncErrorMessage("");
      try {
        const sheet = await window.looper.updateCloudSheet({
          expectedRevision: document.cloud.revision,
          id: document.id,
          shareEnabled: enabled
        });
        if (!isCurrentAccountOperation(generation, accountId)) return;
        const savedDocument = cloudSheetToLibraryDocument(sheet, document.path);
        if (!savedDocument?.cloud || savedDocument.id !== document.id) {
          throw new Error("The server returned invalid sharing settings.");
        }
        let offlineCacheFailed = false;
        try {
          await window.looper.cacheCloudSheet(sheet);
        } catch {
          offlineCacheFailed = true;
        }
        savedCloudFingerprintsRef.current.set(document.id, fingerprint);
        savedCloudDraftFingerprintsRef.current.delete(document.id);
        pendingCloudDraftFingerprintsRef.current.delete(document.id);
        void window.looper.deleteCloudDraft({ sheetId: document.id }).catch(() => {});
        setLibraryDocuments((currentDocuments) =>
          currentDocuments.map((candidate) =>
            candidate.id === document.id
              ? {
                  ...candidate,
                  cloud: savedDocument.cloud,
                  updatedAt: savedDocument.updatedAt
                }
              : candidate
          )
        );
        const offlineCacheMessage =
          "Sharing updated in cloud, but the offline copy could not be refreshed.";
        setCloudSyncState(offlineCacheFailed ? "error" : "saved");
        setCloudSyncErrorMessage(
          offlineCacheFailed ? offlineCacheMessage : ""
        );
        setMessage(
          offlineCacheFailed
            ? offlineCacheMessage
            : enabled
              ? "Shareable URLs enabled"
              : "Shareable URLs disabled"
        );
      } catch (error) {
        if (!isCurrentAccountOperation(generation, accountId)) return;
        const errorMessage =
          error instanceof Error ? error.message : "Could not update sharing settings.";
        setCloudSyncState("error");
        setCloudSyncErrorMessage(errorMessage);
        setMessage(errorMessage);
      } finally {
        if (isCurrentAccountOperation(generation, accountId)) {
          setIsUpdatingShareSettings(false);
        }
      }
    }, [
      activeDocument,
      activeDocumentIsSharedVisitor,
      closeDocumentMenu,
      demoTimeEnabled,
      isCurrentAccountOperation,
      isUpdatingShareSettings,
      requestOwnedSheet
    ]
  );

  const copyShareableUrl = useCallback(async (): Promise<void> => {
    if (demoTimeEnabled) {
      closeDocumentMenu();
      setMessage("Sharing is disabled in Demo Time");
      return;
    }
    if (activeDocument && !activeDocument.cloud && !activeDocumentIsSharedVisitor) {
      closeDocumentMenu();
      requestOwnedSheet({
        clientCreatedId: activeDocument.id,
        copyShareableUrlAfterCreate: true,
        data: activeDocument.data,
        path: activeDocument.path,
        replaceDocumentId: activeDocument.id,
        requireShareableUrlAfterCreate: true,
        successMessage: "Shareable URLs enabled"
      });
      return;
    }
    if (!activeDocument?.cloud?.shareEnabled || !activeDocument.cloud.shareToken) {
      setMessage("Enable shareable URLs before copying the link.");
      return;
    }
    try {
      await window.looper.copyShareableUrl({
        shareToken: activeDocument.cloud.shareToken
      });
      closeDocumentMenu();
      setMessage("Shareable URL copied");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Could not copy the shareable URL.";
      setCloudSyncState("error");
      setCloudSyncErrorMessage(errorMessage);
      setMessage(errorMessage);
    }
  }, [
    activeDocument,
    activeDocumentIsSharedVisitor,
    closeDocumentMenu,
    demoTimeEnabled,
    requestOwnedSheet
  ]);

  const beginRename = useCallback((): void => {
    setRenameDraft(documentTitle);
    setIsRenameEditing(true);
    requestAnimationFrame(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    });
  }, [documentTitle]);

  const commitRename = useCallback((): void => {
    if (activeDocumentIsSharedVisitor) {
      closeDocumentMenu();
      setMessage("Only the sheet owner can rename this sheet.");
      return;
    }
    if (isGettingStartedExampleDocumentId(activeDocumentId)) {
      closeDocumentMenu();
      setMessage("Duplicate this example to rename it");
      return;
    }

    const title = normalizeDocumentTitle(renameDraft);
    closeDocumentMenu();
    if (title === documentTitle) return;

    updateActiveDocumentData((current) => ({ ...current, title }));
    setIsDirty(true);
    setMessage(`Renamed to ${title}`);
  }, [
    activeDocumentId,
    activeDocumentIsSharedVisitor,
    closeDocumentMenu,
    documentTitle,
    renameDraft,
    updateActiveDocumentData
  ]);

  const renameLibraryDocument = useCallback(
    (document: LibraryDocument, value: string): void => {
      const title = normalizeDocumentTitle(value);
      if (title === document.title) return;

      setLibraryDocuments((currentDocuments) =>
        currentDocuments.map((candidate) =>
          candidate.id === document.id
            ? refreshLibraryDocument({
                ...candidate,
                title,
                data: { ...candidate.data, title }
              })
            : candidate
        )
      );
      if (document.id === activeDocumentId) setIsDirty(true);
      setMessage(`Renamed to ${title}`);
    },
    [activeDocumentId]
  );

  const duplicateLibraryDocument = useCallback(
    (document: LibraryDocument): void => {
      const title = nextDuplicateTitle(document.title, libraryDocuments);
      requestOwnedSheet({
        clientCreatedId: createDocumentId(),
        data: {
          ...document.data,
          title,
          loopedLines: [...document.data.loopedLines],
          stockSymbols: document.data.stockSymbols ? [...document.data.stockSymbols] : []
        },
        successMessage: `Duplicated as ${title}`
      });
    },
    [libraryDocuments, requestOwnedSheet]
  );

  const exportLibraryDocument = useCallback(async (document: LibraryDocument): Promise<void> => {
    const title = normalizeDocumentTitle(document.data.title ?? document.title);
    let documentEvaluation = evaluation;
    if (document.id !== activeDocumentId) {
      const symbols = extractStockSymbols(document.data.text);
      let exportStockQuotes: StockQuoteMap = {};
      if (symbols.length > 0) {
        try {
          exportStockQuotes = await window.looper.fetchStockQuotes(symbols);
        } catch {
          // Evaluation errors remain visible in the CSV when market data is unavailable.
        }
      }
      const combinedQuotes = { ...stockQuotes, ...exportStockQuotes };
      documentEvaluation = activeDocumentIsSharedVisitor
        ? evaluateLooperText(
            document.data.text,
            document.data.loopCount,
            combinedQuotes,
            document.data.decimalPlaces
          )
        : new GlobalVariableWorkbook(
            globalVariableDocuments,
            combinedQuotes
          ).evaluateDocument(document.id);
    }
    const result = await window.looper.exportDocument(
      title,
      exportLooperCsv(
        documentEvaluation,
        normalizeLoopPeriodLabel(document.data.loopPeriod, document.data.loopCount)
      )
    );
    if (result.canceled) return;
    setMessage(`Exported ${fileName(result.path)}`);
  }, [
    activeDocumentId,
    activeDocumentIsSharedVisitor,
    evaluation,
    globalVariableDocuments,
    stockQuotes
  ]);

  const deleteLibraryDocument = useCallback(
    async (
      document: LibraryDocument,
      options: { confirm?: boolean } = {}
    ): Promise<boolean> => {
      if (
        isSharedAccess &&
        sharedSheet?.id === document.id &&
        sharedSheetOwnership !== "owner"
      ) {
        closeLibraryDocumentMenu();
        closeDocumentMenu();
        setMessage("Only the sheet owner can delete this sheet.");
        return false;
      }
      if (isGettingStartedExampleDocumentId(document.id)) {
        closeLibraryDocumentMenu();
        closeDocumentMenu();
        setMessage("Built-in examples reset automatically and cannot be deleted");
        return false;
      }

      if (options.confirm !== false) {
        const confirmed = window.confirm(
          `Delete “${document.title}”? This cannot be undone.`
        );
        if (!confirmed) return false;
      }
      let draftCleanupWarning: string | undefined;

      if (document.local) {
        if (localSyncInFlightRef.current.has(document.id)) {
          setMessage("Wait for this local sheet to finish saving before deleting it.");
          return false;
        }
        const pendingTimeout = localSyncTimeoutsRef.current.get(document.id);
        if (pendingTimeout !== undefined) window.clearTimeout(pendingTimeout);
        localSyncTimeoutsRef.current.delete(document.id);
        try {
          await window.looper.deleteLocalSheet({
            expectedRevision: document.local.revision,
            id: document.id
          });
          savedLocalFingerprintsRef.current.delete(document.id);
        } catch (error) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : "Could not delete this local sheet.";
          setMessage(errorMessage);
          return false;
        }
      }

      if (document.cloud) {
        const accountId = currentAccountIdRef.current;
        const generation = accountGenerationRef.current;
        if (
          !accountId ||
          !isCurrentAccountOperation(generation, accountId) ||
          cloudDeleteInFlightRef.current.has(document.id)
        ) {
          return false;
        }
        if (
          cloudSyncInFlightRef.current.has(document.id) ||
          cloudDraftInFlightRef.current.has(document.id)
        ) {
          setMessage("Wait for this sheet to finish saving before deleting it.");
          return false;
        }
        const wasBlocked = cloudSyncBlockedRef.current.has(document.id);
        cloudDeleteInFlightRef.current.add(document.id);
        cloudSyncBlockedRef.current.add(document.id);
        const pendingTimeout = cloudSyncTimeoutsRef.current.get(document.id);
        if (pendingTimeout !== undefined) window.clearTimeout(pendingTimeout);
        cloudSyncTimeoutsRef.current.delete(document.id);
        try {
          setCloudSyncState("saving");
          await window.looper.deleteCloudSheet({
            expectedRevision: document.cloud.revision,
            id: document.id
          });
          if (!isCurrentAccountOperation(generation, accountId)) return false;
          try {
            await window.looper.deleteCloudDraft({ sheetId: document.id });
          } catch {
            draftCleanupWarning =
              "The sheet was deleted, but its obsolete secure draft could not be removed.";
          }
          try {
            await window.looper.deleteCachedCloudSheet({ sheetId: document.id });
          } catch {
            draftCleanupWarning =
              "The sheet was deleted, but its offline copy could not be removed.";
          }
          if (!isCurrentAccountOperation(generation, accountId)) return false;
          savedCloudFingerprintsRef.current.delete(document.id);
          savedCloudDraftFingerprintsRef.current.delete(document.id);
          pendingCloudDraftFingerprintsRef.current.delete(document.id);
          cloudSyncBlockedRef.current.delete(document.id);
          cloudDraftBlockedRef.current.delete(document.id);
          if (draftCleanupWarning) {
            setCloudSyncState("error");
            setCloudSyncErrorMessage(draftCleanupWarning);
          } else {
            setCloudSyncState("saved");
            setCloudSyncErrorMessage("");
          }
        } catch (error) {
          if (!isCurrentAccountOperation(generation, accountId)) return false;
          if (!wasBlocked) cloudSyncBlockedRef.current.delete(document.id);
          const errorMessage =
            error instanceof Error ? error.message : "Could not delete this sheet.";
          setCloudSyncState("error");
          setCloudSyncErrorMessage(errorMessage);
          setMessage(errorMessage);
          setLibraryDocuments((currentDocuments) => [...currentDocuments]);
          return false;
        } finally {
          cloudDeleteInFlightRef.current.delete(document.id);
        }
      }

      if (document.cloud) {
        setBillingStatus((current) => {
          if (!current) return current;
          const sheetCount = Math.max(0, current.sheetCount - 1);
          return {
            ...current,
            canCreateSheet: sheetCount < current.sheetLimit,
            sheetCount,
            unusedSheetCount: Math.max(0, current.sheetLimit - sheetCount)
          };
        });
      }

      const fallbackDocumentId = latestLibraryDocumentsRef.current.find(
        (candidate) => candidate.id !== document.id
      )?.id;
      setLibraryDocuments((currentDocuments) =>
        demoTimeEnabled
          ? currentDocuments.filter((candidate) => candidate.id !== document.id)
          : restoreBundledExampleDocuments(
              currentDocuments.filter((candidate) => candidate.id !== document.id)
            )
      );
      if (document.id === activeDocumentIdRef.current) {
        setActiveDocumentId(fallbackDocumentId ?? "");
        setViewMode("library");
        setIsDirty(false);
        pushBrowserView();
      }
      closeLibraryDocumentMenu();
      closeDocumentMenu();
      setMessage(draftCleanupWarning ?? `Deleted ${document.title}`);
      return true;
    },
    [
      closeDocumentMenu,
      closeLibraryDocumentMenu,
      demoTimeEnabled,
      isCurrentAccountOperation,
      isSharedAccess,
      pushBrowserView,
      sharedSheet?.id,
      sharedSheetOwnership
    ]
  );

  const duplicateSelectedLibraryDocuments = useCallback(async (): Promise<void> => {
    if (
      selectedLibraryDocuments.length === 0 ||
      areSheetActionsDisabled ||
      presentedAccountState.status !== "authenticated"
    ) {
      return;
    }

    closeLibraryBulkMenu();
    const reservedDocuments = [...latestLibraryDocumentsRef.current];
    let duplicatedCount = 0;
    for (const document of selectedLibraryDocuments) {
      const title = nextDuplicateTitle(document.title, reservedDocuments);
      const clientCreatedId = createDocumentId();
      reservedDocuments.push({ ...document, id: clientCreatedId, title });
      try {
        await createSheetForIntent({
          clientCreatedId,
          data: {
            ...document.data,
            title,
            loopedLines: [...document.data.loopedLines],
            stockSymbols: document.data.stockSymbols
              ? [...document.data.stockSymbols]
              : []
          },
          stayInLibrary: true,
          successMessage: `Duplicated as ${title}`
        });
        duplicatedCount += 1;
      } catch {
        // The selected provider leaves the actionable failure visible in the status area.
      }
    }

    clearLibrarySelection();
    if (duplicatedCount === selectedLibraryDocuments.length) {
      setMessage(
        `Duplicated ${duplicatedCount} ${duplicatedCount === 1 ? "sheet" : "sheets"}`
      );
    } else if (duplicatedCount > 0) {
      setMessage(`Duplicated ${duplicatedCount} of ${selectedLibraryDocuments.length} sheets`);
    }
  }, [
    areSheetActionsDisabled,
    clearLibrarySelection,
    closeLibraryBulkMenu,
    createSheetForIntent,
    presentedAccountState.status,
    selectedLibraryDocuments
  ]);

  const exportAllLibraryDocuments = useCallback(async (): Promise<
    number | undefined
  > => {
    if (presentedUserLibraryDocuments.length === 0) return 0;

    const symbols = Array.from(
      new Set(
        presentedUserLibraryDocuments.flatMap((document) =>
          extractStockSymbols(document.data.text)
        )
      )
    );
    let exportStockQuotes: StockQuoteMap = {};
    if (symbols.length > 0) {
      try {
        exportStockQuotes = await window.looper.fetchStockQuotes(symbols);
      } catch {
        // Individual CSV cells preserve evaluation errors when quotes are unavailable.
      }
    }

    const workbook = new GlobalVariableWorkbook(
      globalVariableDocuments,
      { ...stockQuotes, ...exportStockQuotes }
    );
    const result = await window.looper.exportSheets(
      presentedUserLibraryDocuments.map((document) => ({
        content: exportLooperCsv(
          workbook.evaluateDocument(document.id),
          normalizeLoopPeriodLabel(
            document.data.loopPeriod,
            document.data.loopCount
          )
        ),
        suggestedName: normalizeDocumentTitle(
          document.data.title ?? document.title
        )
      }))
    );
    if (result.canceled) return undefined;
    setMessage(
      `Exported ${result.count} ${
        result.count === 1 ? "sheet" : "sheets"
      } to ${fileName(result.path)}`
    );
    return result.count;
  }, [
    globalVariableDocuments,
    presentedUserLibraryDocuments,
    stockQuotes
  ]);

  const exportSelectedLibraryDocuments = useCallback(async (): Promise<void> => {
    if (selectedLibraryDocuments.length === 0) return;
    closeLibraryBulkMenu();
    for (const document of selectedLibraryDocuments) {
      await exportLibraryDocument(document);
    }
    clearLibrarySelection();
  }, [
    clearLibrarySelection,
    closeLibraryBulkMenu,
    exportLibraryDocument,
    selectedLibraryDocuments
  ]);

  const deleteSelectedLibraryDocuments = useCallback(async (): Promise<void> => {
    if (selectedLibraryDocuments.length === 0 || selectionIncludesBundledExample) return;
    const count = selectedLibraryDocuments.length;
    const confirmed = window.confirm(
      `Delete ${count} ${count === 1 ? "sheet" : "sheets"}? This cannot be undone.`
    );
    if (!confirmed) return;

    closeLibraryBulkMenu();
    let deletedCount = 0;
    for (const document of selectedLibraryDocuments) {
      if (await deleteLibraryDocument(document, { confirm: false })) {
        deletedCount += 1;
      }
    }

    if (selectedLibraryDocumentIds.has(activeDocumentIdRef.current)) {
      const remainingDocument = latestLibraryDocumentsRef.current.find(
        (document) => !selectedLibraryDocumentIds.has(document.id)
      );
      setActiveDocumentId(remainingDocument?.id ?? "");
    }
    clearLibrarySelection();
    setMessage(
      deletedCount === count
        ? `Deleted ${count} ${count === 1 ? "sheet" : "sheets"}`
        : `Deleted ${deletedCount} of ${count} sheets`
    );
  }, [
    clearLibrarySelection,
    closeLibraryBulkMenu,
    deleteLibraryDocument,
    selectedLibraryDocumentIds,
    selectedLibraryDocuments,
    selectionIncludesBundledExample
  ]);

  const showDocumentLibrary = useCallback((): void => {
    if (isSharedAccess && window.looper.platform === "web") {
      window.location.assign("/");
      return;
    }
    sectionSortUndoRef.current = undefined;
    setLibraryDocuments((currentDocuments) =>
      demoTimeEnabled
        ? currentDocuments
        : restoreBundledExampleDocuments(currentDocuments)
    );
    if (isGettingStartedExampleDocumentId(activeDocumentIdRef.current)) {
      setIsDirty(false);
    }
    setIsLibrarySettingsMenuOpen(false);
    closeLibraryDocumentMenu();
    closeDocumentMenu();
    setIsLoopCountMenuOpen(false);
    setIsLoopPeriodMenuOpen(false);
    setIsLoopPeriodCustomEditing(false);
    setViewMode("library");
    pushBrowserView();
    setMessage("All documents");
  }, [
    closeDocumentMenu,
    closeLibraryDocumentMenu,
    demoTimeEnabled,
    isSharedAccess,
    pushBrowserView
  ]);

  const selectLibraryDocument = useCallback((id: string): void => {
    setActiveDocumentId(id);
    setViewMode("editor");
    pushBrowserView(id);
    setIsLibrarySettingsMenuOpen(false);
    clearLibrarySelection();
    closeLibraryDocumentMenu();
    closeDocumentMenu();
    setIsLoopCountMenuOpen(false);
    setIsLoopPeriodMenuOpen(false);
    setIsLoopPeriodCustomEditing(false);
    setIsDirty(false);
    setMessage("Opened document");
    requestAnimationFrame(() => editorRef.current?.focus());
  }, [
    clearLibrarySelection,
    closeDocumentMenu,
    closeLibraryDocumentMenu,
    pushBrowserView
  ]);

  const globalReferenceTarget = useCallback(
    (name: string): GlobalReferenceTarget | undefined => {
      const definition = globalVariableWorkbook?.definition(name);
      if (!definition || definition.documentId === activeDocumentId) return undefined;
      return {
        definition,
        title: `Global variable — click to open its definition in ${definition.documentTitle}`
      };
    },
    [activeDocumentId, globalVariableWorkbook]
  );

  const navigateToGlobalDefinition = useCallback(
    (definition: GlobalVariableDefinition): void => {
      pendingGlobalNavigationRef.current = definition;
      selectLibraryDocument(definition.documentId);
      setMessage(`${definition.name} is defined in ${definition.documentTitle}`);
    },
    [selectLibraryDocument]
  );

  const toggleLoopSidebarVisibility = useCallback((): void => {
    setIsLoopCountMenuOpen(false);
    if (isLoopSidebarVisible) setIsLoopVariablesDrawerOpen(false);
    if (isMobileWebLayout) {
      setIsMobileLoopSidebarOpen((current) => !current);
      setMessage(isLoopSidebarVisible ? "Loop sidebar hidden" : "Loop sidebar shown");
      return;
    }
    const sheetId = activeDocument?.id;
    if (!sheetId) return;
    if (!isLoopSidebarVisible) {
      loopSidebarCompactOverrideRef.current = loopSidebarShouldAutoCollapse(
        window.innerWidth
      );
      setIsLoopSidebarAutoCollapsed(false);
    } else if (loopSidebarShouldAutoCollapse(window.innerWidth)) {
      loopSidebarCompactOverrideRef.current = false;
      setIsLoopSidebarAutoCollapsed(true);
    }
    setLoopSidebarVisibility((current) => ({
      ...current,
      [sheetId]: !isLoopSidebarVisible
    }));
    setMessage(isLoopSidebarVisible ? "Loop sidebar hidden" : "Loop sidebar shown");
  }, [activeDocument?.id, isLoopSidebarVisible, isMobileWebLayout]);

  const toggleLoopedLine = useCallback((lineNumber: number, variableName = "Variable"): void => {
    const wasLooped = documentData.loopedLines.includes(lineNumber);
    updateActiveDocumentData((current) => {
      const nextLines = new Set(current.loopedLines);
      if (nextLines.has(lineNumber)) {
        nextLines.delete(lineNumber);
      } else {
        nextLines.add(lineNumber);
      }

      return {
        ...current,
        loopedLines: Array.from(nextLines).sort((a, b) => a - b),
        variableDefinitions: variableDefinitionState.metadata
      };
    });
    setIsDirty(true);
    setMessage(
      wasLooped
        ? `${variableName} hidden from sidebar`
        : `${variableName} shown in sidebar`
    );
  }, [documentData.loopedLines, updateActiveDocumentData, variableDefinitionState.metadata]);

  const toggleLoopVariableGroup = useCallback((group: VariableGroup): void => {
    const groupLines = new Set(group.definitions.map((definition) => definition.lineNumber));
    const allSelected = group.definitions.every((definition) =>
      documentData.loopedLines.includes(definition.lineNumber)
    );
    updateActiveDocumentData((current) => {
      const nextLines = new Set(current.loopedLines);
      for (const lineNumber of groupLines) {
        if (allSelected) nextLines.delete(lineNumber);
        else nextLines.add(lineNumber);
      }
      return {
        ...current,
        loopedLines: Array.from(nextLines).sort((left, right) => left - right),
        variableDefinitions: variableDefinitionState.metadata
      };
    });
    setIsDirty(true);
    setMessage(
      allSelected
        ? `All ${group.name} definitions hidden from sidebar`
        : `All ${group.name} definitions shown in sidebar`
    );
  }, [
    documentData.loopedLines,
    updateActiveDocumentData,
    variableDefinitionState.metadata
  ]);

  const toggleLoopVariable = useCallback((): void => {
    const wasPublished = documentData.isLoopVariablePublished;
    updateActiveDocumentData((current) => ({
      ...current,
      isLoopVariablePublished: !current.isLoopVariablePublished
    }));
    setIsDirty(true);
    setMessage(wasPublished ? "loop hidden from sidebar" : "loop shown in sidebar");
  }, [documentData.isLoopVariablePublished, updateActiveDocumentData]);

  const showAllLoopVariables = useCallback((): void => {
    if (visibleLoopVariableCount === availableLoopVariableCount) return;
    const lineNumbers = loopVariableOptions
      .map((variable) => variable.lineNumber)
      .sort((left, right) => left - right);
    const variableLineNumbers = new Set(loopVariableOptions.map((variable) => variable.lineNumber));
    updateActiveDocumentData((current) => ({
      ...current,
      isLoopVariablePublished: true,
      loopedLines: Array.from(new Set([
        ...current.loopedLines.filter((lineNumber) => !variableLineNumbers.has(lineNumber)),
        ...lineNumbers
      ])).sort((left, right) => left - right),
      variableDefinitions: variableDefinitionState.metadata
    }));
    setIsDirty(true);
    setMessage("All variables shown in sidebar");
  }, [
    availableLoopVariableCount,
    loopVariableOptions,
    updateActiveDocumentData,
    variableDefinitionState.metadata,
    visibleLoopVariableCount
  ]);

  const hideAllLoopVariables = useCallback((): void => {
    if (visibleLoopVariableCount === 0) return;
    const variableLineNumbers = new Set(loopVariableOptions.map((variable) => variable.lineNumber));
    updateActiveDocumentData((current) => ({
      ...current,
      isLoopVariablePublished: false,
      loopedLines: current.loopedLines.filter((lineNumber) => !variableLineNumbers.has(lineNumber)),
      variableDefinitions: variableDefinitionState.metadata
    }));
    setIsDirty(true);
    setMessage("All variables hidden from sidebar");
  }, [loopVariableOptions, updateActiveDocumentData, variableDefinitionState.metadata, visibleLoopVariableCount]);

  const toggleLoopVariablesDrawer = useCallback((): void => {
    if (isLoopVariablesDrawerOpen) {
      setIsLoopVariablesDrawerOpen(false);
      return;
    }

    if (!loopVariablesDrawerHasCustomHeightRef.current) {
      const measuredSidebarHeight =
        loopResultsRef.current?.getBoundingClientRect().height ?? 0;
      const sidebarHeight =
        measuredSidebarHeight > 0 ? measuredSidebarHeight : loopResultsHeight;
      setLoopVariablesDrawerHeight(
        defaultLoopVariablesDrawerHeight(sidebarHeight, isMobileWebLayout)
      );
    }
    setIsLoopVariablesDrawerOpen(true);
  }, [isLoopVariablesDrawerOpen, isMobileWebLayout, loopResultsHeight]);

  const closeLoopCountMenu = useCallback((): void => {
    setIsLoopCountMenuOpen(false);
  }, []);

  const toggleLoopCountMenu = useCallback((): void => {
    if (isLoopCountMenuOpen) {
      closeLoopCountMenu();
      return;
    }

    closeDocumentMenu();
    setIsLoopPeriodMenuOpen(false);
    setIsLoopPeriodCustomEditing(false);
    setIsLoopCountMenuOpen(true);
  }, [closeDocumentMenu, closeLoopCountMenu, isLoopCountMenuOpen]);

  const updateLoopCount = useCallback((value: number): void => {
    const nextLoopCount = normalizeLoopCount(value);
    if (nextLoopCount === loopCount) return;

    updateActiveDocumentData((current) => ({
      ...current,
      loopCount: nextLoopCount,
      loopPeriod: normalizeLoopPeriodLabel(current.loopPeriod, nextLoopCount)
    }));
    setIsDirty(true);
    setMessage(`Loop set to ${nextLoopCount}`);
  }, [loopCount, updateActiveDocumentData]);

  const closeLoopPeriodMenu = useCallback((): void => {
    setIsLoopPeriodMenuOpen(false);
    setLoopPeriodSidebarMenu(undefined);
    setIsLoopPeriodCustomEditing(false);
    setLoopPeriodDraft(loopPeriodLabel);
  }, [loopPeriodLabel]);

  const showLoopPeriodSidebarMenu = useCallback(
    (target: HTMLElement, loop: number): void => {
      closeDocumentMenu();
      setIsLoopCountMenuOpen(false);

      const bounds = target.getBoundingClientRect();
      const spaceBelow =
        window.innerHeight -
        bounds.bottom -
        loopPeriodSidebarMenuGap -
        loopPeriodSidebarMenuViewportInset;
      const spaceAbove =
        bounds.top - loopPeriodSidebarMenuGap - loopPeriodSidebarMenuViewportInset;
      const placeBelow = spaceBelow >= loopPeriodSidebarMenuHeight || spaceBelow >= spaceAbove;
      const top = placeBelow
        ? bounds.bottom + loopPeriodSidebarMenuGap
        : Math.max(
            loopPeriodSidebarMenuViewportInset,
            bounds.top - loopPeriodSidebarMenuGap - loopPeriodSidebarMenuHeight
          );
      const maximumRight = Math.max(
        loopPeriodSidebarMenuViewportInset,
        window.innerWidth - loopPeriodSidebarMenuWidth - loopPeriodSidebarMenuViewportInset
      );

      setLoopPeriodDraft(loopPeriodLabel);
      setIsLoopPeriodCustomEditing(false);
      setLoopPeriodSidebarMenu({
        loop,
        right: Math.min(
          maximumRight,
          Math.max(loopPeriodSidebarMenuViewportInset, window.innerWidth - bounds.right)
        ),
        top
      });
      setIsLoopPeriodMenuOpen(true);
    },
    [closeDocumentMenu, loopPeriodLabel, loopPeriodSidebarMenuHeight]
  );

  const toggleLoopPeriodSidebarMenu = useCallback(
    (target: HTMLElement, loop: number): void => {
      if (isLoopPeriodMenuOpen && loopPeriodSidebarMenu?.loop === loop) {
        closeLoopPeriodMenu();
        return;
      }
      showLoopPeriodSidebarMenu(target, loop);
    },
    [
      closeLoopPeriodMenu,
      isLoopPeriodMenuOpen,
      loopPeriodSidebarMenu?.loop,
      showLoopPeriodSidebarMenu
    ]
  );

  const closeLoopVariableSidebarMenu = useCallback((): void => {
    setLoopVariableSidebarMenu(undefined);
  }, []);

  const showLoopVariableSidebarMenu = useCallback(
    (
      target: HTMLElement,
      triggerKey: string,
      name: string,
      lineNumber: number | undefined,
      source: "editor" | "sidebar"
    ): void => {
      closeDocumentMenu();
      closeLoopCountMenu();
      closeLoopPeriodMenu();
      hideLoopResultPopover();

      const bounds = target.getBoundingClientRect();
      const spaceBelow =
        window.innerHeight -
        bounds.bottom -
        loopVariableSidebarMenuGap -
        loopVariableSidebarMenuViewportInset;
      const spaceAbove =
        bounds.top - loopVariableSidebarMenuGap - loopVariableSidebarMenuViewportInset;
      const placeBelow =
        spaceBelow >= loopVariableSidebarMenuHeight || spaceBelow >= spaceAbove;
      const top = placeBelow
        ? bounds.bottom + loopVariableSidebarMenuGap
        : Math.max(
            loopVariableSidebarMenuViewportInset,
            bounds.top - loopVariableSidebarMenuGap - loopVariableSidebarMenuHeight
          );
      const maximumRight = Math.max(
        loopVariableSidebarMenuViewportInset,
        window.innerWidth -
          loopVariableSidebarMenuWidth -
          loopVariableSidebarMenuViewportInset
      );
      const alignedRight = Math.min(
        maximumRight,
        Math.max(
          loopVariableSidebarMenuViewportInset,
          window.innerWidth - bounds.right
        )
      );
      const maximumLeft = Math.max(
        loopVariableSidebarMenuViewportInset,
        window.innerWidth -
          loopVariableSidebarMenuWidth -
          loopVariableSidebarMenuViewportInset
      );
      const alignedLeft = Math.min(
        maximumLeft,
        Math.max(loopVariableSidebarMenuViewportInset, bounds.left)
      );

      setLoopVariableSidebarMenu({
        left: source === "editor" ? alignedLeft : undefined,
        lineNumber,
        name,
        right: source === "sidebar" ? alignedRight : undefined,
        source,
        top,
        triggerKey
      });
      requestAnimationFrame(() => {
        loopVariableSidebarMenuRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
      });
    },
    [
      closeDocumentMenu,
      closeLoopCountMenu,
      closeLoopPeriodMenu,
      hideLoopResultPopover
    ]
  );

  const toggleLoopVariableSidebarMenu = useCallback(
    (
      target: HTMLElement,
      triggerKey: string,
      name: string,
      lineNumber: number | undefined,
      source: "editor" | "sidebar"
    ): void => {
      if (loopVariableSidebarMenu?.triggerKey === triggerKey) {
        closeLoopVariableSidebarMenu();
        return;
      }
      showLoopVariableSidebarMenu(target, triggerKey, name, lineNumber, source);
    },
    [
      closeLoopVariableSidebarMenu,
      loopVariableSidebarMenu?.triggerKey,
      showLoopVariableSidebarMenu
    ]
  );

  const hideSelectedLoopVariable = useCallback((): void => {
    if (!loopVariableSidebarMenu) return;

    const { lineNumber, name } = loopVariableSidebarMenu;
    closeLoopVariableSidebarMenu();
    if (lineNumber === undefined) {
      toggleLoopVariable();
    } else {
      toggleLoopedLine(lineNumber, name);
    }
  }, [
    closeLoopVariableSidebarMenu,
    loopVariableSidebarMenu,
    toggleLoopVariable,
    toggleLoopedLine
  ]);

  const toggleSelectedLoopVariableDivider = useCallback((): void => {
    if (!loopVariableSidebarMenu) return;

    if (
      loopVariableSidebarMenu.source === "editor" &&
      loopVariableSidebarMenu.lineNumber !== undefined
    ) {
      const edit = toggleDividerAboveLine(editorText, loopVariableSidebarMenu.lineNumber);
      updateText(edit.text);
      closeLoopVariableSidebarMenu();
      setMessage(
        edit.inserted
          ? `Divider inserted above ${loopVariableSidebarMenu.name}`
          : `Divider above ${loopVariableSidebarMenu.name} removed`
      );
      requestAnimationFrame(() => {
        const target = editorRef.current;
        if (!target) return;
        const nextLines = edit.text.split("\n");
        const lineOffset = nextLines
          .slice(0, edit.targetLineNumber)
          .reduce((offset, source) => offset + source.length + 1, 0);
        target.focus();
        setEditorSelection(target, lineOffset);
        setFocusedEditorLine(edit.targetLineNumber);
      });
      return;
    }

    const dividerLine = loopVariableSidebarMenu.lineNumber ?? 0;
    const hadDivider = (documentData.loopSidebarDividerLines ?? []).includes(dividerLine);
    updateActiveDocumentData((current) => {
      const nextDividerLines = new Set(current.loopSidebarDividerLines ?? []);
      if (nextDividerLines.has(dividerLine)) {
        nextDividerLines.delete(dividerLine);
      } else {
        nextDividerLines.add(dividerLine);
      }
      return {
        ...current,
        loopSidebarDividerLines: Array.from(nextDividerLines).sort((a, b) => a - b)
      };
    });
    closeLoopVariableSidebarMenu();
    setIsDirty(true);
    setMessage(
      hadDivider
        ? `Divider above ${loopVariableSidebarMenu.name} removed`
        : `Divider inserted above ${loopVariableSidebarMenu.name}`
    );
  }, [
    closeLoopVariableSidebarMenu,
    documentData.loopSidebarDividerLines,
    editorText,
    loopVariableSidebarMenu,
    updateText,
    updateActiveDocumentData
  ]);

  const toggleLoopLabelPicker = useCallback((): void => {
    const isPickerOpen = isLoopPeriodMenuOpen && !loopPeriodSidebarMenu;
    if (isPickerOpen) {
      closeLoopPeriodMenu();
      return;
    }

    setLoopPeriodSidebarMenu(undefined);
    setLoopPeriodDraft(loopPeriodLabel);
    setIsLoopPeriodCustomEditing(false);
    setIsLoopPeriodMenuOpen(true);
  }, [
    closeLoopPeriodMenu,
    isLoopPeriodMenuOpen,
    loopPeriodLabel,
    loopPeriodSidebarMenu
  ]);

  const commitLoopPeriodLabel = useCallback((value = loopPeriodDraft): void => {
    const nextLabel = normalizeLoopPeriodLabel(value, loopCount);
    closeLoopPeriodMenu();
    setLoopPeriodDraft(nextLabel);

    if (nextLabel === loopPeriodLabel) return;

    updateActiveDocumentData((current) => ({
      ...current,
      loopPeriod: nextLabel
    }));
    setIsDirty(true);
    setMessage(`Loop label set to ${nextLabel}`);
  }, [closeLoopPeriodMenu, loopCount, loopPeriodDraft, loopPeriodLabel, updateActiveDocumentData]);

  const beginCustomLoopPeriodEditing = useCallback((): void => {
    setLoopPeriodDraft(isCustomLoopPeriod ? loopPeriodLabel : "");
    setIsLoopPeriodCustomEditing(true);
  }, [isCustomLoopPeriod, loopPeriodLabel]);

  const handleLoopResultsScroll = useCallback(
    (event: ReactUIEvent<HTMLDivElement>): void => {
      handleTransientScrollbarScroll(event);
      if (loopPeriodSidebarMenu) closeLoopPeriodMenu();
      if (loopVariableSidebarMenu) closeLoopVariableSidebarMenu();
    },
    [
      closeLoopPeriodMenu,
      closeLoopVariableSidebarMenu,
      handleTransientScrollbarScroll,
      loopPeriodSidebarMenu,
      loopVariableSidebarMenu
    ]
  );

  const requestEmailCode = useCallback(async (email: string): Promise<void> => {
    await window.looper.requestEmailCode(email);
  }, []);

  const verifyEmailCode = useCallback(
    async (email: string, code: string): Promise<AccountDialogAccount> => {
      return window.looper.verifyEmailCode(email, code);
    },
    []
  );

  const finishAccountVerification = useCallback(
    (verifiedAccount: AccountDialogAccount): void => {
      if (!verifiedAccount.id) {
        setMessage("Your account was verified, but no account ID was returned.");
        return;
      }
      const account = {
        email: verifiedAccount.email,
        id: verifiedAccount.id
      };
      activateAccount(account);
      applyAdminAccessStatus("denied");

      void window.looper
        .getAdminAccess()
        .then((status) => {
          if (currentAccountIdRef.current === account.id) {
            applyAdminAccessStatus(status);
          }
        })
        .catch(() => {
          if (currentAccountIdRef.current === account.id) {
            applyAdminAccessStatus("denied");
          }
        });

      void (async () => {
        if (sharedSheet) {
          let ownership: SharedSheetOwnership = "visitor";
          try {
            ownership = (await window.looper.getCloudSheet(sharedSheet.id))
              ? "owner"
              : "visitor";
          } catch {
            // Failing closed keeps owner-only controls hidden while shared editing remains usable.
          }
          if (
            currentAccountIdRef.current === account.id &&
            ownership === "owner"
          ) {
            savedCloudFingerprintsRef.current.set(
              sharedSheet.id,
              savedSharedFingerprintRef.current
            );
          }
          if (currentAccountIdRef.current === account.id) {
            setSharedSheetOwnership(ownership);
          }
        } else {
          await loadCloudSheetsForAccount(account);
        }
        if (pendingSheetIntent) {
          await createOwnedSheet(pendingSheetIntent);
        }
      })().catch(() => {
        // Loading/creation reports a concise status and leaves the pending intent retryable.
      });
    },
    [
      activateAccount,
      applyAdminAccessStatus,
      createOwnedSheet,
      loadCloudSheetsForAccount,
      pendingSheetIntent,
      sharedSheet
    ]
  );

  const openAccountDialog = useCallback((): void => {
    if (accountState.status === "unavailable") {
      setCloudSyncErrorMessage(accountState.message);
      setCloudSyncState("error");
      setMessage(accountState.message);
      return;
    }
    setPendingSheetIntent(undefined);
    setAccountDialogPurpose("sign-in");
    setIsLibrarySettingsMenuOpen(false);
    setIsAccountDialogOpen(true);
  }, [accountState]);

  const openAdminPanel = useCallback((): void => {
    if (!presentedAccountHasAdminAccess) return;
    setIsLibrarySettingsMenuOpen(false);
    setIsAdminPanelOpen(true);
  }, [presentedAccountHasAdminAccess]);

  const toggleDemoTime = useCallback(async (): Promise<void> => {
    try {
      const enabled = await window.looper.setDemoTime(!demoTimeEnabled);
      applyDemoTime(enabled);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not update Demo Time."
      );
    }
  }, [applyDemoTime, demoTimeEnabled]);

  const toggleSignedOutPreview = useCallback(async (): Promise<void> => {
    try {
      const enabled = await window.looper.setSignedOutPreview(
        !signedOutPreviewEnabled
      );
      applySignedOutPreview(enabled);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not update the logged-out preview."
      );
    }
  }, [applySignedOutPreview, signedOutPreviewEnabled]);

  const toggleUpdateButtonPreview = useCallback(async (): Promise<void> => {
    appUpdatePreviewRunRef.current += 1;
    try {
      await window.looper.setUpdateButtonPreview(
        !updateButtonPreviewEnabled
      );
      setAppUpdateState(await window.looper.getAppUpdateState());
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not update the update button preview."
      );
    }
  }, [updateButtonPreviewEnabled]);

  const toggleWindowsClientSpoof = useCallback(async (): Promise<void> => {
    try {
      setWindowsClientSpoofEnabled(
        await window.looper.setWindowsClientSpoof(!windowsClientSpoofEnabled)
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not update the Windows client spoof."
      );
    }
  }, [windowsClientSpoofEnabled]);

  const installAppUpdate = useCallback(async (): Promise<void> => {
    if (appUpdateState.status !== "available") return;
    if (appUpdateState.preview) {
      const previewRun = appUpdatePreviewRunRef.current + 1;
      appUpdatePreviewRunRef.current = previewRun;
      const previewState = appUpdateState;
      const startedAt = performance.now();
      setAppUpdateState({
        ...previewState,
        progress: 0,
        status: "downloading"
      });

      const animatePreviewProgress = (now: number): void => {
        if (appUpdatePreviewRunRef.current !== previewRun) return;
        const progress = Math.min(
          100,
          ((now - startedAt) / appUpdatePreviewDurationMs) * 100
        );
        setAppUpdateState({
          ...previewState,
          progress,
          status: progress >= 100 ? "installing" : "downloading"
        });
        if (progress < 100) {
          window.requestAnimationFrame(animatePreviewProgress);
          return;
        }
        window.setTimeout(() => {
          if (appUpdatePreviewRunRef.current === previewRun) {
            setAppUpdateState(previewState);
          }
        }, appUpdatePreviewCompletionHoldMs);
      };
      window.requestAnimationFrame(animatePreviewProgress);
      return;
    }

    setAppUpdateState({
      ...appUpdateState,
      progress: 0,
      status: "downloading"
    });
    try {
      await window.looper.installAppUpdate();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Looper could not start downloading the update."
      );
      void window.looper.getAppUpdateState().then(setAppUpdateState);
    }
  }, [appUpdateState]);

  const selectBillingPreview = useCallback(
    async (mode: BillingPreviewMode): Promise<void> => {
      try {
        const selectedMode = await window.looper.setBillingPreview(mode);
        setBillingPreviewMode(selectedMode);
        setLibrarySettingsMenuView("debug");
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Could not update the billing preview."
        );
      }
    },
    []
  );

  const retryCloudSync = useCallback((): void => {
    if (!authenticatedAccount || isLoadingCloudSheets || isSigningOut) return;
    cloudSyncBlockedRef.current.clear();
    cloudDraftBlockedRef.current.clear();
    setCloudSyncState("idle");
    setCloudSyncErrorMessage("");
    setMessage("Retrying account sync…");
    if (pendingSheetIntent && !cloudCreateOperationRef.current) {
      void createOwnedSheet(pendingSheetIntent).catch(() => {
        // The visible sync banner remains until the pending sheet succeeds.
      });
      return;
    }
    void loadCloudSheetsForAccount(authenticatedAccount);
  }, [
    authenticatedAccount,
    createOwnedSheet,
    isLoadingCloudSheets,
    isSigningOut,
    loadCloudSheetsForAccount,
    pendingSheetIntent
  ]);

  useEffect(() => {
    if (cloudSyncState !== "offline" || !authenticatedAccount) return;

    const retryWhenOnline = (): void => {
      if (navigator.onLine !== false) retryCloudSync();
    };
    const retryInterval = window.setInterval(retryWhenOnline, 20_000);
    window.addEventListener("online", retryWhenOnline);
    return () => {
      window.clearInterval(retryInterval);
      window.removeEventListener("online", retryWhenOnline);
    };
  }, [authenticatedAccount, cloudSyncState, retryCloudSync]);

  const finishAccountExit = useCallback(
    (reason: "deleted" | "signed-out"): void => {
      cloudSyncInFlightRef.current.clear();
      cloudDraftInFlightRef.current.clear();
      cloudSyncBlockedRef.current.clear();
      cloudDraftBlockedRef.current.clear();
      cloudDeleteInFlightRef.current.clear();
      savedCloudFingerprintsRef.current.clear();
      savedCloudDraftFingerprintsRef.current.clear();
      pendingCloudDraftFingerprintsRef.current.clear();

      if (isSharedAccess && sharedSheet) {
        const retainedSharedDocument =
          latestLibraryDocumentsRef.current.find(
            (document) => document.id === sharedSheet.id
          ) ?? cloudSheetToLibraryDocument(sharedSheet);
        setLibraryDocuments(retainedSharedDocument ? [retainedSharedDocument] : []);
        setActiveDocumentId(retainedSharedDocument?.id ?? "");
        setViewMode("editor");
        setSharedSheetOwnership("visitor");
      } else {
        const retainedDocuments = latestLibraryDocumentsRef.current.filter(
          (document) => !document.cloud
        );
        setLibraryDocuments((currentDocuments) =>
          restoreBundledExampleDocuments(
            currentDocuments.filter((document) => !document.cloud)
          )
        );
        setActiveDocumentId((currentId) =>
          latestLibraryDocumentsRef.current.some(
            (document) => document.id === currentId && !document.cloud
          )
            ? currentId
            : retainedDocuments[0]?.id ?? ""
        );
        setViewMode("library");
        pushBrowserView();
      }
      setAccountState({ status: "anonymous" });
      applyAdminAccessStatus("denied");
      setBillingStatus(undefined);
      setIsBillingDialogOpen(false);
      setCloudSyncState("idle");
      setCloudSyncErrorMessage("");
      setPendingSheetIntent(undefined);
      setMessage(
        reason === "deleted"
          ? isSharedAccess
            ? "Account deleted. You can keep editing this shared sheet."
            : "Account and cloud data permanently deleted."
          : isSharedAccess
            ? "Signed out. You can keep editing this shared sheet."
            : "Signed out. Account sheets were removed from this Mac."
      );
    },
    [applyAdminAccessStatus, isSharedAccess, pushBrowserView, sharedSheet]
  );

  const signOut = useCallback(async (): Promise<void> => {
    if (demoTimeEnabled) {
      setIsLibrarySettingsMenuOpen(false);
      try {
        const enabled = await window.looper.setDemoTime(false);
        applyDemoTime(enabled);
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Could not exit Demo Time."
        );
      }
      return;
    }
    if (!authenticatedAccount || isSigningOut || signOutOperationRef.current) return;
    const operationId = createDocumentId();
    signOutOperationRef.current = operationId;
    setIsLibrarySettingsMenuOpen(false);
    applyAdminAccessStatus("denied");
    setIsSigningOut(true);
    accountGenerationRef.current += 1;
    currentAccountIdRef.current = undefined;
    cloudCreateOperationRef.current = undefined;
    cloudLoadOperationRef.current = undefined;
    setIsCreatingCloudSheet(false);
    setIsLoadingCloudSheets(false);
    for (const timeout of cloudSyncTimeoutsRef.current.values()) {
      window.clearTimeout(timeout);
    }
    cloudSyncTimeoutsRef.current.clear();
    try {
      await window.looper.signOut();
      if (signOutOperationRef.current !== operationId) return;
      finishAccountExit("signed-out");
    } catch (error) {
      if (signOutOperationRef.current !== operationId) return;
      activateAccount(authenticatedAccount);
      const errorMessage =
        error instanceof Error ? error.message : "Could not sign out.";
      setCloudSyncState("error");
      setCloudSyncErrorMessage(errorMessage);
      setMessage(errorMessage);
      void loadCloudSheetsForAccount(authenticatedAccount);
    } finally {
      if (signOutOperationRef.current === operationId) {
        signOutOperationRef.current = undefined;
        setIsSigningOut(false);
      }
    }
  }, [
    activateAccount,
    applyAdminAccessStatus,
    applyDemoTime,
    authenticatedAccount,
    demoTimeEnabled,
    finishAccountExit,
    isSigningOut,
    loadCloudSheetsForAccount,
  ]);

  const openDeleteAccount = useCallback((): void => {
    if (demoTimeEnabled) {
      setIsLibrarySettingsMenuOpen(false);
      setMessage("Account deletion is disabled in Demo Time");
      return;
    }
    if (!authenticatedAccount || isSigningOut) return;
    const confirmed = window.confirm(
      "Permanently delete your Looper account, cloud sheets, shared links, and purchased sheet capacity? This cannot be undone."
    );
    if (!confirmed) return;
    setPendingSheetIntent(undefined);
    setAccountDialogPurpose("delete-account");
    setIsLibrarySettingsMenuOpen(false);
    setIsAccountDialogOpen(true);
  }, [authenticatedAccount, demoTimeEnabled, isSigningOut]);

  const verifyAndDeleteAccount = useCallback(
    async (email: string, code: string): Promise<void> => {
      if (!authenticatedAccount || email !== authenticatedAccount.email) {
        throw new Error("The deletion code must match the signed-in account.");
      }
      applyAdminAccessStatus("denied");
      await window.looper.verifyEmailCode(email, code);
      await window.looper.deleteAccount();
      accountGenerationRef.current += 1;
      currentAccountIdRef.current = undefined;
      cloudCreateOperationRef.current = undefined;
      cloudLoadOperationRef.current = undefined;
      setIsCreatingCloudSheet(false);
      setIsLoadingCloudSheets(false);
      for (const timeout of cloudSyncTimeoutsRef.current.values()) {
        window.clearTimeout(timeout);
      }
      cloudSyncTimeoutsRef.current.clear();
      finishAccountExit("deleted");
    },
    [applyAdminAccessStatus, authenticatedAccount, finishAccountExit]
  );

  useEffect(() => {
    if (!localOnlyMode || publicDemoMode) return;
    let canceled = false;
    const loadLocalSheets = (folderChanged = false): void => {
      setIsLoadingSheetStorage(true);
      savedLocalFingerprintsRef.current.clear();
      void window.looper
        .listLocalSheets()
        .then((sheets) => {
        if (canceled) return;
        const localDocuments = sheets.flatMap((sheet) => {
          const document = localSheetToLibraryDocument(sheet);
          if (!document?.local) return [];
          savedLocalFingerprintsRef.current.set(
            document.id,
            localDocumentFingerprint(document)
          );
          return [document];
        });
        const bundledDocuments = actualLibraryDocumentsRef.current.filter(
          (document) => isGettingStartedExampleDocumentId(document.id)
        );
        setActualLibraryDocuments([
          ...sortSheetsByLastModified(localDocuments),
          ...bundledDocuments
        ]);
        const availableDocumentIds = new Set(
          [...localDocuments, ...bundledDocuments].map((document) => document.id)
        );
        const fallbackDocumentId =
          localDocuments[0]?.id ?? bundledDocuments[0]?.id ?? "";
        setActiveDocumentId((current) =>
          availableDocumentIds.has(current) ? current : fallbackDocumentId
        );
        if (folderChanged || localDocuments.length === 0) {
          setViewMode("library");
        }
        setAccountState({ status: "anonymous" });
        setCloudSyncState("idle");
        setCloudSyncErrorMessage("");
        setMessage(
          localDocuments.length === 1
            ? "Loaded 1 local sheet"
            : `Loaded ${localDocuments.length} local sheets`
        );
        })
        .catch((error: unknown) => {
          if (canceled) return;
          setMessage(
            error instanceof Error
              ? error.message
              : "Local sheets could not be loaded."
          );
        })
        .finally(() => {
          if (!canceled) setIsLoadingSheetStorage(false);
        });
    };

    const stopListening = window.looper.onSheetStorageSettingsChanged(() => {
      loadLocalSheets(true);
    });
    loadLocalSheets();

    return () => {
      canceled = true;
      stopListening();
    };
  }, [localOnlyMode, publicDemoMode]);

  useEffect(() => {
    if (localOnlyMode || publicDemoMode) return;
    let canceled = false;

    void (async () => {
      try {
        const configuration = await window.looper.getCloudConfiguration();
        if (canceled) return;
        if (!configuration.configured) {
          const missing = [
            configuration.authConfigured ? "" : "Supabase",
            configuration.apiConfigured ? "" : "the Vercel API",
            configuration.secureStorageAvailable ? "" : "secure storage"
          ].filter(Boolean);
          setAccountState({
            message: `Cloud accounts need ${missing.join(", ")} configured.`,
            status: "unavailable"
          });
          if (sharedSheet) setSharedSheetOwnership("visitor");
          return;
        }

        const account = await window.looper.getAccount();
        if (canceled) return;
        if (!account) {
          setAccountState({ status: "anonymous" });
          if (sharedSheet) setSharedSheetOwnership("visitor");
          return;
        }

        activateAccount(account);
        if (sharedSheet) {
          let ownership: SharedSheetOwnership = "visitor";
          try {
            ownership = (await window.looper.getCloudSheet(sharedSheet.id))
              ? "owner"
              : "visitor";
          } catch {
            // Failing closed keeps owner-only controls hidden while shared editing remains usable.
          }
          if (canceled) return;
          if (ownership === "owner") {
            savedCloudFingerprintsRef.current.set(
              sharedSheet.id,
              savedSharedFingerprintRef.current
            );
          }
          setSharedSheetOwnership(ownership);
          return;
        }
        await loadCloudSheetsForAccount(account);
      } catch (error) {
        if (canceled) return;
        setAccountState({
          message:
            error instanceof Error
              ? error.message
              : "Cloud accounts are temporarily unavailable.",
          status: "unavailable"
        });
        if (sharedSheet) setSharedSheetOwnership("visitor");
      }
    })();

    return () => {
      canceled = true;
    };
  }, [
    activateAccount,
    loadCloudSheetsForAccount,
    localOnlyMode,
    publicDemoMode,
    sharedSheet
  ]);

  useEffect(() => {
    if (
      !publicDemoMode &&
      openAccountDialogOnLaunch &&
      accountState.status === "anonymous" &&
      !isSharedAccess &&
      !signedOutPreviewEnabled
    ) {
      setAccountDialogPurpose("sign-in");
      setIsAccountDialogOpen(true);
    }
  }, [
    accountState.status,
    isSharedAccess,
    openAccountDialogOnLaunch,
    publicDemoMode,
    signedOutPreviewEnabled
  ]);

  useEffect(
    () =>
      window.looper.onApplicationSettingsCommand((command) => {
        if (command.type === "show-admin-panel") {
          closeDocumentMenu();
          closeLibraryDocumentMenu();
          closeLibraryBulkMenu();
          setIsLibrarySearchOpen(false);
          setLibrarySearchQuery("");
          setIsLibrarySettingsMenuOpen(false);
          setIsAdminPanelOpen(true);
          return;
        }
        if (command.type === "export-all-sheets") {
          void exportAllLibraryDocuments();
          return;
        }
        if (command.type === "set-theme") {
          setTheme(command.theme);
          return;
        }
        if (command.type === "set-default-decimal-places") {
          setDefaultDecimalPlaces(
            parseDefaultDecimalPlaces(command.decimalPlaces)
          );
          return;
        }
        if (command.type === "set-startup-view") {
          setStartupView(command.startupView);
          return;
        }
        if (command.type === "toggle-always-show-download-app-button") {
          setAlwaysShowDownloadAppButton((current) => !current);
          return;
        }
        if (command.type === "sign-out") void signOut();
      }),
    [
      closeDocumentMenu,
      closeLibraryBulkMenu,
      closeLibraryDocumentMenu,
      exportAllLibraryDocuments,
      signOut
    ]
  );

  useEffect(() => {
    void window.looper
      .updateApplicationSettingsMenu({
        accountEmail: presentedAccountEmail,
        alwaysShowDownloadAppButton,
        defaultDecimalPlaces,
        isSigningOut,
        sheetCount: presentedUserLibraryDocuments.length,
        startupView,
        theme
      })
      .catch(() => undefined);
  }, [
    alwaysShowDownloadAppButton,
    defaultDecimalPlaces,
    isSigningOut,
    presentedAccountEmail,
    presentedUserLibraryDocuments.length,
    startupView,
    theme
  ]);

  useLayoutEffect(() => {
    const systemThemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = (): void => {
      const resolvedTheme = resolveTheme(theme, systemThemeQuery);
      document.documentElement.dataset.theme = resolvedTheme;
      document.documentElement.style.colorScheme = resolvedTheme;
    };

    applyTheme();
    if (theme === "system") systemThemeQuery.addEventListener("change", applyTheme);

    try {
      window.localStorage.setItem(themeStorageKey, theme);
    } catch {
      // Local storage can be unavailable in unusual browser contexts.
    }

    void window.looper.setThemeSource(theme);

    return () => systemThemeQuery.removeEventListener("change", applyTheme);
  }, [theme]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        defaultDecimalPlacesStorageKey,
        String(defaultDecimalPlaces)
      );
      window.localStorage.setItem(startupViewStorageKey, startupView);
    } catch {
      // Preferences remain available for this session when storage is unavailable.
    }
  }, [defaultDecimalPlaces, startupView]);

  useLayoutEffect(() => {
    if (viewMode !== "library") return;

    const scroller = libraryScrollRef.current;
    if (!scroller) return;

    scroller.scrollTop = libraryScrollTopRef.current;
  }, [viewMode]);

  useEffect(() => {
    if (publicDemoMode || demoTimeEnabled) return;
    try {
      const localDocuments = libraryDocuments.filter(
        (document) =>
          !document.cloud &&
          !document.local &&
          !isGettingStartedExampleDocumentId(document.id)
      );
      window.localStorage.setItem(documentsStorageKey, JSON.stringify(localDocuments));
      window.localStorage.setItem(activeDocumentStorageKey, activeDocumentId);
      if (initialLibraryState.gettingStartedTemplateRevisionToPersist) {
        window.localStorage.setItem(
          GETTING_STARTED_TEMPLATE_REVISION_STORAGE_KEY,
          initialLibraryState.gettingStartedTemplateRevisionToPersist
        );
      }
    } catch {
      // Local storage can be unavailable in unusual browser contexts.
    }
  }, [
    activeDocumentId,
    demoTimeEnabled,
    initialLibraryState,
    libraryDocuments,
    publicDemoMode
  ]);

  useEffect(() => {
    const sharedShareToken = sharedSheet?.shareToken;
    if (
      !isSharedAccess ||
      !sharedSheet ||
      !sharedShareToken ||
      sharedSheetOwnership === "owner"
    ) {
      return;
    }
    const document = libraryDocuments.find((candidate) => candidate.id === sharedSheet.id);
    if (!document?.cloud) return;
    const fingerprint = cloudDocumentFingerprint(document);
    if (savedSharedFingerprintRef.current === fingerprint) return;

    if (sharedSyncTimeoutRef.current !== undefined) {
      window.clearTimeout(sharedSyncTimeoutRef.current);
    }
    sharedSyncTimeoutRef.current = window.setTimeout(() => {
      sharedSyncTimeoutRef.current = undefined;
      if (sharedSyncInFlightRef.current) return;
      const latestDocument = latestLibraryDocumentsRef.current.find(
        (candidate) => candidate.id === sharedSheet.id
      );
      if (!latestDocument?.cloud) return;
      const latestFingerprint = cloudDocumentFingerprint(latestDocument);
      if (savedSharedFingerprintRef.current === latestFingerprint) return;

      const operationId = createDocumentId();
      sharedSyncInFlightRef.current = operationId;
      setCloudSyncState("saving");
      setCloudSyncErrorMessage("");
      void window.looper
        .updateSharedCloudSheet({
          document: latestDocument.data as unknown as JsonObject,
          expectedRevision: latestDocument.cloud.revision,
          shareToken: sharedShareToken
        })
        .then((sheet) => {
          if (sharedSyncInFlightRef.current !== operationId) return;
          const savedDocument = cloudSheetToLibraryDocument(sheet);
          if (
            !savedDocument?.cloud ||
            savedDocument.id !== sharedSheet.id ||
            savedDocument.cloud.shareToken !== sharedShareToken
          ) {
            throw new Error("The server returned an invalid shared sheet.");
          }
          savedSharedFingerprintRef.current = latestFingerprint;
          setLibraryDocuments((currentDocuments) =>
            currentDocuments.map((candidate) =>
              candidate.id === savedDocument.id
                ? {
                    ...candidate,
                    cloud: savedDocument.cloud,
                    data: {
                      ...candidate.data,
                      title: savedDocument.title
                    },
                    title: savedDocument.title,
                    updatedAt: savedDocument.updatedAt
                  }
                : candidate
            )
          );
          const currentDocument = latestLibraryDocumentsRef.current.find(
            (candidate) => candidate.id === savedDocument.id
          );
          if (
            currentDocument &&
            cloudDocumentFingerprint(currentDocument) === latestFingerprint
          ) {
            setIsDirty(false);
          }
          setCloudSyncState("saved");
          setCloudSyncErrorMessage("");
          setMessage("Shared sheet saved");
        })
        .catch((error: unknown) => {
          if (sharedSyncInFlightRef.current !== operationId) return;
          const errorMessage =
            error instanceof Error ? error.message : "This shared sheet could not be saved.";
          setCloudSyncState("error");
          setCloudSyncErrorMessage(errorMessage);
          setMessage(errorMessage);
        })
        .finally(() => {
          if (sharedSyncInFlightRef.current === operationId) {
            sharedSyncInFlightRef.current = undefined;
          }
        });
    }, 800);

    return () => {
      if (sharedSyncTimeoutRef.current !== undefined) {
        window.clearTimeout(sharedSyncTimeoutRef.current);
        sharedSyncTimeoutRef.current = undefined;
      }
    };
  }, [isSharedAccess, libraryDocuments, sharedSheet, sharedSheetOwnership]);

  useEffect(() => {
    const activeLocalIds = new Set(
      libraryDocuments.flatMap((document) => (document.local ? [document.id] : []))
    );
    for (const [documentId, timeout] of localSyncTimeoutsRef.current) {
      if (activeLocalIds.has(documentId)) continue;
      window.clearTimeout(timeout);
      localSyncTimeoutsRef.current.delete(documentId);
      localSyncInFlightRef.current.delete(documentId);
      savedLocalFingerprintsRef.current.delete(documentId);
    }
    if (isLoadingSheetStorage) return;

    for (const document of libraryDocuments) {
      if (!document.local) continue;
      const fingerprint = localDocumentFingerprint(document);
      if (savedLocalFingerprintsRef.current.get(document.id) === fingerprint) continue;
      const existingTimeout = localSyncTimeoutsRef.current.get(document.id);
      if (existingTimeout !== undefined) window.clearTimeout(existingTimeout);

      const timeout = window.setTimeout(() => {
        localSyncTimeoutsRef.current.delete(document.id);
        if (localSyncInFlightRef.current.has(document.id)) return;
        const latestDocument = latestLibraryDocumentsRef.current.find(
          (candidate) => candidate.id === document.id
        );
        if (!latestDocument?.local) return;
        const latestFingerprint = localDocumentFingerprint(latestDocument);
        if (
          savedLocalFingerprintsRef.current.get(document.id) === latestFingerprint
        ) {
          return;
        }

        const operationId = createDocumentId();
        localSyncInFlightRef.current.set(document.id, operationId);
        void window.looper
          .updateLocalSheet({
            document: latestDocument.data as unknown as JsonObject,
            expectedRevision: latestDocument.local.revision,
            id: latestDocument.id,
            title: latestDocument.title
          })
          .then((savedSheet) => {
            if (localSyncInFlightRef.current.get(document.id) !== operationId) return;
            const savedDocument = localSheetToLibraryDocument(savedSheet);
            if (!savedDocument?.local || savedDocument.id !== document.id) {
              throw new Error("Local storage returned an invalid sheet.");
            }
            savedLocalFingerprintsRef.current.set(document.id, latestFingerprint);
            setLibraryDocuments((currentDocuments) =>
              currentDocuments.map((candidate) =>
                candidate.id === document.id && candidate.local
                  ? {
                      ...candidate,
                      local: savedDocument.local,
                      updatedAt: savedDocument.updatedAt
                    }
                  : candidate
              )
            );
          })
          .catch((error: unknown) => {
            if (localSyncInFlightRef.current.get(document.id) !== operationId) return;
            setMessage(
              error instanceof Error
                ? error.message
                : "This local sheet could not be saved."
            );
          })
          .finally(() => {
            if (localSyncInFlightRef.current.get(document.id) === operationId) {
              localSyncInFlightRef.current.delete(document.id);
            }
          });
      }, 500);
      localSyncTimeoutsRef.current.set(document.id, timeout);
    }
  }, [isLoadingSheetStorage, libraryDocuments]);

  useEffect(() => {
    const activeCloudIds = new Set(
      libraryDocuments.flatMap((document) => (document.cloud ? [document.id] : []))
    );
    for (const [documentId, timeout] of cloudSyncTimeoutsRef.current) {
      if (!activeCloudIds.has(documentId)) {
        window.clearTimeout(timeout);
        cloudSyncTimeoutsRef.current.delete(documentId);
        savedCloudFingerprintsRef.current.delete(documentId);
        savedCloudDraftFingerprintsRef.current.delete(documentId);
        pendingCloudDraftFingerprintsRef.current.delete(documentId);
        cloudSyncBlockedRef.current.delete(documentId);
        cloudDraftBlockedRef.current.delete(documentId);
      }
    }

    if (!authenticatedAccount || isLoadingCloudSheets) return;
    const syncAccount = authenticatedAccount;
    const accountId = syncAccount.id;
    const accountGeneration = accountGenerationRef.current;
    if (!isCurrentAccountOperation(accountGeneration, accountId)) return;

    function persistLatestDraft(documentId: string): void {
      if (!isCurrentAccountOperation(accountGeneration, accountId)) return;
      if (
        cloudDraftBlockedRef.current.has(documentId) ||
        cloudDeleteInFlightRef.current.has(documentId)
      ) {
        return;
      }

      const document = latestLibraryDocumentsRef.current.find(
        (candidate) => candidate.id === documentId
      );
      if (!document?.cloud) return;
      const fingerprint = cloudDocumentFingerprint(document);
      if (savedCloudFingerprintsRef.current.get(documentId) === fingerprint) return;
      const draftFingerprint = cloudDraftFingerprint(document);
      if (
        draftFingerprint === undefined ||
        savedCloudDraftFingerprintsRef.current.get(documentId) === draftFingerprint ||
        pendingCloudDraftFingerprintsRef.current.get(documentId) === draftFingerprint
      ) {
        return;
      }

      const draftOperationId = `${accountGeneration}:draft:${createDocumentId()}`;
      cloudDraftInFlightRef.current.set(documentId, draftOperationId);
      pendingCloudDraftFingerprintsRef.current.set(documentId, draftFingerprint);
      if (!cloudSyncBlockedRef.current.has(documentId)) {
        setCloudSyncState("saving");
      }
      void window.looper
        .saveCloudDraft({
          document: document.data as unknown as JsonObject,
          expectedRevision: document.cloud.revision,
          schemaVersion: 1,
          sheetId: document.id,
          title: document.title
        })
        .then((savedDraft) => {
          if (
            cloudDraftInFlightRef.current.get(documentId) !== draftOperationId ||
            !isCurrentAccountOperation(accountGeneration, accountId)
          ) {
            return;
          }
          if (storedCloudDraftFingerprint(savedDraft) !== draftFingerprint) {
            throw new Error("The secure draft store returned an invalid draft.");
          }
          savedCloudDraftFingerprintsRef.current.set(documentId, draftFingerprint);
        })
        .catch((error: unknown) => {
          if (
            cloudDraftInFlightRef.current.get(documentId) !== draftOperationId ||
            !isCurrentAccountOperation(accountGeneration, accountId)
          ) {
            return;
          }
          cloudDraftBlockedRef.current.add(documentId);
          const errorMessage =
            error instanceof Error
              ? error.message
              : "This sheet could not be saved to secure local storage.";
          setCloudSyncState("error");
          setCloudSyncErrorMessage(errorMessage);
          setMessage(errorMessage);
        })
        .finally(() => {
          if (cloudDraftInFlightRef.current.get(documentId) === draftOperationId) {
            cloudDraftInFlightRef.current.delete(documentId);
            if (
              pendingCloudDraftFingerprintsRef.current.get(documentId) ===
              draftFingerprint
            ) {
              pendingCloudDraftFingerprintsRef.current.delete(documentId);
            }
          }
          if (
            !isCurrentAccountOperation(accountGeneration, accountId) ||
            cloudDraftBlockedRef.current.has(documentId)
          ) {
            return;
          }
          const latestDocument = latestLibraryDocumentsRef.current.find(
            (candidate) => candidate.id === documentId
          );
          const latestDraftFingerprint = latestDocument
            ? cloudDraftFingerprint(latestDocument)
            : undefined;
          if (
            latestDocument?.cloud &&
            savedCloudFingerprintsRef.current.get(documentId) !==
              cloudDocumentFingerprint(latestDocument) &&
            latestDraftFingerprint !== undefined &&
            savedCloudDraftFingerprintsRef.current.get(documentId) !==
              latestDraftFingerprint
          ) {
            persistLatestDraft(documentId);
          }
        });
    }

    function scheduleSave(documentId: string, delay: number): void {
      const existingTimeout = cloudSyncTimeoutsRef.current.get(documentId);
      if (existingTimeout !== undefined) window.clearTimeout(existingTimeout);

      const timeout = window.setTimeout(() => {
        cloudSyncTimeoutsRef.current.delete(documentId);
        if (!isCurrentAccountOperation(accountGeneration, accountId)) return;
        if (
          cloudSyncBlockedRef.current.has(documentId) ||
          cloudDraftBlockedRef.current.has(documentId) ||
          cloudDeleteInFlightRef.current.has(documentId)
        ) {
          return;
        }
        if (cloudSyncInFlightRef.current.has(documentId)) {
          scheduleSave(documentId, 250);
          return;
        }

        const document = latestLibraryDocumentsRef.current.find(
          (candidate) => candidate.id === documentId
        );
        if (!document?.cloud) return;
        const fingerprint = cloudDocumentFingerprint(document);
        if (savedCloudFingerprintsRef.current.get(documentId) === fingerprint) return;
        const draftFingerprint = cloudDraftFingerprint(document);
        if (
          draftFingerprint === undefined ||
          cloudDraftInFlightRef.current.has(documentId) ||
          savedCloudDraftFingerprintsRef.current.get(documentId) !== draftFingerprint
        ) {
          persistLatestDraft(documentId);
          scheduleSave(documentId, 100);
          return;
        }

        const saveOperationId = `${accountGeneration}:${createDocumentId()}`;
        let reconcileAfterSave = false;
        let offlineCacheFailed = false;
        cloudSyncInFlightRef.current.set(documentId, saveOperationId);
        setCloudSyncState("saving");
        void window.looper
          .updateCloudSheet({
            document: document.data as unknown as JsonObject,
            expectedRevision: document.cloud.revision,
            id: document.id,
            title: document.title
          })
          .then(async (sheet) => {
            if (
              cloudSyncInFlightRef.current.get(documentId) !== saveOperationId ||
              !isCurrentAccountOperation(accountGeneration, accountId)
            ) {
              return;
            }
            const savedDocument = cloudSheetToLibraryDocument(sheet, document.path);
            if (!savedDocument?.cloud || savedDocument.id !== documentId) {
              throw new Error("The server returned an invalid saved sheet.");
            }
            try {
              await window.looper.cacheCloudSheet(sheet);
            } catch {
              offlineCacheFailed = true;
            }
            savedCloudFingerprintsRef.current.set(documentId, fingerprint);
            setLibraryDocuments((currentDocuments) =>
              currentDocuments.map((candidate) =>
                candidate.id === documentId
                  ? {
                      ...candidate,
                      cloud: savedDocument.cloud,
                      updatedAt: savedDocument.updatedAt
                    }
                  : candidate
              )
            );
            const latestDocument = latestLibraryDocumentsRef.current.find(
              (candidate) => candidate.id === documentId
            );
            const canDeleteMatchingDraft =
              latestDocument?.cloud !== undefined &&
              cloudDocumentFingerprint(latestDocument) === fingerprint &&
              savedCloudDraftFingerprintsRef.current.get(documentId) ===
                draftFingerprint;
            if (canDeleteMatchingDraft && !offlineCacheFailed) {
              await window.looper.deleteCloudDraft({ sheetId: documentId });
              if (
                cloudSyncInFlightRef.current.get(documentId) !== saveOperationId ||
                !isCurrentAccountOperation(accountGeneration, accountId)
              ) {
                return;
              }
              if (
                savedCloudDraftFingerprintsRef.current.get(documentId) ===
                draftFingerprint
              ) {
                savedCloudDraftFingerprintsRef.current.delete(documentId);
              }
            }
            if (
              activeDocumentIdRef.current === documentId &&
              latestDocument?.cloud &&
              cloudDocumentFingerprint(latestDocument) === fingerprint
            ) {
              setIsDirty(false);
            }
          })
          .catch((error: unknown) => {
            if (!isCurrentAccountOperation(accountGeneration, accountId)) return;
            cloudSyncBlockedRef.current.add(documentId);
            if (isCloudRevisionConflict(error)) {
              reconcileAfterSave = true;
              setCloudSyncState("saving");
              setCloudSyncErrorMessage("");
              setMessage(
                "Reconciling this device’s offline changes with the latest cloud revision…"
              );
              return;
            }
            const errorMessage =
              error instanceof Error
                ? error.message
                : "This sheet could not be saved to your account.";
            setCloudSyncState(
              isCloudConnectionError(error) ? "offline" : "error"
            );
            setCloudSyncErrorMessage(errorMessage);
            setMessage(errorMessage);
          })
          .finally(() => {
            if (cloudSyncInFlightRef.current.get(documentId) === saveOperationId) {
              cloudSyncInFlightRef.current.delete(documentId);
            }
            if (!isCurrentAccountOperation(accountGeneration, accountId)) return;
            if (reconcileAfterSave) {
              void loadCloudSheetsForAccount(syncAccount);
              return;
            }
            if (offlineCacheFailed) {
              const offlineCacheMessage =
                "Your changes saved to cloud, but the offline copy could not be refreshed.";
              setCloudSyncState("error");
              setCloudSyncErrorMessage(offlineCacheMessage);
              setMessage(offlineCacheMessage);
            }
            if (
              cloudSyncInFlightRef.current.size === 0 &&
              cloudDraftInFlightRef.current.size === 0 &&
              !offlineCacheFailed
            ) {
              if (
                cloudSyncBlockedRef.current.size > 0 ||
                cloudDraftBlockedRef.current.size > 0
              ) {
                setCloudSyncState((current) =>
                  current === "offline" ? "offline" : "error"
                );
              } else {
                setCloudSyncState("saved");
                setCloudSyncErrorMessage("");
              }
            }
            const latestDocument = latestLibraryDocumentsRef.current.find(
              (candidate) => candidate.id === documentId
            );
            if (
              latestDocument?.cloud &&
              !cloudSyncBlockedRef.current.has(documentId) &&
              savedCloudFingerprintsRef.current.get(documentId) !==
                cloudDocumentFingerprint(latestDocument)
            ) {
              scheduleSave(documentId, 100);
            }
          });
      }, delay);
      cloudSyncTimeoutsRef.current.set(documentId, timeout);
    }

    for (const document of libraryDocuments) {
      if (!document.cloud) continue;
      if (
        sharedSheet?.id === document.id &&
        sharedSheetOwnership !== "owner"
      ) {
        continue;
      }
      const fingerprint = cloudDocumentFingerprint(document);
      if (savedCloudFingerprintsRef.current.get(document.id) === fingerprint) continue;
      if (!cloudDraftBlockedRef.current.has(document.id)) {
        persistLatestDraft(document.id);
      }
      if (
        !cloudSyncBlockedRef.current.has(document.id) &&
        !cloudDraftBlockedRef.current.has(document.id)
      ) {
        scheduleSave(document.id, 800);
      }
    }
  }, [
    authenticatedAccount,
    isCurrentAccountOperation,
    isLoadingCloudSheets,
    libraryDocuments,
    loadCloudSheetsForAccount,
    sharedSheet?.id,
    sharedSheetOwnership
  ]);

  useEffect(() => {
    const timeouts = localSyncTimeoutsRef.current;
    return () => {
      for (const timeout of timeouts.values()) window.clearTimeout(timeout);
      timeouts.clear();
    };
  }, []);

  useEffect(() => {
    const timeouts = cloudSyncTimeoutsRef.current;
    return () => {
      for (const timeout of timeouts.values()) window.clearTimeout(timeout);
      timeouts.clear();
    };
  }, []);

  useEffect(() => {
    if (!isDocumentMenuOpen) return;

    const handlePointerDown = (event: globalThis.PointerEvent): void => {
      const target = event.target;
      if (target instanceof Node && documentMenuRef.current?.contains(target)) return;
      closeDocumentMenu();
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [closeDocumentMenu, isDocumentMenuOpen]);

  useEffect(() => {
    if (!isLoopCountMenuOpen) return;

    const handlePointerDown = (event: globalThis.PointerEvent): void => {
      const target = event.target;
      if (target instanceof Node && loopCountMenuRef.current?.contains(target)) return;
      if (target instanceof Node && loopCountMenuPopupRef.current?.contains(target)) return;
      closeLoopCountMenu();
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [closeLoopCountMenu, isLoopCountMenuOpen]);

  useEffect(() => {
    if (!isLoopPeriodMenuOpen) return;

    const handlePointerDown = (event: globalThis.PointerEvent): void => {
      const target = event.target;
      if (target instanceof Node && loopPeriodSidebarMenuRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest(".loop-header-label-button")) return;
      closeLoopPeriodMenu();
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [closeLoopPeriodMenu, isLoopPeriodMenuOpen]);

  useEffect(() => {
    if (!loopVariableSidebarMenu) return;

    const handlePointerDown = (event: globalThis.PointerEvent): void => {
      const target = event.target;
      if (target instanceof Node && loopVariableSidebarMenuRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest(".loop-variable-trigger")) {
        return;
      }
      closeLoopVariableSidebarMenu();
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [closeLoopVariableSidebarMenu, loopVariableSidebarMenu]);

  useEffect(() => {
    if (!loopResultPopover) return;

    const handlePointerDown = (event: globalThis.PointerEvent): void => {
      const target = event.target;
      if (target instanceof Node && loopResultPopoverRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest(".static-result-value.looped")) return;
      hideLoopResultPopover();
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [hideLoopResultPopover, loopResultPopover]);

  useEffect(() => {
    if (!isLibrarySettingsMenuOpen) return;

    const handlePointerDown = (event: globalThis.PointerEvent): void => {
      const target = event.target;
      if (target instanceof Node && librarySettingsMenuRef.current?.contains(target)) return;
      setIsLibrarySettingsMenuOpen(false);
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [isLibrarySettingsMenuOpen]);

  useEffect(() => {
    if (!isLibrarySearchOpen) return;

    librarySearchInputRef.current?.focus();

    const handlePointerDown = (event: globalThis.PointerEvent): void => {
      const target = event.target;
      if (target instanceof Node && librarySearchControlRef.current?.contains(target)) return;
      setIsLibrarySearchOpen(false);
      setLibrarySearchQuery("");
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [isLibrarySearchOpen]);

  useEffect(() => {
    if (!isLibraryBulkMenuOpen) return;

    const handlePointerDown = (event: globalThis.PointerEvent): void => {
      const target = event.target;
      if (target instanceof Node && libraryBulkMenuRef.current?.contains(target)) return;
      closeLibraryBulkMenu();
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [closeLibraryBulkMenu, isLibraryBulkMenuOpen]);

  useEffect(() => {
    const documentIds = new Set(searchableLibraryDocuments.map((document) => document.id));
    setSelectedLibraryDocumentIds((currentIds) => {
      const nextIds = new Set([...currentIds].filter((id) => documentIds.has(id)));
      if (nextIds.size === currentIds.size) return currentIds;
      return nextIds;
    });
  }, [searchableLibraryDocuments]);

  useEffect(() => {
    if (selectedLibraryDocumentCount === 0) closeLibraryBulkMenu();
  }, [closeLibraryBulkMenu, selectedLibraryDocumentCount]);

  useLayoutEffect(() => {
    if (!isLibrarySearchOpen) {
      setIsLibrarySearchOverflowing(false);
      return;
    }

    const target = librarySearchResultsRef.current;
    if (!target) return;

    const updateOverflowState = (): void => {
      const bottomPadding = Number.parseFloat(window.getComputedStyle(target).paddingBottom) || 0;
      const contentHeight = target.scrollHeight - bottomPadding;
      setIsLibrarySearchOverflowing(contentHeight > target.clientHeight + 1);
    };

    updateOverflowState();
    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(updateOverflowState);
    observer.observe(target);
    return () => observer.disconnect();
  }, [isLibrarySearchOpen, librarySearchQuery, librarySearchResults]);

  useEffect(() => {
    if (viewMode === "library") return;
    setIsLibrarySearchOpen(false);
    setLibrarySearchQuery("");
    clearLibrarySelection();
  }, [clearLibrarySelection, viewMode]);

  useEffect(() => {
    if (isLoopPeriodCustomEditing) return;
    setLoopPeriodDraft(loopPeriodLabel);
  }, [isLoopPeriodCustomEditing, loopPeriodLabel]);

  useEffect(() => {
    if (!isLoopPeriodCustomEditing) return;
    loopPeriodInputRef.current?.focus();
    loopPeriodInputRef.current?.select();
  }, [isLoopPeriodCustomEditing]);

  useEffect(() => {
    const activePointerId = rowDrag?.pointerId;
    if (activePointerId === undefined) return;

    const handlePointerMove = (event: globalThis.PointerEvent): void => {
      if (event.pointerId !== activePointerId) return;
      if (event.pointerType !== "touch" && event.buttons === 0) {
        clearRowDrag(activePointerId);
        return;
      }

      event.preventDefault();
      updateRowDragAtPointer(event.pointerId, event.clientY);
    };

    const handlePointerUp = (event: globalThis.PointerEvent): void => {
      if (event.pointerId !== activePointerId) return;
      event.preventDefault();
      finishRowDragAtPointer(event.pointerId, event.clientY);
    };

    const handlePointerCancel = (event: globalThis.PointerEvent): void => {
      if (event.pointerId === activePointerId) clearRowDrag(activePointerId);
    };

    const handleWindowBlur = (): void => clearRowDrag(activePointerId);
    const handleVisibilityChange = (): void => {
      if (document.visibilityState !== "visible") clearRowDrag(activePointerId);
    };

    window.addEventListener("pointermove", handlePointerMove, true);
    window.addEventListener("pointerup", handlePointerUp, true);
    window.addEventListener("pointercancel", handlePointerCancel, true);
    window.addEventListener("blur", handleWindowBlur);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove, true);
      window.removeEventListener("pointerup", handlePointerUp, true);
      window.removeEventListener("pointercancel", handlePointerCancel, true);
      window.removeEventListener("blur", handleWindowBlur);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [clearRowDrag, finishRowDragAtPointer, rowDrag?.pointerId, updateRowDragAtPointer]);

  useEffect(() => {
    return window.looper.onContentZoom(applyContentZoom);
  }, [applyContentZoom]);

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key === "Escape") {
        const escapeToDocumentLibrary = shouldEscapeToDocumentLibrary({
          hasOpenTransientUi:
            hasDismissiblePopoverOpen ||
            isAccountDialogOpen ||
            isAdminPanelOpen ||
            isBillingDialogOpen ||
            isLoopVariablesDrawerOpen ||
            isMobileLoopSidebarVisible ||
            isLoopSidebarResizing ||
            isLoopVariablesDrawerResizing ||
            rowDrag !== undefined,
          isComposing: event.isComposing,
          isEditorView: viewMode === "editor",
          isRepeat: event.repeat,
          key: event.key
        });
        setIsLibrarySearchOpen(false);
        setLibrarySearchQuery("");
        setIsLibrarySettingsMenuOpen(false);
        clearLibrarySelection();
        closeLibraryDocumentMenu();
        closeDocumentMenu();
        closeLoopCountMenu();
        closeLoopPeriodMenu();
        closeLoopVariableSidebarMenu();
        setIsLoopVariablesDrawerOpen(false);
        setIsMobileLoopSidebarOpen(false);
        loopVariablesDrawerDragRef.current = undefined;
        setIsLoopVariablesDrawerResizing(false);
        hideLoopResultPopover();
        clearRowDrag();
        loopSidebarDragRef.current = undefined;
        setIsLoopSidebarResizing(false);
        if (escapeToDocumentLibrary) {
          event.preventDefault();
          showDocumentLibrary();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    clearRowDrag,
    clearLibrarySelection,
    closeDocumentMenu,
    closeLibraryDocumentMenu,
    closeLoopCountMenu,
    closeLoopPeriodMenu,
    closeLoopVariableSidebarMenu,
    hasDismissiblePopoverOpen,
    hideLoopResultPopover,
    isAccountDialogOpen,
    isAdminPanelOpen,
    isBillingDialogOpen,
    isLoopSidebarResizing,
    isLoopVariablesDrawerOpen,
    isLoopVariablesDrawerResizing,
    isMobileLoopSidebarVisible,
    rowDrag,
    showDocumentLibrary,
    viewMode
  ]);

  useEffect(() => {
    document.title = `${documentTitle}${isDirty ? " •" : ""} — Looper`;
  }, [documentTitle, isDirty]);

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (!event.metaKey && !event.ctrlKey) return;

      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        void saveDocument(event.shiftKey);
      }
      if (key === "o") {
        event.preventDefault();
        if (!publicDemoMode) void openDocument();
      }
      if (key === "n") {
        event.preventDefault();
        if (!publicDemoMode) newDocument();
      }
      if (
        key === "b" &&
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        !event.shiftKey &&
        !event.repeat &&
        viewMode === "editor"
      ) {
        event.preventDefault();
        toggleLoopSidebarVisibility();
      }
      if (
        key === "p" &&
        (event.metaKey || event.ctrlKey) &&
        event.shiftKey &&
        !event.altKey &&
        !event.repeat &&
        viewMode === "editor" &&
        focusedEditorLine !== undefined &&
        document.activeElement === editorRef.current
      ) {
        event.preventDefault();
        toggleLoopedLine(
          focusedEditorLine,
          sourceLines[focusedEditorLine]?.trim() || `Line ${focusedEditorLine}`
        );
      }
      if (
        key === "f" &&
        viewMode === "library" &&
        presentedAccountState.status === "authenticated"
      ) {
        event.preventDefault();
        closeLibraryDocumentMenu();
        closeLibraryBulkMenu();
        setIsLibrarySettingsMenuOpen(false);
        setIsLibrarySearchOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    closeLibraryBulkMenu,
    closeLibraryDocumentMenu,
    focusedEditorLine,
    newDocument,
    openDocument,
    presentedAccountState.status,
    publicDemoMode,
    saveDocument,
    sourceLines,
    toggleLoopedLine,
    toggleLoopSidebarVisibility,
    viewMode
  ]);

  useLayoutEffect(() => {
    const target = editorRef.current;
    if (target) {
      const rowSources = editorRows(target).map((row) => row.textContent ?? "");
      if (!editorRowsMatchText(rowSources, editorText)) {
        renderEditorText(target, editorText);
      } else {
        syncEditorRowClasses(target);
      }

      const pendingNavigation = pendingGlobalNavigationRef.current;
      if (
        pendingNavigation &&
        pendingNavigation.documentId === activeDocumentId
      ) {
        const lines = editorText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
        const definitionLine = lines[pendingNavigation.lineNumber] ?? "";
        const nameOffset = definitionLine
          .toLocaleLowerCase()
          .indexOf(pendingNavigation.normalizedName);
        const lineOffset = lines
          .slice(0, pendingNavigation.lineNumber)
          .reduce((offset, source) => offset + source.length + 1, 0);
        const selectionStart = lineOffset + Math.max(0, nameOffset);
        target.focus();
        setEditorSelection(
          target,
          selectionStart,
          selectionStart + pendingNavigation.name.length
        );
        const row = editorRows(target)[pendingNavigation.lineNumber];
        if (row) {
          target.scrollTop = Math.max(
            0,
            row.offsetTop - target.clientHeight / 2 + row.offsetHeight / 2
          );
        }
        setFocusedEditorLine(pendingNavigation.lineNumber);
        pendingGlobalNavigationRef.current = undefined;
      }
    }
    syncWrappedRowHeights();
    if (target) syncEditorScroll(target);
  }, [
    activeDocumentId,
    editorText,
    normalizedContentFontScale,
    sourceLines,
    staticResultCharacterCount,
    syncEditorScroll,
    syncWrappedRowHeights,
    viewMode
  ]);

  useEffect(() => {
    const syncFocusedEditorLine = (): void => {
      const target = editorRef.current;
      if (!target || document.activeElement !== target) return;
      setFocusedEditorLine(focusedEditorLineIndex(target));
    };

    document.addEventListener("selectionchange", syncFocusedEditorLine);
    return () => document.removeEventListener("selectionchange", syncFocusedEditorLine);
  }, []);

  useEffect(() => {
    const target = editorRef.current;
    if (!target || typeof ResizeObserver === "undefined") return;

    let animationFrame = 0;
    const observer = new ResizeObserver(() => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        syncWrappedRowHeights();
        syncEditorScroll(target);
      });
    });
    observer.observe(target);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      observer.disconnect();
    };
  }, [syncEditorScroll, syncWrappedRowHeights, viewMode]);

  useEffect(() => {
    if (editorRef.current) {
      syncEditorScroll(editorRef.current);
    }
  }, [isLoopSidebarVisible, sourceLines.length, syncEditorScroll]);

  useEffect(() => {
    const handleResize = (): void => {
      if (window.looper.platform !== "web") {
        if (loopSidebarShouldAutoCollapse(window.innerWidth)) {
          if (!loopSidebarCompactOverrideRef.current) {
            setIsLoopSidebarAutoCollapsed(true);
            setIsLoopVariablesDrawerOpen(false);
          }
        } else {
          loopSidebarCompactOverrideRef.current = false;
          setIsLoopSidebarAutoCollapsed(false);
        }
      }
      setLoopSidebarWidth((current) =>
        loopSidebarDefaultViewportRatio !== undefined &&
        !loopSidebarWidthIsCustomRef.current
          ? defaultLoopSidebarWidth(
              window.innerWidth,
              loopSidebarDefaultViewportRatio
            )
          : clampLoopSidebarWidth(current, window.innerWidth)
      );
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [loopSidebarDefaultViewportRatio]);

  useEffect(() => {
    const timeouts = scrollbarHideTimeoutsRef.current;
    return () => {
      for (const timeout of timeouts.values()) {
        window.clearTimeout(timeout);
      }
      timeouts.clear();
    };
  }, []);

  useEffect(() => {
    hideLoopResultPopover();
  }, [activeDocumentId, hideLoopResultPopover, viewMode]);

  useEffect(() => {
    if (!loopResultPopover) return;
    const handleResize = (): void => hideLoopResultPopover();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [hideLoopResultPopover, loopResultPopover]);

  useEffect(() => {
    if (!loopPeriodSidebarMenu) return;
    const handleResize = (): void => closeLoopPeriodMenu();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [closeLoopPeriodMenu, loopPeriodSidebarMenu]);

  useEffect(() => {
    try {
      if (loopSidebarDefaultViewportRatio !== undefined) {
        if (!loopSidebarWidthIsCustomRef.current) return;
        window.localStorage.setItem(
          webLoopSidebarWidthStorageKey,
          String(loopSidebarWidth)
        );
        return;
      }
      window.localStorage.setItem(loopSidebarWidthStorageKey, String(loopSidebarWidth));
    } catch {
      // Local storage can be unavailable in unusual browser contexts.
    }
  }, [loopSidebarDefaultViewportRatio, loopSidebarWidth]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        loopSidebarVisibilityStorageKey,
        JSON.stringify(loopSidebarVisibility)
      );
    } catch {
      // Local storage can be unavailable in unusual browser contexts.
    }
  }, [loopSidebarVisibility]);

  const renderLibraryDocumentCard = (
    document: LibraryDocument,
    displayTitle?: string
  ): ReactElement => (
    <LibraryDocumentCard
      active={false}
      actionsHidden={publicDemoMode}
      displayTitle={displayTitle}
      document={document}
      key={document.id}
      menuOpen={openLibraryDocumentMenuId === document.id}
      onDelete={deleteLibraryDocument}
      onDuplicate={duplicateLibraryDocument}
      onExport={(candidate) => void exportLibraryDocument(candidate)}
      onMenuClose={closeLibraryDocumentMenu}
      onMenuOpen={openLibraryDocumentMenu}
      onRename={renameLibraryDocument}
      onSelect={selectLibraryDocument}
      onToggleSelection={toggleLibraryDocumentSelection}
      selected={selectedLibraryDocumentIds.has(document.id)}
    />
  );

  const newSheetCard = (
    <button
      aria-label="Create New Sheet"
      className="document-card ghost-document-card"
      disabled={areSheetActionsDisabled}
      onClick={newDocument}
      type="button"
    >
      <span className="ghost-document-preview" aria-hidden="true">
        <span className="ghost-document-plus">+</span>
      </span>
      <span className="document-card-meta">
        <span className="document-card-title">New Sheet</span>
        <span className="document-card-detail">0-line sheet</span>
      </span>
    </button>
  );

  const loopCountMenuContent = (
    <>
      <div className="loop-count-slider-heading">
        <h2 id="loop-count-popover-title">Iteration count</h2>
        <output aria-live="polite" htmlFor="loop-count-slider">
          {loopCount}
        </output>
      </div>
      <p>
        Choose how many iterations the sheet runs. Use the magic word <code>loop</code>{" "}
        in a formula to reference the current iteration.
      </p>
      <div className="loop-count-slider-row">
        <span aria-hidden="true">0</span>
        <label className="loop-count-slider-control" htmlFor="loop-count-slider">
          <span className="screen-reader-only">Iteration count</span>
          <input
            aria-valuetext={`${loopCount} iterations`}
            id="loop-count-slider"
            max={loopCountSliderMaximum}
            min={0}
            onChange={(event) => updateLoopCount(event.currentTarget.valueAsNumber)}
            step={1}
            type="range"
            value={loopCount}
          />
        </label>
        <span aria-hidden="true">{loopCountSliderMaximum}</span>
      </div>
      <div className="loop-count-slider-divider" />
      <div className="loop-label-setting">
        <div className="loop-label-setting-copy">
          <h3>Label</h3>
          <span>Names each iteration.</span>
        </div>
        <div className="loop-label-picker" ref={loopPeriodSidebarMenuRef}>
          <button
            aria-expanded={isLoopPeriodMenuOpen && !loopPeriodSidebarMenu}
            aria-haspopup="menu"
            className={`loop-label-selection-button ${
              isLoopPeriodMenuOpen && !loopPeriodSidebarMenu ? "active" : ""
            }`}
            onClick={(event) => {
              event.stopPropagation();
              toggleLoopLabelPicker();
            }}
            type="button"
          >
            <span>{loopPeriodLabel}</span>
            <UiIcon icon={ChevronDown} />
          </button>

          {isLoopPeriodMenuOpen && !loopPeriodSidebarMenu ? (
            <div className="loop-label-picker-popover">
              <LoopPeriodMenu
                allowNone={loopCount === 0}
                className="loop-label-picker-menu"
                customEditing={isLoopPeriodCustomEditing}
                draft={loopPeriodDraft}
                inputRef={loopPeriodInputRef}
                isCustom={isCustomLoopPeriod}
                label={loopPeriodLabel}
                onBeginCustom={beginCustomLoopPeriodEditing}
                onCancel={closeLoopPeriodMenu}
                onCommit={commitLoopPeriodLabel}
                onDraftChange={setLoopPeriodDraft}
                presets={loopPeriodPresets}
              />
            </div>
          ) : null}
        </div>
      </div>
    </>
  );

  return (
    <main
      className={`looper-shell ${isLoopSidebarResizing ? "loop-sidebar-resizing" : ""} ${
        isLoopVariablesDrawerResizing ? "loop-variables-drawer-resizing" : ""
      } ${rowDrag ? "row-dragging" : ""}`}
      data-header-control-size={headerControlSize}
      data-library-scrolled={isLibraryScrolled ? "true" : undefined}
      data-view-mode={viewMode}
      data-window-full-screen={isWindowFullScreen ? "true" : undefined}
      style={shellStyle}
    >
      {isLocalSheetDropActive ? (
        <div className="local-sheet-drop-overlay" role="status">
          <div className="local-sheet-drop-card">
            <UiIcon aria-hidden="true" icon={FileInput} />
            <strong>Drop to import</strong>
            <span>Add .loop files to your Looper library</span>
          </div>
        </div>
      ) : null}
      <header
        className={`native-titlebar ${viewMode === "editor" ? "sheet-titlebar" : ""} ${isLoopSidebarVisible ? "" : "results-hidden"} ${hasDismissiblePopoverOpen ? "dismisses-open-popover" : ""}`}
      >
        {viewMode === "editor" ? (
          <>
          <div className="titlebar-controls sheet-titlebar-editor-controls" aria-label="Document controls">
            {showsSheetBackButton ? (
              <TitlebarIconButton
                className="mobile-sheet-nav-button mobile-sheet-back-button"
                label={isMobileLoopSidebarVisible ? "Close loop sidebar" : "Back"}
                onClick={
                  isMobileLoopSidebarVisible
                    ? () => {
                        setIsLoopVariablesDrawerOpen(false);
                        setIsMobileLoopSidebarOpen(false);
                      }
                    : showDocumentLibrary
                }
              >
                <UiIcon
                  className={
                    isMobileLoopSidebarVisible ? "mobile-sidebar-close-icon" : "back-icon"
                  }
                  icon={isMobileLoopSidebarVisible ? X : ChevronLeft}
                />
              </TitlebarIconButton>
            ) : null}
            <div className="document-title-control" ref={documentMenuRef}>
              <button
                aria-expanded={publicDemoMode ? undefined : isDocumentMenuOpen}
                aria-haspopup={publicDemoMode ? undefined : "menu"}
                className={`titlebar-pill-button document-title-button ${isDocumentMenuOpen ? "active" : ""}`}
                onClick={(event) => {
                  if (publicDemoMode) return;
                  event.stopPropagation();
                  toggleDocumentMenu();
                }}
                title={publicDemoMode ? documentTitle : "Document options"}
                type="button"
              >
                <span className="document-title-button-label">{documentTitle}</span>
                {!publicDemoMode ? (
                  <UiIcon className="document-title-chevron" icon={ChevronDown} />
                ) : null}
              </button>

              {isDocumentMenuOpen && !publicDemoMode ? (
                isRenameEditing &&
                !activeDocumentIsBundledExample &&
                !activeDocumentIsSharedVisitor ? (
                  <form
                    aria-label="Rename document"
                    className="document-menu document-rename-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      commitRename();
                    }}
                    role="dialog"
                  >
                    <label htmlFor="document-rename-input">Rename document</label>
                    <input
                      id="document-rename-input"
                      onChange={(event) => setRenameDraft(event.currentTarget.value)}
                      ref={renameInputRef}
                      spellCheck={false}
                      value={renameDraft}
                    />
                    <div className="document-rename-actions">
                      <button onClick={() => setIsRenameEditing(false)} type="button">
                        Cancel
                      </button>
                      <button className="primary" disabled={!renameDraft.trim()} type="submit">
                        Rename
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="document-menu" role="menu" aria-label="Document options">
                    {!activeDocumentIsBundledExample &&
                    !activeDocumentIsSharedVisitor ? (
                      <button className="document-menu-item" onClick={beginRename} role="menuitem" type="button">
                        <span>Rename</span>
                      </button>
                    ) : null}
                    <button className="document-menu-item" onClick={duplicateDocument} role="menuitem" type="button">
                      <span>Duplicate</span>
                    </button>
                    <button
                      className="document-menu-item"
                      onClick={() => void exportDocument()}
                      role="menuitem"
                      type="button"
                    >
                      <span>Export CSV</span>
                    </button>
                    {!activeDocumentIsSharedVisitor ? (
                      <>
                        <div className="document-menu-separator" role="separator" />
                        <div
                          aria-label="Decimal places"
                          className="document-menu-decimal-setting"
                          role="group"
                        >
                          <span>Decimal places</span>
                          <div className="document-menu-decimal-options">
                            {decimalPlaceOptions.map((option) => (
                              <button
                                aria-checked={decimalPlaces === option}
                                aria-label={`${option} decimal ${option === 1 ? "place" : "places"}`}
                                className={decimalPlaces === option ? "selected" : ""}
                                key={option}
                                onClick={() => setDocumentDecimalPlaces(option)}
                                role="radio"
                                type="button"
                              >
                                {option}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    ) : null}
                    {!localOnlyMode &&
                    !activeDocumentIsBundledExample &&
                    activeDocument ? (
                      <>
                        <div className="document-menu-separator" role="separator" />
                        {!activeDocumentIsSharedVisitor ? (
                          <button
                            aria-checked={Boolean(activeDocument.cloud?.shareEnabled)}
                            className="document-menu-item"
                            disabled={isUpdatingShareSettings || isCreatingCloudSheet}
                            onClick={() =>
                              void setShareableUrlsEnabled(
                                !Boolean(activeDocument.cloud?.shareEnabled)
                              )
                            }
                            role="menuitemcheckbox"
                            type="button"
                          >
                            <span>Shareable URL</span>
                            <span className="document-menu-status">
                              {activeDocument.cloud?.shareEnabled ? "Enabled" : "Disabled"}
                            </span>
                          </button>
                        ) : null}
                        <button
                          className="document-menu-item"
                          disabled={
                            !activeDocument.cloud?.shareEnabled ||
                            isUpdatingShareSettings ||
                            isCreatingCloudSheet
                          }
                          onClick={() => void copyShareableUrl()}
                          role="menuitem"
                          type="button"
                        >
                          <span>Copy Shareable URL</span>
                        </button>
                      </>
                    ) : null}
                    {!activeDocumentIsBundledExample &&
                    !activeDocumentIsSharedVisitor ? (
                      <>
                        <div className="document-menu-separator" role="separator" />
                        <button
                          className="document-menu-item danger"
                          onClick={() => {
                            if (activeDocument) deleteLibraryDocument(activeDocument);
                          }}
                          role="menuitem"
                          type="button"
                        >
                          <span>Delete</span>
                        </button>
                      </>
                    ) : null}
                  </div>
                )
              ) : null}
            </div>
            <div className="header-loop-count-control loop-count-control" ref={loopCountMenuRef}>
              <button
                aria-expanded={isLoopCountMenuOpen}
                aria-haspopup="dialog"
                className={`titlebar-pill-button header-loop-count-button loop-count-menu-button ${
                  isLoopCountMenuOpen ? "active" : ""
                }`}
                onClick={(event) => {
                  event.stopPropagation();
                  toggleLoopCountMenu();
                }}
                title="Choose loop count"
                type="button"
              >
                <span className="titlebar-pill-label">
                  {isMobileWebLayout ? "Loop" : "Loop:"}
                </span>
                <span className="titlebar-pill-value">{loopCount}</span>
              </button>

              {isMobileWebLayout ? (
                <MobileLoopSheet
                  containerRef={loopCountMenuPopupRef}
                  labelledBy="loop-count-popover-title"
                  onRequestClose={closeLoopCountMenu}
                  open={isLoopCountMenuOpen}
                >
                  {loopCountMenuContent}
                </MobileLoopSheet>
              ) : isLoopCountMenuOpen ? (
                <div className="header-loop-count-popover" ref={loopCountMenuPopupRef}>
                  <section
                    aria-labelledby="loop-count-popover-title"
                    className="loop-count-slider-popover"
                    role="dialog"
                  >
                    {loopCountMenuContent}
                  </section>
                </div>
              ) : null}
            </div>
            <TitlebarIconButton
              active={isLoopSidebarVisible}
              className="mobile-sheet-nav-button mobile-sheet-sidebar-button"
              label={isLoopSidebarVisible ? "Hide loop sidebar" : "Show loop sidebar"}
              onClick={toggleLoopSidebarVisibility}
            >
              <UiIcon className="compact-titlebar-icon" icon={sidebarVisibilityIcon} />
              <span className="mobile-sidebar-button-label">Loops</span>
            </TitlebarIconButton>
          </div>
          </>
        ) : isMobileWebLayout ? null : (
          <div className="titlebar-controls library-titlebar-controls" aria-label="Sheet controls">
            {shouldShowLibrarySettingsControl ? (
            <div
              className="library-settings-control library-centered-control"
              ref={librarySettingsMenuRef}
            >
              <button
                aria-expanded={isLibrarySettingsMenuOpen}
                aria-haspopup="dialog"
                aria-label={
                  localOnlyMode
                    ? "Looper settings menu"
                    : presentedAccountState.status === "authenticated"
                    ? `${presentedAccountState.account.email} account menu`
                    : "Settings menu"
                }
                className={`titlebar-pill-button document-title-button library-title-button library-brand-settings-button mobile-library-glass-control ${isLibrarySettingsMenuOpen ? "active" : ""}`}
                onClick={(event) => {
                  event.stopPropagation();
                  closeLibraryDocumentMenu();
                  closeLibraryBulkMenu();
                  setIsLibrarySearchOpen(false);
                  setLibrarySearchQuery("");
                  setIsLibrarySettingsMenuOpen((current) => {
                    if (!current) setLibrarySettingsMenuView("root");
                    return !current;
                  });
                }}
                title={
                  localOnlyMode
                    ? "Looper"
                    : presentedAccountState.status === "authenticated"
                    ? presentedAccountState.account.email
                    : "Settings"
                }
                type="button"
              >
                <span className="document-title-button-label">
                  {localOnlyMode
                    ? "Looper"
                    : presentedAccountState.status === "authenticated"
                    ? presentedAccountState.account.email
                    : "Settings"}
                </span>
                <UiIcon className="document-title-chevron" icon={ChevronDown} />
              </button>

              {isLibrarySettingsMenuOpen ? (
                <div
                  className="library-settings-menu"
                  role="dialog"
                  aria-label={
                    localOnlyMode
                      ? "Looper settings"
                      : presentedAccountState.status === "authenticated"
                      ? `${presentedAccountState.account.email} account settings`
                      : "Settings"
                  }
                >
                  {librarySettingsMenuView === "root" ? (
                    <>
                      {debugSettingsAreAvailable ||
                      presentedAccountHasAdminAccess ||
                      presentedAccountNeedsAdminMfa ? (
                        <>
                          <div
                            aria-label="Internal tools"
                            className="settings-internal-tools"
                            role="group"
                          >
                            {debugSettingsAreAvailable ? (
                              <button
                                className="settings-menu-action settings-drill-row settings-internal-action"
                                onClick={() => setLibrarySettingsMenuView("debug")}
                                type="button"
                              >
                                <span className="settings-menu-item-copy">
                                  <UiIcon
                                    aria-hidden="true"
                                    className="settings-menu-item-icon"
                                    icon={Bug}
                                  />
                                  <span>Debug</span>
                                </span>
                                <UiIcon
                                  aria-hidden="true"
                                  className="settings-drill-chevron"
                                  icon={ChevronRight}
                                />
                              </button>
                            ) : null}
                            {presentedAccountHasAdminAccess ? (
                              <button
                                className="settings-menu-action settings-internal-action"
                                onClick={openAdminPanel}
                                type="button"
                              >
                                <span className="settings-menu-item-copy">
                                  <UiIcon
                                    aria-hidden="true"
                                    className="settings-menu-item-icon"
                                    icon={ShieldCheck}
                                  />
                                  <span>Admin Panel</span>
                                </span>
                              </button>
                            ) : null}
                            {presentedAccountNeedsAdminMfa ? (
                              <button
                                className="settings-menu-action settings-internal-action"
                                onClick={() => {
                                  setIsLibrarySettingsMenuOpen(false);
                                  setIsAdminMfaDialogOpen(true);
                                }}
                                type="button"
                              >
                                <span className="settings-menu-item-copy">
                                  <UiIcon
                                    aria-hidden="true"
                                    className="settings-menu-item-icon"
                                    icon={ShieldCheck}
                                  />
                                  <span>Verify Admin</span>
                                </span>
                              </button>
                            ) : null}
                          </div>
                          <div className="settings-separator" role="separator" />
                        </>
                      ) : null}
                      {!localOnlyMode &&
                      presentedAccountState.status === "authenticated" ? (
                        <button
                          aria-label={`Buy more storage with ${SHEET_PACK_SIZE} additional sheets. ${billingDialogStatus.sheetCount} sheets used of ${billingDialogStatus.sheetLimit}`}
                          className={`settings-sheet-usage-card ${
                            sheetUsageIsAtLimit ? "is-at-limit" : ""
                          }`}
                          disabled={
                            isLoadingSheetStorage ||
                            isCreatingCloudSheet ||
                            !billingDialogStatus.canPurchaseSheets
                          }
                          onClick={() => {
                            setIsLibrarySettingsMenuOpen(false);
                            setIsBillingDialogOpen(true);
                          }}
                          type="button"
                        >
                          <span className="settings-sheet-usage-header">
                            <span className="settings-label settings-sheet-usage-title">
                              {sheetUsageIsAtLimit ? (
                                <UiIcon
                                  aria-hidden="true"
                                  className="settings-sheet-usage-alert-icon"
                                  icon={CircleAlert}
                                />
                              ) : null}
                              <span>
                                {sheetUsageIsAtLimit ? "Limit Reached" : "Storage limit"}
                              </span>
                            </span>
                            <span className="settings-sheet-usage-action">
                              Buy more
                            </span>
                          </span>
                          <span
                            aria-hidden="true"
                            className="settings-sheet-usage-divider"
                          />
                          <span
                            aria-label={`${billingDialogStatus.sheetCount} of ${billingDialogStatus.sheetLimit} sheets used`}
                            aria-valuemax={billingDialogStatus.sheetLimit}
                            aria-valuemin={0}
                            aria-valuenow={billingDialogStatus.sheetCount}
                            className="settings-sheet-usage-scale"
                            role="progressbar"
                          >
                            <span className="settings-sheet-usage-boundary">0</span>
                            <span
                              aria-hidden="true"
                              className="settings-sheet-usage-meter"
                              style={
                                {
                                  "--sheet-usage-progress": `${sheetUsagePercent}%`
                                } as CSSProperties
                              }
                            >
                              <span className="settings-sheet-usage-track">
                                <span className="settings-sheet-usage-fill" />
                              </span>
                            </span>
                            <span className="settings-sheet-usage-boundary settings-sheet-usage-limit">
                              {billingDialogStatus.sheetLimit}
                            </span>
                          </span>
                        </button>
                      ) : null}
                      {!localOnlyMode &&
                      presentedAccountState.status === "authenticated" ? (
                        <div className="settings-separator" role="separator" />
                      ) : null}
                      {localOnlyMode ? (
                        <>
                          <div
                            aria-label="Local sheets"
                            className="settings-local-sheet-actions"
                            role="group"
                          >
                            <button
                              className="settings-menu-action"
                              onClick={() => {
                                setIsLibrarySettingsMenuOpen(false);
                                void openDocument();
                              }}
                              type="button"
                            >
                              <span className="settings-menu-item-copy">
                                <UiIcon
                                  aria-hidden="true"
                                  className="settings-menu-item-icon"
                                  icon={FileInput}
                                />
                                <span>Open Sheet…</span>
                              </span>
                            </button>
                            <button
                              className="settings-menu-action"
                              onClick={() => void revealLocalSheetDirectory()}
                              type="button"
                            >
                              <span className="settings-menu-item-copy">
                                <UiIcon
                                  aria-hidden="true"
                                  className="settings-menu-item-icon"
                                  icon={FolderOpen}
                                />
                                <span>
                                  {runtimePlatform === "darwin"
                                    ? "Show Sheet Folder in Finder"
                                    : "Show Sheet Folder in File Explorer"}
                                </span>
                              </span>
                            </button>
                            <button
                              className="settings-menu-action"
                              onClick={() => void changeLocalSheetDirectory()}
                              type="button"
                            >
                              <span className="settings-menu-item-copy">
                                <UiIcon
                                  aria-hidden="true"
                                  className="settings-menu-item-icon"
                                  icon={FolderCog}
                                />
                                <span>Change Sheet Folder…</span>
                              </span>
                            </button>
                          </div>
                          <div className="settings-separator" role="separator" />
                        </>
                      ) : null}
                      <button
                        aria-label={`Appearance: ${themeName(theme)}. Switch to ${themeName(nextAppearanceTheme)}`}
                        className="settings-row settings-setting-row"
                        onClick={() => setTheme(nextAppearanceTheme)}
                        title={`Switch to ${themeName(nextAppearanceTheme)} theme`}
                        type="button"
                      >
                        <span className="settings-menu-item-copy">
                          <UiIcon
                            aria-hidden="true"
                            className="settings-menu-item-icon"
                            icon={Palette}
                          />
                          <span className="settings-label">Appearance</span>
                        </span>
                        <span className="settings-setting-value">
                          {themeName(theme)}
                        </span>
                      </button>
                      {!localOnlyMode &&
                      presentedAccountState.status === "authenticated" ? (
                        <>
                          <div className="settings-separator" role="separator" />
                          <button
                            className="settings-menu-action"
                            disabled={isSigningOut}
                            onClick={() => void signOut()}
                            type="button"
                          >
                            <span className="settings-menu-item-copy">
                              <UiIcon
                                aria-hidden="true"
                                className="settings-menu-item-icon"
                                icon={LogOut}
                              />
                              <span>{isSigningOut ? "Signing Out…" : "Sign Out"}</span>
                            </span>
                          </button>
                          <button
                            className="settings-menu-action settings-danger-action"
                            disabled={isSigningOut}
                            onClick={openDeleteAccount}
                            type="button"
                          >
                            <span className="settings-menu-item-copy">
                              <UiIcon
                                aria-hidden="true"
                                className="settings-menu-item-icon"
                                icon={Trash2}
                              />
                              <span>Delete Account…</span>
                            </span>
                          </button>
                        </>
                      ) : null}
                    </>
                  ) : librarySettingsMenuView === "debug" ? (
                    <>
                      <div className="settings-drill-header">
                        <button
                          aria-label="Back to Settings"
                          className="settings-drill-back"
                          onClick={() => setLibrarySettingsMenuView("root")}
                          type="button"
                        >
                          <UiIcon aria-hidden="true" icon={ChevronLeft} />
                        </button>
                        <strong>Debug</strong>
                        <span aria-hidden="true" className="settings-drill-header-spacer" />
                      </div>
                      <div className="settings-separator" role="separator" />
                      <button
                        aria-checked={demoTimeEnabled}
                        className="settings-menu-action settings-toggle-row"
                        onClick={() => void toggleDemoTime()}
                        role="menuitemcheckbox"
                        type="button"
                      >
                        <span>Demo Time</span>
                        <span aria-hidden="true" className="settings-menu-check-slot">
                          {demoTimeEnabled ? (
                            <UiIcon className="settings-menu-check" icon={Check} />
                          ) : null}
                        </span>
                      </button>
                      <button
                        aria-checked={updateButtonPreviewEnabled}
                        className="settings-menu-action settings-toggle-row"
                        onClick={() => void toggleUpdateButtonPreview()}
                        role="menuitemcheckbox"
                        type="button"
                      >
                        <span>Preview Update Button</span>
                        <span aria-hidden="true" className="settings-menu-check-slot">
                          {updateButtonPreviewEnabled ? (
                            <UiIcon className="settings-menu-check" icon={Check} />
                          ) : null}
                        </span>
                      </button>
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
            ) : null}
            <div className="library-header-controls">
              {selectedLibraryDocumentCount > 0 ? (
                <div className="library-bulk-menu-control" ref={libraryBulkMenuRef}>
                  <button
                    aria-expanded={isLibraryBulkMenuOpen}
                    aria-haspopup="menu"
                    aria-label={`Actions for ${selectedLibraryDocumentCount} selected ${selectedLibraryDocumentCount === 1 ? "sheet" : "sheets"}`}
                    className={`icon-button titlebar-icon-button library-bulk-menu-button ${isLibraryBulkMenuOpen ? "active" : ""}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      closeLibraryDocumentMenu();
                      setIsLibrarySettingsMenuOpen(false);
                      setIsLibrarySearchOpen(false);
                      setLibrarySearchQuery("");
                      setIsLibraryBulkMenuOpen((current) => !current);
                    }}
                    title={`${selectedLibraryDocumentCount} selected`}
                    type="button"
                  >
                    <UiIcon
                      aria-hidden="true"
                      className="compact-titlebar-icon"
                      icon={Ellipsis}
                    />
                  </button>

                  {isLibraryBulkMenuOpen ? (
                    <div
                      aria-label="Selected sheet actions"
                      className="document-menu library-bulk-menu"
                      role="menu"
                    >
                      <div className="library-bulk-menu-summary">
                        {`${selectedLibraryDocumentCount} ${selectedLibraryDocumentCount === 1 ? "Sheet" : "Sheets"} Selected`}
                      </div>
                      <button
                        className="document-menu-item"
                        disabled={
                          areSheetActionsDisabled ||
                          presentedAccountState.status !== "authenticated"
                        }
                        onClick={() => void duplicateSelectedLibraryDocuments()}
                        role="menuitem"
                        type="button"
                      >
                        <span>Duplicate</span>
                      </button>
                      <button
                        className="document-menu-item"
                        onClick={() => void exportSelectedLibraryDocuments()}
                        role="menuitem"
                        type="button"
                      >
                        <span>Export CSV…</span>
                      </button>
                      <div className="document-menu-separator" role="separator" />
                      <button
                        className="document-menu-item danger"
                        disabled={selectionIncludesBundledExample}
                        onClick={() => void deleteSelectedLibraryDocuments()}
                        role="menuitem"
                        title={
                          selectionIncludesBundledExample
                            ? "Built-in examples cannot be deleted"
                            : undefined
                        }
                        type="button"
                      >
                        <span>Delete…</span>
                      </button>
                      <div className="document-menu-separator" role="separator" />
                      <button
                        className="document-menu-item"
                        onClick={clearLibrarySelection}
                        role="menuitem"
                        type="button"
                      >
                        <span>Clear Selection</span>
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {downloadAppButtonIsVisible &&
              !localOnlyMode &&
              presentedAccountState.status === "authenticated" ? (
                <a
                  className="titlebar-pill-button library-download-app-button"
                  href={downloadHref}
                  rel={window.looper.platform === "web" ? undefined : "noreferrer"}
                  target={window.looper.platform === "web" ? undefined : "_blank"}
                  title={downloadAppLabel}
                >
                  <span>{downloadAppLabel}</span>
                </a>
              ) : null}
              {localOnlyMode ||
              presentedAccountState.status === "authenticated" ? (
                <div className="library-search-control" ref={librarySearchControlRef}>
                <button
                  aria-expanded={isLibrarySearchOpen}
                  aria-haspopup="dialog"
                  aria-label="Search sheets"
                  className={`icon-button titlebar-icon-button library-search-button ${isLibrarySearchOpen ? "active" : ""}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    closeLibraryDocumentMenu();
                    closeLibraryBulkMenu();
                    setIsLibrarySettingsMenuOpen(false);
                    if (isLibrarySearchOpen) setLibrarySearchQuery("");
                    setIsLibrarySearchOpen(!isLibrarySearchOpen);
                  }}
                  title="Search sheets"
                  type="button"
                >
                  <UiIcon className="compact-titlebar-icon" icon={Search} />
                </button>

                {isLibrarySearchOpen ? (
                  <div
                    className="library-search-popover"
                    role="dialog"
                    aria-label="Search sheets"
                  >
                    <label className="library-search-field">
                      <UiIcon icon={Search} />
                      <input
                        aria-label="Search sheets"
                        autoComplete="off"
                        onChange={(event) => setLibrarySearchQuery(event.currentTarget.value)}
                        placeholder="Search sheets"
                        ref={librarySearchInputRef}
                        spellCheck={false}
                        type="search"
                        value={librarySearchQuery}
                      />
                      <span className="library-search-shortcut" aria-hidden="true">
                        {primaryShortcutPrefix}F
                      </span>
                    </label>
                    <div
                      className={`library-search-results scrollbar-on-scroll ${isLibrarySearchOverflowing ? "is-overflowing" : ""}`}
                      onScroll={handleTransientScrollbarScroll}
                      ref={librarySearchResultsRef}
                    >
                      {librarySearchQuery.trim() ? (
                        <div className="library-search-summary" aria-live="polite">
                          {`${librarySearchResults.length} ${librarySearchResults.length === 1 ? "result" : "results"}`}
                        </div>
                      ) : null}
                      {librarySearchResults.length > 0 ? (
                        librarySearchResults.map((document) => (
                          <button
                            className="library-search-result"
                            key={`search-${document.id}`}
                            onClick={() => {
                              setIsLibrarySearchOpen(false);
                              setLibrarySearchQuery("");
                              selectLibraryDocument(document.id);
                            }}
                            type="button"
                          >
                            <span className="library-search-result-copy">
                              <span className="library-search-result-title">{document.title}</span>
                              <span className="library-search-result-detail">
                                {documentActivityDetail(document.updatedAt)}
                              </span>
                            </span>
                          </button>
                        ))
                      ) : (
                        <div className="library-search-empty">No sheets found</div>
                      )}
                    </div>
                  </div>
                ) : null}
                </div>
              ) : null}
              {!publicDemoMode &&
              !localOnlyMode &&
              presentedAccountState.status === "anonymous" ? (
                <button
                  aria-label="Sign in to Looper"
                  className="titlebar-pill-button document-title-button library-title-button library-sign-in-button mobile-library-glass-control"
                  onClick={openAccountDialog}
                  title="Sign In"
                  type="button"
                >
                  <span className="document-title-button-label">Sign In</span>
                </button>
              ) : null}
            </div>
          </div>
        )}
      </header>

      {visibleCloudIssue ? (
        <aside
          aria-live={isUsingOffline ? "polite" : "assertive"}
          className={`cloud-sync-banner ${isUsingOffline ? "offline" : ""}`}
          role={isUsingOffline ? "status" : "alert"}
        >
          <span>{visibleCloudIssue}</span>
          {presentedAccountState.status === "authenticated" && !isUsingOffline ? (
            <button
              disabled={isLoadingCloudSheets || isSigningOut}
              onClick={retryCloudSync}
              type="button"
            >
              Retry
            </button>
          ) : null}
        </aside>
      ) : null}

      {appUpdateState.status !== "idle" ? (
        <button
          aria-label={
            appUpdateState.status === "available"
              ? appUpdateState.preview
                ? "Preview Update App button"
                : `Download and install ${appUpdateState.releaseName}`
              : appUpdateState.status === "installing"
                ? `Installing ${appUpdateState.releaseName}; Looper will restart`
                : `Downloading ${appUpdateState.releaseName}, ${Math.round(appUpdateState.progress)} percent`
          }
          className={`app-update-button ${
            appUpdateState.status === "available" ? "" : "is-progress"
          }`}
          data-preview={appUpdateState.preview ? "true" : undefined}
          data-state={appUpdateState.status}
          disabled={appUpdateState.status !== "available"}
          onClick={() => void installAppUpdate()}
          title={
            appUpdateState.preview
              ? "Preview the update download animation"
              : appUpdateState.status === "available"
                ? `${appUpdateState.releaseName} is ready to download`
                : "Looper will restart automatically when the update is ready"
          }
          type="button"
        >
          <span className="app-update-label">Update App</span>
          <span aria-hidden="true" className="app-update-progress">
            <svg className="app-update-progress-ring" viewBox="0 0 24 24">
              <circle
                className="app-update-progress-track"
                cx="12"
                cy="12"
                r="9"
              />
              <circle
                className="app-update-progress-value"
                cx="12"
                cy="12"
                r="9"
                style={{
                  strokeDashoffset:
                    appUpdateProgressCircumference *
                    (1 -
                      (appUpdateState.status === "available"
                        ? 0
                        : appUpdateState.progress) /
                        100)
                }}
              />
            </svg>
          </span>
          <span aria-live="polite" className="screen-reader-only">
            {appUpdateState.status === "downloading"
              ? `Downloading update: ${Math.round(appUpdateState.progress)} percent`
              : appUpdateState.status === "installing"
                ? "Update downloaded. Restarting Looper."
                : ""}
          </span>
        </button>
      ) : null}

      {viewMode === "library" ? (
        <section
          className="document-library scrollbar-on-scroll"
          aria-label="All documents"
          onScroll={handleLibraryScroll}
          ref={libraryScrollRef}
        >
          {isMobileWebLayout ? (
            <MobileMarketingLibrary
              downloadHref={downloadHref}
              iconSource={looperIconSource}
            />
          ) : (
            <>
          {(localOnlyMode
            ? presentedUserLibraryDocuments.length === 0
            : presentedAccountState.status !== "authenticated") ? (
            <div className="library-header">
              <div className="library-title-group">
                <img alt="" className="library-hero-icon" draggable={false} src={looperIconSource} />
                <h1>
                  <strong>Looper</strong>
                  <span>
                    {publicDemoMode
                      ? " is an open source desktop notebook calculator. It uses the magic word "
                      : " is an advanced notebook calculator. Use the magic word "}
                  </span>
                  <span className="library-hero-accent">loop</span>
                  <span>
                    {publicDemoMode
                      ? " to manipulate calculations over time."
                      : " to see how calculations change over time."}
                  </span>
                </h1>
              </div>
            </div>
          ) : null}

          {(localOnlyMode
            ? presentedUserLibraryDocuments.length === 0
            : presentedAccountState.status === "anonymous") ? (
            <div
              aria-label="Get started"
              className="signed-out-library-actions"
            >
              {!publicDemoMode ? (
                <button
                  className="signed-out-library-action signed-out-create-sheet-action"
                  disabled={areSheetActionsDisabled}
                  onClick={newDocument}
                  type="button"
                >
                  <UiIcon className="signed-out-library-action-icon" icon={FilePlus} />
                  <span>Create Sheet</span>
                </button>
              ) : null}
              {(publicDemoMode || !localOnlyMode) && downloadAppButtonIsVisible ? (
                <a
                  className="signed-out-library-action signed-out-download-app-action"
                  href={downloadHref}
                  rel={window.looper.platform === "web" ? undefined : "noreferrer"}
                  target={window.looper.platform === "web" ? undefined : "_blank"}
                >
                  <UiIcon className="signed-out-library-action-icon" icon={Download} />
                  <span>{downloadAppLabel}</span>
                </a>
              ) : null}
              {publicDemoMode ? (
                <a
                  className="signed-out-library-action signed-out-view-source-action"
                  href={looperSourceUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  <UiIcon className="signed-out-library-action-icon" icon={Code2} />
                  <span>View Source</span>
                </a>
              ) : null}
            </div>
          ) : null}

          {(localOnlyMode
            ? presentedUserLibraryDocuments.length > 0
            : presentedAccountState.status !== "anonymous" ||
              presentedUserLibraryDocuments.length > 0) ? (
            <div
              aria-label="Your sheets"
              className="document-grid"
            >
              {!publicDemoMode &&
              (localOnlyMode || presentedAccountState.status !== "anonymous")
                ? newSheetCard
                : null}
              {presentedUserLibraryDocuments.map((document) =>
                renderLibraryDocumentCard(document)
              )}
            </div>
          ) : null}

          {learningLibraryDocuments.length > 0 ? (
            <>
              <div className="library-divider" role="separator" />
              <section
                aria-labelledby="getting-started-heading"
                className="getting-started-section"
              >
                <h2
                  className="library-section-title getting-started-title"
                  id="getting-started-heading"
                >
                  Looper Basics
                </h2>
                <div
                  aria-label="Looper Basics sheets"
                  className="document-grid getting-started-grid learning-grid"
                >
                  {learningLibraryDocuments.map((document, index) =>
                    renderLibraryDocumentCard(document, `${index + 1}. ${document.title}`)
                  )}
                </div>
              </section>
            </>
          ) : null}

          {templateLibraryDocuments.length > 0 ? (
            <>
              <div className="library-divider" role="separator" />
              <section
                aria-labelledby="templates-heading"
                className="getting-started-section"
              >
                <h2
                  className="library-section-title getting-started-title"
                  id="templates-heading"
                >
                  Templates
                </h2>
                <div
                  aria-label="Template sheets"
                  className="document-grid getting-started-grid"
                >
                  {templateLibraryDocuments.map((document) =>
                    renderLibraryDocumentCard(document)
                  )}
                </div>
              </section>
            </>
          ) : null}
            </>
          )}
          {publicDemoMode ? <PublicWebsiteFooter /> : null}
        </section>
      ) : (
        <section className={`native-workspace ${isLoopSidebarVisible ? "" : "results-hidden"}`}>
          <section className="native-editor-panel" aria-label="Looper editor">
            <div className="editor-stack">
              <div
                className="editor-scroll-frame"
                style={rowDrag
                  ? ({ "--row-drag-source-height": `${rowDrag.sourceHeight}px` } as CSSProperties)
                  : undefined}
              >
                <div className="row-reorder-rail" aria-label="Line numbers and row reorder controls">
                <div className="row-reorder-scroll-viewport">
                  <div className="row-reorder-rail-inner" ref={rowHandlesInnerRef}>
                    {sourceLines.map((_, index) => {
                      const isDragging = rowDrag?.sourceIndex === index;
                      const lineNumber = index;
                      const isReorderable = canReorderLine(index);
                      const dragClassName = rowDragRowClassName(rowDrag, index);

                      return (
                        <div
                          className={`row-reorder-row ${dragClassName}`}
                          key={`row-reorder-${index}-${sourceLines.length}`}
                        >
                          {isReorderable ? (
                            <button
                              aria-label={`Drag row ${lineNumber} to reorder`}
                              className={`line-number-button can-reorder ${isDragging ? "dragging" : ""}`}
                              onPointerCancel={cancelRowDrag}
                              onPointerDown={(event) => beginRowDrag(event, index)}
                              onPointerUp={finishRowDrag}
                              onLostPointerCapture={cancelRowDrag}
                              tabIndex={-1}
                              title="Drag to reorder row"
                              type="button"
                            >
                              <span className="line-number-text">{lineNumber}</span>
                              <UiIcon className="line-number-gripper" icon={GripHorizontal} />
                            </button>
                          ) : (
                            <span
                              className="line-number-button locked"
                              aria-hidden="true"
                              title="Row cannot be moved"
                            >
                              <span className="line-number-text">{lineNumber}</span>
                              <UiIcon className="line-number-lock" icon={Lock} />
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div
                aria-hidden="true"
                className="editor-highlight-viewport has-interactive-tokens"
              >
                <pre className="highlight-layer" ref={highlightLayerRef}>
                  {sourceLines.map((line, index) => {
                    const isPublished = loopedLineNumbers.has(index);
                    return (
                      <div
                        className={`highlight-row ${lineUsesFullEditorWidth(line) ? "comment-only" : ""} ${shouldDisplayDivider(line, focusedEditorLine === index) ? "divider" : ""} ${isPublished ? "published-line" : ""} ${rowDragRowClassName(rowDrag, index)}`}
                        key={`highlight-${index}-${sourceLines.length}`}
                      >
                        {highlightLine(
                          line,
                          evaluation.lines[index],
                          index,
                          syntaxHighlightContext,
                          globalReferenceTarget,
                          navigateToGlobalDefinition
                        )}
                      </div>
                    );
                  })}
                </pre>
              </div>
              <div
                aria-label="Document text"
                aria-multiline="true"
                className="editor-input scrollbar-on-scroll"
                contentEditable="plaintext-only"
                ref={editorRef}
                role="textbox"
                spellCheck={false}
                suppressContentEditableWarning
                onBeforeInput={handleEditorBeforeInput}
                onBlur={handleEditorBlur}
                onCut={handleEditorCut}
                onFocus={handleEditorFocus}
                onInput={handleEditorInput}
                onKeyDown={handleEditorKeyDown}
                onPaste={handleEditorPaste}
                onScroll={handleEditorScroll}
                onSelect={handleEditorSelect}
              />

              <div className="static-results">
                <div className="static-results-inner" ref={staticResultsInnerRef}>
                  {sourceLines.map((_, index) => {
                    const line = evaluation.lines[index];
                    const item = line?.evaluations[activeResultLoop];
                    const canSortSection = canSafelySortSection(
                      evaluation.lines,
                      index,
                      activeResultLoop
                    );
                    const nextSortDirection = canSortSection
                      ? nextSectionSortDirection(evaluation.lines, index, activeResultLoop)
                      : undefined;
                    const isLoading = evaluationWaitsForStockQuote(
                      item,
                      loadingStockSymbols
                    );
                    const isLoopedResult =
                      item?.status === "success" && Boolean(item.value?.isLooped) && Boolean(line);
                    const isLoopResultPopoverOpen =
                      isLoopedResult && loopResultPopover?.lineNumber === line?.lineNumber;

                    return (
                      <div
                        className={`static-result-row ${loopedLineNumbers.has(index) ? "published-line" : ""} ${rowDragRowClassName(rowDrag, index)}`}
                        key={`static-${index}-${sourceLines.length}`}
                      >
                        {canSortSection ? (
                          <button
                            aria-label={`Sort ${(line.title ?? "section").replace(/:\s*$/, "")} ${
                              nextSortDirection === "descending" ? "high to low" : "low to high"
                            }`}
                            className="section-sort-button"
                            onClick={() => sortSection(index)}
                            title={`Sort section ${
                              nextSortDirection === "descending" ? "high to low" : "low to high"
                            }`}
                            type="button"
                          >
                            <UiIcon className="section-sort-icon" icon={ListFilter} />
                          </button>
                        ) : (
                          <span
                            aria-label={
                              isLoopedResult && line
                                ? `Show values by loop iteration for ${resultLineLabel(line)}`
                                : undefined
                            }
                            aria-controls={
                              isLoopResultPopoverOpen
                                ? "loop-result-history-popover"
                                : undefined
                            }
                            aria-expanded={isLoopedResult ? isLoopResultPopoverOpen : undefined}
                            className={`${resultClassName(
                              item,
                              "static-result-value",
                              isLoading
                            )} ${isLoopResultPopoverOpen ? "active" : ""}`.trim()}
                            onClick={(event) => {
                              if (isLoopedResult && line) {
                                toggleLoopResultPopover(event.currentTarget, line);
                              }
                            }}
                            onKeyDown={(event) => {
                              if (!isLoopedResult || !line || !["Enter", " "].includes(event.key)) {
                                return;
                              }
                              event.preventDefault();
                              toggleLoopResultPopover(event.currentTarget, line);
                            }}
                            role={isLoopedResult ? "button" : undefined}
                            tabIndex={isLoopedResult ? 0 : undefined}
                            title={isLoading ? "Loading stock quote" : item?.error}
                          >
                            {line?.kind === "equation"
                              ? formatEvaluation(item, isLoading)
                              : ""}
                          </span>
                        )}
                        <button
                          aria-label={`${loopedLineNumbers.has(index) ? "Unpublish" : "Publish"} line ${index}`}
                          aria-pressed={loopedLineNumbers.has(index)}
                          className={`publish-line-button ${loopedLineNumbers.has(index) ? "active" : ""}`}
                          onClick={() =>
                            toggleLoopedLine(
                              index,
                              sourceLines[index].trim() || `Line ${index}`
                            )
                          }
                          title={loopedLineNumbers.has(index) ? "Hide from sidebar" : "Show in sidebar"}
                          type="button"
                        >
                          <UiIcon icon={ArrowRight} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {rowDrag ? (
                <div
                  aria-hidden="true"
                  className={`row-drag-preview ${lineUsesFullEditorWidth(draggedSource) ? "comment-only" : ""}`}
                  style={{
                    height: `${rowDrag.sourceHeight}px`,
                    transform: `translateY(${rowDrag.previewTop}px) scale(1.012)`
                  }}
                >
                  <span className="row-drag-preview-handle">
                    <UiIcon icon={GripHorizontal} />
                  </span>
                  <div className="row-drag-preview-source">
                    {highlightLine(
                      draggedSource,
                      draggedEvaluationLine,
                      rowDrag.sourceIndex,
                      syntaxHighlightContext
                    )}
                  </div>
                  <div className="row-drag-preview-result">
                    <span
                      className={resultClassName(
                        draggedResult,
                        "static-result-value",
                        draggedResultIsLoading
                      )}
                      title={
                        draggedResultIsLoading
                          ? "Loading stock quote"
                          : draggedResult?.error
                      }
                    >
                      {draggedEvaluationLine?.kind === "equation"
                        ? formatEvaluation(draggedResult, draggedResultIsLoading)
                        : ""}
                    </span>
                  </div>
                </div>
              ) : null}
              </div>
            </div>
          </section>

          {isLoopSidebarVisible && !isMobileWebLayout ? (
            <div
              aria-label="Resize loop sidebar"
              aria-orientation="vertical"
              aria-valuemax={maximumLoopSidebarWidth(window.innerWidth)}
              aria-valuemin={loopSidebarMinWidth}
              aria-valuenow={loopSidebarWidth}
              className={`loop-sidebar-resize-handle ${isLoopSidebarResizing ? "resizing" : ""}`}
              onKeyDown={handleLoopSidebarResizeKeyDown}
              onPointerCancel={cancelLoopSidebarResize}
              onPointerDown={beginLoopSidebarResize}
              onPointerMove={updateLoopSidebarResize}
              onPointerUp={finishLoopSidebarResize}
              role="separator"
              tabIndex={0}
              title="Drag to resize loop sidebar"
            />
          ) : null}

          <section
            aria-hidden={!isLoopSidebarVisible}
            className={`loop-results ${
              SHOW_LOOP_VARIABLES_DRAWER && isLoopVariablesDrawerOpen
                ? "variables-expanded"
                : "variables-drawer-hidden"
            }`}
            aria-label="Loop results"
            ref={loopResultsRef}
            style={
              {
                "--loop-sidebar-variables-drawer-height": `${loopVariablesDrawerHeight}px`
              } as CSSProperties
            }
          >
            <div className="loop-results-list scrollbar-on-scroll" onScroll={handleLoopResultsScroll}>
              {activeLoopedLines.length === 0 ? (
                shouldShowSidebarPublishHint ? (
                  <div
                    className="loop-sidebar-empty-state"
                    style={
                      {
                        "--loop-sidebar-publish-hint-offset": `${sidebarPublishHintOffset}px`
                      } as CSSProperties
                    }
                  >
                    <div className="loop-sidebar-published-lines-callout">
                      <span
                        className="loop-sidebar-published-lines-callout-icon"
                        aria-hidden="true"
                      />
                      <div className="loop-sidebar-callout-copy">
                        <span className="loop-sidebar-callout-title">Publish Arrows</span>
                        <span className="loop-sidebar-callout-body">
                          Click the arrow icon to the right of a result to publish that line to the
                          sidebar
                        </span>
                      </div>
                    </div>
                  </div>
                ) : null
              ) : loopIndices.map((loop) => (
                <div className="loop-period" key={`loop-${loop}`}>
                  {loopPeriodLabel !== NONE_LOOP_PERIOD_LABEL ? (
                    <div className="loop-header-row">
                      <button
                        aria-expanded={
                          isLoopPeriodMenuOpen && loopPeriodSidebarMenu?.loop === loop
                        }
                        aria-haspopup="menu"
                        aria-controls={
                          isLoopPeriodMenuOpen && loopPeriodSidebarMenu?.loop === loop
                            ? "loop-period-sidebar-menu"
                            : undefined
                        }
                        aria-label={`Change label for ${loopIterationLabel(
                          loopPeriodLabel,
                          loop,
                          evaluation.loopCount
                        )}`}
                        className={`loop-header-label-button ${
                          isLoopPeriodMenuOpen && loopPeriodSidebarMenu?.loop === loop
                            ? "active"
                            : ""
                        }`}
                        onClick={(event) => {
                          const willOpen = !(
                            isLoopPeriodMenuOpen && loopPeriodSidebarMenu?.loop === loop
                          );
                          toggleLoopPeriodSidebarMenu(event.currentTarget, loop);
                          if (!willOpen) return;
                          requestAnimationFrame(() => {
                            loopPeriodSidebarMenuRef.current
                              ?.querySelector<HTMLButtonElement>("button")
                              ?.focus();
                          });
                        }}
                        onKeyDown={(event) => {
                          if (event.key !== "ArrowDown") return;
                          event.preventDefault();
                          showLoopPeriodSidebarMenu(event.currentTarget, loop);
                          requestAnimationFrame(() => {
                            loopPeriodSidebarMenuRef.current
                              ?.querySelector<HTMLButtonElement>("button")
                              ?.focus();
                          });
                        }}
                        type="button"
                      >
                        <span>
                          {loopIterationLabel(loopPeriodLabel, loop, evaluation.loopCount)}:
                        </span>
                      </button>
                    </div>
                  ) : null}
                  {activeLoopedLines.map((line) => {
                    if (line.kind !== "equation" && loop !== 0) return null;
                    const item = line.evaluations[loop];
                    const variableName = line.variable ?? line.title ?? (line.source.trim() || "Blank line");
                    const triggerKey = `loop-${loop}-line-${line.lineNumber}`;
                    const isLoading = evaluationWaitsForStockQuote(
                      item,
                      loadingStockSymbols
                    );
                    return (
                      <div className="loop-result-variable" key={triggerKey}>
                      {(documentData.loopSidebarDividerLines ?? []).includes(line.lineNumber) ? (
                        <div className="loop-result-divider" aria-hidden="true" />
                      ) : null}
                      <button
                        aria-controls={
                          loopVariableSidebarMenu?.triggerKey === triggerKey
                            ? "loop-variable-sidebar-menu"
                            : undefined
                        }
                        aria-expanded={loopVariableSidebarMenu?.triggerKey === triggerKey}
                        aria-haspopup="menu"
                        aria-label={`Options for ${variableName} in ${loopPeriodLabel} ${loop}`}
                        className={`loop-result-row loop-variable-trigger ${
                          loopVariableSidebarMenu?.triggerKey === triggerKey ? "active" : ""
                        }`}
                        onClick={(event) =>
                          toggleLoopVariableSidebarMenu(
                            event.currentTarget,
                            triggerKey,
                            variableName,
                            line.lineNumber,
                            "sidebar"
                          )
                        }
                        type="button"
                      >
                        <span
                          className={`loop-result-label ${variableName.startsWith("@") ? "syntax-global-variable" : ""}`}
                        >
                          {line.variable || !line.source.trim() ? (
                            <span>{variableName}</span>
                          ) : (
                            highlightLine(
                              line.source,
                              line,
                              line.lineNumber,
                              syntaxHighlightContext,
                              undefined,
                              undefined,
                              loop
                            )
                          )}
                        </span>
                        {line.kind === "equation" ? (
                          <span
                            className={resultClassName(item, "result-value", isLoading)}
                            title={isLoading ? "Loading stock quote" : item?.error}
                          >
                            {formatEvaluation(item, isLoading)}
                          </span>
                        ) : <span />}
                      </button>
                      </div>
                    );
                  })}
                  <div className="loop-result-spacer" />
                </div>
              ))}
            </div>
            {SHOW_LOOP_VARIABLES_DRAWER ? (
              <LoopVariablesDrawer
                availableCount={availableLoopVariableCount}
                drawerHeight={loopVariablesDrawerHeight}
                groups={loopVariableGroups}
                isLoopPublished={documentData.isLoopVariablePublished}
                loopedLines={documentData.loopedLines}
                maximumHeight={loopVariablesDrawerMaximumHeight}
                minimumHeight={loopVariablesDrawerMinimumHeight}
                onResizeCancel={cancelLoopVariablesDrawerResize}
                onResizeFinish={finishLoopVariablesDrawerResize}
                onResizeKeyDown={handleLoopVariablesDrawerResizeKeyDown}
                onResizeMove={updateLoopVariablesDrawerResize}
                onResizeStart={beginLoopVariablesDrawerResize}
                onSelectAll={showAllLoopVariables}
                onSelectNone={hideAllLoopVariables}
                onToggle={toggleLoopVariablesDrawer}
                onToggleGroup={toggleLoopVariableGroup}
                onToggleLine={toggleLoopedLine}
                onToggleLoop={toggleLoopVariable}
                open={isLoopVariablesDrawerOpen}
                visibleCount={visibleLoopVariableCount}
              />
            ) : null}
          </section>
        </section>
      )}

      {!localOnlyMode ? <AdminPanelDialog
        onClose={() => setIsAdminPanelOpen(false)}
        open={isAdminPanelOpen && presentedAccountHasAdminAccess}
      /> : null}

      {!localOnlyMode ? <AdminMfaDialog
        onClose={() => setIsAdminMfaDialogOpen(false)}
        onVerified={() => {
          applyAdminAccessStatus("granted");
          setIsAdminMfaDialogOpen(false);
          setMessage("Admin access verified with your authenticator.");
        }}
        open={
          isAdminMfaDialogOpen &&
          adminAccessStatus === "mfa_required" &&
          authenticatedAccount !== undefined
        }
      /> : null}

      {!localOnlyMode ? <BillingDialog
        onCheckout={startBillingCheckout}
        onClose={() => setIsBillingDialogOpen(false)}
        open={isBillingDialogOpen}
        preview={billingPreviewMode !== "live"}
        status={billingDialogStatus}
      /> : null}

      {!localOnlyMode ? <AccountDialog
        initialEmail={
          signedOutPreviewEnabled ? undefined : authenticatedAccount?.email
        }
        lockEmail={accountDialogPurpose === "delete-account"}
        onClose={(reason) => {
          setIsAccountDialogOpen(false);
          if (reason === "cancel") setPendingSheetIntent(undefined);
          setAccountDialogPurpose("sign-in");
        }}
        onRequestCode={requestEmailCode}
        onVerified={
          accountDialogPurpose === "sign-in" ? finishAccountVerification : undefined
        }
        onVerifyCode={
          accountDialogPurpose === "delete-account"
            ? verifyAndDeleteAccount
            : verifyEmailCode
        }
        open={isAccountDialogOpen}
        title={
          accountDialogPurpose === "delete-account"
            ? "Confirm account deletion"
            : "Sign up or log in"
        }
        verificationErrorLabel={
          accountDialogPurpose === "delete-account"
            ? "Could not delete account"
            : "Could not sign in"
        }
      /> : null}

      {isLoopPeriodMenuOpen && loopPeriodSidebarMenu
        ? createPortal(
            <div
              className="loop-period-sidebar-popover"
              id="loop-period-sidebar-menu"
              ref={loopPeriodSidebarMenuRef}
              style={loopPeriodSidebarMenuStyle}
            >
              <LoopPeriodMenu
                allowNone={loopCount === 0}
                customEditing={isLoopPeriodCustomEditing}
                draft={loopPeriodDraft}
                inputRef={loopPeriodInputRef}
                isCustom={isCustomLoopPeriod}
                label={loopPeriodLabel}
                onBeginCustom={beginCustomLoopPeriodEditing}
                onCancel={closeLoopPeriodMenu}
                onCommit={commitLoopPeriodLabel}
                onDraftChange={setLoopPeriodDraft}
                presets={loopPeriodPresets}
              />
            </div>,
            document.body
          )
        : null}

      {loopResultPopover && loopResultPopoverLine
        ? createPortal(
            <div
              aria-label={`Values by loop iteration for ${resultLineLabel(loopResultPopoverLine)}`}
              className="loop-result-history-popover"
              id="loop-result-history-popover"
              ref={loopResultPopoverRef}
              role="dialog"
              style={{
                maxHeight: `${loopResultPopover.maxHeight}px`,
                right: `${loopResultPopover.right}px`,
                top: `${loopResultPopover.top}px`
              }}
            >
              {loopResultPopoverLine.evaluations.map((item) => {
                const isLoading = evaluationWaitsForStockQuote(
                  item,
                  loadingStockSymbols
                );
                const valueClassName = [
                  "loop-result-history-value",
                  item.status === "error" ? "error" : "",
                  item.status === "empty" || item.status === "title" ? "empty" : "",
                  isLoading ? "loading" : ""
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <div className="loop-result-history-row" key={`loop-history-${item.loop}`}>
                    <span className="loop-result-history-index">{item.loop}</span>
                    <span className={valueClassName} title={item.error}>
                      {formatEvaluation(item, isLoading)}
                    </span>
                  </div>
                );
              })}
            </div>,
            document.body
          )
        : null}

      {loopVariableSidebarMenu
        ? createPortal(
            <div
              aria-label={`${loopVariableSidebarMenu.name} options`}
              className="loop-variable-sidebar-menu"
              id="loop-variable-sidebar-menu"
              ref={loopVariableSidebarMenuRef}
              role="menu"
              style={{
                left: loopVariableSidebarMenu.left,
                right: loopVariableSidebarMenu.right,
                top: `${loopVariableSidebarMenu.top}px`
              }}
            >
              {selectedVariableMenuDefinition?.definitionCount &&
              selectedVariableMenuDefinition.definitionCount > 1 ? (
                <div className="variables-menu-definition-context" role="presentation">
                  <span className="variables-menu-definition-name">
                    {selectedVariableMenuDefinition.name}
                    {selectedVariableMenuDefinition.qualifier
                      ? ` · ${selectedVariableMenuDefinition.qualifier}`
                      : ""}
                  </span>
                  <span className="variables-menu-definition-detail">
                    {selectedVariableMenuDefinition.isRedefinition
                      ? `Redefinition ${selectedVariableMenuDefinition.occurrence} of ${selectedVariableMenuDefinition.definitionCount}`
                      : `Original definition · 1 of ${selectedVariableMenuDefinition.definitionCount}`}
                  </span>
                </div>
              ) : null}
              <button
                aria-checked={
                  loopVariableSidebarMenu.source === "editor"
                    ? selectedVariableMenuIsPublished
                    : undefined
                }
                className="variables-menu-item"
                onClick={hideSelectedLoopVariable}
                role={
                  loopVariableSidebarMenu.source === "editor"
                    ? "menuitemcheckbox"
                    : "menuitem"
                }
                type="button"
              >
                <span className="variables-menu-check" aria-hidden="true">
                  {loopVariableSidebarMenu.source === "editor" ? (
                    selectedVariableMenuIsPublished ? <UiIcon icon={Check} /> : null
                  ) : (
                    <UiIcon icon={X} />
                  )}
                </span>
                <span className="variables-menu-item-label">
                  {loopVariableSidebarMenu.source === "editor"
                    ? "Show in sidebar"
                    : "Hide from sidebar"}
                </span>
              </button>
              <button
                className="variables-menu-item"
                onClick={toggleSelectedLoopVariableDivider}
                role="menuitem"
                type="button"
              >
                <span className="variables-menu-check" aria-hidden="true">
                  <UiIcon icon={Minus} />
                </span>
                <span className="variables-menu-item-label">
                  {selectedVariableMenuHasDivider
                    ? "Remove divider"
                    : "Insert divider"}
                </span>
              </button>
            </div>,
            document.body
          )
        : null}

      <div className="screen-reader-only" aria-live="polite">
        {message}
      </div>
    </main>
  );
}
