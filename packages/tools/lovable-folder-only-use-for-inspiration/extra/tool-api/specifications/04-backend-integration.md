# Backend Integration Tools

6 tools for enabling backend services and managing secrets.

---

## `supabase--enable`

Enable Lovable Cloud backend (Supabase under the hood). **REQUIRED** before any backend functionality.

**Signature:**
```typescript
supabase--enable(): void
```

**Parameters:** None

**Returns:** Success message and setup instructions

**Usage:**
```typescript
// Enable backend for the first time
supabase--enable()

// This provisions:
// - PostgreSQL database
// - Authentication system
// - File storage
// - Edge functions runtime
// - Realtime subscriptions
```

**When to Enable:**
User requests:
- Authentication (login/signup)
- Database/data persistence
- API endpoints
- File uploads/storage
- Backend logic with secrets
- Server-side email sending
- Scheduled tasks

**After Enabling:**
```typescript
// You gain access to:
// - Database tables (create via UI or migrations)
// - Auth system (email, password, OAuth)
// - Storage buckets
// - Edge functions (serverless API endpoints)
// - Secrets management
// - Realtime subscriptions
```

**Critical Rules:**
- ✅ Enable BEFORE implementing any backend features
- ✅ Auto-provisions everything - no external accounts needed
- ✅ User instructions appear in chat after enabling
- ❌ Cannot implement auth/database without this
- ✅ Free tier includes generous usage limits

**Follow-up Actions:**
After enabling, show users:
```markdown
Cloud is now active! You can now:
- Create database tables
- Add user authentication
- Store files
- Run backend code

<lov-actions>
<lov-link url="https://docs.lovable.dev/features/cloud">Read Cloud docs</lov-link>
</lov-actions>
```

---

## `secrets--fetch_secrets`

List all configured secrets (names only, not values).

**Signature:**
```typescript
secrets--fetch_secrets(): string[]
```

**Parameters:** None

**Returns:** Array of secret names (values hidden for security)

**Usage:**
```typescript
// Check what secrets are configured
secrets--fetch_secrets()

// Returns:
// [
//   "OPENAI_API_KEY",
//   "STRIPE_SECRET_KEY", 
//   "RESEND_API_KEY",
//   "LOVABLE_API_KEY (cannot be deleted)"
// ]
```

**Output Format:**
- Secret names only (no values)
- Indicates which secrets cannot be deleted (platform-managed)
- Shows user-created vs system secrets

**Critical Rules:**
- ✅ **ALWAYS** check existing secrets before adding new ones
- ✅ Use to verify required secrets exist before implementation
- ✅ Cannot see secret values (security)
- ✅ `LOVABLE_API_KEY` auto-provisioned (cannot be deleted)

---

## `secrets--add_secret`

Add new secrets (API keys, tokens). Opens secure form for user input.

**Signature:**
```typescript
secrets--add_secret(secret_names: string[]): void
```

**Parameters:**
- `secret_names` (required): Array of secret names to add
  - Convention: `SCREAMING_SNAKE_CASE`
  - Examples: `["OPENAI_API_KEY"]`, `["STRIPE_SECRET_KEY", "STRIPE_PUBLISHABLE_KEY"]`

**Returns:** Secure form for user to input values

**Usage:**
```typescript
// Add single secret
secrets--add_secret(["OPENAI_API_KEY"])

// Add multiple secrets at once (preferred)
secrets--add_secret([
  "STRIPE_SECRET_KEY",
  "STRIPE_PUBLISHABLE_KEY",
  "STRIPE_WEBHOOK_SECRET"
])

// Add email service key
secrets--add_secret(["RESEND_API_KEY"])

// Add external API key
secrets--add_secret(["REPLICATE_API_TOKEN"])
```

**Process:**
1. Tool displays secure input form in chat
2. User enters secret value(s) in form
3. User clicks "Add" to confirm
4. Secrets encrypted and stored in Supabase
5. Available as `Deno.env.get("SECRET_NAME")` in edge functions

**Critical Rules:**
- ❌ **NEVER** ask user to paste secrets in chat (insecure)
- ✅ **ALWAYS** use this tool to collect secrets
- ✅ Check existing secrets first with `secrets--fetch_secrets()`
- ✅ Batch multiple secrets in one call (better UX)
- ✅ Secrets automatically available in all edge functions
- ❌ **NEVER** hardcode secrets in code

**Common Secrets:**
```typescript
// OpenAI
secrets--add_secret(["OPENAI_API_KEY"])

// Stripe payments
secrets--add_secret([
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET"
])

// Email (Resend)
secrets--add_secret(["RESEND_API_KEY"])

// AI services
secrets--add_secret(["REPLICATE_API_TOKEN"])
secrets--add_secret(["ANTHROPIC_API_KEY"])

// External APIs
secrets--add_secret(["GOOGLE_MAPS_API_KEY"])
secrets--add_secret(["SENDGRID_API_KEY"])
```

---

## `secrets--update_secret`

