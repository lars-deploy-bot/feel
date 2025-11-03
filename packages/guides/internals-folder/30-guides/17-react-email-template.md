<!-- SUPABASE DISABLED: # React Email Templates in Supabase Edge Functions -->

## Overview

React Email allows you to create email templates using React components, providing type safety, component reusability, and modern development workflow.

## Template Creation

### Directory Structure

```
<!-- SUPABASE DISABLED: supabase/ -->
  └── functions/
      └── send-email/
          ├── index.ts
          └── _templates/
              ├── magic-link.tsx
              ├── welcome.tsx
              └── notification.tsx
```

### Example Template

```typescript
<!-- SUPABASE DISABLED: // supabase/functions/send-email/_templates/magic-link.tsx -->

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'

interface MagicLinkEmailProps {
<!-- SUPABASE DISABLED:   supabase_url: string -->
  email_action_type: string
  redirect_to: string
  token_hash: string
  token: string
}

export const MagicLinkEmail = ({
  token,
<!-- SUPABASE DISABLED:   supabase_url, -->
  email_action_type,
  redirect_to,
  token_hash,
}: MagicLinkEmailProps) => (
  <Html>
    <Head />
    <Preview>Log in with this magic link</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Login</Heading>
        <Link
<!-- SUPABASE DISABLED:           href={`${supabase_url}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to}`} -->
          target="_blank"
          style={{
            ...link,
            display: 'block',
            marginBottom: '16px',
          }}
        >
          Click here to log in with this magic link
        </Link>
        <Text style={{ ...text, marginBottom: '14px' }}>
          Or, copy and paste this temporary login code:
        </Text>
        <code style={code}>{token}</code>
        <Text
          style={{
            ...text,
            color: '#ababab',
            marginTop: '14px',
            marginBottom: '16px',
          }}
        >
          If you didn&apos;t try to login, you can safely ignore this email.
        </Text>
        <Text style={footer}>
          <Link
            href="https://yourcompany.com"
            target="_blank"
            style={{ ...link, color: '#898989' }}
          >
            Your Company
          </Link>
          , building amazing products.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

// Styles
const main = {
  backgroundColor: '#ffffff',
}

const container = {
  paddingLeft: '12px',
  paddingRight: '12px',
  margin: '0 auto',
}

const h1 = {
  color: '#333',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '40px 0',
  padding: '0',
}

const link = {
  color: '#2754C5',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
  fontSize: '14px',
  textDecoration: 'underline',
}

const text = {
  color: '#333',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
  fontSize: '14px',
  margin: '24px 0',
}

const footer = {
  color: '#898989',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
  fontSize: '12px',
  lineHeight: '22px',
  marginTop: '12px',
  marginBottom: '24px',
}

const code = {
  display: 'inline-block',
  padding: '16px 4.5%',
  width: '90.5%',
  backgroundColor: '#f4f4f4',
  borderRadius: '5px',
  border: '1px solid #eee',
  color: '#333',
}
```

## Edge Function Implementation

```typescript
<!-- SUPABASE DISABLED: // supabase/functions/send-email/index.ts -->

import React from 'npm:react@18.3.1'
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0'
import { Resend } from 'npm:resend@4.0.0'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { MagicLinkEmail } from './_templates/magic-link.tsx'

const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string)
const hookSecret = Deno.env.get('SEND_EMAIL_HOOK_SECRET') as string

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('not allowed', { status: 400 })
  }

  const payload = await req.text()
  const headers = Object.fromEntries(req.headers)
  const wh = new Webhook(hookSecret)
  
  try {
    const {
      user,
      email_data: { token, token_hash, redirect_to, email_action_type },
    } = wh.verify(payload, headers) as {
      user: {
        email: string
      }
      email_data: {
        token: string
        token_hash: string
        redirect_to: string
        email_action_type: string
        site_url: string
        token_new: string
        token_hash_new: string
      }
    }

    // Render React component to HTML
    const html = await renderAsync(
      React.createElement(MagicLinkEmail, {
<!-- SUPABASE DISABLED:         supabase_url: Deno.env.get('SUPABASE_URL') ?? '', -->
        token,
        token_hash,
        redirect_to,
        email_action_type,
      })
    )

    // Send email with rendered HTML
    const { error } = await resend.emails.send({
      from: 'Your App <onboarding@resend.dev>',
      to: [user.email],
      subject: 'Your Magic Link',
      html,
    })
    
    if (error) {
      throw error
    }
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
    
  } catch (error) {
    console.log(error)
    return new Response(
      JSON.stringify({
        error: {
          http_code: error.code,
          message: error.message,
        },
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
})
```

