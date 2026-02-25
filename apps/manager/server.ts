import { resolve } from "node:path"

const DIST = resolve(import.meta.dir, "dist")
const PORT = 5090

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url)

    // Strip /manager-2 prefix if present (when accessed via Next.js rewrite)
    let pathname = url.pathname
    if (pathname.startsWith("/manager-2")) {
      pathname = pathname.slice("/manager-2".length) || "/"
    }

    // Proxy API requests to the API server on port 5080
    if (pathname.startsWith("/api") || pathname.startsWith("/auth") || pathname.startsWith("/health")) {
      const target = new URL(req.url)
      target.host = "localhost"
      target.port = "5080"
      target.pathname = pathname
      return fetch(new Request(target, req))
    }

    // Try to serve the exact file from dist/
    const filePath = resolve(DIST, pathname.slice(1))
    const file = Bun.file(filePath)
    if (await file.exists()) {
      return new Response(file)
    }

    // SPA fallback: serve index.html for all other routes
    return new Response(Bun.file(resolve(DIST, "index.html")))
  },
})

console.log(`Manager server listening on http://localhost:${server.port}`)
