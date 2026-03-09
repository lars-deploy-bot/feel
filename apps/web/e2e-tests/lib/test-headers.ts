export function buildE2ETestHeaders(includeJsonContentType = false): Record<string, string> {
  const headers: Record<string, string> = {}

  if (includeJsonContentType) {
    headers["Content-Type"] = "application/json"
  }

  const testSecret = process.env.E2E_TEST_SECRET
  if (testSecret) {
    headers["x-test-secret"] = testSecret
  }

  return headers
}
