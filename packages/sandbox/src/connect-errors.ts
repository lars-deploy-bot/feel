const SANDBOX_GONE_MESSAGE_PATTERNS = [/\bnot found\b/i, /\bdoes not exist\b/i, /\bno such sandbox\b/i]

function parseStatusCode(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return null
}

export function getSandboxConnectErrorStatusCode(err: unknown): number | null {
  if (!err || typeof err !== "object") {
    return null
  }

  const directStatus = parseStatusCode(Reflect.get(err, "status"))
  if (directStatus !== null) {
    return directStatus
  }

  const statusCode = parseStatusCode(Reflect.get(err, "statusCode"))
  if (statusCode !== null) {
    return statusCode
  }

  const response = Reflect.get(err, "response")
  if (!response || typeof response !== "object") {
    return null
  }

  return parseStatusCode(Reflect.get(response, "status"))
}

export function getSandboxConnectErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) {
    return err.message
  }

  if (err && typeof err === "object") {
    const message = Reflect.get(err, "message")
    if (typeof message === "string" && message.trim().length > 0) {
      return message
    }

    const statusCode = getSandboxConnectErrorStatusCode(err)
    if (statusCode !== null) {
      return `HTTP ${statusCode}`
    }

    try {
      return JSON.stringify(err)
    } catch {
      return String(err)
    }
  }

  return String(err)
}

export function isSandboxDefinitelyGone(err: unknown): boolean {
  const statusCode = getSandboxConnectErrorStatusCode(err)
  if (statusCode === 404) {
    return true
  }

  const message = getSandboxConnectErrorMessage(err)
  return SANDBOX_GONE_MESSAGE_PATTERNS.some(pattern => pattern.test(message))
}
