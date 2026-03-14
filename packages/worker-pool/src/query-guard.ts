export function getMissingTerminalResultError(
  queryResult: unknown,
  messageCount: number,
  wasCancelled: boolean,
): string | null {
  if (wasCancelled || queryResult !== null) {
    return null
  }

  const messageLabel = messageCount === 1 ? "message" : "messages"
  return `Claude query ended without a result after ${messageCount} ${messageLabel}`
}
