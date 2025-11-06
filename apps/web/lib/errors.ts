/**
 * Custom error for HTTP failures that have already been logged to dev terminal.
 * Prevents duplicate error logging in catch blocks.
 */
export class HttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly statusText: string,
  ) {
    super(message)
    this.name = "HttpError"
  }
}

/**
 * Check if an error has already been logged (to prevent duplicate logging)
 */
export function isAlreadyLogged(error: unknown): boolean {
  return error instanceof HttpError
}
