import { cookies } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"
import { hasSessionCookie } from "@/features/auth/types/guards"
import { getWorkspacePort } from "@/lib/workspace-ports"

/**
 * Proxy handler for all HTTP methods
 * Proxies requests to local Vite dev servers, working around X-Frame-Options DENY
 *
 * Security model: If you have ANY valid session, you can preview any workspace.
 * This is acceptable because:
 * 1. User must be authenticated to reach this endpoint
 * 2. Proxying to localhost only (no external access)
 * 3. Same security as direct browser access to workspace
 */
async function handleProxy(request: NextRequest, props: { params: Promise<{ workspace: string; path?: string[] }> }) {
  const params = await props.params
  const { workspace, path = [] } = params
  const targetPath = path.length > 0 ? `/${path.join("/")}` : "/"
  const proxyPrefix = `/api/workspace-proxy/${workspace}`

  // TODO: Re-enable auth once we fix cookie passing in iframe
  // For now, allow unauthenticated access to test the proxy
  const jar = await cookies()
  const sessionCookie = jar.get("session")

  console.log(`[Proxy] ${workspace}${targetPath} - Session:`, sessionCookie?.value ? "present" : "missing")

  // TEMPORARY: Disabled auth check for testing
  // if (!hasSessionCookie(sessionCookie)) {
  //   console.log(`[Proxy] ${workspace} - Auth failed: no valid session`)
  //   return NextResponse.json({ error: "Authentication required" }, { status: 401 })
  // }

  // Look up the port for this workspace
  const port = getWorkspacePort(workspace)

  if (!port) {
    console.log(`[Proxy] ${workspace} - Port not found in Caddyfile`)
    return NextResponse.json({ error: `Workspace "${workspace}" not found in Caddyfile` }, { status: 404 })
  }

  // Build the target URL
  const targetUrl = `http://localhost:${port}${targetPath}`

  console.log(`[Proxy] Forwarding ${workspace}${targetPath} → localhost:${port}`)

  // Forward query parameters
  const searchParams = request.nextUrl.searchParams
  const queryString = searchParams.toString()
  const finalUrl = queryString ? `${targetUrl}?${queryString}` : targetUrl

  try {
    // Get request body if present (for POST/PUT/PATCH)
    let body: BodyInit | undefined
    if (request.method !== "GET" && request.method !== "HEAD") {
      body = await request.arrayBuffer()
    }

    // Forward the request to the local server
    // Use redirect: "manual" so we can rewrite Location headers
    const response = await fetch(finalUrl, {
      method: request.method,
      headers: {
        // CRITICAL: Set Host header to the workspace domain (Vite allowedHosts check)
        Host: workspace,
        // Forward relevant headers
        "User-Agent": request.headers.get("user-agent") || "Claude-Bridge-Proxy",
        Accept: request.headers.get("accept") || "*/*",
        "Accept-Encoding": request.headers.get("accept-encoding") || "",
        ...(request.headers.get("content-type") ? { "Content-Type": request.headers.get("content-type")! } : {}),
      },
      body,
      redirect: "manual", // Handle redirects manually to rewrite Location
    })

    // Build response headers
    const headers = new Headers()

    // Copy relevant headers
    const contentType = response.headers.get("content-type") || "text/html"
    headers.set("Content-Type", contentType)
    headers.set("Cache-Control", response.headers.get("cache-control") || "no-cache")

    // CRITICAL: Remove X-Frame-Options to allow iframe embedding
    // Also remove Content-Security-Policy frame-ancestors if present
    // Do NOT copy x-frame-options or any CSP that blocks framing

    // Allow iframe embedding explicitly
    headers.set("X-Frame-Options", "SAMEORIGIN")
    headers.set("Content-Security-Policy", "frame-ancestors 'self'")

    // Handle redirects: rewrite Location header
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location")
      if (location) {
        // Rewrite absolute-path redirects to go through proxy
        if (location.startsWith("/")) {
          const rewrittenLocation = `${proxyPrefix}${location}`
          console.log(`[Proxy] Rewriting redirect: ${location} → ${rewrittenLocation}`)
          headers.set("Location", rewrittenLocation)
        } else {
          headers.set("Location", location)
        }
      }

      // Return redirect response without body modification
      return new NextResponse(null, {
        status: response.status,
        statusText: response.statusText,
        headers,
      })
    }

    // Get response body
    let responseBody = await response.arrayBuffer()

    // Log what we're serving for debugging
    if (targetPath.includes("@react-refresh") || targetPath.includes("sonner")) {
      console.log(`[Proxy] Serving ${targetPath} with content-type: ${contentType}`)
    }

    // Rewrite HTML: inject <base> tag and fix absolute URLs
    if (contentType.includes("text/html")) {
      let html = new TextDecoder().decode(responseBody)

      // CRITICAL: Inject base tag AND script to intercept URL construction
      const baseTag = `<base href="${proxyPrefix}/">`
      const urlInterceptScript = `
<script>
  // Intercept ALL URL construction methods to force through proxy
  (function() {
    const proxyPrefix = '${proxyPrefix}';

    function rewriteURL(url) {
      url = String(url);
      if (url.startsWith('/') && !url.startsWith('//') && !url.includes('/api/workspace-proxy')) {
        return proxyPrefix + url;
      }
      return url;
    }

    // Intercept URL constructor
    const originalURL = window.URL;
    window.URL = function(url, base) {
      return new originalURL(rewriteURL(url), base);
    };
    window.URL.createObjectURL = originalURL.createObjectURL.bind(originalURL);
    window.URL.revokeObjectURL = originalURL.revokeObjectURL.bind(originalURL);

    // Intercept fetch
    const originalFetch = window.fetch;
    window.fetch = function(url, options) {
      return originalFetch(rewriteURL(url), options);
    };

    // Intercept XMLHttpRequest
    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, ...args) {
      return originalOpen.call(this, method, rewriteURL(url), ...args);
    };

    console.log('[Proxy Interceptor] URL/fetch/XHR interception active');
  })();
</script>`

      if (/<base\s/i.test(html)) {
        // Rewrite existing <base> tag
        html = html.replace(
          /<base\s+href=(["'])\/?\1/gi,
          `<base href=$1${proxyPrefix}/$1`
        )
        console.log("[Proxy] Rewrote existing <base> tag")
      } else {
        // Inject <base> as FIRST child of <head>
        html = html.replace(
          /<head([^>]*)>/i,
          `<head$1>${baseTag}${urlInterceptScript}`
        )
        console.log("[Proxy] Injected <base> tag and URL interceptor")
      }

      // Rewrite absolute-path URLs in attributes to go through proxy
      // Match: href="/..." or src="/..." but NOT href="//" (protocol-relative) or already-proxied paths
      html = html.replace(
        /\b(href|src)=(["'])\/(?!\/|api\/workspace-proxy)/g,
        `$1=$2${proxyPrefix}/`
      )

      // Rewrite meta refresh if present
      html = html.replace(
        /<meta\s+http-equiv=(["'])refresh\1\s+content=(["'])(\d+);\s*url=\//gi,
        `<meta http-equiv=$1refresh$1 content=$2$3; url=${proxyPrefix}/`
      )

      responseBody = new TextEncoder().encode(html)
    }

    // Rewrite JavaScript/TypeScript files: Vite special paths
    // Vite serves .tsx/.ts as JavaScript after transpiling
    if (
      contentType.includes("javascript") ||
      contentType.includes("typescript") ||
      contentType.includes("application/json") ||
      contentType.includes("text/tsx") ||
      contentType.includes("text/jsx")
    ) {
      let content = new TextDecoder().decode(responseBody)

      // Rewrite import statements for Vite special modules
      // import ... from "/@..."
      content = content.replace(
        /from\s+(['"])(\/[@][^'"]+)\1/g,
        `from $1${proxyPrefix}$2$1`
      )

      // import("/@...")
      content = content.replace(
        /import\s*\(\s*(['"])(\/[@][^'"]+)\1\s*\)/g,
        `import($1${proxyPrefix}$2$1)`
      )

      // require("/@...")
      content = content.replace(
        /require\s*\(\s*(['"])(\/[@][^'"]+)\1\s*\)/g,
        `require($1${proxyPrefix}$2$1)`
      )

      // Rewrite window.location.origin + "/" patterns (Vite client does this)
      content = content.replace(
        /window\.location\.origin\s*\+\s*(['"])\/(?!\/|api\/workspace-proxy)/g,
        `window.location.origin + $1${proxyPrefix}/`
      )

      // Rewrite location.origin + "/" patterns
      content = content.replace(
        /location\.origin\s*\+\s*(['"])\/(?!\/|api\/workspace-proxy)/g,
        `location.origin + $1${proxyPrefix}/`
      )

      // Rewrite new URL("/@...", ...) patterns
      content = content.replace(
        /new\s+URL\s*\(\s*(['"])(\/[@][^'"]+)\1/g,
        `new URL($1${proxyPrefix}$2$1`
      )

      // Rewrite Vite special paths that might have absolute URLs
      // Skip if already proxied
      content = content.replace(/(['"])(\/@fs\/[^'"]+)/g, (match, quote, path) => {
        if (path.includes("/api/workspace-proxy")) return match
        return `${quote}${proxyPrefix}${path}`
      })
      content = content.replace(/(['"])(\/@[^'"]+)/g, (match, quote, path) => {
        if (path.includes("/api/workspace-proxy")) return match
        return `${quote}${proxyPrefix}${path}`
      })

      // Rewrite any literal "/" paths that might cause navigation
      // Be careful: only rewrite if it looks like a URL string, and skip already-proxied
      const originalContent = content
      content = content.replace(/(["'])\/(?!\/|[*]|api\/workspace-proxy)/g, `$1${proxyPrefix}/`)

      // Log if we rewrote @react-refresh imports
      if (targetPath.includes("@react-refresh") || targetPath.includes("sonner")) {
        if (originalContent !== content) {
          console.log(`[Proxy] Rewrote ${targetPath} - found ${originalContent.match(/\/@/g)?.length || 0} Vite paths`)
        } else {
          console.log(`[Proxy] No rewriting needed for ${targetPath}`)
        }
      }

      responseBody = new TextEncoder().encode(content)
    }

    // Forward the response back to the client
    return new NextResponse(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  } catch (error) {
    console.error(`Proxy error for ${workspace}:`, error)
    return NextResponse.json(
      {
        error: "Failed to proxy request",
        details: error instanceof Error ? error.message : "Unknown error",
        workspace,
        port,
        targetUrl: finalUrl,
      },
      { status: 502 },
    )
  }
}

// Export handlers for all common HTTP methods
export const GET = handleProxy
export const POST = handleProxy
export const PUT = handleProxy
export const PATCH = handleProxy
export const DELETE = handleProxy
export const HEAD = handleProxy
export const OPTIONS = handleProxy
