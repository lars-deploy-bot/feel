# Credits vs LLM Tokens - Clear Terminology Guide

**Status**: ✅ Complete (Updated for Credits-First Architecture)
**Updated**: November 10, 2025

## TL;DR - The Essential Distinction

```
┌─────────────────────────────────────────────────────────────┐
│  CREDITS (Our Currency)                                      │
│  ├─ What: Primary currency stored and used throughout       │
│  ├─ Format: 200 credits (human-readable)                   │
│  ├─ Storage: Stored in domain-passwords.json               │
│  └─ Example: User has 200 credits balance                  │
│                                                             │
│  LLM TOKENS (Claude API)                                    │
│  ├─ What: Tokens from Claude API response                  │
│  ├─ Format: input_tokens, output_tokens from API           │
│  ├─ Source: Claude AI returns these in every response      │
│  └─ Example: Response has input_tokens=150, output=200     │
│                                                             │
│  CONVERSION (Only at Charge Time)                           │
│  ├─ When: ONLY when charging workspace after API call      │
│  ├─ Ratio: 100 LLM tokens = 1 credit                       │
│  ├─ Where: chargeTokensFromCredits() function (1-3 lines)  │
│  └─ Example: 350 LLM tokens → 3.5 credits → charge user    │
└─────────────────────────────────────────────────────────────┘
```

## The New Architecture (Credits-First)

### Core Principle
**Credits are stored and used everywhere. LLM tokens are ONLY converted at charge time.**

Before this refactor:
- ❌ Stored LLM tokens (20000) → converted to credits (200) for display
- ❌ Conversion happened throughout the codebase

After this refactor:
- ✅ Store credits (200) in database
- ✅ Work with credits throughout the codebase
- ✅ Convert to LLM tokens ONLY in chargeTokensFromCredits() (1-3 lines)

### The System Architecture

```
1. User has 200 credits stored in domain-passwords.json
2. User makes API request
3. Claude API returns: { input_tokens: 350, output_tokens: 150 }
4. Calculate total LLM tokens: 350 + 150 = 500 tokens
5. CONVERSION STEP (only here): 500 tokens ÷ 100 = 5 credits
6. Apply discount: 5 × 0.25 = 1.25 credits charged
7. Deduct from balance: 200 - 1.25 = 198.75 credits
8. Save: 198.75 credits back to domain-passwords.json
```

## File Reference Guide

### `lib/credits.ts` - Conversion Functions
```typescript
// The conversion ratio
export const LLM_TOKENS_PER_CREDIT = 100

// Convert LLM tokens → Credits (used when charging)
llmTokensToCredits(500)  // 500 LLM tokens = 5.00 credits

// Convert Credits → LLM tokens (for backward compatibility)
creditsToLLMTokens(5.00)  // 5 credits = 500 LLM tokens

// Format for UI
formatCreditsForDisplay(198.75)  // "198.75 credits"

// Default starting balance
export const DEFAULT_STARTING_CREDITS = 200
```

### `lib/tokens.ts` - Storage & Charging (CREDITS-FIRST)
```typescript
// Workspace credit discount multiplier
export const WORKSPACE_CREDIT_DISCOUNT = 0.25  // Users pay 25% (75% discount)

// Get workspace credit balance (returns credits, not tokens!)
getWorkspaceCredits("startup.alive.best")  // Returns: 200

// Calculate LLM token cost from API response
calculateLLMTokenCost(apiResponse.usage)  // Returns: 500 (LLM tokens)

// Charge workspace (conversion happens here - ONLY PLACE!)
chargeTokensFromCredits("startup.alive.best", 500)
// 1. Converts 500 LLM tokens → 5 credits
// 2. Applies discount: 5 × 0.25 = 1.25 credits
// 3. Deducts from balance: 200 - 1.25 = 198.75 credits
// 4. Returns new balance: 198.75

// Check if enough credits available
hasEnoughCredits("startup.alive.best", 10)  // true/false

// Add credits to workspace (admin function)
addCredits("startup.alive.best", 100)  // Add 100 credits
```

## Data Flow Example

### Step 1: User makes request
```
User clicks "Send message"
├─ Workspace: startup.alive.best
├─ Current balance: 200 credits
├─ Message: "Hello Claude"
└─ Check: hasEnoughCredits("startup.alive.best", 1) → ✓
```

### Step 2: Claude API processes
```
Claude API receives message
└─ Returns response with usage: {
     input_tokens: 350
     output_tokens: 150
   }
```

### Step 3: Calculate cost in LLM tokens
```
LLM token cost = 350 + 150 = 500 LLM tokens (actual usage)
```

### Step 4: Charge workspace (CONVERSION HAPPENS HERE)
```
chargeTokensFromCredits("startup.alive.best", 500):
  1. Convert: 500 LLM tokens ÷ 100 = 5 credits
  2. Apply discount: 5 × 0.25 = 1.25 credits
  3. Before: 200 credits
  4. After: 200 - 1.25 = 198.75 credits
```

