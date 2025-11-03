# Input Validation Security

## Critical Security Rule

**All user inputs must be validated both client-side and server-side** to prevent injection attacks and data corruption.

## Schema Validation with Zod

```typescript
import { z } from 'zod';

const contactSchema = z.object({
  name: z.string()
    .trim()
    .min(1, "Name required")
    .max(100, "Name too long"),
  email: z.string()
    .trim()
    .email("Invalid email")
    .max(255, "Email too long"),
  message: z.string()
    .trim()
    .min(1, "Message required")
    .max(1000, "Message too long")
});

// Usage
try {
  const validated = contactSchema.parse(userInput);
  // Use validated data
} catch (error) {
  // Handle validation errors
}
```

## Security Checklist

### Form Validation
- ✅ Client-side validation with error messages
- ✅ Input length limits
- ✅ Character restrictions
- ✅ Proper encoding for external APIs
- ✅ No logging of sensitive data

### External API Calls
- Never pass unvalidated input to URLs
- Always use `encodeURIComponent()` for URL parameters
- Implement length limits
- Restrict allowed characters

### HTML Content
- Never use `dangerouslySetInnerHTML` with user content
- Use DOMPurify if HTML rendering required
- Validate CSS values for custom styling

---

**Key Principle**: Never trust user input. Validate everything.
