/**
 * SDK Log Proxy — intercepts raw Anthropic API calls for debugging.
 *
 * Sits between the Claude CLI subprocess and api.anthropic.com.
 * Logs full request bodies and streamed response bodies to /tmp/sdk-call-logs/.
 *
 * Usage:
 *   bun run scripts/sdk-log-proxy.ts
 *   # Then set SDK_LOG_PROXY_PORT=5099 in your environment before starting workers
 *
 * Logs are JSONL files: one per API call, named by timestamp + sequence number.
 * Request body is logged immediately; streaming response is collected and appended on completion.
 */

import { appendFileSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs"

const PORT = Number(process.env.SDK_LOG_PROXY_PORT) || 5099
const ANTHROPIC_API = "https://api.anthropic.com"
const LOGS_DIR = "/tmp/sdk-call-logs"

mkdirSync(LOGS_DIR, { recursive: true })

let callSeq = 0

function logLine(file: string, obj: unknown) {
  appendFileSync(file, JSON.stringify(obj) + "\n")
}

function tryParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

/** Collect an SSE stream in the background, then append parsed events to the log file. */
async function collectStream(stream: ReadableStream<Uint8Array>, logFile: string) {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  const chunks: string[] = []
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(decoder.decode(value, { stream: true }))
    }
  } catch (err) {
    logLine(logFile, { _type: "stream_error", _ts: new Date().toISOString(), error: String(err) })
    return
  }

  const fullText = chunks.join("")

  // Parse SSE events: blocks separated by double newline
  const events = fullText
    .split("\n\n")
    .filter(Boolean)
    .map((block) => {
      const result: Record<string, unknown> = {}
      for (const line of block.split("\n")) {
        if (line.startsWith("event: ")) result.event = line.slice(7)
        if (line.startsWith("data: ")) result.data = tryParse(line.slice(6))
      }
      return result
    })
    .filter((e) => e.data !== undefined)

  logLine(logFile, {
    _type: "response_stream",
    _ts: new Date().toISOString(),
    eventCount: events.length,
    events,
  })
}

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url)

    // Health / log listing endpoints (used by the manager API)
    if (req.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, logsDir: LOGS_DIR, callCount: callSeq })
    }

    if (req.method === "GET" && url.pathname === "/_logs") {
      const files = readdirSync(LOGS_DIR)
        .filter((f) => f.endsWith(".jsonl"))
        .sort()
        .reverse()
        .slice(0, 200)
        .map((f) => {
          const st = statSync(`${LOGS_DIR}/${f}`)
          return { name: f, size: st.size, mtime: st.mtimeMs }
        })
      return Response.json({ files })
    }

    if (req.method === "GET" && url.pathname === "/_logs/read") {
      const file = url.searchParams.get("file")
      if (!file || file.includes("..") || file.includes("/")) {
        return Response.json({ error: "bad file param" }, { status: 400 })
      }
      try {
        const content = readFileSync(`${LOGS_DIR}/${file}`, "utf-8")
        const lines = content
          .trim()
          .split("\n")
          .map((l) => tryParse(l))
        return Response.json({ lines })
      } catch {
        return Response.json({ error: "not found" }, { status: 404 })
      }
    }

    // Forward everything else to Anthropic
    const targetUrl = `${ANTHROPIC_API}${url.pathname}${url.search}`
    const seq = ++callSeq
    const ts = new Date().toISOString()
    const logFile = `${LOGS_DIR}/${ts.replace(/[:.]/g, "-")}_${String(seq).padStart(4, "0")}.jsonl`

    // Read + log request body
    const reqBody = await req.text()
    const parsedBody = tryParse(reqBody)

    // Strip messages content for compact request logging (full body is still in the file)
    logLine(logFile, {
      _type: "request",
      _ts: ts,
      method: req.method,
      path: url.pathname,
      body: parsedBody,
    })

    // Forward to Anthropic — pass through auth headers, strip host
    const fwdHeaders = new Headers(req.headers)
    fwdHeaders.delete("host")

    const resp = await fetch(targetUrl, {
      method: req.method,
      headers: fwdHeaders,
      body: req.method !== "GET" ? reqBody : undefined,
    })

    const contentType = resp.headers.get("content-type") || ""
    const isStream = contentType.includes("text/event-stream")

    if (isStream && resp.body) {
      // Tee the stream: one side passes through to the SDK, other side we collect for logging
      const [passThrough, capture] = resp.body.tee()
      collectStream(capture, logFile)

      // Pass through with original headers
      const respHeaders = new Headers(resp.headers)
      return new Response(passThrough, { status: resp.status, headers: respHeaders })
    }

    // Non-streaming response (e.g. errors, count tokens)
    const respText = await resp.text()
    logLine(logFile, {
      _type: "response",
      _ts: new Date().toISOString(),
      status: resp.status,
      body: tryParse(respText),
    })

    return new Response(respText, {
      status: resp.status,
      headers: resp.headers,
    })
  },
})

console.log(`SDK Log Proxy running on http://localhost:${server.port}`)
console.log(`Logs dir: ${LOGS_DIR}`)
console.log(`Set SDK_LOG_PROXY_PORT=${server.port} in worker env to activate`)
