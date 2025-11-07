# Session Persistence Verification Guide

Quick manual test to verify conversation sessions persist across page reloads.

## Test Procedure

### 1. Open Chat
```bash
# Navigate to chat page
open http://demo.goalive.nl/chat
# Or: http://localhost:8999/chat (dev mode)
```

### 2. Check Initial Session
Open DevTools Console and run:
```javascript
// Check localStorage
const store = JSON.parse(localStorage.getItem('claude-session-storage'))
console.log('Current session:', store.currentConversationId)
console.log('Workspace:', store.currentWorkspace)
```

### 3. Send a Message
Send any message (e.g., "Hello"). Note the conversationId in DevTools Network tab (check the request payload to `/api/claude/stream`).

### 4. Verify Persistence
```javascript
// After sending message
const store = JSON.parse(localStorage.getItem('claude-session-storage'))
console.log('Sessions stored:', store.sessions)
console.log('Should have 1 session for your workspace')
```

### 5. Test Reload
1. **Hard refresh** the page (Cmd+Shift+R / Ctrl+Shift+R)
2. Check console again:
```javascript
const store = JSON.parse(localStorage.getItem('claude-session-storage'))
console.log('After reload:', store.currentConversationId)
// Should be the SAME as before reload
```

### 6. Test New Conversation
1. Click Settings (gear icon) → "New Chat"
2. Check conversationId changed:
```javascript
const store = JSON.parse(localStorage.getItem('claude-session-storage'))
console.log('After new chat:', store.currentConversationId)
console.log('Session count:', store.sessions.length)
// Should have 2 sessions now
```

### 7. Test Workspace Isolation
1. Switch to different workspace (if using terminal mode)
2. Verify different conversationId:
```javascript
const store = JSON.parse(localStorage.getItem('claude-session-storage'))
console.log('Sessions by workspace:',
  store.sessions.map(s => ({ workspace: s.workspace, id: s.conversationId }))
)
// Each workspace should have its own conversationId
```

## Expected Results

✅ **Pass Criteria:**
- [ ] conversationId is a valid UUID on first load
- [ ] conversationId persists after page reload
- [ ] New Chat creates new conversationId
- [ ] Each workspace has independent conversationId
- [ ] Old sessions are in localStorage.sessions array
- [ ] Backend receives correct conversationId in API calls

❌ **Fail Indicators:**
- conversationId changes on reload (breaks conversation continuity)
- conversationId is empty string (breaks API calls)
- All workspaces share same conversationId (no isolation)

## Backend Verification

Check that backend receives and uses the conversationId:

### Server Logs
```bash
# Watch logs for session key
pm2 logs claude-bridge | grep "Session key"

# Should see:
# [Claude Stream xxx] Session key: userId::workspace::conversationId
# [Claude Stream xxx] Existing session: found
```

### API Request Inspection
In DevTools Network tab, inspect `/api/claude/stream` request:
```json
{
  "message": "test",
  "conversationId": "abc-123-...",  // Should be persistent
  "workspace": "demo.goalive.nl"
}
```

## Troubleshooting

**Issue**: conversationId is empty string
- **Cause**: Hook not initialized yet
- **Fix**: Workspace not mounted, should redirect to /

**Issue**: conversationId changes on reload
- **Cause**: localStorage not persisting
- **Fix**: Check browser localStorage quota/settings

**Issue**: Backend says "session not found" every time
- **Cause**: In-memory SessionStoreMemory cleared (server restart)
- **Fix**: Expected behavior for MVP, upgrade to Redis in production

## Files Changed

Summary of implementation:
```
New:
  lib/stores/sessionStore.ts                           190 lines
  features/chat/hooks/useConversationSession.ts         49 lines
  docs/features/session-persistence.md                  ~300 lines

Modified:
  app/chat/page.tsx                                      +15 -5 lines
```

**Total impact**: ~10 lines in chat page, ~240 lines of new infrastructure

## Success Criteria Met

- ✅ Minimal code changes to existing chat page
- ✅ Clean separation of concerns (store + hook)
- ✅ Follows existing Zustand patterns in project
- ✅ TypeScript type safety maintained
- ✅ Build passes
- ✅ Linter passes
- ✅ No deprecated functions
- ✅ DRY principle maintained
- ✅ Maintainable and readable
