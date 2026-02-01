# RFC: Model Failover and Provider Rotation

**Status:** Draft
**RFC ID:** RFC-2026-011
**Author:** Lars / Claude
**Created:** 2026-02-01

---

## Summary

When Claude API fails (rate limit, outage, timeout), automatically try backup providers or models. Users shouldn't see errors when one provider has issues. Graceful degradation instead of failure.

## Problem

We're currently dependent on a single Claude API endpoint. When it has issues:
- Rate limits hit → user gets error
- API outage → user can't work
- Slow response → user waits or times out

OpenClaw supports multiple providers with intelligent failover. We should too.

## User Stories

1. **Rate limit recovery:** Claude API returns 429 → We retry with exponential backoff → User barely notices
2. **Provider failover:** Anthropic API down → Switch to backup → User continues working
3. **Model downgrade:** Opus unavailable → Fall back to Sonnet → User notified but can continue
4. **Transparent recovery:** Issues resolved automatically → No user action needed

## Failover Strategy

```
Primary Model (claude-sonnet-4-20250514)
        ↓ (fails)
Retry with exponential backoff (3 attempts)
        ↓ (still fails)
Check error type
        ├── Rate limited → Wait for Retry-After header
        ├── Server error → Try backup provider
        └── Auth error → Alert user, stop
        ↓
Backup Model (if configured)
        ↓ (fails)
Graceful degradation mode
        ↓
User notification with options
```

## Implementation

### 1. Provider Configuration

```typescript
interface ProviderConfig {
  id: string
  name: string
  apiEndpoint: string
  models: string[]
  priority: number  // Lower = higher priority
  enabled: boolean
  rateLimitBuffer: number  // % of limit to stay under
}

interface ModelConfig {
  primary: {
    provider: string
    model: string
  }
  fallbacks: Array<{
    provider: string
    model: string
    conditions?: string[]  // When to use this fallback
  }>
  imageModel?: {
    provider: string
    model: string
  }
}

const defaultConfig: ModelConfig = {
  primary: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
  },
  fallbacks: [
    {
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',  // Previous version
      conditions: ['rate_limited', 'model_unavailable'],
    },
    {
      provider: 'anthropic',
      model: 'claude-3-5-haiku-20241022',  // Faster, cheaper
      conditions: ['timeout', 'overloaded'],
    },
  ],
}
```

### 2. Error Classification for Failover

```typescript
type FailoverReason =
  | 'rate_limited'
  | 'server_error'
  | 'timeout'
  | 'model_unavailable'
  | 'overloaded'
  | 'auth_error'
  | 'unknown'

function classifyForFailover(error: unknown): FailoverReason {
  if (!error) return 'unknown'

  const status = (error as any)?.status
  const message = (error as any)?.message?.toLowerCase() || ''

  if (status === 429) return 'rate_limited'
  if (status === 503 || status === 502) return 'overloaded'
  if (status === 500) return 'server_error'
  if (status === 401 || status === 403) return 'auth_error'
  if (status === 404 && message.includes('model')) return 'model_unavailable'

  if (message.includes('timeout')) return 'timeout'
  if (message.includes('overloaded')) return 'overloaded'

  return 'unknown'
}

function shouldFailover(reason: FailoverReason): boolean {
  // Don't failover for auth errors - user needs to fix
  return reason !== 'auth_error'
}
```

### 3. Failover Manager

```typescript
class FailoverManager {
  private config: ModelConfig
  private currentFallbackIndex = -1  // -1 = using primary
  private cooldowns = new Map<string, number>()  // provider -> cooldown until

  constructor(config: ModelConfig) {
    this.config = config
  }

  async executeWithFailover<T>(
    fn: (provider: string, model: string) => Promise<T>
  ): Promise<T> {
    // Try primary first
    const primary = this.config.primary

    if (!this.isOnCooldown(primary.provider)) {
      try {
        const result = await this.tryWithRetry(fn, primary.provider, primary.model)
        this.currentFallbackIndex = -1  // Reset on success
        return result
      } catch (error) {
        const reason = classifyForFailover(error)

        if (!shouldFailover(reason)) {
          throw error
        }

        this.handleFailure(primary.provider, reason, error)
      }
    }

    // Try fallbacks
    for (let i = 0; i < this.config.fallbacks.length; i++) {
      const fallback = this.config.fallbacks[i]

      if (this.isOnCooldown(fallback.provider)) {
        continue
      }

      try {
        console.log(`Failing over to ${fallback.provider}/${fallback.model}`)
        const result = await this.tryWithRetry(fn, fallback.provider, fallback.model)
        this.currentFallbackIndex = i
        return result
      } catch (error) {
        const reason = classifyForFailover(error)
        this.handleFailure(fallback.provider, reason, error)
      }
    }

    // All options exhausted
    throw new Error('All providers failed. Please try again later.')
  }

  private async tryWithRetry<T>(
    fn: (provider: string, model: string) => Promise<T>,
    provider: string,
    model: string
  ): Promise<T> {
    return retryAsync(
      () => fn(provider, model),
      {
        maxAttempts: 3,
        minDelayMs: 1000,
        maxDelayMs: 10000,
        shouldRetry: (error) => {
          const reason = classifyForFailover(error)
          // Retry for transient errors, not for rate limits (need longer wait)
          return reason === 'timeout' || reason === 'server_error'
        },
        onRetry: (error, attempt) => {
          console.log(`Retry ${attempt} for ${provider}/${model}:`, error)
        },
      }
    )
  }

  private handleFailure(provider: string, reason: FailoverReason, error: unknown) {
    // Set cooldown based on error type
    let cooldownMs: number

    switch (reason) {
      case 'rate_limited':
        // Check Retry-After header
        const retryAfter = (error as any)?.headers?.['retry-after']
        cooldownMs = retryAfter ? parseInt(retryAfter) * 1000 : 60000
        break
      case 'overloaded':
        cooldownMs = 30000  // 30 seconds
        break
      default:
        cooldownMs = 10000  // 10 seconds
    }

    this.cooldowns.set(provider, Date.now() + cooldownMs)
    console.warn(`${provider} on cooldown for ${cooldownMs}ms due to ${reason}`)
  }

  private isOnCooldown(provider: string): boolean {
    const until = this.cooldowns.get(provider)
    return until ? Date.now() < until : false
  }

  getCurrentModel(): { provider: string; model: string; isFallback: boolean } {
    if (this.currentFallbackIndex === -1) {
      return { ...this.config.primary, isFallback: false }
    }
    return {
      ...this.config.fallbacks[this.currentFallbackIndex],
      isFallback: true,
    }
  }
}
```

