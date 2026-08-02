export function isSheetLimitIssue(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  return (
    normalized.includes("unused sheet") ||
    normalized.includes("sheet limit") ||
    normalized.includes("sheet allowance") ||
    normalized.includes("sheet_limit_reached")
  );
}

export function conciseCloudIssueMessage(
  message: string,
  offline = false
): string {
  const normalized = message.trim().toLowerCase();

  if (offline) {
    return "Using offline";
  }

  if (normalized.includes("offline copy")) {
    return normalized.includes("removed")
      ? "Could not remove offline copy"
      : "Could not refresh offline copy";
  }

  if (
    normalized.includes("secure draft") ||
    normalized.includes("secure local storage")
  ) {
    return normalized.includes("removed")
      ? "Could not remove offline draft"
      : "Could not save offline draft";
  }

  if (
    normalized.includes("temporarily unavailable") ||
    normalized.includes("cloud is unavailable") ||
    normalized.includes("check your connection") ||
    normalized.includes("cloud request failed") ||
    normalized.includes("fetch failed") ||
    normalized.includes("network") ||
    normalized.includes("timed out")
  ) {
    return "Cloud unavailable";
  }

  if (normalized.includes("sign out")) return "Could not sign out";
  if (normalized.includes("changed on another device")) {
    return "Sheet changed elsewhere";
  }
  if (isSheetLimitIssue(normalized)) return "No unused sheets";
  if (
    normalized.includes("copy") &&
    (normalized.includes("url") || normalized.includes("link"))
  ) {
    return "Could not copy link";
  }
  if (
    normalized.includes("sharing") ||
    normalized.includes("shareable url")
  ) {
    return normalized.includes("not available")
      ? "Sharing unavailable"
      : "Could not update sharing";
  }
  if (normalized.includes("delete")) return "Could not delete sheet";
  if (normalized.includes("create")) return "Could not create sheet";
  if (normalized.includes("save")) return "Could not save sheet";
  if (normalized.includes("account")) return "Account unavailable";

  return "Cloud sync failed";
}