## Additional Template Examples

### Welcome Email Template

```typescript
// _templates/welcome.tsx

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'

interface WelcomeEmailProps {
  userName: string
  verificationUrl: string
}

export const WelcomeEmail = ({
  userName,
  verificationUrl,
}: WelcomeEmailProps) => (
  <Html>
    <Head />
    <Preview>Welcome to our platform!</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Welcome {userName}!</Heading>
        <Text style={text}>
          We're excited to have you on board. To get started, please verify your email address.
        </Text>
        <Section style={buttonContainer}>
          <Button style={button} href={verificationUrl}>
            Verify Email
          </Button>
        </Section>
        <Text style={text}>
          If you didn't create an account, you can safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
}

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
}

const h1 = {
  color: '#333',
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '40px 0',
  padding: '0',
}

const text = {
  color: '#333',
  fontSize: '16px',
  lineHeight: '26px',
}

const buttonContainer = {
  padding: '27px 0',
}

const button = {
  backgroundColor: '#5469d4',
  borderRadius: '4px',
  color: '#fff',
  fontSize: '16px',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'block',
  width: '100%',
  padding: '12px',
}
```

### Notification Template

```typescript
// _templates/notification.tsx

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
  Section,
} from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'

interface NotificationEmailProps {
  title: string
  message: string
  actionUrl?: string
}

export const NotificationEmail = ({
  title,
  message,
  actionUrl,
}: NotificationEmailProps) => (
  <Html>
    <Head />
    <Preview>{title}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h2}>{title}</Heading>
        <Text style={text}>{message}</Text>
        {actionUrl && (
          <Section style={buttonSection}>
            <a href={actionUrl} style={button}>
              View Details
            </a>
          </Section>
        )}
      </Container>
    </Body>
  </Html>
)

const main = {
  backgroundColor: '#ffffff',
}

const container = {
  margin: '0 auto',
  padding: '20px',
}

const h2 = {
  color: '#333',
  fontSize: '20px',
  fontWeight: 'bold',
}

const text = {
  color: '#333',
  fontSize: '14px',
  lineHeight: '24px',
}

const buttonSection = {
  margin: '20px 0',
}

const button = {
  backgroundColor: '#007bff',
  color: '#ffffff',
  padding: '12px 20px',
  borderRadius: '4px',
  textDecoration: 'none',
  display: 'inline-block',
}
```

## Using Templates in Edge Function

```typescript
import { WelcomeEmail } from './_templates/welcome.tsx'
import { NotificationEmail } from './_templates/notification.tsx'

// Render welcome email
const welcomeHtml = await renderAsync(
  React.createElement(WelcomeEmail, {
    userName: 'John Doe',
    verificationUrl: 'https://app.com/verify?token=abc123'
  })
)

// Render notification email
const notificationHtml = await renderAsync(
  React.createElement(NotificationEmail, {
    title: 'New Message',
    message: 'You have received a new message.',
    actionUrl: 'https://app.com/messages'
  })
)
```

## Best Practices

### 1. Component Reusability
Create shared components:
```typescript
// _templates/components/Button.tsx
export const EmailButton = ({ href, text }) => (
  <Link href={href} style={buttonStyle}>
    {text}
  </Link>
)
```

### 2. Type Safety
Define prop interfaces:
```typescript
interface EmailProps {
  userName: string
  actionUrl: string
  expiresAt: Date
}
```

### 3. Inline Styles
Always use inline styles for email compatibility:
```typescript
const style = {
  color: '#333',
  fontSize: '16px',
}
```

### 4. Test Across Clients
Test rendered emails in:
- Gmail
- Outlook
- Apple Mail
- Mobile clients

### 5. Preview Text
Always include preview text:
```typescript
<Preview>This appears in inbox preview</Preview>
```

---

**Advantage**: React Email provides type safety, component reusability, and modern development experience while ensuring email client compatibility.
