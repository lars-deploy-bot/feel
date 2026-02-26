import { parseAsBoolean, parseAsString, parseAsStringLiteral } from "nuqs"

/**
 * Single registry for all manager search params.
 * Every URL param in the app is defined here — no guessing, no duplicates.
 */

// Shared
export const pageParam = parseAsString.withDefault("organizations")
export const tabParam = parseAsStringLiteral(["overview", "activity"] as const).withDefault("overview")
export const searchParam = parseAsString.withDefault("")
export const sortAscParam = parseAsBoolean.withDefault(false)

// Users page
export const usersSortParam = parseAsStringLiteral([
  "name",
  "status",
  "last_active",
  "created",
  "orgs",
] as const).withDefault("last_active")
export const selectedUserParam = parseAsString

// Orgs page
export const orgsSortParam = parseAsStringLiteral([
  "name",
  "credits",
  "members",
  "projects",
  "created",
] as const).withDefault("name")
export const selectedOrgParam = parseAsString

/**
 * Query key map — the actual ?key= names in the URL.
 * Centralized so we never collide.
 */
export const PARAM_KEYS = {
  tab: "tab",
  search: "q",
  sort: "sort",
  sortAsc: "asc",
  selected: "id",
} as const
