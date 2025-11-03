# Lovable AI Features Guide

## Overview

Lovable AI provides built-in artificial intelligence capabilities that require zero configuration and no external API keys. This makes it the fastest and simplest way to add AI features to your application.

## Why Lovable AI First

### Advantages Over External APIs

**Zero Configuration**:
- No API keys to manage
- No external accounts needed
- No secret management required
- Works immediately after Cloud connection

**Cost Efficiency**:
- Free monthly AI usage included
- Usage-based pricing beyond free tier
- No separate billing for AI services
- Predictable cost structure

**Simplicity**:
- No rate limiting concerns
- No authentication complexity
- Automatic scaling
- Built-in error handling

**Integration**:
- Native Lovable Cloud integration
- Consistent with other platform features
- Optimized for Lovable applications

### When to Consider Alternatives

Only use external AI APIs (OpenAI, Anthropic, Replicate) when:
- You need a specific model not available in Lovable AI
- You have existing infrastructure with another provider
- You require features beyond Lovable AI's scope
- User explicitly requests a specific service

## Prerequisites

**Required**:
- Lovable Cloud must be enabled
- That's it! No other setup needed

**To enable**:
```typescript
// Use the Cloud enablement tool if not already connected
<!-- SUPABASE DISABLED: supabase--enable() -->
```

## Supported Use Cases

### 1. Text Generation and Completion

**Applications**:
- Content generation
- Writing assistance
- Code completion
- Email drafting
- Marketing copy

**Example**:
```typescript
const response = await fetch(
<!-- SUPABASE DISABLED:   `${supabaseUrl}/functions/v1/ai-generate`, -->
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: 'Write a product description for...',
      maxTokens: 200
    })
  }
)
```

### 2. Conversational Chatbots

**Applications**:
- Customer support bots
- Interactive assistants
- Q&A systems
- Educational tutors

**Example**:
```typescript
const response = await fetch(
<!-- SUPABASE DISABLED:   `${supabaseUrl}/functions/v1/ai-chat`, -->
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: 'You are a helpful assistant' },
        { role: 'user', content: 'How do I reset my password?' }
      ]
    })
  }
)
```

### 3. Text Summarization

**Applications**:
- Document summarization
- Meeting notes condensation
- Article abstracts
- Content digests

**Example**:
```typescript
const summary = await fetch(
<!-- SUPABASE DISABLED:   `${supabaseUrl}/functions/v1/ai-summarize`, -->
  {
    method: 'POST',
    body: JSON.stringify({
      text: longDocument,
      length: 'short' // short, medium, long
    })
  }
)
```

### 4. Sentiment Analysis

**Applications**:
- Review analysis
- Customer feedback processing
- Social media monitoring
- Brand sentiment tracking

**Example**:
```typescript
const sentiment = await fetch(
<!-- SUPABASE DISABLED:   `${supabaseUrl}/functions/v1/ai-sentiment`, -->
  {
    method: 'POST',
    body: JSON.stringify({
      text: 'This product exceeded my expectations!'
    })
  }
)

// Returns: { sentiment: 'positive', score: 0.92 }
```

### 5. Language Translation

**Applications**:
- Multi-language support
- Content localization
- Real-time chat translation
- Document translation

**Example**:
```typescript
const translation = await fetch(
<!-- SUPABASE DISABLED:   `${supabaseUrl}/functions/v1/ai-translate`, -->
  {
    method: 'POST',
    body: JSON.stringify({
      text: 'Hello, how are you?',
      targetLanguage: 'es' // Spanish
    })
  }
)
```

### 6. Document Q&A

**Applications**:
- Document search
- Knowledge base queries
- Research assistance
- Legal document analysis

**Example**:
```typescript
const answer = await fetch(
<!-- SUPABASE DISABLED:   `${supabaseUrl}/functions/v1/ai-document-qa`, -->
  {
    method: 'POST',
    body: JSON.stringify({
      document: documentText,
      question: 'What are the key terms of this contract?'
    })
  }
)
```

### 7. Image Analysis

**Applications**:
- Image description
- Content moderation
- Product recognition
- Accessibility (alt text generation)

**Example**:
```typescript
const analysis = await fetch(
<!-- SUPABASE DISABLED:   `${supabaseUrl}/functions/v1/ai-image-analyze`, -->
  {
    method: 'POST',
    body: JSON.stringify({
      imageUrl: 'https://...',
      task: 'describe' // describe, moderate, detect-objects
    })
  }
)
```

### 8. Task Automation

**Applications**:
- Workflow automation
- Data processing
- Email categorization
- Form parsing

**Example**:
```typescript
const result = await fetch(
<!-- SUPABASE DISABLED:   `${supabaseUrl}/functions/v1/ai-automate`, -->
  {
    method: 'POST',
    body: JSON.stringify({
      task: 'extract-contact-info',
      input: emailContent
    })
  }
)
```

## Implementation Patterns

