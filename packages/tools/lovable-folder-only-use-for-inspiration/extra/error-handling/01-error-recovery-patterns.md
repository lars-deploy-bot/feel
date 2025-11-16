# Error Recovery Patterns

## Handling Failures Gracefully in the Lovable Execution Model

This document covers comprehensive error handling strategies for tool failures, API errors, and recovery workflows.

---

## Error Categories

### 1. Tool Execution Errors

**File Not Found**
```
Error: File not found: src/components/Button.tsx
Cause: File doesn't exist at expected path
Recovery: Search for file, offer to create, ask user
```

**Invalid Path**
```
Error: Access denied: path outside project root
Cause: Path traversal attempt (security)
Recovery: None - reject request, log security event
```

**Read-Only File**
```
Error: Cannot modify read-only file: package.json
Cause: Attempted to write to protected file
Recovery: Use appropriate tool (lov-add-dependency)
```

**Invalid Parameters**
```
Error: Invalid parameters: file_path is required
Cause: Missing required parameter
Recovery: Retry with correct parameters
```

### 2. Backend Errors

**Supabase Not Enabled**
```
Error: Lovable Cloud not enabled for this project
Cause: Attempting backend operation without Cloud
Recovery: Enable Cloud, then retry operation
```

**Database Connection Failed**
```
Error: Could not connect to database
Cause: Network issue, database down, invalid credentials
Recovery: Retry with exponential backoff, check status
```

**RLS Policy Violation**
```
Error: Row Level Security policy violation
Cause: User attempting unauthorized database access
Recovery: Review policies, generate correct RLS
```

### 3. External API Errors

**Rate Limit Exceeded**
```
Error: 429 Too Many Requests
Cause: Rate limit hit for external API
Recovery: Wait, retry with backoff, inform user
```

**Authentication Failed**
```
Error: 401 Unauthorized - Invalid API key
Cause: Missing or invalid secret
Recovery: Prompt user to add/update secret
```

**Timeout**
```
Error: Request timeout after 30 seconds
Cause: External service slow or unresponsive
Recovery: Retry once, then fail with message
```

### 4. AI Model Errors

**Context Too Large**
```
Error: Context exceeds 200k token limit
Cause: Too many files loaded into context
Recovery: Trim context, load selectively
```

**Invalid Tool Call**
```
Error: AI returned malformed tool call
Cause: Model hallucinated invalid JSON
Recovery: Ask AI to retry with valid format
```

**Infinite Loop**
```
Error: Max iterations exceeded (10 rounds)
Cause: AI stuck in retry loop
Recovery: Break loop, ask user for guidance
```

---

## Recovery Strategies

### Strategy 1: Automatic Retry with Backoff

```typescript
async function executeWithRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 1000,
    maxDelayMs = 10000,
    retryableErrors = [429, 503, 504]
  } = options;
  
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry non-retryable errors
      if (!isRetryable(error, retryableErrors)) {
        throw error;
      }
      
      // Last attempt - throw error
      if (attempt === maxAttempts) {
        throw new Error(
          `Failed after ${maxAttempts} attempts: ${error.message}`
        );
      }
      
      // Calculate backoff delay (exponential)
      const delayMs = Math.min(
        baseDelayMs * Math.pow(2, attempt - 1),
        maxDelayMs
      );
      
      console.log(`Retry attempt ${attempt}/${maxAttempts} after ${delayMs}ms`);
      await sleep(delayMs);
    }
  }
  
  throw lastError!;
}

// Usage
const result = await executeWithRetry(
  () => callExternalAPI(),
  { maxAttempts: 3, baseDelayMs: 1000 }
);
```

---

### Strategy 2: Graceful Degradation

```typescript
async function executeWithFallback<T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T>,
  options: { timeout?: number } = {}
): Promise<T> {
  try {
    // Try primary approach with timeout
    return await withTimeout(primary(), options.timeout || 30000);
  } catch (error) {
    console.warn('Primary approach failed, using fallback:', error.message);
    
    // Fall back to alternative approach
    try {
      return await fallback();
    } catch (fallbackError) {
      throw new Error(
        `Both primary and fallback failed:\n` +
        `Primary: ${error.message}\n` +
        `Fallback: ${fallbackError.message}`
      );
    }
  }
}

// Example: File search with fallback
const searchResults = await executeWithFallback(
  // Primary: Fast regex search
  () => lov-search-files("Button", "src/**/*.tsx"),
  // Fallback: Slower full-text search
  () => lov-search-files("Button", "**/*", { caseSensitive: false })
);
```

---

### Strategy 3: Circuit Breaker

