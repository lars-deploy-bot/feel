# tool-results:// Structure

## What Goes Here

Large output from tool executions that's too big to display in chat.

## Example Structure

```
tool-results://
├── security-scan-20250127-142301.json
│   [10,253 lines - Full security audit results]
│
├── network-requests-20250127-142405.json
│   [892 lines - All network requests with headers, payloads]
│
├── console-logs-20250127-142510.txt
│   [2,341 lines - Complete browser console output]
│
├── search-results-20250127-143015.json
│   [1,456 lines - File search results across entire codebase]
│
└── table-schema-20250127-144520.json
    [3,789 lines - Complete database schema with all tables, columns, policies]
```

## Why Tool Results Go Here

**Problem:**
Some tool outputs are HUGE (thousands of lines). Displaying in chat would:
- Clutter the conversation
- Slow down the UI
- Make it hard to read other messages

**Solution:**
- Tool executes
- If output > threshold → Save to `tool-results://`
- Show truncated preview in chat
- AI can read full output when needed

## What Tools Use This

### `security--run_security_scan()`
```
Output: 10,000+ lines of JSON
- All tables analyzed
- All RLS policies checked
- All findings with details
- Recommendations
- Code references

Stored as: tool-results://security-scan-[timestamp].json

User sees in chat:
"Security scan complete. Found 12 issues (3 critical, 5 high, 4 medium).
Full results: tool-results://security-scan-20250127-142301.json"
```

### `alive-read-network-requests()`
```
Output: 5,000+ lines of JSON
- Every HTTP request
- Full headers
- Request/response bodies
- Timing data
- Status codes

Stored as: tool-results://network-requests-[timestamp].json

User sees in chat:
"Found 47 network requests. Slowest: POST /api/data (2.4s).
Full details: tool-results://network-requests-20250127-142405.json"
```

### `alive-read-console-logs()`
```
Output: 8,000+ lines of text
- Every console.log()
- Warnings
- Errors
- Stack traces

Stored as: tool-results://console-logs-[timestamp].txt

User sees in chat:
"Found 23 errors in console. Most common: 'Cannot read property of undefined'.
Full logs: tool-results://console-logs-20250127-142510.txt"
```

### `alive-search-files()`
```
Output: 3,000+ lines of matches
- Every file with matching pattern
- Line numbers
- Context around matches
- Full file paths

Stored as: tool-results://search-results-[timestamp].json

User sees in chat:
"Found 'useState' in 47 files (234 occurrences).
Full results: tool-results://search-results-20250127-143015.json"
```

### `security--get_table_schema()`
```
Output: 12,000+ lines of JSON
- All database tables
- Every column with types
- All indexes
- All foreign keys
- All RLS policies
- All functions

Stored as: tool-results://table-schema-[timestamp].json

User sees in chat:
"Database has 23 tables, 156 columns, 45 RLS policies.
Full schema: tool-results://table-schema-20250127-144520.json"
```

## How AI Uses Tool Results

### Example: Security Scan

```
1. User asks: "Audit my app security"

2. AI calls: security--run_security_scan()

3. Results are HUGE (10,000+ lines)

4. Alive saves to: tool-results://security-scan-[timestamp].json

5. Chat shows:
   "Security scan complete. Found 12 issues.
   Full results: tool-results://security-scan-[timestamp].json"

6. AI reads full results:
   alive-view("tool-results://security-scan-[timestamp].json")

7. AI analyzes all findings

8. AI fixes issues:
   alive-line-replace(file1, fix1)
   alive-line-replace(file2, fix2)
   [provides SQL for user to run]

9. AI summarizes:
   "Fixed 8/12 issues. Remaining 4 require manual intervention."
```

## Format Examples

### security-scan-[timestamp].json
```json
{
  "scan_id": "scan_abc123",
  "timestamp": "2025-01-27T14:23:01Z",
  "findings": [
    {
      "id": "MISSING_RLS",
      "internal_id": "missing_rls_users",
      "severity": "error",
      "category": "Row Level Security",
      "name": "Missing RLS on users table",
      "description": "Table 'users' does not have Row Level Security enabled",
      "details": "This allows any authenticated user to read/modify all user records...",
      "remediation_difficulty": "low",
      "affected_tables": ["users"],
      "sql_fix": "ALTER TABLE users ENABLE ROW LEVEL SECURITY;\nCREATE POLICY ..."
    },
    // ... 100+ more findings
  ],
  "summary": {
    "total_findings": 123,
    "by_severity": {
      "error": 12,
      "warn": 45,
      "info": 66
    },
    "by_category": {
      "rls": 23,
      "auth": 8,
      "input_validation": 15
    }
  }
}
```

