type EscapeSheetNavigationInput = {
  hasOpenTransientUi: boolean;
  isComposing: boolean;
  isEditorView: boolean;
  isRepeat: boolean;
  key: string;
};

export function shouldEscapeToDocumentLibrary({
  hasOpenTransientUi,
  isComposing,
  isEditorView,
  isRepeat,
  key
}: EscapeSheetNavigationInput): boolean {
  return (
    key === "Escape" &&
    isEditorView &&
    !hasOpenTransientUi &&
    !isComposing &&
    !isRepeat
  );
}
