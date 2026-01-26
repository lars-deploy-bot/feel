# PR 2: Stream Buffer

**Status**: ⏳ pending
**Depends on**: PR 1 (backend session keys)
**Estimated time**: 1 hour

## Goal

Update stream buffer to use `tabKey` instead of `conversationKey`.

## Self-Update Instructions

After completing each checkbox, update this file immediately:
```
- [ ] Task  →  - [x] Task
```
This ensures crash recovery - the file IS the source of truth.

---

## Checklist

### 1. lib/stream/stream-buffer.ts

- [ ] Read current file
- [ ] Rename `conversationKey` to `tabKey` in `StreamBufferEntry` interface
- [ ] Update `createStreamBuffer()` to accept `tabKey` parameter
- [ ] Update `hasActiveStream()` to lookup by `tabKey`
- [ ] Update `getStreamBuffer()` if it uses conversation key
- [ ] Update `deleteStreamBuffer()` if it uses conversation key
- [ ] Update any Redis key patterns that include "conversation"
- [ ] Verify changes compile: `bun run type-check`

### 2. Update callers

- [ ] Search for `stream-buffer` imports: `grep -r "stream-buffer" apps/web`
- [ ] Update each caller to pass `tabKey` instead of `conversationKey`
- [ ] Verify changes compile: `bun run type-check`

---

## Verification

- [ ] `bun run type-check` passes
- [ ] `bun run lint` passes
- [ ] Stream reconnection still works (manual test if possible)

---

## Notes

Write any issues, blockers, or decisions here during implementation:

```
(empty)
```

---

## Completion

- [ ] All checkboxes complete
- [ ] Update `0_overview.md`: Change PR 2 status to ✅ complete
