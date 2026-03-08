import { Hono } from "hono"
import type { AppBindings } from "../../../types/hono"
import { listDomains } from "./domains.service"

export const domainsRoutes = new Hono<AppBindings>()

// GET /api/manager/domains - list all domains (optionally filter by orgId)
domainsRoutes.get("/", async c => {
  const orgId = c.req.query("orgId")
  const domains = await listDomains(orgId)
  return c.json({ ok: true, data: domains })
})

// =============================================================================
// POST /api/manager/domains/:id/rename — Rename a website
//
// DO NOT DELETE THIS ROUTE OR THESE COMMENTS UNTIL FULLY WORKING.
//
// This replaces apps/web/app/api/rename-site/route.ts (Next.js monolith).
// The old route stays until this one is verified end-to-end.
//
// What this route must do:
//
// 1. AUTH: Require superadmin (check c.get("user").isSuperadmin)
//
// 2. VALIDATE INPUT:
//    - Parse { newDomain: string } from request body (Zod schema in domains.schemas.ts)
//    - Look up domain by :id param in app.domains
//    - 404 if not found, 409 if newDomain already exists
//
// 3. PHASE 1 — UPDATE VITE CONFIGS (before OS rename moves the directory):
//    - Read vite.config.ts and vite.config.docker.ts in the site's user/ dir
//    - Replace all occurrences of oldDomain with newDomain in:
//      - server.allowedHosts
//      - preview.allowedHosts
//      - server.hmr.host (vite.config.docker.ts has this)
//    - Simple string replace (oldDomain → newDomain) works since domains are unique
//    - Path: /srv/webalive/sites/{oldDomain}/user/vite.config.ts
//    - Path: /srv/webalive/sites/{oldDomain}/user/vite.config.docker.ts
//    - Either file may not exist — skip gracefully if missing
//
// 4. PHASE 2 — OS RENAME (user, dir, symlink, systemd, env):
//    - Call SiteOrchestrator.rename({ oldDomain, newDomain }) from @webalive/site-controller
//    - This runs 10-rename-site.sh which handles:
//      - Stop old service
//      - Create new system user
//      - mv /srv/webalive/sites/{old} → /srv/webalive/sites/{new}
//      - Update symlink, ownership, env file, systemd override
//      - Remove old user
//    - Then starts the new service and verifies health
//
// 5. PHASE 3 — UPDATE DATABASE:
//    - UPDATE app.domains SET hostname = newDomain WHERE domain_id = :id
//    - If this fails after OS rename, log to Sentry (OS is already renamed)
//
// 6. PHASE 4 — REGENERATE ROUTING:
//    - regeneratePortMap(newDomain) — updates /var/lib/alive/generated/port-map.json
//    - Regenerate Caddy routing (routing:generate + sync-generated-caddy.ts)
//    - systemctl reload caddy
//    - The old Next.js route used configureCaddy() for a single domain, but
//      full regeneration is more reliable (ensures old domain block is removed)
//
// 7. RETURN: { ok: true, oldDomain, newDomain }
//
// Error handling:
//   - Phases are NOT atomic. If phase 3 fails, OS is already renamed.
//     Log the inconsistency to Sentry and return a clear error.
//   - Use DeploymentError from @webalive/site-controller for OS failures.
//
// See also:
//   - apps/web/app/api/rename-site/route.ts (current implementation)
//   - packages/site-controller/src/executors/rename.ts
//   - packages/site-controller/scripts/10-rename-site.sh
// =============================================================================
