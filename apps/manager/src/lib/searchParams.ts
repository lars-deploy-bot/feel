import { parseAsBoolean, parseAsString, parseAsStringLiteral } from "nuqs"

/**
 * Single registry for all manager search params.
 * Every URL param in the app is defined here — no guessing, no duplicates.
 */

// Shared
export const pageParam = parseAsString.withDefault("organizations")

const TAB_OPTIONS: readonly ["overview", "activity"] = ["overview", "activity"]
export const tabParam = parseAsStringLiteral(TAB_OPTIONS).withDefault("overview")

export const searchParam = parseAsString.withDefault("")
export const sortAscParam = parseAsBoolean.withDefault(false)

// Users page
const USER_SORT_OPTIONS: readonly ["name", "status", "last_active", "created", "orgs"] = [
  "name",
  "status",
  "last_active",
  "created",
  "orgs",
]
export const usersSortParam = parseAsStringLiteral(USER_SORT_OPTIONS).withDefault("last_active")
export const selectedUserParam = parseAsString

// Orgs page
const ORG_SORT_OPTIONS: readonly ["name", "credits", "members", "projects", "created"] = [
  "name",
  "credits",
  "members",
  "projects",
  "created",
]
export const orgsSortParam = parseAsStringLiteral(ORG_SORT_OPTIONS).withDefault("name")
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
} satisfies Record<string, string>
