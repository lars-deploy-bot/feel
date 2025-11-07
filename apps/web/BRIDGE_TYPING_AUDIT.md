# Bridge Typing System Audit Checklist

**Purpose**: Verify that Bridge type system is fully implemented and consistent across client/server.

**Context**: We've refactored the Bridge protocol to use typed enums instead of string literals:
- Client Request Types: `ClientRequest.MESSAGE`, `ClientRequest.INTERRUPT`
- Client Error Types: `ClientError.*` (7 types)
- Bridge Stream Types: `BridgeStreamType.*` (7 types)
- Dev Terminal Types: All above combined via `DevEventName` union

---

## Boxes to Tick (Concrete Verifications)

### ☐ 1. Server generates BridgeStreamType enum values
**File**: `app/api/claude/stream/route.ts`
- [ ] All message creations use `BridgeStreamType.START`
- [ ] All message creations use `BridgeStreamType.MESSAGE`
- [ ] All message creations use `BridgeStreamType.COMPLETE`
- [ ] All message creations use `BridgeStreamType.ERROR`
- [ ] All message creations use `BridgeStreamType.DONE`
- [ ] No hardcoded strings like `"start"`, `"message"`, `"complete"`

### ☐ 2. Client parses BridgeStreamType enum values
**File**: `features/chat/lib/message-parser.ts`
- [ ] Type guards check `BridgeStreamType.START`
- [ ] Type guards check `BridgeStreamType.MESSAGE`
- [ ] Type guards check `BridgeStreamType.COMPLETE`
- [ ] Type guards check `BridgeStreamType.ERROR`
- [ ] No hardcoded type string checks like `"start"` or `"message"`

### ☐ 3. Client request events use ClientRequest enum
**File**: `app/chat/page.tsx`
- [ ] Outgoing request uses `ClientRequest.MESSAGE` as event type
- [ ] Stop streaming uses `ClientRequest.INTERRUPT` as event type
- [ ] Both create NDJSON format with `JSON.stringify() + '\n'`
- [ ] Both include proper timestamp and requestId

### ☐ 4. Client error events use ClientError enum
**File**: `app/chat/page.tsx`
- [ ] Timeout error uses `ClientError.TIMEOUT_ERROR`
- [ ] Parse error uses `ClientError.PARSE_ERROR`
- [ ] Reader error uses `ClientError.READER_ERROR`
- [ ] HTTP error uses `ClientError.HTTP_ERROR`
- [ ] All 7 error types are referenced at least once

### ☐ 5. Dev terminal discriminates by DevEventName
**File**: `features/chat/components/DevTerminal.tsx`
- [ ] Filters use `BridgeStreamType.PING` (not string `"ping"`)
- [ ] Event display uses `DevEventName` type
- [ ] Copy button properly serializes typed events

### ☐ 6. send-client-error uses typed error constants
**File**: `features/chat/lib/send-client-error.ts`
- [ ] Imports `ClientError` enum
- [ ] Uses `errorType` parameter as both eventName and event.type
- [ ] Creates NDJSON rawSSE format

### ☐ 7. dev-terminal-context has complete type definitions
**File**: `features/chat/lib/dev-terminal-context.tsx`
- [ ] Exports `ClientRequest` enum with MESSAGE, INTERRUPT
- [ ] Exports `ClientError` enum with all 7 error types
- [ ] Exports `ClientRequestType` type
- [ ] Exports `ClientErrorType` type
- [ ] DevEventName is union of all three event families
- [ ] ClientStreamEvent.type is properly typed union

### ☐ 8. Agent child runner uses BRIDGE_STREAM_TYPES
**File**: `scripts/run-agent.mjs` or `lib/agent-child-runner.ts`
- [ ] Imports from `agent-constants.mjs`
- [ ] Uses `BRIDGE_STREAM_TYPES.MESSAGE`
- [ ] Uses `BRIDGE_STREAM_TYPES.COMPLETE`
- [ ] Uses `BRIDGE_STREAM_TYPES.DONE`
- [ ] No hardcoded Bridge type strings

---

## Questions to Answer (Conceptual Alignment)

### Q1: Event Flow
**Question**: Can you trace a complete event from client request → server response → dev terminal?
- [ ] Describe the CLIENT_REQUEST_MESSAGE event path
- [ ] Describe how BridgeStreamType.MESSAGE flows back
- [ ] Describe how both appear in dev terminal with proper types

### Q2: Type Safety
**Question**: Where would TypeScript catch a mismatch if someone used a hardcoded string instead of enum?
- [ ] Find 3 places where type system prevents "string literal errors"
- [ ] Give an example of what would break if we added a new BridgeStreamType without updating type guards

### Q3: Duplication Strategy
**Question**: Why do we define constants in BOTH `.mjs` (Node.js) and `.ts` (Browser)?
- [ ] Explain the execution context separation
- [ ] Explain why we can't import across the boundary
- [ ] Verify both files have identical enum values

