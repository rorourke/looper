const forbiddenWindowsFileNameCharacters = /[\u0000-\u001f\u007f<>:"/\\|?*]/g;
const reservedWindowsFileName =
  /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;

export function safeFileName(
  value: string,
  fallback = "Untitled"
): string {
  const normalizedFileName = value
    .normalize("NFC")
    .trim()
    .replace(/\.loop$/i, "")
    .replace(forbiddenWindowsFileNameCharacters, "-")
    .replace(/^\.+$/, "")
    .trim()
    .slice(0, 96)
    .trim()
    .replace(/[ .]+$/g, "");
  if (!normalizedFileName) return fallback;
  return reservedWindowsFileName.test(normalizedFileName)
    ? `_${normalizedFileName}`
    : normalizedFileName;
}
