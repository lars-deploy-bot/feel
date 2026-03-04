import { Hono } from "hono"
import type { AppBindings } from "../../../types/hono"
import { transferDomainSchema } from "./transfers.schemas"

export const transfersRoutes = new Hono<AppBindings>()

/**
 * POST /api/manager/transfers
 *
 * Transfer a website from an alive subdomain to a custom domain.
 *
 * What this needs to do:
 * 1. Add a Caddy site block for the new domain (reverse_proxy to same port)
 * 2. Keep the old alive subdomain serving (no redirect until DNS is confirmed)
 * 3. Re-sync generated Caddyfile to avoid conflicts
 * 4. Reload Caddy
 *
 * IMPORTANT: The site's vite.config.ts `server.allowedHosts` must also include
 * the new domain, otherwise Vite returns 403 for requests with the new Host header.
 * This needs to be done either:
 *   - Automatically by writing to the site's vite.config.ts
 *   - Or by notifying the user to add it manually via the chat
 *
 * TODO: Implement the actual transfer logic
 */
transfersRoutes.post("/", async c => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ ok: false, error: "Invalid JSON body" }, 400)
  }
  const parsed = transferDomainSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ ok: false, error: parsed.error.flatten() }, 400)
  }

  // parsed.data.fromDomain / parsed.data.toDomain — used when implemented
  //
  // TODO: Implement transfer steps:
  // 1. Validate fromDomain exists in DB (app.domains)
  // 2. Check DNS for toDomain points to our server IP
  // 3. Look up the port for fromDomain
  // 4. Add toDomain Caddy block (ops/caddy/Caddyfile) pointing to same port
  // 5. Re-run sync-generated-caddy.ts to filter toDomain from generated file
  // 6. Reload Caddy (systemctl reload caddy)
  // 7. Update site's vite.config.ts allowedHosts to include toDomain
  // 8. Restart the site service
  // 9. Store the transfer record in DB

  return c.json({ ok: false, error: "Not implemented yet" }, 501)
})
