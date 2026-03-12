import { z } from "zod"

const InternalLeaseResponseSchema = z.object({
  lease: z.string(),
  workspace: z.string(),
  expiresAt: z.number(),
})

export type InternalLeaseResponse = z.infer<typeof InternalLeaseResponseSchema>

export interface InternalLeaseRequest {
  upstream: string
  requestId: string
  serviceName: string
  secret: string
  body: unknown
}

export async function requestInternalLease(input: InternalLeaseRequest): Promise<InternalLeaseResponse> {
  if (!input.upstream) {
    throw new Error(`${input.serviceName} upstream is required`)
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)

  try {
    const response = await fetch(`${input.upstream}/internal/lease`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": input.secret,
      },
      body: JSON.stringify(input.body),
      signal: controller.signal,
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`${input.serviceName} returned ${response.status}: ${text}`)
    }

    const parsed = InternalLeaseResponseSchema.safeParse(await response.json())
    if (!parsed.success) {
      throw new Error(`${input.serviceName} returned an unexpected response shape`)
    }

    return parsed.data
  } finally {
    clearTimeout(timeout)
  }
}

export async function requestInternalWatchLease(input: InternalLeaseRequest): Promise<InternalLeaseResponse> {
  if (!input.upstream) {
    throw new Error(`${input.serviceName} upstream is required`)
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)

  try {
    const response = await fetch(`${input.upstream}/internal/watch-lease`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": input.secret,
      },
      body: JSON.stringify(input.body),
      signal: controller.signal,
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`${input.serviceName} returned ${response.status}: ${text}`)
    }

    const parsed = InternalLeaseResponseSchema.safeParse(await response.json())
    if (!parsed.success) {
      throw new Error(`${input.serviceName} returned an unexpected response shape`)
    }

    return parsed.data
  } finally {
    clearTimeout(timeout)
  }
}
