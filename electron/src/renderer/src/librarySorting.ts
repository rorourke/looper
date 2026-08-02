type LastModifiedSheet = {
  id: string;
  updatedAt: string;
};

export function sortSheetsByLastModified<Sheet extends LastModifiedSheet>(
  sheets: readonly Sheet[]
): Sheet[] {
  return [...sheets].sort(
    (left, right) =>
      Date.parse(right.updatedAt) - Date.parse(left.updatedAt) ||
      right.id.localeCompare(left.id)
  );
}
