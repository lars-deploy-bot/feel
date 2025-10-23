# Postmortem: CORS Issues with Cross-Domain Widget Implementation

**Date**: October 23, 2025
**Incident**: Claude Bridge widget failing with CORS errors when loaded from external domains
**Duration**: ~2 hours
**Status**: Resolved

## Summary

The Claude Bridge widget was failing to authenticate when loaded from external domains (e.g., `demo.goalive.nl`) due to CORS policy violations. The widget would load but authentication requests to `terminal.goalive.nl` were blocked.

## Timeline

1. **Initial Implementation**: Widget created and working when loaded from same domain
2. **Cross-origin Testing**: Widget failed when loaded from `demo.goalive.nl`
3. **CORS Error**: `Access-Control-Allow-Origin` header conflicts with credentials mode
4. **Investigation**: Discovered origin header was `undefined` in preflight requests
5. **Resolution**: Fixed origin extraction and implemented dynamic domain whitelist

## Root Cause

### Primary Issue
The `origin` header was not being properly extracted in the OPTIONS preflight request, causing the CORS handler to fall back to the default `terminal.goalive.nl` instead of allowing the requesting domain.

### Secondary Issues
1. **Wildcard CORS with Credentials**: Using `Access-Control-Allow-Origin: '*'` with `credentials: 'include'` is not allowed by browsers
2. **Static Domain List**: No dynamic way to allow new domains as sites were added to `/sites` directory
3. **Missing Origin Parameter**: Several API endpoints weren't passing the origin to the CORS helper function

## What Went Wrong

### Code Issues
```typescript
// ❌ PROBLEM: Origin not extracted in OPTIONS
export async function OPTIONS(req: NextRequest) {
  const res = new NextResponse(null, { status: 200 })
  addCorsHeaders(res) // Missing origin parameter!
  return res
}

// ❌ PROBLEM: Wildcard with credentials
res.headers.set('Access-Control-Allow-Origin', '*') // Not allowed with credentials
res.headers.set('Access-Control-Allow-Credentials', 'true')
```

### Browser Behavior
- Preflight OPTIONS requests sometimes don't include `origin` header properly
- Browsers require exact origin match when `credentials: 'include'` is used
- Fallback to `referer` header was needed

## What Went Right

### Quick Detection
- Clear error messages in browser console
- Immediate identification of CORS as the root cause
- Good debugging approach with incremental fixes

### Systematic Resolution
- Added comprehensive logging to understand the issue
- Implemented both file-based and fallback domain matching
- Created automated domain discovery system

## Resolution

### 1. Fixed Origin Extraction
```typescript
export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin') || req.headers.get('referer')?.split('/').slice(0, 3).join('/')
  const res = new NextResponse(null, { status: 200 })
  addCorsHeaders(res, origin)
  return res
}
```

### 2. Dynamic Domain Discovery
```bash
# Script: scripts/update-cors-domains.sh
# Scans /root/webalive/sites/ for domains
# Generates allowed-domains.json automatically
```

### 3. Smart CORS Handler
```typescript
// Reads from allowed-domains.json with fallback to .goalive.nl pattern
export function addCorsHeaders(res: NextResponse, origin?: string | null) {
  let allowedOrigin = 'https://terminal.goalive.nl' // fallback

  if (origin) {
    // Check against allowed domains file
    // Fallback to .goalive.nl pattern matching
  }

  res.headers.set('Access-Control-Allow-Origin', allowedOrigin)
}
```

### 4. Updated Cookie Settings
```typescript
res.cookies.set('session', '1', {
  httpOnly: true,
  secure: true,
  sameSite: 'none', // Changed from 'lax' for cross-origin
  path: '/',
})
```

## Prevention Measures

### 1. Automated Domain Management
- Created `bun run update-cors` command
- Script automatically discovers domains from `/sites` directory
- No manual CORS configuration needed for new sites

### 2. Comprehensive CORS Setup
- Added CORS headers to all API endpoints (`/api/login`, `/api/claude`, `/api/claude/stream`)
- Implemented OPTIONS handlers for all endpoints
- Proper origin extraction with fallback mechanisms

### 3. Documentation
- Added widget integration guide
- Created troubleshooting section for CORS issues
- Documented the domain discovery system

### 4. Testing Strategy
- Test widget from multiple domains
- Verify preflight OPTIONS requests work
- Check browser network tab for CORS headers

## Lessons Learned

### Technical
1. **Always test cross-origin scenarios early** - CORS issues only appear when testing from different domains
2. **Preflight requests behave differently** - OPTIONS requests may not have the same headers as actual requests
3. **Browser CORS rules are strict** - Wildcard origins don't work with credentials
4. **Header extraction needs fallbacks** - Multiple ways to determine origin may be needed

### Process
1. **Comprehensive logging helps** - Debug output made the issue immediately clear
2. **Incremental fixes work better** - Fixing one piece at a time rather than wholesale changes
3. **Automation prevents recurring issues** - Dynamic domain discovery eliminates manual CORS management

### Documentation
1. **Postmortems are valuable** - This documentation will help with future CORS issues
2. **Integration guides need real examples** - Show actual working code snippets
3. **Troubleshooting sections save time** - Common error patterns should be documented

## Action Items

- [x] Implement dynamic domain discovery system
- [x] Fix all CORS handlers across API endpoints
- [x] Clean up debug logging for production
- [x] Document the widget integration process
- [x] Create this postmortem for future reference

## Future Considerations

### Scalability
- Consider caching allowed domains in memory rather than reading file each time
- Implement domain validation to prevent abuse
- Add monitoring for CORS failures

### Security
- Review if all domains in `/sites` should automatically be trusted
- Consider implementing domain verification system
- Add rate limiting for widget authentication attempts

### Monitoring
- Add metrics for widget usage across domains
- Monitor CORS failures and unknown domains
- Track authentication success rates per domain

---

**Key Takeaway**: CORS with credentials requires exact origin matching and careful header handling. Always test cross-origin scenarios early and implement comprehensive logging for debugging.