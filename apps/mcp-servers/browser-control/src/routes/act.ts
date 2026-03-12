/**
 * POST /act
 * Perform an interaction on the current page.
 *
 * Uses stored roleRefs from the last snapshot to resolve element refs.
 * Adapted from OpenClaw's interaction patterns.
 *
 * Body: { domain: string, sessionId?: string, action: string, ref?: string, value?: string, text?: string }
 */

import { browserPool } from "../browser-pool.js"
import { normalizeTimeoutMs, refLocator, requireRef, toAIFriendlyError, UserInputError } from "../snapshot-formatter.js"
import type { RouteHandler } from "../types.js"

export const handleAct: RouteHandler = async (body, signal) => {
  const domain = typeof body.domain === "string" ? body.domain : ""
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : undefined
  const action = typeof body.action === "string" ? body.action : ""
  const rawRef = typeof body.ref === "string" ? body.ref : undefined
  const value = typeof body.value === "string" ? body.value : undefined
  const text = typeof body.text === "string" ? body.text : undefined

  if (!domain) {
    return { ok: false, status: 400, error: "domain is required" }
  }

  const session = await browserPool.getSession(domain, sessionId)
  const currentUrl = session.page.url()

  if (currentUrl === "about:blank") {
    return { ok: false, status: 400, error: "No page loaded. Use the 'open' action first." }
  }

  const timeout = normalizeTimeoutMs(undefined, 10_000)

  try {
    switch (action) {
      case "click": {
        const ref = requireRef(rawRef)
        const locator = refLocator(session.page, ref, session.roleRefs)

        try {
          await locator.click({ timeout })
        } catch (err) {
          throw toAIFriendlyError(err, ref)
        }

        if (signal.aborted) throw new Error("aborted")

        // Wait briefly for any navigation or state change
        await session.page.waitForLoadState("domcontentloaded", { timeout: 3_000 }).catch(() => {})

        return {
          ok: true,
          data: { ok: true, action: "click", ref, url: session.page.url() },
        }
      }

      case "fill": {
        const ref = requireRef(rawRef)
        if (value === undefined) {
          return { ok: false, status: 400, error: "value is required for fill action" }
        }

        const locator = refLocator(session.page, ref, session.roleRefs)

        try {
          await locator.fill(value, { timeout })
        } catch (err) {
          throw toAIFriendlyError(err, ref)
        }

        return {
          ok: true,
          data: { ok: true, action: "fill", ref, value, url: session.page.url() },
        }
      }

      case "type": {
        if (!text) {
          return { ok: false, status: 400, error: "text is required for type action" }
        }
        await session.page.keyboard.type(text)

        return {
          ok: true,
          data: { ok: true, action: "type", text, url: session.page.url() },
        }
      }

      default:
        return { ok: false, status: 400, error: `Unknown action: ${action}. Supported: click, fill, type.` }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (err instanceof UserInputError) {
      return { ok: false, status: 400, error: message }
    }
    throw err
  }
}