```typescript
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private threshold: number = 5,
    private resetTimeMs: number = 60000
  ) {}
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check circuit state
    if (this.state === 'open') {
      const timeSinceFailure = Date.now() - this.lastFailureTime;
      
      if (timeSinceFailure < this.resetTimeMs) {
        throw new Error('Circuit breaker is OPEN - service unavailable');
      }
      
      // Try half-open state
      this.state = 'half-open';
    }
    
    try {
      const result = await fn();
      
      // Success - reset circuit
      this.failures = 0;
      this.state = 'closed';
      
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();
      
      // Open circuit if threshold exceeded
      if (this.failures >= this.threshold) {
        this.state = 'open';
        console.error(`Circuit breaker OPEN after ${this.failures} failures`);
      }
      
      throw error;
    }
  }
}

// Usage: Protect external API calls
const circuitBreaker = new CircuitBreaker(5, 60000);

async function callSupabaseAPI() {
  return await circuitBreaker.execute(() =>
    fetch('https://api.supabase.com/...')
  );
}
```

---

### Strategy 4: Compensating Transactions

```typescript
interface CompensatingAction {
  execute: () => Promise<void>;
  compensate: () => Promise<void>;
}

async function executeTransaction(actions: CompensatingAction[]): Promise<void> {
  const completed: CompensatingAction[] = [];
  
  try {
    // Execute each action
    for (const action of actions) {
      await action.execute();
      completed.push(action);
    }
  } catch (error) {
    console.error('Transaction failed, rolling back:', error);
    
    // Compensate in reverse order
    for (const action of completed.reverse()) {
      try {
        await action.compensate();
      } catch (compensateError) {
        console.error('Compensation failed:', compensateError);
        // Continue compensating despite errors
      }
    }
    
    throw new Error(`Transaction rolled back: ${error.message}`);
  }
}

// Example: Create multiple files with rollback
await executeTransaction([
  {
    execute: () => lov-write('src/A.tsx', contentA),
    compensate: () => lov-delete('src/A.tsx')
  },
  {
    execute: () => lov-write('src/B.tsx', contentB),
    compensate: () => lov-delete('src/B.tsx')
  },
  {
    execute: () => lov-write('src/C.tsx', contentC),
    compensate: () => lov-delete('src/C.tsx')
  }
]);
```

---

## Error Recovery Workflows

### Workflow 1: File Not Found

```
Error: File not found: src/components/Button.tsx
         │
         ▼
┌────────────────────────────────────────┐
│ Step 1: Search for similar files      │
└────────┬───────────────────────────────┘
         │
    ┌────┴────┐
    │         │
  Found    Not Found
    │         │
    ▼         ▼
┌────────┐  ┌──────────────────────────┐
│ Step 2:│  │ Step 2: Offer to create  │
│ Show   │  │ "I couldn't find Button. │
│ matches│  │  Create new component?"  │
└────┬───┘  └───────┬──────────────────┘
     │              │
     ▼              ▼
"Did you mean     User responds:
 ButtonOld.tsx?"   "Yes" or "No"
     │              │
     └──────┬───────┘
            ▼
     Final action
```

**Implementation:**

```typescript
async function handleFileNotFound(filePath: string): Promise<RecoveryResult> {
  // 1. Search for similar files
  const fileName = path.basename(filePath);
  const searchResults = await lov-search-files(fileName, "src/**/*");
  
  if (searchResults.results.length > 0) {
    // Found similar files
    return {
      type: 'found_alternatives',
      message: `I couldn't find ${filePath}. Did you mean one of these?`,
      alternatives: searchResults.results.map(r => r.file),
      suggestedAction: 'clarify'
    };
  }
  
  // 2. Offer to create
  return {
    type: 'offer_create',
    message: `I couldn't find ${filePath}. Would you like me to create it?`,
    suggestedAction: 'create_new'
  };
}
```

---

### Workflow 2: Supabase Not Enabled

```
Error: Lovable Cloud not enabled
         │
         ▼
┌────────────────────────────────────────┐
│ Step 1: Explain what Cloud provides   │
│ • Database                             │
│ • Authentication                       │
│ • Edge Functions                       │
└────────┬───────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────┐
│ Step 2: Offer to enable                │
│ "Enable Lovable Cloud now?"            │
└────────┬───────────────────────────────┘
         │
    ┌────┴────┐
    │         │
  "Yes"     "No"
    │         │
    ▼         ▼
Enable    Continue
Cloud     without
    │     backend
    ▼
Provision
backend
    │
    ▼
Retry original
operation
```

**Implementation:**

```typescript
async function handleSupabaseNotEnabled(
  originalOperation: ToolCall
): Promise<RecoveryResult> {
  
  return {
    type: 'enable_backend_required',
    message: `
This feature requires Lovable Cloud (backend). It provides:
• PostgreSQL database
• User authentication
• File storage
• Edge functions

Would you like me to enable it? (Free tier available)
    `,
    suggestedAction: 'enable_cloud',
    pendingOperation: originalOperation
  };
}

