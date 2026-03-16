/**
 * mini-tools service client (server-only)
 *
 * Centralized access to the alive-services mini-tools API.
 * All routes that call mini-tools should use this client.
 */

function getConfig() {
  const url = process.env.MINI_TOOLS_URL
  const key = process.env.ALIVE_SECRET_KEY
  if (!url || !key) {
    throw new Error("MINI_TOOLS_URL and ALIVE_SECRET_KEY environment variables are required")
  }
  return { url, key }
}

/**
 * Fetch from mini-tools with auth and timeout.
 * Throws on missing config. Does NOT parse the response — caller decides.
 */
export async function miniToolsFetch(path: string, init: RequestInit): Promise<Response> {
  const { url, key } = getConfig()
  return fetch(`${url}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${key}`,
    },
    signal: init.signal ?? AbortSignal.timeout(30_000),
  })
}
