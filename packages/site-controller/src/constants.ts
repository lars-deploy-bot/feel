/**
 * Browser-safe constants export
 *
 * This file re-exports only the constants from config.ts
 * without any Node.js dependencies, making it safe to import
 * in client-side code and React Server Components.
 */

export { PATHS, DEFAULTS, DOMAINS, PORTS, TIMEOUTS, SECURITY } from './config.js'