// User responds "yes"
async function executeEnableAndRetry(originalOperation: ToolCall) {
  // 1. Enable Cloud
  await supabase--enable();
  
  // 2. Wait for provisioning
  await waitForSupabaseReady();
  
  // 3. Retry original operation
  return await executeTool(
    originalOperation.name,
    originalOperation.parameters
  );
}
```

---

### Workflow 3: Rate Limit Exceeded

```
Error: 429 Too Many Requests
         │
         ▼
┌────────────────────────────────────────┐
│ Step 1: Parse retry-after header      │
└────────┬───────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────┐
│ Step 2: Inform user of wait time      │
│ "Rate limit hit. Retrying in 30s..."  │
└────────┬───────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────┐
│ Step 3: Wait with exponential backoff │
└────────┬───────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────┐
│ Step 4: Retry request                  │
└────────┬───────────────────────────────┘
         │
    ┌────┴────┐
    │         │
 Success    Fail again
    │         │
    ▼         ▼
  Done    Retry up to
          3 times,
          then fail
```

**Implementation:**

```typescript
async function handleRateLimit(
  request: () => Promise<any>,
  attempt: number = 1
): Promise<any> {
  
  try {
    return await request();
  } catch (error) {
    if (error.status === 429 && attempt <= 3) {
      // Parse retry-after header (seconds)
      const retryAfter = parseInt(error.headers.get('retry-after') || '30');
      const delayMs = retryAfter * 1000;
      
      console.log(`Rate limit hit. Retrying in ${retryAfter}s (attempt ${attempt}/3)`);
      
      // Wait
      await sleep(delayMs);
      
      // Retry
      return await handleRateLimit(request, attempt + 1);
    }
    
    // Max retries or non-rate-limit error
    throw error;
  }
}
```

---

## Error Messages Best Practices

### ❌ Bad Error Messages

```
"Error occurred"
"Failed to execute"
"Something went wrong"
"Operation unsuccessful"
```

### ✅ Good Error Messages

```
"File not found: src/components/Button.tsx. Would you like me to create it?"

"Rate limit exceeded. Retrying in 30 seconds..."

"Lovable Cloud not enabled. This feature requires a backend. Enable now?"

"Invalid API key for OpenAI. Please update your OPENAI_API_KEY secret."
```

**Formula for good error messages:**
```
[What happened] + [Why it happened] + [What to do next]
```

---

## Logging & Monitoring

### Error Logging

```typescript
async function logError(error: Error, context: ErrorContext) {
  await analytics.track('error', {
    type: error.constructor.name,
    message: error.message,
    stack: error.stack,
    context: {
      userId: context.userId,
      projectId: context.projectId,
      tool: context.tool,
      parameters: context.parameters
    },
    timestamp: new Date(),
    severity: classifyErrorSeverity(error)
  });
}

function classifyErrorSeverity(error: Error): 'low' | 'medium' | 'high' | 'critical' {
  if (error.message.includes('security') || error.message.includes('access denied')) {
    return 'critical';
  }
  if (error.message.includes('rate limit') || error.message.includes('timeout')) {
    return 'medium';
  }
  if (error.message.includes('not found')) {
    return 'low';
  }
  return 'medium';
}
```

### Error Monitoring Dashboard

```typescript
// Track error rates
const errorRates = {
  fileNotFound: 12.5,        // per 100 requests
  rateLimitExceeded: 2.3,
  invalidParameters: 5.1,
  supabaseNotEnabled: 8.7,
  networkTimeout: 1.2
};

// Alert on spikes
if (errorRates.rateLimitExceeded > 5.0) {
  alert.send({
    type: 'error_spike',
    message: 'Rate limit errors increased to 5% of requests',
    action: 'Investigate external API usage'
  });
}
```

---

## Summary: Error Recovery Checklist

When an error occurs:

- [ ] **Classify error** - Retryable, user-fixable, or fatal?
- [ ] **Log error** - Include context, severity, timestamp
- [ ] **Attempt recovery** - Retry, fallback, or compensate
- [ ] **Communicate clearly** - Tell user what happened and what's next
- [ ] **Learn from error** - Update patterns to prevent recurrence

**Recovery strategies by error type:**

| Error Type | Strategy |
|------------|----------|
| File not found | Search for alternatives, offer to create |
| Invalid path | Reject, log security event |
| Rate limit | Retry with backoff |
| Backend not enabled | Offer to enable, explain benefits |
| Network timeout | Retry once, then fail |
| Invalid parameters | Fix parameters, retry |
| Context too large | Trim context, load selectively |
| Infinite loop | Break loop, ask user for guidance |

The key principle: **Never leave users stuck** - always provide a path forward.