### Basic Edge Function Structure

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
<!-- SUPABASE DISABLED: import { createClient } from 'https://esm.sh/@supabase/supabase-js@2' -->

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { prompt } = await req.json()

    // Lovable AI call here
    const result = await callLovableAI(prompt)

    return new Response(
      JSON.stringify({ result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
```

### Frontend Integration

```typescript
import { useToast } from "@/hooks/use-toast"

function AIFeature() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')

  const handleGenerate = async (prompt: string) => {
    setLoading(true)
    try {
      const response = await fetch(
<!-- SUPABASE DISABLED:         `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-generate`, -->
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ prompt })
        }
      )

      if (!response.ok) throw new Error('AI request failed')

      const data = await response.json()
      setResult(data.result)
      
      toast({
        title: "Generated successfully",
        description: "Your AI content is ready",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <Button onClick={() => handleGenerate(userInput)} disabled={loading}>
        {loading ? 'Generating...' : 'Generate with AI'}
      </Button>
      {result && <div>{result}</div>}
    </div>
  )
}
```

## Best Practices

### Input Validation

```typescript
function validateAIInput(input: string): boolean {
  if (!input || input.trim().length === 0) {
    throw new Error('Input cannot be empty')
  }
  if (input.length > 10000) {
    throw new Error('Input too long (max 10,000 characters)')
  }
  return true
}
```

### Rate Limiting

```typescript
// Implement simple rate limiting
const rateLimiter = new Map<string, number>()

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const lastRequest = rateLimiter.get(userId) || 0
  
  if (now - lastRequest < 1000) { // 1 second between requests
    throw new Error('Rate limit exceeded')
  }
  
  rateLimiter.set(userId, now)
  return true
}
```

### Error Handling

```typescript
async function callAIWithRetry(prompt: string, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await callLovableAI(prompt)
    } catch (error) {
      if (i === maxRetries - 1) throw error
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
    }
  }
}
```

### Response Caching

```typescript
const cache = new Map<string, { result: string, timestamp: number }>()

async function getCachedOrGenerate(prompt: string) {
  const cached = cache.get(prompt)
  const now = Date.now()
  
  // Cache for 1 hour
  if (cached && now - cached.timestamp < 3600000) {
    return cached.result
  }
  
  const result = await callLovableAI(prompt)
  cache.set(prompt, { result, timestamp: now })
  return result
}
```

## Cost Management

### Usage Tracking

```typescript
// Track AI usage in database
async function logAIUsage(userId: string, type: string, tokens: number) {
<!-- SUPABASE DISABLED:   await supabase -->
    .from('ai_usage')
    .insert({
      user_id: userId,
      feature: type,
      tokens_used: tokens,
      timestamp: new Date().toISOString()
    })
}
```

### User Quotas

```typescript
async function checkUserQuota(userId: string): Promise<boolean> {
<!-- SUPABASE DISABLED:   const { data } = await supabase -->
    .from('ai_usage')
    .select('tokens_used')
    .eq('user_id', userId)
    .gte('timestamp', new Date(Date.now() - 30*24*60*60*1000)) // Last 30 days
  
  const totalTokens = data?.reduce((sum, row) => sum + row.tokens_used, 0) || 0
  const quotaLimit = 100000 // 100k tokens per month
  
  return totalTokens < quotaLimit
}
```

## Security Considerations

### Input Sanitization

```typescript
function sanitizeInput(input: string): string {
  // Remove potential prompt injection attempts
  return input
    .replace(/\b(ignore previous|disregard|system:|admin:)/gi, '')
    .trim()
}
```

### Authentication

```typescript
serve(async (req) => {
  // Always verify authentication for AI features
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response('Unauthorized', { status: 401 })
  }

<!-- SUPABASE DISABLED:   const supabase = createClient( -->
<!-- SUPABASE DISABLED:     Deno.env.get('SUPABASE_URL')!, -->
<!-- SUPABASE DISABLED:     Deno.env.get('SUPABASE_ANON_KEY')!, -->
    { global: { headers: { Authorization: authHeader } } }
  )

<!-- SUPABASE DISABLED:   const { data: { user }, error } = await supabase.auth.getUser() -->
  if (error || !user) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Proceed with AI request
})
```

## Troubleshooting

### Common Issues

**Rate Limiting**:
```typescript
// Error: Too many requests
// Solution: Implement client-side throttling
const debouncedGenerate = debounce(handleGenerate, 1000)
```

**Timeout Errors**:
```typescript
// Error: Request timeout
// Solution: Increase timeout, show loading state
const controller = new AbortController()
const timeoutId = setTimeout(() => controller.abort(), 30000)

fetch(url, { signal: controller.signal })
```

**Invalid Input**:
```typescript
// Error: Input validation failed
// Solution: Validate before sending
if (prompt.length < 10) {
  throw new Error('Prompt too short (minimum 10 characters)')
}
```

## Migration from External APIs

If moving from OpenAI/Anthropic to Lovable AI:

1. **Identify feature equivalents** in Lovable AI
2. **Update edge function** to use Lovable AI calls
3. **Remove external API secrets** (no longer needed)
4. **Test thoroughly** to ensure feature parity
5. **Monitor usage** and costs post-migration

---

**Key Principle**: Lovable AI should always be your first choice for AI features. It's simpler, faster to implement, and requires zero configuration compared to external APIs.
