# PR 2: Stream Buffer

## Status: [x] Complete

## Checklist

- [x] Update `lib/stream/stream-buffer.ts` - Key buffers by `tabKey` instead of `conversationKey`
- [x] Update buffer retrieval functions (`findStreamBufferByTab` renamed from `findStreamBufferByConversation`)
- [x] Update buffer cleanup functions (`deleteStreamBuffer` now uses `tabKey`)
- [x] Test: Type check passes, callers already use tabKey format

## Files to Modify

### 1. `apps/web/lib/stream/stream-buffer.ts`

**Key insight:** The stream buffer stores messages for reconnection. Currently keyed by `conversationId`, needs to be keyed by `tabId`.

**Before:**
```typescript
// Buffer keyed by conversationId
const buffers = new Map<string, StreamBuffer>()

export function getBuffer(conversationId: string): StreamBuffer {
  return buffers.get(conversationId)
}

export function setBuffer(conversationId: string, buffer: StreamBuffer) {
  buffers.set(conversationId, buffer)
}
```

**After:**
```typescript
// Buffer keyed by tabId (the session key)
const buffers = new Map<string, StreamBuffer>()

export function getBuffer(tabId: string): StreamBuffer {
  return buffers.get(tabId)
}

export function setBuffer(tabId: string, buffer: StreamBuffer) {
  buffers.set(tabId, buffer)
}
```

**Also update any functions that:**
- Create buffers
- Delete buffers
- List buffers
- Check buffer existence

## Self-Update Instructions

When completing a task, update the checkbox:
```markdown
- [x] Update `lib/stream/stream-buffer.ts` - Key buffers by `tabId`
```

When PR is complete, update status and `0_overview.md`.
