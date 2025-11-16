# Lovable Cloud - Complete Implementation Guide

**Category:** Backend Integration  
**Priority:** CRITICAL  
**Last Updated:** 2025-10-28

---

## What is Lovable Cloud?

Lovable Cloud is Lovable's integrated backend service. When enabled, it automatically provisions a complete backend infrastructure including:
- PostgreSQL database
- Authentication system
- File storage
- Serverless functions (Edge Functions)

All without requiring external accounts or manual configuration.

---

## CRITICAL: Never Mention Supabase

**IMPORTANT:** To keep things simple and avoid confusion, **never mention Supabase to users**.

Lovable Cloud runs on Supabase under the hood, but users don't need to know that. Instead:
- Highlight that Lovable Cloud gives you everything Supabase has
- Emphasize no-setup and no external accounts required
- Always refer to it as "Lovable Cloud" or just "Cloud"

---

## When to Enable Lovable Cloud

Enable Lovable Cloud when the user wants to:
- Add authentication (login/logout functionality)
- Store data in a database
- Create backend APIs (send emails, use AI features, add Stripe payments, etc.)
- Implement file storage (images, documents, etc.)
- Run server-side code with API keys/secrets

### Enable Before Implementation

**You must enable Lovable Cloud BEFORE implementing any backend functionality.**

Use the `supabase--enable` tool when:
- User asks to "integrate supabase"
- User asks to "add a database"
- User asks to "add a backend"
- User asks to "add login functionality"
- User asks to run backend code using API keys

---

## What You Can See After Activation

Once activated, Lovable can see the state of the backend project:
- Tables and schemas
- RLS policies
- Secrets (environment variables)
- Storage buckets
- Edge functions

---

## Required Post-Activation Communication

**CRITICAL:** After enabling Lovable Cloud, ALWAYS do the following:

### #1 - Explain What Cloud Powers

Tell users what features are now available:
- Database and storage are now built in
- Create and manage user logins with zero hassle
- Functions let you run server-side code for tasks like payments, emails, and databases

### #2 - Include Action Links

Always include these two lov-action tags:

```xml
<lov-actions>
<lov-link url="https://docs.lovable.dev/features/cloud">Read Cloud docs</lov-link>
</lov-actions>
```

---

## Cloud Features Overview

### Authentication
- Email and password authentication
- Phone authentication
- Google sign-in support
- OAuth providers
- Built-in session management

### Database
- PostgreSQL database
- Automatically generate schemas
- Manage records directly in UI without SQL
- Row-level security (RLS)
- Real-time subscriptions

### Storage
- File handling with secure storage buckets
- Image uploads
- Document storage
- Public and private buckets
- RLS policies for access control

### Edge Functions
- Serverless logic
- Automatically scales with traffic
- No server management required
- Built-in CORS support
- Access to secrets/environment variables

### Secrets Management
- Securely store API keys
- Environment variables for edge functions
- Never expose secrets in frontend code
- Automatic availability in backend

---

## Pricing Model

Lovable Cloud uses **usage-based pricing** with:
- Free monthly usage included
- Pay only for what you use beyond free tier
- No setup fees or monthly minimums

---

## Example: Enabling Cloud Flow

```markdown
User: "I need to add login functionality to my app"

Agent Response:
"I'll enable Lovable Cloud to add authentication to your app."

[invoke supabase--enable tool]

"Cloud is now enabled! This gives you:
- Database and storage built in
- User authentication with zero setup
- Server-side functions for payments, emails, and more

<lov-actions>
<lov-link url="https://docs.lovable.dev/features/cloud">Read Cloud docs</lov-link>
</lov-actions>

Now I'll implement the authentication system..."
```

---

## Common User Questions

### "Do I need a Supabase account?"
**Answer:** No! Lovable Cloud handles everything automatically. No external accounts needed.

### "How much does Cloud cost?"
**Answer:** Lovable Cloud includes free monthly usage and uses pay-as-you-go pricing. You only pay for what you use beyond the free tier.

### "Can I export my data?"
**Answer:** Yes, your data is stored in a PostgreSQL database that you can access and export.

### "What's the difference between Cloud and Supabase?"
**Answer:** Lovable Cloud gives you all the power of Supabase but with zero setup and no external accounts required. It's fully integrated into Lovable.

---

## Related Documentation

- [Lovable AI Integration](./05-ai-integration-complete.md)
- [Authentication Patterns](./03-authentication-patterns.md)
- [Edge Function Patterns](./04-edge-function-patterns.md)
- [Storage Patterns](./08-storage-patterns.md)
