# Email Patterns - Sending Emails with Resend

**Category:** External Integration  
**Priority:** MEDIUM  
**Last Updated:** 2025-10-28

---

## Email Overview

Lovable supports sending emails using the Resend API through edge functions. This is useful for:
- Welcome emails
- Password reset emails
- Notifications
- Receipts and invoices
- Marketing emails

---

## Setting Up Resend

### Step 1: Get Resend API Key

1. Sign up at [resend.com](https://resend.com)
2. Get your API key from the dashboard
3. Add it as a secret in Lovable Cloud

### Step 2: Add Secret

Use the secrets tool to add `RESEND_API_KEY`:

```typescript
// Agent will invoke:
secrets--add_secret({ secret_names: ["RESEND_API_KEY"] })
```

---

## Basic Email Sending

### Edge Function Pattern

**File:** `supabase/functions/send-email/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, subject, html } = await req.json();

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY not configured');
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Your App <noreply@yourdomain.com>',
        to: [to],
        subject: subject,
        html: html,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Resend API error: ${error}`);
    }

    const data = await response.json();
    console.log('Email sent:', data.id);

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Email error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
```

---

### Calling from Frontend

```typescript
const sendEmail = async (to: string, subject: string, html: string) => {
  const { data, error } = await supabase.functions.invoke('send-email', {
    body: { to, subject, html }
  });

  if (error) {
    console.error('Failed to send email:', error);
    throw error;
  }

  return data;
};

// Usage
await sendEmail(
  'user@example.com',
  'Welcome to our app!',
  '<h1>Welcome!</h1><p>Thanks for signing up.</p>'
);
```

---

## Email Templates

### Pattern 1: Welcome Email

```typescript
const sendWelcomeEmail = async (userEmail: string, userName: string) => {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .button { 
            display: inline-block;
            padding: 12px 24px;
            background: #4F46E5;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Our App!</h1>
          </div>
          <div class="content">
            <p>Hi ${userName},</p>
            <p>Thank you for signing up! We're excited to have you on board.</p>
            <p>
              <a href="https://yourapp.com/dashboard" class="button">
                Get Started
              </a>
            </p>
            <p>If you have any questions, feel free to reach out to our support team.</p>
            <p>Best regards,<br>The Team</p>
          </div>
        </div>
      </body>
    </html>
  `;

  await supabase.functions.invoke('send-email', {
    body: {
      to: userEmail,
      subject: 'Welcome to Our App!',
      html: html
    }
  });
};
```

---

### Pattern 2: Password Reset Email

```typescript
const sendPasswordResetEmail = async (userEmail: string, resetToken: string) => {
  const resetUrl = `https://yourapp.com/reset-password?token=${resetToken}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <body style="font-family: Arial, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>Password Reset Request</h2>
          <p>We received a request to reset your password.</p>
          <p>Click the button below to reset your password:</p>
          <p>
            <a href="${resetUrl}" 
               style="display: inline-block; padding: 12px 24px; background: #4F46E5; 
                      color: white; text-decoration: none; border-radius: 5px;">
              Reset Password
            </a>
          </p>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request this, please ignore this email.</p>
        </div>
      </body>
    </html>
  `;

  await supabase.functions.invoke('send-email', {
    body: {
      to: userEmail,
      subject: 'Reset Your Password',
      html: html
    }
  });
};
```

---

### Pattern 3: Notification Email

```typescript
const sendNotificationEmail = async (
  userEmail: string,
  title: string,
  message: string,
  actionUrl?: string
) => {
  const html = `
    <!DOCTYPE html>
    <html>
      <body style="font-family: Arial, sans-serif; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #4F46E5;">${title}</h2>
          <p>${message}</p>
          ${actionUrl ? `
            <p>
              <a href="${actionUrl}" 
                 style="display: inline-block; padding: 12px 24px; background: #4F46E5; 
                        color: white; text-decoration: none; border-radius: 5px;">
                View Details
              </a>
            </p>
          ` : ''}
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
          <p style="font-size: 12px; color: #666;">
            You're receiving this email because you're subscribed to notifications.
            <a href="https://yourapp.com/settings">Manage preferences</a>
          </p>
        </div>
      </body>
    </html>
  `;

  await supabase.functions.invoke('send-email', {
    body: {
      to: userEmail,
      subject: title,
      html: html
    }
  });
};
```

---

## Advanced Patterns

### Pattern 4: Batch Email Sending

```typescript
// Edge function
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { recipients, subject, html } = await req.json();

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY not configured');
    }

    // Send to multiple recipients
    const promises = recipients.map((email: string) =>
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'Your App <noreply@yourdomain.com>',
          to: [email],
          subject: subject,
          html: html,
        }),
      })
    );

    const results = await Promise.allSettled(promises);
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    return new Response(
      JSON.stringify({ successful, failed, total: recipients.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Batch email error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

---

### Pattern 5: Email with Attachments

```typescript
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, subject, html, attachments } = await req.json();

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Your App <noreply@yourdomain.com>',
        to: [to],
        subject: subject,
        html: html,
        attachments: attachments || [],  // [{ filename: 'file.pdf', content: 'base64string' }]
      }),
    });

    const data = await response.json();

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

