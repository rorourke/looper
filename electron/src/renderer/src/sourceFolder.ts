export function abbreviatedSourceFolderPath(
  directoryPath: string | undefined
): string {
  const normalizedPath = directoryPath?.trim();
  if (!normalizedPath) return "…";

  const pathWithoutTrailingSeparators = normalizedPath.replace(/[\\/]+$/, "");
  if (!pathWithoutTrailingSeparators) return "/";
  if (/^[A-Za-z]:$/.test(pathWithoutTrailingSeparators)) {
    return `${pathWithoutTrailingSeparators}\\`;
  }

  const folderName = pathWithoutTrailingSeparators.split(/[\\/]+/).at(-1);
  return folderName ? `/${folderName}` : normalizedPath;
}
