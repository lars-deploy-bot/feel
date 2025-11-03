<!-- SUPABASE DISABLED: # Email Sending with Resend in Supabase -->

## Important Constraint

<!-- SUPABASE DISABLED: **You cannot send emails from frontend code.** Email sending must be implemented in Supabase Edge Functions. -->

## Setup Process

### Step 1: User Account Creation

Instruct the user:
1. Visit https://resend.com
2. Sign up for account (if not already registered)
3. Complete email verification

### Step 2: Domain Validation

**Critical Step**: Domain must be validated before sending emails.

Instruct user to:
1. Navigate to https://resend.com/domains
2. Add and validate their sending domain
3. Complete DNS verification

**Common Error**: Users often forget this step, causing send failures.

### Step 3: API Key Generation

Instruct user to:
1. Visit https://resend.com/api-keys
2. Create new API key
3. Copy key for next step

Request the `RESEND_API_KEY` from user.

## Edge Function Implementation

### Basic Template

```typescript
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  to: string;
  subject: string;
  html: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, subject, html }: EmailRequest = await req.json();

    const emailResponse = await resend.emails.send({
      from: "Your App <onboarding@resend.dev>",
      to: [to],
      subject: subject,
      html: html,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify(emailResponse),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error sending email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
```

### Contact Form Example

```typescript
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ContactRequest {
  name: string;
  email: string;
  message: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name, email, message }: ContactRequest = await req.json();

    // Send confirmation to user
    const userEmail = await resend.emails.send({
      from: "Your Company <noreply@yourdomain.com>",
      to: [email],
      subject: "We received your message!",
      html: `
        <h1>Thank you for contacting us, ${name}!</h1>
        <p>We have received your message and will get back to you soon.</p>
        <p><strong>Your message:</strong></p>
        <p>${message}</p>
        <p>Best regards,<br>Your Company Team</p>
      `,
    });

    // Send notification to admin
    const adminEmail = await resend.emails.send({
      from: "Contact Form <notifications@yourdomain.com>",
      to: ["admin@yourdomain.com"],
      subject: `New contact form submission from ${name}`,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>From:</strong> ${name} (${email})</p>
        <p><strong>Message:</strong></p>
        <p>${message}</p>
      `,
    });

    console.log("Emails sent:", { userEmail, adminEmail });

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in contact form:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
```

## Calling from Frontend

```typescript
const sendEmail = async (to: string, subject: string, html: string) => {
<!-- SUPABASE DISABLED:   const { data, error } = await supabase.functions.invoke('send-email', { -->
    body: { to, subject, html }
  });
  
  if (error) throw error;
  return data;
};

// Usage
await sendEmail(
  'user@example.com',
  'Welcome!',
  '<h1>Welcome to our platform!</h1>'
);
```

## Email Templates

### HTML Email Best Practices

```typescript
const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background-color: #007bff;
      color: white;
      text-decoration: none;
      border-radius: 4px;
      margin: 20px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Welcome!</h1>
    <p>Thank you for signing up.</p>
    <a href="https://yourapp.com/verify" class="button">Verify Email</a>
    <p>If you didn't sign up, please ignore this email.</p>
  </div>
</body>
</html>
`;
```

## Common Use Cases

### Welcome Email
```typescript
await resend.emails.send({
  from: "Welcome <welcome@yourdomain.com>",
  to: [userEmail],
  subject: "Welcome to Our Platform!",
  html: welcomeEmailTemplate(userName),
});
```

### Password Reset
```typescript
await resend.emails.send({
  from: "Security <security@yourdomain.com>",
  to: [userEmail],
  subject: "Reset Your Password",
  html: passwordResetTemplate(resetToken),
});
```

### Transaction Receipt
```typescript
await resend.emails.send({
  from: "Receipts <receipts@yourdomain.com>",
  to: [userEmail],
  subject: "Your Receipt #12345",
  html: receiptTemplate(orderData),
});
```

### Weekly Digest
```typescript
await resend.emails.send({
  from: "Newsletter <newsletter@yourdomain.com>",
  to: [userEmail],
  subject: "Your Weekly Update",
  html: digestTemplate(contentData),
});
```

## Error Handling

### Common Errors

```typescript
try {
  await resend.emails.send({...});
} catch (error) {
  if (error.message.includes('API key')) {
    // Invalid or missing API key
    console.error('Resend API key issue');
  } else if (error.message.includes('domain')) {
    // Domain not verified
    console.error('Domain verification required');
  } else if (error.message.includes('rate limit')) {
    // Rate limit exceeded
    console.error('Too many requests');
  } else {
    console.error('Unknown error:', error);
  }
}
```

## Testing

### Test Email Function

```typescript
// Test endpoint
if (req.url.includes('/test')) {
  const testEmail = await resend.emails.send({
    from: "Test <test@yourdomain.com>",
    to: ["test@example.com"],
    subject: "Test Email",
    html: "<p>This is a test email</p>",
  });
  
  return new Response(JSON.stringify(testEmail), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
```

## Rate Limits

Resend has rate limits:
- **Free tier**: 100 emails/day
- **Paid tier**: Higher limits based on plan

Implement queueing for high-volume sending:
```typescript
// Consider batching or queue system for bulk emails
const sendBatch = async (emails: string[]) => {
  const batchSize = 10;
  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);
    await Promise.all(batch.map(sendEmail));
    await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
  }
};
```

## Best Practices

### 1. From Address
Use descriptive, branded sender addresses:
```typescript
from: "Your Company <notifications@yourdomain.com>"
```

### 2. Subject Lines
Keep under 50 characters, be specific and actionable.

### 3. HTML Validation
Test emails across multiple clients (Gmail, Outlook, Apple Mail).

### 4. Plain Text Alternative
Always provide plain text version:
```typescript
await resend.emails.send({
  from: "...",
  to: [...],
  subject: "...",
  html: htmlContent,
  text: plainTextContent, // Fallback for non-HTML clients
});
```

### 5. Unsubscribe Links
Include for marketing emails:
```html
<a href="https://yourapp.com/unsubscribe?token={{token}}">Unsubscribe</a>
```

### 6. Logging
Log email sends for audit trail:
```typescript
console.log('Email sent:', {
  to: email,
  subject: subject,
  timestamp: new Date().toISOString(),
  messageId: response.id
});
```

---

**Important**: Always verify domain in Resend dashboard before attempting to send emails. This is the most common cause of send failures.
