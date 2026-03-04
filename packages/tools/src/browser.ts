/**
 * Browser-safe entrypoint for @webalive/tools.
 *
 * This intentionally re-exports only display-safe utilities/constants
 * so accidental browser imports do not pull server-only Claude SDK code.
 */

export * from "./display.js"
