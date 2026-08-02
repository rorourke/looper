export const sheetQueryParameter = "sheet";

const maximumDocumentIdLength = 256;

export type BrowserLocation = Pick<Location, "pathname" | "search">;

export function documentIdFromBrowserLocation(
  location: BrowserLocation
): string | undefined {
  if (location.pathname !== "/") return undefined;

  const documentId = new URLSearchParams(location.search)
    .get(sheetQueryParameter)
    ?.trim();
  if (!documentId || documentId.length > maximumDocumentIdLength) return undefined;
  return documentId;
}

export function browserPathForDocument(documentId?: string): string {
  if (!documentId) return "/";
  const search = new URLSearchParams({ [sheetQueryParameter]: documentId });
  return `/?${search.toString()}`;
}
