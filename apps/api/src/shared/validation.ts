import type { z } from "zod"
import { ValidationError } from "../infra/errors"

export function validate<T extends z.ZodType>(schema: T, data: unknown): z.output<T> {
  const result = schema.safeParse(data)
  if (!result.success) {
    const messages = result.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join("; ")
    throw new ValidationError(messages)
  }
  return result.data
}
