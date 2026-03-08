import { Hono } from "hono"
import type { AppBindings } from "../../../types/hono"

const PROXY_PORT = Number(process.env.SDK_LOG_PROXY_PORT) || 5099
const PROXY_BASE = `http://localhost:${PROXY_PORT}`

async function proxyJson(url: string): Promise<Record<string, unknown>> {
  const resp = await fetch(url)
  const data: unknown = await resp.json()
  if (!resp.ok || typeof data !== "object" || data === null) {
    return { error: "proxy error", status: resp.status }
  }
  return data as Record<string, unknown>
}

export const sdkLogsRoutes = new Hono<AppBindings>()

// GET /api/manager/sdk-logs — list log files
sdkLogsRoutes.get("/", async c => {
  try {
    const data = await proxyJson(`${PROXY_BASE}/_logs`)
    return c.json({ ok: true, files: data.files })
  } catch {
    return c.json({ error: "SDK log proxy not running. Start it with: bun run scripts/sdk-log-proxy.ts" }, 503)
  }
})

// GET /api/manager/sdk-logs/read?file=<name> — read a specific log file
sdkLogsRoutes.get("/read", async c => {
  const file = c.req.query("file")
  if (!file) return c.json({ error: "file param required" }, 400)

  try {
    const data = await proxyJson(`${PROXY_BASE}/_logs/read?file=${encodeURIComponent(file)}`)
    if (data.error) return c.json({ error: data.error }, 404)
    return c.json({ ok: true, lines: data.lines })
  } catch {
    return c.json({ error: "SDK log proxy not running" }, 503)
  }
})

// GET /api/manager/sdk-logs/health — proxy health check
sdkLogsRoutes.get("/health", async c => {
  try {
    const data = await proxyJson(`${PROXY_BASE}/health`)
    return c.json({ ok: true, logsDir: data.logsDir, callCount: data.callCount })
  } catch {
    return c.json({ ok: false, error: "proxy not running" }, 503)
  }
})