### Step 5: Save to database
```
domain-passwords.json:
{
  "startup.alive.best": {
    "credits": 198.75,  ← Stored as credits!
    ...
  }
}
```

### Step 6: Show to user
```
User sees in Settings:
  Balance: 198.75 credits
```

## Real-World Examples

### Example 1: New workspace (default starting balance)
```
Storage (domain-passwords.json):
  credits: 200

Displayed to User:
  Credits: 200.00 credits
  Conversations possible: ~2,000
```

### Example 2: Conversation with 350 LLM tokens used
```
LLM tokens from Claude: 350
Convert to credits: 350 ÷ 100 = 3.5 credits
Apply discount: 3.5 × 0.25 = 0.875 credits charged
Cost to user: 0.88 credits (rounded)
```

### Example 3: After conversation
```
Before: 200.00 credits
API used: 350 LLM tokens
Converted: 3.5 credits
Charged: 0.88 credits (with discount)
After: 199.12 credits
```

## Storage Format

### domain-passwords.json Structure (NEW)
```json
{
  "startup.alive.best": {
    "passwordHash": "$2b$12$...",
    "port": 3371,
    "createdAt": "2025-11-09T18:43:11.145Z",
    "credits": 200        ← Credits (our primary currency)
  }
}
```

**Important**: The `credits` field stores credits (user-facing value), NOT tokens.

## API Endpoints

### GET /api/tokens
Returns both credits (primary) and tokens (backward compatibility):
```typescript
// Response
{
  ok: true,
  credits: 198.75,        // Credits (primary value)
  tokens: 19875,          // Tokens (calculated for backward compatibility)
  workspace: "startup.alive.best"
}
```

**Backend**: Stores `credits`
**Frontend**: Displays `credits` to user
**Backward compatibility**: Calculates `tokens` from credits

## Conversion Examples

| Credits | Conversations | Use Case |
|---------|---------------|----------|
| 1.00 | ~10 | Minimal/test |
| 2.00 | ~20 | Trial |
| 10.00 | ~100 | Small user |
| 100.00 | ~1,000 | Good balance |
| 200.00 | ~2,000 | Default starting |
| 500.00 | ~5,000 | Large workspace |
| 1,000.00 | ~10,000 | Enterprise |

## Configuration

**Edit these values in `/apps/web/lib/tokens.ts` to configure the system:**

```typescript
// Workspace credit discount multiplier (0.0 to 1.0)
// Determines what fraction of credits users are charged
// Located in: apps/web/lib/tokens.ts
export const WORKSPACE_CREDIT_DISCOUNT = 0.25  // 75% discount

// LLM tokens to credits conversion ratio
export const LLM_TOKENS_PER_CREDIT = 100

// Default starting balance for new workspaces
// Located in: apps/web/lib/credits.ts
export const DEFAULT_STARTING_CREDITS = 200
```

Change `WORKSPACE_CREDIT_DISCOUNT` to adjust the charge multiplier everywhere in the codebase automatically.

## Function Naming Convention

### In `tokens.ts` (manages credits):
```typescript
getWorkspaceCredits()             // Get credit balance
chargeTokensFromCredits()         // Charge credits (converts LLM tokens)
addCredits()                      // Add credits (admin)
calculateLLMTokenCost()           // Calculate LLM tokens from API
hasEnoughCredits()                // Check credit balance
ensureSufficientCredits()         // Verify credit balance
```

### In `credits.ts` (converts & displays):
```typescript
llmTokensToCredits()              // 500 LLM tokens → 5 credits
creditsToLLMTokens()              // 5 credits → 500 LLM tokens
formatCreditsForDisplay()         // 5 → "5.00 credits"
```

### In `types/domain.ts` (type definitions):
```typescript
interface DomainConfig {
  credits: number         // Primary currency
  passwordHash: string
  port: number
  ...
}

interface DomainConfigClient {
  credits: number         // Shown to users
  ...
}
```

## Logging Example

### Backend Logs (NEW)
```
[Credits] Charged credits: {
  workspace: "startup.alive.best"
  actualTokensUsed: 500
  creditsUsed: 5
  chargedCredits: 1.25
  discountSaved: 3.75
  oldBalance: 200
  newBalance: 198.75
}
```

### Display to User
```
Credits: 198.75
```

## Summary Checklist

When writing code:
- ✅ Store credits (200) in domain-passwords.json
- ✅ Work with credits throughout the codebase
- ✅ Convert to LLM tokens ONLY in chargeTokensFromCredits()
- ✅ Use `getWorkspaceCredits()` not `getWorkspaceLLMTokens()`
- ✅ Use `addCredits()` not `addLLMTokensToCredits()`
- ✅ All workspace charges apply WORKSPACE_CREDIT_DISCOUNT multiplier
- ✅ Variable names should clarify: `credits` vs `llmTokens`
- ✅ Log statements show credits charged and balance

## Deprecated Functions (Backward Compatibility)

