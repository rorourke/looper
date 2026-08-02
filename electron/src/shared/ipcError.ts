const namedErrorPrefix = /^[A-Za-z_$][\w$]*Error:\s*/;

export function normalizeIpcErrorMessage(
  error: unknown,
  channel: string
): string {
  const fallback = "The app could not complete this action.";
  if (!(error instanceof Error) || !error.message.trim()) return fallback;

  const remotePrefix = `Error invoking remote method '${channel}':`;
  const message = error.message.trim();
  if (!message.startsWith(remotePrefix)) return message;

  const remoteMessage = message.slice(remotePrefix.length).trim();
  return remoteMessage.replace(namedErrorPrefix, "").trim() || fallback;
}

export function normalizeIpcError(error: unknown, channel: string): Error {
  return new Error(normalizeIpcErrorMessage(error, channel));
}
