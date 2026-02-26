import type { ZodSchema, ZodTypeDef } from "zod"
import { ValidationError } from "../infra/errors"

export function validate<Output, Input = Output>(schema: ZodSchema<Output, ZodTypeDef, Input>, data: unknown): Output {
  const result = schema.safeParse(data)
  if (!result.success) {
    const messages = result.error.errors.map(e => `${e.path.join(".")}: ${e.message}`).join("; ")
    throw new ValidationError(messages)
  }
  return result.data
}
