# Plan: Add expected unblock date to blocked projects

## Context
When a project is blocked, users can currently see the reason but not *when* it's expected to be unblocked. Adding an expected unblock date gives visibility into timelines.

## Changes

### 1. Database: add column `blockedUntil` (server.ts, line ~65)
- Add `blockedUntil TEXT` to CREATE TABLE
- Add ALTER TABLE migration for existing data
- Include in INSERT (line ~103), UPDATE (line ~133), and GET (line ~87)

### 2. TypeScript interface (src/pages/Index.tsx, line ~17)
- Add `blockedUntil?: string` to `Project` interface

### 3. Edit modal blocked section (desktop ~897-930, mobile ~1794-1828)
- Below the "What's blocking this?" input, add a date input for expected unblock date
- Minimal styling, same pattern as blockedReason input

### 4. Card display (desktop ~1478, mobile ~604, initiatives ~1554, ~670)
- Show "tot [date]" next to the blocked reason text when blockedUntil is set

### 5. Clear on unblock
- When user clicks X to unblock, also clear `blockedUntil`

## Files to modify
- `server.ts` - DB schema + endpoints
- `src/pages/Index.tsx` - interface, modal, card rendering

## Verification
- Open a project, mark as blocked, set a date, verify it shows on the card
- Unblock the project, verify date is cleared
