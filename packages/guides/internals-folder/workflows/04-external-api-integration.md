# Tool Workflow: External API Integration

## Scenario
User requests: "Integrate [external API service]" (e.g., OpenAI, Stripe, SendGrid)

## Agent Capabilities
<!-- SUPABASE DISABLED: - Backend enablement (supabase--enable) -->
- Secret management (secrets--add_secret)
- Code writing (lov-write, lov-line-replace)
- Dependency management (lov-add-dependency)
- Web search (websearch--web_code_search)

## Decision Tree

```
START: User wants external API integration
│
├─→ IDENTIFICATION PHASE:
│   ├─→ Check: Do I know this API?
│   │   ├─→ Known APIs (OpenAI, Stripe, Replicate, Resend): Use internal knowledge
│   │   └─→ Unknown API: 
│   │       └─→ websearch--web_code_search("API_NAME authentication setup")
│   │
│   ├─→ Check: What type of API?
│   │   ├─→ Requires API key: Need secrets management
│   │   ├─→ Requires OAuth: Need auth flow
│   │   ├─→ Public API: Can call from frontend
│   │   └─→ Webhook-based: Need endpoint setup
│   │
│   └─→ Check: Is there a Lovable integration?
│       ├─→ Stripe: Use stripe--enable_stripe
│       ├─→ OpenAI + want Lovable AI: Check if should use Lovable AI instead
│       └─→ Others: Manual integration
│
├─→ PREREQUISITE SETUP:
│   ├─→ Backend required? (API keys or server-side calls)
│   │   ├─→ Check useful-context: Backend enabled?
<!-- SUPABASE DISABLED: │   │   │   ├─→ NO: supabase--enable() -->
│   │   │   └─→ YES: Continue
│   │   └─→ WAIT for backend ready
│   │
│   ├─→ Dependencies needed?
│   │   └─→ websearch--web_code_search("API_NAME npm package")
│   │       └─→ lov-add-dependency("package-name@version")
│   │
│   └─→ Secrets needed?
│       ├─→ secrets--add_secret(["API_KEY_NAME"])
│       └─→ WAIT for user to add secret
│
├─→ IMPLEMENTATION STRATEGY:
│   ├─→ IF Lovable Integration exists:
│   │   └─→ Use integration tool (e.g., stripe--enable_stripe)
│   │
│   ├─→ IF Simple API (e.g., OpenAI via Lovable AI):
│   │   ├─→ Create edge function
│   │   └─→ Create frontend hook
│   │
│   ├─→ IF Complex API (e.g., OAuth flow):
│   │   ├─→ Create multiple edge functions
│   │   ├─→ Create auth handlers
│   │   ├─→ Create state management
│   │   └─→ Create UI components
│   │
│   └─→ IF Webhook-based API:
│       ├─→ Create webhook receiver edge function
│       ├─→ Create webhook handler logic
│       └─→ Provide webhook URL to user
│
└─→ EXECUTION PHASE:
    ├─→ CREATE EDGE FUNCTION(S):
<!-- SUPABASE DISABLED:     │   └─→ lov-write(supabase/functions/api-name/index.ts) -->
    │
    ├─→ CREATE FRONTEND INTEGRATION:
    │   ├─→ lov-write(src/hooks/useApiName.ts) ||
    │   ├─→ lov-write(src/lib/apiClient.ts) ||
    │   └─→ lov-write(src/components/ApiComponent.tsx)
    │
    └─→ UPDATE CONFIGURATION:
<!-- SUPABASE DISABLED:         └─→ Ensure supabase/config.toml includes function -->
```

## Tool Sequences by API Type

### Type 1: Simple API with Key (e.g., OpenAI)
Request: "Add AI text generation with OpenAI"

```
1. Check: Should use Lovable AI instead?
   ├─→ User wants specific OpenAI features: Use OpenAI
   └─→ Generic AI needs: Suggest Lovable AI
   
2. IF OpenAI:
   3. Check: Backend enabled?
<!-- SUPABASE DISABLED:       ├─→ NO: supabase--enable() -->
      └─→ YES: Continue
   4. secrets--add_secret(["OPENAI_API_KEY"])
   5. WAIT for user confirmation
   6. websearch--web_code_search("OpenAI API node.js latest") IF needed
<!-- SUPABASE DISABLED:    7. lov-write(supabase/functions/generate-text/index.ts) || -->
      lov-write(src/hooks/useTextGeneration.ts) ||
      lov-write(src/components/TextGenerator.tsx)
```

### Type 2: Integrated Service (Stripe)
Request: "Add payment processing with Stripe"

```
1. Check: Backend enabled?
<!-- SUPABASE DISABLED:    ├─→ NO: supabase--enable() -->
   └─→ YES: Continue
2. stripe--enable_stripe()
3. WAIT for Stripe integration complete
4. Follow Stripe-specific implementation from context
5. lov-write(src/components/PricingTable.tsx) ||
   lov-write(src/hooks/useSubscription.ts)
```

### Type 3: OAuth Flow (Google Auth)
Request: "Add Google sign-in"