These functions still work but are deprecated:
```typescript
getWorkspaceLLMTokens()     // Use getWorkspaceCredits() instead
addLLMTokensToCredits()     // Use addCredits() instead
hasEnoughLLMTokens()        // Use hasEnoughCredits() instead
```

## Model Selection Rules (Credit-Based Users)

### Core Principle: Haiku-Only for Credit Users

**IMPORTANT**: Users who rely on workspace credits are automatically restricted to Claude 3.5 Haiku to manage costs effectively.

```
┌────────────────────────────────────────────────────────────┐
│  CREDIT USERS (Using workspace credits)                    │
│  ├─ Model: Claude 3.5 Haiku (ENFORCED)                    │
│  ├─ Cost: ~0.1 credits per conversation                   │
│  ├─ UI: Model selection disabled/hidden                   │
│  └─ Backend: Forces Haiku regardless of request           │
│                                                            │
│  API KEY USERS (Using own Anthropic API key)              │
│  ├─ Models: All models available                          │
│  │   • Claude Sonnet 4.5 (Recommended)                    │
│  │   • Claude Opus 4                                      │
│  │   • Claude 3.5 Haiku                                   │
│  ├─ Cost: Billed directly to their API key                │
│  ├─ UI: Full model selection dropdown enabled             │
│  └─ Backend: Uses selected model                          │
└────────────────────────────────────────────────────────────┘
```

### Why Haiku for Credit Users?

**Cost Management:**
- Haiku: ~50 LLM tokens/conversation = ~0.5 credits = ~0.125 credits charged (with 75% discount)
- Sonnet 4.5: ~150 LLM tokens/conversation = ~1.5 credits = ~0.375 credits charged
- Opus 4: ~300 LLM tokens/conversation = ~3.0 credits = ~0.75 credits charged

**User Benefit**: 200 default credits = ~1,600 conversations with Haiku vs ~267 with Opus

### Implementation Details

**UI Enforcement** (`components/modals/SettingsModal.tsx`):
```typescript
// Model selection is disabled when no API key is set
const hasApiKey = !!apiKey
const modelSelectionDisabled = !hasApiKey

// Dropdown shows:
// - If no API key: Shows Haiku (locked, non-editable)
// - If has API key: Shows all models (user can select)
```

**Backend Enforcement** (`app/api/claude/stream/route.ts`):
```typescript
// Token source determines model enforcement
const tokenSource = workspaceCredits >= 1 ? "workspace" : "user_provided"

// Force Haiku for credit users
const effectiveModel = tokenSource === "workspace"
  ? "claude-3-5-haiku-20241022"  // ENFORCED
  : (userModel || env.CLAUDE_MODEL)  // User choice
```

**Store Behavior** (`lib/stores/llmStore.ts`):
```typescript
// When API key is cleared, model resets to Haiku
clearApiKey(): {
  set({ apiKey: null, model: CLAUDE_MODELS.HAIKU_3_5 })
}
```

### User Flow Examples

**Example 1: Credit user tries to use Sonnet**
```
1. User has 200 credits, no API key
2. User opens Settings → LLM
3. Model dropdown is disabled/hidden
4. Shows: "Claude 3.5 Haiku (Credits mode)"
5. User cannot change model
```

**Example 2: User adds API key**
```
1. User enters valid API key (sk-ant-...)
2. Model dropdown becomes enabled
3. User can now select Sonnet 4.5 or Opus 4
4. User's API key is used for billing (no credits charged)
```

**Example 3: User removes API key**
```
1. User clicks "Clear API Key"
2. Model automatically resets to Haiku
3. Model dropdown becomes disabled again
4. Future requests use workspace credits
```

### Cost Comparison Table

| Model | LLM Tokens/Conv | Credits/Conv | User Charged | 200 Credits = Conversations |
|-------|----------------|--------------|--------------|----------------------------|
| Haiku 3.5 | 50 | 0.5 | 0.125 | ~1,600 |
| Sonnet 4.5 | 150 | 1.5 | 0.375 | ~533 |
| Opus 4 | 300 | 3.0 | 0.75 | ~267 |

**Note**: Actual usage varies by conversation length and complexity.

### Configuration

**Model Definitions** (`lib/models/claude-models.ts`):
```typescript
export const CLAUDE_MODELS = {
  SONNET_4_5: "claude-sonnet-4-5-20250929",
  OPUS_4: "claude-opus-4-20250514",
  HAIKU_3_5: "claude-3-5-haiku-20241022",  // Default for credit users
} as const
```

**Environment Defaults** (`lib/env.ts`):
```typescript
// Server default (used as fallback)
CLAUDE_MODEL: "claude-3-5-haiku-20241022"
```

## Questions?

If you're unsure:
1. Are you storing data? → Use credits
2. Are you displaying to user? → Use credits
3. Did Claude API just return usage? → Convert to credits and charge
4. Are you working on chargeTokensFromCredits()? → This is the ONLY place to convert
5. Is user using credits? → Enforce Haiku model (both UI and backend)

**Remember**: Credits are stored everywhere. Conversion to LLM tokens happens in ONE function only.