---

## Triggering Emails

### On User Signup

```typescript
// In auth trigger or signup flow
const handleSignup = async (email: string, name: string) => {
  // Create user account
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name }
    }
  });

  if (error) throw error;

  // Send welcome email
  await supabase.functions.invoke('send-email', {
    body: {
      to: email,
      subject: 'Welcome!',
      html: `<h1>Welcome ${name}!</h1>`
    }
  });
};
```

---

### On Order Confirmation

```typescript
const sendOrderConfirmation = async (orderId: string, userEmail: string) => {
  // Fetch order details
  const { data: order } = await supabase
    .from('orders')
    .select('*, items(*)')
    .eq('id', orderId)
    .single();

  const html = `
    <h2>Order Confirmation</h2>
    <p>Thank you for your order!</p>
    <p>Order ID: ${order.id}</p>
    <p>Total: $${order.total}</p>
    <h3>Items:</h3>
    <ul>
      ${order.items.map((item: any) => `
        <li>${item.name} - $${item.price}</li>
      `).join('')}
    </ul>
  `;

  await supabase.functions.invoke('send-email', {
    body: {
      to: userEmail,
      subject: `Order Confirmation - ${order.id}`,
      html: html
    }
  });
};
```

---

## Best Practices

### 1. Validate Email Addresses

```typescript
const isValidEmail = (email: string) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

// In edge function
if (!isValidEmail(to)) {
  throw new Error('Invalid email address');
}
```

---

### 2. Use Environment-Specific From Addresses

```typescript
const getFromAddress = () => {
  const env = Deno.env.get('ENVIRONMENT') || 'development';
  
  if (env === 'production') {
    return 'noreply@yourdomain.com';
  }
  
  return 'dev@yourdomain.com';
};
```

---

### 3. Handle Rate Limits

```typescript
// Add retry logic
const sendWithRetry = async (emailData: any, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify(emailData),
      });

      if (response.ok) {
        return await response.json();
      }

      if (response.status === 429) {
        // Rate limited - wait and retry
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        continue;
      }

      throw new Error(`API error: ${response.status}`);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
    }
  }
};
```

---

### 4. Log Email Sends

```typescript
// Create emails table
create table public.email_logs (
  id uuid primary key default gen_random_uuid(),
  to_address text not null,
  subject text not null,
  sent_at timestamp with time zone default now(),
  resend_id text,
  status text default 'sent',
  error text
);

// In edge function
await supabase.from('email_logs').insert({
  to_address: to,
  subject: subject,
  resend_id: data.id,
  status: 'sent'
});
```

---

### 5. Use Templates for Consistency

```typescript
const generateEmailTemplate = (
  title: string,
  content: string,
  ctaText?: string,
  ctaUrl?: string
) => {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          /* Shared styles */
          body { font-family: Arial, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>${title}</h1>
          <div>${content}</div>
          ${ctaText && ctaUrl ? `
            <a href="${ctaUrl}" class="button">${ctaText}</a>
          ` : ''}
        </div>
      </body>
    </html>
  `;
};
```

---

## Common Issues

### Issue 1: "Domain not verified"

**Problem:** Emails fail to send

**Solution:**
1. Verify your domain in Resend dashboard
2. Add DNS records as instructed
3. Wait for verification to complete

---

### Issue 2: Emails Go to Spam

**Solutions:**
1. Set up SPF, DKIM, and DMARC records
2. Use a verified domain
3. Include unsubscribe link
4. Avoid spam trigger words in subject

---

### Issue 3: Rate Limiting

**Problem:** Too many emails sent too quickly

**Solutions:**
1. Implement retry logic with exponential backoff
2. Queue emails for batch processing
3. Upgrade Resend plan if needed

---

## Related Documentation

- [Edge Function Patterns](./04-edge-function-patterns.md)
- [Security Critical Rules](./06-security-critical-rules.md)
- [Lovable Cloud](./01-lovable-cloud.md)