```
<!-- SUPABASE DISABLED: 1. supabase--enable() if needed -->
<!-- SUPABASE DISABLED: 2. websearch--web_code_search("Supabase Google OAuth setup") -->
3. Provide manual steps:
<!-- SUPABASE DISABLED:    - Enable Google provider in Supabase dashboard -->
   - Get credentials from Google Console
   - Add redirect URLs
4. lov-line-replace(src/contexts/AuthContext.tsx, add-google-signin)
5. lov-line-replace(src/pages/Login.tsx, add-google-button)
```

### Type 4: Webhook Receiver (Stripe webhooks)
Request: "Handle Stripe webhook events"

```
1. secrets--add_secret(["STRIPE_WEBHOOK_SECRET"])
<!-- SUPABASE DISABLED: 2. lov-write(supabase/functions/stripe-webhook/index.ts) -->
3. Set verify_jwt = false in config
4. Provide webhook URL to user:
<!-- SUPABASE DISABLED:    https://PROJECT_REF.supabase.co/functions/v1/stripe-webhook -->
5. lov-write(src/lib/webhookHandlers.ts) IF complex logic needed
```

### Type 5: Complex API (Twilio SMS)
Request: "Send SMS notifications with Twilio"

```
<!-- SUPABASE DISABLED: 1. supabase--enable() if needed -->
2. websearch--web_code_search("Twilio SMS API Node.js")
3. lov-add-dependency("twilio@latest")
4. secrets--add_secret(["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER"])
5. WAIT for secrets
<!-- SUPABASE DISABLED: 6. lov-write(supabase/functions/send-sms/index.ts) || -->
   lov-write(src/hooks/useSMS.ts) ||
   lov-write(src/components/SMSNotificationSettings.tsx)
```

### Type 6: Public API (Weather data)
Request: "Show weather data from OpenWeather"

```
1. Check: API requires key?
   ├─→ YES: Need edge function
<!-- SUPABASE DISABLED:    │   2a. supabase--enable() -->
   │   2b. secrets--add_secret(["OPENWEATHER_API_KEY"])
<!-- SUPABASE DISABLED:    │   2c. lov-write(supabase/functions/weather/index.ts) -->
   └─→ NO: Can call from frontend
       2a. lov-write(src/lib/weatherAPI.ts)
       
3. lov-write(src/hooks/useWeather.ts) ||
   lov-write(src/components/WeatherWidget.tsx)
```

### Type 7: AI Service (Replicate)
Request: "Generate images with Replicate AI"

```
<!-- SUPABASE DISABLED: 1. supabase--enable() if needed -->
2. websearch--web_code_search("Replicate API image generation")
3. secrets--add_secret(["REPLICATE_API_KEY"])
4. lov-add-dependency("replicate@latest")
<!-- SUPABASE DISABLED: 5. lov-write(supabase/functions/generate-image/index.ts) || -->
   lov-write(src/hooks/useImageGeneration.ts) ||
   lov-write(src/components/ImageGenerator.tsx)
```

### Type 8: Email Service (Resend)
Request: "Send transactional emails"

```
<!-- SUPABASE DISABLED: 1. supabase--enable() if needed -->
2. secrets--add_secret(["RESEND_API_KEY"])
3. Inform user: Must verify domain at resend.com/domains
4. lov-add-dependency("resend@latest")
<!-- SUPABASE DISABLED: 5. lov-write(supabase/functions/send-email/index.ts) || -->
   lov-write(src/components/EmailForm.tsx)
```

### Type 9: Unknown API
Request: "Integrate with [NewAPI]"

```
1. websearch--web_code_search("NewAPI authentication setup Node.js")
2. websearch--web_code_search("NewAPI npm package")
3. Analyze search results:
   ├─→ Determine: API key vs OAuth vs other
   ├─→ Determine: npm package available?
   └─→ Determine: Example code patterns
4. Follow appropriate pattern from above
<!-- SUPABASE DISABLED: 5. supabase--enable() if backend needed -->
6. secrets--add_secret([required secrets])
7. lov-add-dependency if package found
8. lov-write(edge function) based on examples
9. lov-write(frontend integration)
```

## Critical Rules

1. **Always use edge functions for API keys** - Never expose secrets in frontend
2. **Backend first** - Enable before creating edge functions
3. **Secrets before implementation** - Wait for user to add keys
4. **Search for unknown APIs** - Don't guess implementation
5. **Parallel creation** - Edge function + frontend code simultaneously
6. **Check for Lovable integrations** - Use built-in tools when available
7. **Webhook functions are public** - Set verify_jwt = false
8. **Provide webhook URLs** - User needs to configure in external service

## Common Mistakes

❌ Exposing API keys in frontend code
❌ Not using edge functions for secret API calls
❌ Creating implementation before secrets are added
❌ Not checking for Lovable integrations (Stripe, Lovable AI)
❌ Forgetting to set verify_jwt = false for webhooks
❌ Not researching unknown APIs before implementing
❌ Sequential writes when parallel is possible
❌ Not providing webhook URL to user
❌ Forgetting to add dependencies for npm packages
