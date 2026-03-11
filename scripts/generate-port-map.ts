#!/usr/bin/env bun
/**
 * Generate port-map.json for the preview-proxy Go service.
 *
 * This is the cron fallback (every 5 minutes). The primary trigger is
 * the deploy pipeline, which calls regeneratePortMap() after every deployment.
 *
 * Usage:
 *   SERVER_CONFIG_PATH=/var/lib/alive/server-config.json bun scripts/generate-port-map.ts
 *
 * Infra DB credentials are loaded from the canonical production env file
 * by @webalive/site-controller. Do not pass staging credentials here.
 */

import { regeneratePortMap } from "@webalive/site-controller"

const count = await regeneratePortMap()
console.log(`Wrote ${count} domains to port-map.json`)