### Q4: Dev Terminal Completeness
**Question**: Does dev terminal show all three event families (Client Request, Client Error, Bridge)?
- [ ] Can you observe a CLIENT_REQUEST_MESSAGE event?
- [ ] Can you observe a CLIENT_ERROR_TIMEOUT event?
- [ ] Can you observe a bridge_start event?
- [ ] Are they all properly typed and discriminated?

### Q5: Message Creation Pattern
**Question**: Is the pattern consistent everywhere?
- [ ] Find all message creation sites and verify they use typed variables
- [ ] Check if any use `as any` or type assertions
- [ ] Verify rawSSE is always NDJSON (JSON + newline)

### Q6: Type Narrowing
**Question**: Can you use discriminated unions to narrow event type?
- [ ] Show how `event.eventName === ClientRequest.MESSAGE` narrows the type
- [ ] Show how `event.eventName === BridgeStreamType.PING` narrows the type
- [ ] Verify no additional guards are needed (eventName is sufficient)

### Q7: Coverage
**Question**: Are all event types referenced somewhere?
- [ ] ClientRequest.MESSAGE - referenced where?
- [ ] ClientRequest.INTERRUPT - referenced where?
- [ ] ClientError.PARSE_ERROR - referenced where?
- [ ] BridgeStreamType.PING - referenced where?
- [ ] All 7 BridgeStreamTypes mentioned somewhere?

### Q8: Breaking Changes
**Question**: Would renaming one enum break the system?
- [ ] If we renamed `ClientRequest.MESSAGE` → `ClientRequest.USER_MESSAGE`, what would break?
- [ ] Would dev terminal still work?
- [ ] Would NDJSON format be affected?
- [ ] Which files would need updates?

---

## Proof Strategy (How to Demonstrate Completeness)

### 1. **Grep for String Literals**
```bash
# Should find NO matches (only in comments/strings)
grep -r '"bridge_start"' apps/web/features apps/web/app --include="*.ts" --include="*.tsx"
grep -r '"bridge_message"' apps/web/features apps/web/app --include="*.ts" --include="*.tsx"
grep -r '"client_request_message"' apps/web/features apps/web/app --include="*.ts" --include="*.tsx"
```
**Proof**: If these all return only comments/doc, typing is complete.

### 2. **Find All BridgeStreamType Usage**
```bash
# Should find all 7 types referenced
grep -r "BridgeStreamType\." apps/web/features apps/web/app --include="*.ts" --include="*.tsx" | cut -d: -f3 | sort -u
```
**Proof**: Output should contain all 7: START, MESSAGE, COMPLETE, ERROR, PING, DONE, INTERRUPT

### 3. **Find All ClientRequest Usage**
```bash
grep -r "ClientRequest\." apps/web --include="*.ts" --include="*.tsx"
```
**Proof**: Should find MESSAGE and INTERRUPT in at least 2 places each

### 4. **Find All ClientError Usage**
```bash
grep -r "ClientError\." apps/web --include="*.ts" --include="*.tsx" | cut -d: -f3 | sort -u
```
**Proof**: Output should contain all 7 error types

### 5. **TypeScript Validation**
```bash
cd apps/web && bunx tsc --noEmit
```
**Proof**: Zero errors returned (exit code 0)

### 6. **Build Validation**
```bash
cd apps/web && bun run build
```
**Proof**: Build completes with "Compiled successfully" message

### 7. **Consistency Check - Agent Constants**
```bash
# Compare Node.js constants with Browser constants
grep -A 8 "BRIDGE_STREAM_TYPES = {" lib/claude/agent-constants.mjs
grep -A 8 "export const BridgeStreamType = {" features/chat/lib/streaming/ndjson.ts
```
**Proof**: All keys and values match exactly

### 8. **Event Flow Trace**
1. **Create a test scenario**: Send a message in dev mode
2. **Verify client creates event**: `ClientRequest.MESSAGE` event appears in dev terminal
3. **Verify server responds**: `BridgeStreamType.START`, `BridgeStreamType.MESSAGE`, `BridgeStreamType.COMPLETE` appear
4. **Verify dev terminal renders**: All events show with proper JSON format
5. **Verify types match**: No "string literal errors" in console

---

## Files Modified (Reference)

| File | Changes | Type |
|------|---------|------|
| `dev-terminal-context.tsx` | Added ClientRequest, ClientError enums; renamed DevStreamEvent → ClientStreamEvent | Core types |
| `send-client-error.ts` | Uses ClientError enum values; proper NDJSON format | Handler |
| `app/chat/page.tsx` | All errors use ClientError; requests use ClientRequest | Consumer |
| `DevTerminal.tsx` | Uses BridgeStreamType.PING in filters | Consumer |
| `message-parser.ts` | Uses BridgeStreamType in guards | Consumer |
| `stream/route.ts` | (Should verify uses BridgeStreamType) | Producer |
| `run-agent.mjs` | (Should verify uses BRIDGE_STREAM_TYPES) | Producer |

---

## Success Criteria

All 8 boxes checked ✓
All 8 questions answered with evidence ✓
All 8 proof strategies validated ✓
TypeScript: 0 errors ✓
Build: Successful ✓

**Result**: Bridge typing system is fully implemented and type-safe across client/server boundary.
