import { z } from "zod"

export const transferDomainSchema = z.object({
  /** The current alive subdomain, e.g. "scalotta.alive.best" */
  fromDomain: z.string().min(1),
  /** The target custom domain, e.g. "scalotta.it" */
  toDomain: z.string().min(1),
})

export type TransferDomainInput = z.infer<typeof transferDomainSchema>
