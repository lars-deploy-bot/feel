export type FormDataObjectValue = FormDataEntryValue | FormDataEntryValue[]

/**
 * Convert FormData into a plain object while preserving File instances
 * and repeated keys (as arrays).
 */
export function formDataToObject(fd: FormData): Record<string, FormDataObjectValue> {
  const out: Record<string, FormDataObjectValue> = {}

  for (const [key, value] of fd.entries()) {
    const existing = out[key]
    if (existing === undefined) {
      out[key] = value
      continue
    }

    if (Array.isArray(existing)) {
      existing.push(value)
      continue
    }

    out[key] = [existing, value]
  }

  return out
}
