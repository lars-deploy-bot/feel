import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateRequestId(): string {
  return Math.random().toString(36).substring(2, 8)
}

/**
 * Recursively truncates all string values in an object/array to a maximum length.
 * Preserves object structure while making large payloads more manageable.
 *
 * HANDLES:
 * - Circular references (prevents infinite loops)
 * - Deep nesting (max depth protection)
 * - Special types (Date, RegExp, Error, BigInt, Symbol, Function)
 * - Property access errors (getters that throw)
 * - Malformed structures (try-catch protection)
 *
 * @param value - The value to truncate (can be any type)
 * @param maxLength - Maximum string length before truncation (default: 200)
 * @param maxDepth - Maximum recursion depth (default: 50)
 * @param currentDepth - Internal: current recursion level
 * @param seen - Internal: circular reference tracker
 * @returns A deep copy with all strings truncated and edge cases handled
 */
export function truncateDeep(
  value: unknown,
  maxLength = 200,
  maxDepth = 50,
  currentDepth = 0,
  seen: WeakSet<object> = new WeakSet(),
): unknown {
  // Depth limit protection (prevent stack overflow)
  if (currentDepth >= maxDepth) {
    return "[max depth reached]"
  }

  // Handle null/undefined
  if (value === null || value === undefined) {
    return value
  }

  // Handle strings
  if (typeof value === "string") {
    if (value.length > maxLength) {
      const remaining = value.length - maxLength
      return `${value.slice(0, maxLength)}...[truncated ${remaining} chars]`
    }
    return value
  }

  // Handle primitives
  if (typeof value === "number" || typeof value === "boolean") {
    return value
  }

  // Handle special primitives
  if (typeof value === "bigint") {
    return `${value.toString()}n`
  }

  if (typeof value === "symbol") {
    return value.toString()
  }

  if (typeof value === "function") {
    return `[Function: ${value.name || "anonymous"}]`
  }

  // Handle Date objects
  if (value instanceof Date) {
    try {
      return value.toISOString()
    } catch {
      return "[Invalid Date]"
    }
  }

  // Handle RegExp objects
  if (value instanceof RegExp) {
    return value.toString()
  }

  // Handle Error objects
  if (value instanceof Error) {
    try {
      return {
        name: value.name,
        message: truncateDeep(value.message, maxLength, maxDepth, currentDepth + 1, seen),
        stack: truncateDeep(value.stack, maxLength, maxDepth, currentDepth + 1, seen),
      }
    } catch {
      return "[Error object processing failed]"
    }
  }

  // Handle arrays
  if (Array.isArray(value)) {
    // Circular reference check
    if (seen.has(value)) {
      return "[Circular Reference]"
    }
    seen.add(value)

    try {
      return value.map(item => truncateDeep(item, maxLength, maxDepth, currentDepth + 1, seen))
    } catch (err) {
      return `[Array processing error: ${err instanceof Error ? err.message : String(err)}]`
    }
  }

  // Handle objects
  if (typeof value === "object") {
    // Circular reference check
    if (seen.has(value)) {
      return "[Circular Reference]"
    }
    seen.add(value)

    try {
      const result: Record<string, unknown> = {}

      // Use Object.keys to safely handle getters that might throw
      const keys = Object.keys(value)
      for (const key of keys) {
        try {
          // Access property value - this is where getters execute
          const val = (value as any)[key]
          result[key] = truncateDeep(val, maxLength, maxDepth, currentDepth + 1, seen)
        } catch (err) {
          // Property getter threw an error
          result[key] = `[Error accessing property: ${err instanceof Error ? err.message : String(err)}]`
        }
      }

      return result
    } catch (err) {
      return `[Object processing error: ${err instanceof Error ? err.message : String(err)}]`
    }
  }

  // Fallback for unknown types
  try {
    return String(value)
  } catch {
    return "[Unstringifiable value]"
  }
}
