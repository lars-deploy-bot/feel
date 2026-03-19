/**
 * SQL identifier sanitization for Supabase tools.
 *
 * Prevents SQL injection by validating that identifiers (schema names,
 * table names) contain only safe characters before interpolation.
 */

/**
 * Validate and return a SQL identifier (schema name, table name, etc.).
 * Throws if the identifier contains unsafe characters.
 *
 * Allowed: letters, digits, underscores. Must start with a letter or underscore.
 */
export function sanitizeIdentifier(name: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error(`Invalid SQL identifier: ${name}`)
  }
  return name
}