### network-requests-[timestamp].json
```json
{
  "requests": [
    {
      "id": "req_001",
      "timestamp": "2025-01-27T14:24:05.123Z",
      "method": "POST",
      "url": "https://example.com/api/data",
      "status": 200,
      "duration_ms": 2431,
      "request_headers": {
        "Content-Type": "application/json",
        "Authorization": "Bearer [REDACTED]"
      },
      "request_body": {
        "query": "SELECT * FROM users WHERE id = 123"
      },
      "response_headers": {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache"
      },
      "response_body": {
        "data": [...],
        "meta": {...}
      }
    },
    // ... 500+ more requests
  ],
  "summary": {
    "total_requests": 542,
    "avg_duration_ms": 234,
    "slowest": {
      "url": "/api/data",
      "duration_ms": 2431
    },
    "errors": 12
  }
}
```

### console-logs-[timestamp].txt
```
[14:25:10.123] INFO: App initialized
[14:25:10.456] WARN: React key prop missing in UserList component
[14:25:11.789] ERROR: Cannot read property 'name' of undefined
  at UserProfile.tsx:45
  at Component.render
  at ...
[14:25:12.012] INFO: API request started: POST /api/users
[14:25:14.443] ERROR: Network request failed: 500 Internal Server Error
  Response: {"error": "Database connection timeout"}
[14:25:15.678] WARN: Memory usage high: 512 MB
...
[8,000+ more lines]
```

## Accessing Tool Results

### AI Can Read Them
```typescript
// Full access
alive-view("tool-results://security-scan-20250127-142301.json")
alive-view("tool-results://console-logs-20250127-142510.txt", "1-1000")

// Search within them
alive-search-files(
  query="error",
  include_pattern="tool-results://console-logs-*.txt"
)
```

### You Cannot Directly Access Them
Tool results are in AI's context only. To use them:

1. **Ask AI to analyze**:
   ```
   "What errors are in the console logs?"
   "Fix all security issues found"
   ```

2. **AI reads and acts**:
   - Reads full tool-results file
   - Analyzes the data
   - Takes action (fixes, explanations)

3. **AI summarizes for you**:
   - "Found 12 errors. Fixed 8. Here's what remains..."

## Truncation in Chat

When tool output is huge, you see:

```
Security scan complete. Found 12 issues (3 critical).

Issues summary:
1. Missing RLS on users table (critical)
2. Exposed API key in frontend (critical)
3. SQL injection vulnerability (critical)
4. XSS risk in comment rendering (high)
...

Full results (10,253 lines): tool-results://security-scan-20250127-142301.json

[Rest of output truncated for readability. AI has full access to analyze.]
```

## Lifecycle

```
1. AI executes tool (e.g., security scan)
2. Output is large (10,000+ lines)
3. Alive saves to tool-results://
4. Chat shows truncated preview + file path
5. AI can read full file as needed
6. Conversation ends → tool-results:// DELETED
```

## Common Questions

**Q: Can I download tool results?**  
A: Not directly. Ask AI to summarize or copy relevant parts to project docs.

**Q: How do I see the full security scan?**  
A: Ask AI: "Show me all security findings" and it will read and summarize.

**Q: Why truncate in chat?**  
A: 10,000 lines would be unreadable. AI reads full output, you get summary.

**Q: Can I search tool results?**  
A: Yes, ask AI: "Search console logs for 'timeout'" and it will.

**Q: Do tool results persist?**  
A: No, deleted when conversation ends. Ask AI to save important info to project.

## Best Practices

### For Users
- Let AI analyze tool results (don't ask for full output)
- Ask specific questions: "What's the slowest API call?" vs "Show all network requests"
- If you need full data, ask AI to save summary to project docs

### For AI
- Always read full tool-results when making decisions
- Provide concise summaries to user
- Reference tool-results file path in responses
- Use search to find specific issues in large outputs

## See Also

- **Security Scans**: See `.Alive-internals/tool-api/` for tool docs
- **Debugging**: Console logs, network requests captured here
- **File Search**: Large search results stored here
