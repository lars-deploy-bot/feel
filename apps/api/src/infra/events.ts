import { logger } from "./logger"

type EventMap = {
  "org.created": { orgId: string; name: string }
  "org.deleted": { orgId: string }
  "org.credits_updated": { orgId: string; credits: number }
  "member.added": { orgId: string; userId: string; role: string }
  "member.removed": { orgId: string; userId: string }
}

type EventName = keyof EventMap
type EventHandler<T extends EventName> = (payload: EventMap[T]) => void

const handlers = new Map<EventName, Array<EventHandler<EventName>>>()

function on<T extends EventName>(event: T, handler: EventHandler<T>): void {
  const list = handlers.get(event) ?? []
  list.push(handler as EventHandler<EventName>)
  handlers.set(event, list)
}

function emit<T extends EventName>(event: T, payload: EventMap[T]): void {
  const list = handlers.get(event)
  if (!list) return
  for (const handler of list) {
    try {
      handler(payload)
    } catch (err) {
      logger.error("Event handler threw", {
        event,
        error: err instanceof Error ? err.message : String(err),
      })
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
})
