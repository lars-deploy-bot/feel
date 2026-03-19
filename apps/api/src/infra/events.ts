import { reassignOrDisableAutomations } from "../db/repos/automations.repo"
import { logger } from "./logger"
import { Sentry } from "./sentry"

type EventMap = {
  "org.created": { orgId: string; name: string }
  "org.deleted": { orgId: string }
  "org.credits_updated": { orgId: string; credits: number }
  "member.added": { orgId: string; userId: string; role: string }
  "member.removed": { orgId: string; userId: string }
}

type EventName = keyof EventMap
type EventHandler<K extends EventName> = (payload: EventMap[K]) => void

const handlers: { [K in EventName]: EventHandler<K>[] } = {
  "org.created": [],
  "org.deleted": [],
  "org.credits_updated": [],
  "member.added": [],
  "member.removed": [],
}

function on<K extends EventName>(event: K, handler: EventHandler<K>): void {
  handlers[event].push(handler)
}

function emit<K extends EventName>(event: K, payload: EventMap[K]): void {
  for (const handler of handlers[event]) {
    try {
      handler(payload)
    } catch (err) {
      logger.error("Event handler threw", {
        event,
        error: err instanceof Error ? err.message : String(err),
      })
      Sentry.captureException(err instanceof Error ? err : new Error(String(err)))
    }
  }
}

export const eventBus = { on, emit }

// Default audit-trail handlers: log every event
eventBus.on("org.created", payload => {
  logger.info("audit: org created", payload)
})

eventBus.on("org.deleted", payload => {
  logger.info("audit: org deleted", payload)
})

eventBus.on("org.credits_updated", payload => {
  logger.info("audit: org credits updated", payload)
})

eventBus.on("member.added", payload => {
  logger.info("audit: member added", payload)
})

eventBus.on("member.removed", payload => {
  logger.info("audit: member removed", payload)

  // Transfer or disable automations owned by the departing user
  reassignOrDisableAutomations(payload.orgId, payload.userId)
    .then(result => {
      if (result.transferred > 0 || result.disabled > 0) {
        logger.info("automations reassigned on member removal", {
          orgId: payload.orgId,
          userId: payload.userId,
          transferred: result.transferred,
          disabled: result.disabled,
          details: result.jobDetails,
        })
      }
    })
    .catch(err => {
      logger.error("failed to reassign automations on member removal", {
        orgId: payload.orgId,
        userId: payload.userId,
        error: err instanceof Error ? err.message : String(err),
      })
      Sentry.withScope(scope => {
        scope.setTag("orgId", payload.orgId)
        scope.setTag("userId", payload.userId)
        scope.setFingerprint(["automation-reassign-failure"])
        Sentry.captureException(err instanceof Error ? err : new Error(String(err)))
      })
    })
})