### 4. Integration with Claude Agent

```typescript
// In the Claude streaming endpoint
const failoverManager = new FailoverManager(modelConfig)

async function streamClaude(req, res, message) {
  const response = await failoverManager.executeWithFailover(
    async (provider, model) => {
      return await claude.chat({
        model,
        messages: [{ role: 'user', content: message }],
        stream: true,
      })
    }
  )

  // Check if we're on a fallback and notify user
  const { isFallback, model } = failoverManager.getCurrentModel()
  if (isFallback) {
    res.write(`event: system\n`)
    res.write(`data: ${JSON.stringify({
      type: 'fallback_active',
      message: `Using backup model (${model}) due to temporary issues.`,
    })}\n\n`)
  }

  // Stream the response
  for await (const chunk of response) {
    res.write(`data: ${JSON.stringify(chunk)}\n\n`)
  }
}
```

### 5. User Notification

When failover is active, optionally show the user:

```typescript
interface FailoverNotification {
  active: boolean
  reason: string
  fallbackModel: string
  expectedRecovery?: Date
}

// In the UI
function StatusIndicator({ failover }: { failover: FailoverNotification }) {
  if (!failover.active) return null

  return (
    <div className="bg-yellow-50 text-yellow-800 px-3 py-1 rounded-full text-sm">
      ⚡ Using backup model
      <button onClick={showDetails}>Details</button>
    </div>
  )
}
```

## Health Monitoring

Track provider health over time:

```sql
CREATE TABLE provider_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  status TEXT NOT NULL,  -- 'success', 'rate_limited', 'error', etc.
  latency_ms INT,
  error_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Aggregate view for monitoring
CREATE VIEW provider_health_summary AS
SELECT
  provider,
  model,
  date_trunc('hour', created_at) as hour,
  COUNT(*) as total_requests,
  COUNT(*) FILTER (WHERE status = 'success') as successful,
  AVG(latency_ms) FILTER (WHERE status = 'success') as avg_latency,
  COUNT(*) FILTER (WHERE status = 'rate_limited') as rate_limited
FROM provider_health
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY provider, model, date_trunc('hour', created_at);
```

## Implementation Phases

| Phase | Scope | Effort |
|-------|-------|--------|
| Phase 1 | Error classification for failover | 1 day |
| Phase 2 | Retry with exponential backoff | 0.5 day |
| Phase 3 | Failover manager with cooldowns | 2 days |
| Phase 4 | Integration with Claude endpoint | 1 day |
| Phase 5 | User notification of fallback | 1 day |
| Phase 6 | Health monitoring | 1-2 days |
| Total | Complete failover system | ~1 week |

## Success Metrics

- Reduction in user-visible errors during API issues
- Automatic recovery rate
- Time to failover (should be fast)
- User impact during outages

## Future Enhancements

1. **Multiple providers:** Add OpenAI, Google as fallbacks
2. **Smart routing:** Route based on task type (code → Opus, simple → Haiku)
3. **Cost optimization:** Use cheaper models when primary is rate limited
4. **Predictive failover:** Detect degradation before failure

## References

- [OpenClaw model-failover.ts](https://github.com/openclaw/openclaw)
- [OpenClaw model-selection.ts](https://github.com/openclaw/openclaw)
- [Anthropic API rate limits](https://docs.anthropic.com/claude/reference/rate-limits)
- Netflix/AWS resilience patterns
