# OpenAI Image Generation in Edge Functions

## API Endpoint

```
POST https://api.openai.com/v1/images/generations
```

## Model Selection

Always use **gpt-image-1** (most powerful):
- 32,000 character prompts
- High detail and control
- Multiple output formats
- Transparent backgrounds

## Implementation Example

```typescript
const response = await fetch('https://api.openai.com/v1/images/generations', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${OPENAI_API_KEY}`
  },
  body: JSON.stringify({
    model: 'gpt-image-1',
    prompt: 'a white siamese cat',
    n: 1,
    size: '1024x1024',
    quality: 'high',
    output_format: 'png'
  })
});
```

## Key Parameters

- **model**: 'gpt-image-1' (recommended)
- **quality**: 'high', 'medium', 'low', 'auto'
- **output_format**: 'png', 'jpeg', 'webp'
- **background**: 'transparent', 'opaque', 'auto'
- **size**: '1024x1024', '1536x1024', '1024x1536'
- **output_compression**: 0-100 (webp/jpeg only)

---

<!-- SUPABASE DISABLED: **Remember**: Tell users to add OPENAI_API_KEY to Supabase secrets. -->
