import { isRecord } from "@webalive/shared"
import { Hono } from "hono"
import type { AppBindings } from "../../../types/hono"

const PROXY_TIMEOUT_MS = 10_000

function getProxyBase(): string | null {
  const rawPort = process.env.SDK_LOG_PROXY_PORT
  if (!rawPort || Number.isNaN(Number(rawPort))) return null
  return `http://localhost:${Number(rawPort)}`
}

type ProxyResult = { ok: true; data: Record<string, unknown> } | { ok: false; error: string }

async function proxyJson(url: string): Promise<ProxyResult> {
  const resp = await fetch(url, { signal: AbortSignal.timeout(PROXY_TIMEOUT_MS) })
  const body: unknown = await resp.json()
  if (!resp.ok || !isRecord(body)) {
    return { ok: false, error: `proxy error (status ${resp.status})` }
  }
  return { ok: true, data: body }
}

export const sdkLogsRoutes = new Hono<AppBindings>()

// GET /api/manager/sdk-logs — list log files
sdkLogsRoutes.get("/", async c => {
  const base = getProxyBase()
  if (!base) return c.json({ error: "SDK_LOG_PROXY_PORT not configured" }, 503)
  try {
    const result = await proxyJson(`${base}/_logs`)
    if (!result.ok) return c.json({ error: result.error }, 502)
    return c.json({ ok: true, files: result.data.files })
  } catch {
    return c.json({ error: "SDK log proxy not running. Start it with: bun run scripts/sdk-log-proxy.ts" }, 503)
  }
})

// GET /api/manager/sdk-logs/read?file=<name> — read a specific log file
sdkLogsRoutes.get("/read", async c => {
  const base = getProxyBase()
  if (!base) return c.json({ error: "SDK_LOG_PROXY_PORT not configured" }, 503)
  const file = c.req.query("file")
  if (!file) return c.json({ error: "file param required" }, 400)

  try {
    const result = await proxyJson(`${base}/_logs/read?file=${encodeURIComponent(file)}`)
    if (!result.ok) return c.json({ error: result.error }, 502)
    if (result.data.error) return c.json({ error: result.data.error }, 404)
    return c.json({ ok: true, lines: result.data.lines })
  } catch {
    return c.json({ error: "SDK log proxy not running" }, 503)
  }
})

// GET /api/manager/sdk-logs/health — proxy health check
sdkLogsRoutes.get("/health", async c => {
  const base = getProxyBase()
  if (!base) return c.json({ ok: false, error: "SDK_LOG_PROXY_PORT not configured" }, 503)
  try {
    const result = await proxyJson(`${base}/health`)
    if (!result.ok) return c.json({ ok: false, error: result.error }, 502)
    return c.json({ ok: true, logsDir: result.data.logsDir, callCount: result.data.callCount })
  } catch {
    return c.json({ ok: false, error: "proxy not running" }, 503)
  }
})