Update existing secret values. Opens secure form for new value input.

**Signature:**
```typescript
secrets--update_secret(secret_names: string[]): void
```

**Parameters:**
- `secret_names` (required): Array of secret names to update

**Returns:** Secure form for user to input new values

**Usage:**
```typescript
// Update single secret
secrets--update_secret(["OPENAI_API_KEY"])

// Update multiple secrets
secrets--update_secret([
  "STRIPE_SECRET_KEY",
  "STRIPE_PUBLISHABLE_KEY"
])

// Rotate API key
secrets--update_secret(["EXTERNAL_API_KEY"])
```

**Process:**
1. Tool displays secure input form
2. User enters new value(s)
3. User clicks "Update" to confirm
4. New values encrypted and stored
5. Immediately available in edge functions

**Critical Rules:**
- ✅ Use when API keys need rotation
- ✅ Use when switching to production keys from test keys
- ✅ User must confirm update in secure form
- ❌ Cannot see current value (security)
- ✅ Update takes effect immediately

---

## `secrets--delete_secret`

Delete user-created secrets. **CANNOT** delete system secrets.

**Signature:**
```typescript
secrets--delete_secret(secret_names: string[]): void
```

**Parameters:**
- `secret_names` (required): Array of secret names to delete

**Returns:** Confirmation prompt for user

**Usage:**
```typescript
// Delete single secret
secrets--delete_secret(["OLD_API_KEY"])

// Delete multiple secrets
secrets--delete_secret([
  "DEPRECATED_KEY",
  "UNUSED_TOKEN"
])

// Clean up after removing integration
secrets--delete_secret([
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET"
])
```

**Process:**
1. Tool displays confirmation prompt
2. User clicks "Delete" to confirm
3. Secrets permanently removed
4. No longer available in edge functions

**Critical Rules:**
- ✅ Check with `secrets--fetch_secrets()` first
- ❌ **CANNOT** delete system secrets:
  - `LOVABLE_API_KEY` (auto-provisioned)
  - `SUPABASE_*` secrets (platform-managed)
- ✅ **ONLY** deletes user-created secrets
- ⚠️ Deletion is permanent
- ✅ User must confirm in UI

---

## `stripe--enable_stripe`

Enable Stripe payment integration. Prompts for Stripe secret key.

**Signature:**
```typescript
stripe--enable_stripe(): void
```

**Parameters:** None

**Returns:** Secure form for Stripe secret key input

**Usage:**
```typescript
// Enable Stripe
stripe--enable_stripe()

// User prompted for:
// - STRIPE_SECRET_KEY (from Stripe dashboard)
```

**Process:**
1. Tool opens Stripe setup dialog
2. User enters Stripe secret key
3. Key stored as `STRIPE_SECRET_KEY` secret
4. Ready for payment implementation

**After Enabling:**
```typescript
// In edge functions:
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

// Create payment intent
const paymentIntent = await stripe.paymentIntents.create({
  amount: 2000,
  currency: 'usd',
});
```

**Critical Rules:**
- ✅ Lovable Cloud must be enabled first
- ✅ User needs Stripe account (free to create)
- ✅ Get keys from: https://dashboard.stripe.com/apikeys
- ✅ Use test keys for development
- ✅ Switch to live keys for production

---

## `shopify--enable_shopify`

Enable Shopify integration. User chooses new store or existing connection.

**Signature:**
```typescript
shopify--enable_shopify(): void
```

**Parameters:** None

**Returns:** Shopify setup dialog

**Usage:**
```typescript
// Enable Shopify
shopify--enable_shopify()

// User chooses:
// - Create new Shopify store
// - Connect existing store
```

**Process:**
1. Tool opens Shopify setup dialog
2. User selects option (new vs existing)
3. Credentials stored as secrets
4. Ready for Shopify API usage

**After Enabling:**
```typescript
// In edge functions:
// Access Shopify API
// Credentials automatically available
```

**Critical Rules:**
- ✅ Lovable Cloud must be enabled first
- ✅ User needs Shopify account (paid)
- ✅ Provides access to Shopify Admin API
- ✅ Useful for e-commerce applications

---

## Workflow Patterns

**Check → Add → Use:**
```typescript
// 1. Check existing secrets
secrets--fetch_secrets()

// 2. Add missing secrets
secrets--add_secret(["OPENAI_API_KEY"])

// 3. Use in edge function
const key = Deno.env.get('OPENAI_API_KEY');
```

**Integration setup:**
```typescript
// 1. Enable backend
supabase--enable()

// 2. Enable specific integration
stripe--enable_stripe()

// 3. Implement payment flow
```

**Secret rotation:**
```typescript
// 1. Verify secret exists
secrets--fetch_secrets()

// 2. Update with new value
secrets--update_secret(["API_KEY"])

// 3. Test in edge function
```

**Cleanup:**
```typescript
// 1. Remove code using secret
// 2. Delete secret
secrets--delete_secret(["UNUSED_API_KEY"])
```
