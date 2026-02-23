/**
 * POST /act
 * Perform an interaction on the current page.
 *
 * Uses stored roleRefs from the last snapshot to resolve element refs.
 * Adapted from OpenClaw's interaction patterns.
 *
 * Body: { domain: string, sessionId?: string, action: string, ref?: string, value?: string, text?: string }
 */

import type { IncomingMessage, ServerResponse } from "node:http"
import { browserPool } from "../browser-pool.js"
import { parseJsonBody, sendError, sendJson } from "../http.js"
import { normalizeTimeoutMs, refLocator, requireRef, toAIFriendlyError, UserInputError } from "../snapshot-formatter.js"

export async function handleAct(req: IncomingMessage, res: ServerResponse): Promise<void> {
  let body: Record<string, unknown>
  try {
    body = await parseJsonBody(req)
  } catch (err) {
    sendError(res, 400, err instanceof Error ? err.message : "Invalid request body")
    return
  }

  const domain = typeof body.domain === "string" ? body.domain : ""
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : undefined
  const action = typeof body.action === "string" ? body.action : ""
  const rawRef = typeof body.ref === "string" ? body.ref : undefined
  const value = typeof body.value === "string" ? body.value : undefined
  const text = typeof body.text === "string" ? body.text : undefined

  if (!domain) {
    sendError(res, 400, "domain is required")
    return
  }

  try {
    const session = await browserPool.getSession(domain, sessionId)
    const currentUrl = session.page.url()

    if (currentUrl === "about:blank") {
      sendError(res, 400, "No page loaded. Use the 'open' action first.")
      return
    }

    const timeout = normalizeTimeoutMs(undefined, 10_000)

    switch (action) {
      case "click": {
        const ref = requireRef(rawRef)
        const locator = refLocator(session.page, ref, session.roleRefs)

        try {
          await locator.click({ timeout })
        } catch (err) {
          throw toAIFriendlyError(err, ref)
        }

        // Wait briefly for any navigation or state change
        try {
          await session.page.waitForLoadState("domcontentloaded", { timeout: 3_000 })
        } catch {
          // ignore navigation timeout
        }

        sendJson(res, {
          ok: true,
          action: "click",
          ref,
          url: session.page.url(),
        })
        break
      }

      case "fill": {
        const ref = requireRef(rawRef)
        if (value === undefined) {
          sendError(res, 400, "value is required for fill action")
          return
        }

        const locator = refLocator(session.page, ref, session.roleRefs)

        try {
          await locator.fill(value, { timeout })
        } catch (err) {
          throw toAIFriendlyError(err, ref)
        }

        sendJson(res, {
          ok: true,
          action: "fill",
          ref,
          value,
          url: session.page.url(),
        })
        break
      }

      case "type": {
        if (!text) {
          sendError(res, 400, "text is required for type action")
          return
        }
        await session.page.keyboard.type(text)

        sendJson(res, {
          ok: true,
          action: "type",
          text,
          url: session.page.url(),
        })
        break
      }

      default:
        sendError(res, 400, `Unknown action: ${action}. Supported: click, fill, type.`)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const status = err instanceof UserInputError ? 400 : 500
    sendError(res, status, message)
  }
}
