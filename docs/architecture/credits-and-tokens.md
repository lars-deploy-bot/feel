# Credits vs LLM Tokens - Clear Terminology Guide

**Status**: ⚠️ PARTIALLY OUTDATED - See atomic-credit-charging.md for current implementation
**Last Updated**: November 10, 2025

**IMPORTANT**:
- Credits are NOW stored in **Supabase `iam.orgs.credits`** table (PostgreSQL)
- This document references the legacy `domain-passwords.json` system throughout
- For the CURRENT atomic credit deduction system, see [atomic-credit-charging.md](./atomic-credit-charging.md)
- The concepts (credits vs LLM tokens, conversion ratios, discount) remain accurate

## TL;DR - The Essential Distinction

```
┌─────────────────────────────────────────────────────────────┐
│  CREDITS (Our Currency)                                      │
│  ├─ What: Primary currency stored and used throughout       │
│  ├─ Format: 200 credits (human-readable)                   │
│  ├─ Storage: Supabase iam.orgs.credits (PostgreSQL)        │
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
- ✅ Store credits (200) in Supabase iam.orgs.credits table
- ✅ Work with credits throughout the codebase
- ✅ Convert to LLM tokens ONLY in chargeTokensFromCredits() (1-3 lines)

### The System Architecture

```
1. User has 200 credits stored in Supabase (iam.orgs.credits)
2. User makes API request
3. Claude API returns: { input_tokens: 350, output_tokens: 150 }
4. Calculate total LLM tokens: 350 + 150 = 500 tokens
5. CONVERSION STEP (only here): 500 tokens ÷ 100 = 5 credits
6. Apply discount: 5 × 0.25 = 1.25 credits charged
7. Atomically deduct via Supabase RPC: deduct_credits(org_id, 1.25)
8. Database atomically updates: iam.orgs.credits = 198.75
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

## Model Selection

**Credit users**: DEFAULT_MODEL enforced in UI + backend
**API key users**: Can choose any available model

### Model Cost Estimates

Credit costs vary by model. See `CLAUDE_MODELS` in `lib/models/claude-models.ts` for available models.

### Implementation

**Models** (`lib/models/claude-models.ts`):
See the source file for available models and DEFAULT_MODEL configuration.

**Backend** (`app/api/claude/stream/route.ts`):
```typescript
const effectiveModel = tokenSource === "workspace"
  ? DEFAULT_MODEL  // ENFORCED for credits
  : (userModel || env.CLAUDE_MODEL)
```

**UI** (`components/modals/SettingsModal.tsx`): Dropdown disabled when no API key

**Store** (`lib/stores/llmStore.ts`): Resets to default model when API key cleared

## See Also

- [Atomic Credit Charging](./atomic-credit-charging.md) - Race condition fix, atomic deduction implementation
- [Testing Philosophy](./TESTING_PHILOSOPHY.md) - How to write tests that prove correctness
