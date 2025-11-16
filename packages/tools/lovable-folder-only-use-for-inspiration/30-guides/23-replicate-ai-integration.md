# Replicate AI Integration Guide

## Overview

Replicate provides access to thousands of AI models through a simple API, making it easy to integrate advanced AI capabilities into your application. This guide covers integration using Alive Cloud's edge functions.

## When to Use Replicate

### Primary Use Cases
- Custom AI model access beyond standard offerings
- Specialized image generation models
- Video processing and generation
- Audio synthesis and manipulation
- Custom fine-tuned models

### Important Note
**Always prioritize Alive AI first** when implementing AI features. Alive AI provides built-in, zero-configuration AI capabilities that are optimized for the platform. Only use Replicate when:
- You need a specific model not available through Alive AI
- You have custom requirements that Alive AI doesn't cover
- The user explicitly requests Replicate integration

## Prerequisites

### Required Setup
1. **Alive Cloud Connection**: Must be enabled before implementing
2. **Replicate Account**: Sign up at replicate.com
3. **API Token**: Generate from your Replicate dashboard
4. **Secrets Storage**: Add `REPLICATE_API_KEY` to Alive Cloud secrets

## Implementation Pattern

### Edge Function Structure

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Replicate from "https://esm.sh/replicate@0.25.2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const REPLICATE_API_KEY = Deno.env.get('REPLICATE_API_KEY')
    if (!REPLICATE_API_KEY) {
      throw new Error('REPLICATE_API_KEY is not set')
    }

    const replicate = new Replicate({
      auth: REPLICATE_API_KEY,
    })

    const body = await req.json()

    // Check prediction status
    if (body.predictionId) {
      const prediction = await replicate.predictions.get(body.predictionId)
      return new Response(JSON.stringify(prediction), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Generate new output
    const output = await replicate.run(
      "black-forest-labs/flux-schnell",
      {
        input: {
          prompt: body.prompt,
          go_fast: true,
          megapixels: "1",
          num_outputs: 1,
          aspect_ratio: "1:1",
          output_format: "webp",
          output_quality: 80,
          num_inference_steps: 4
        }
      }
    )

    return new Response(JSON.stringify({ output }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error("Replicate error:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
```

## Frontend Integration

### Making Requests

```typescript
const generateImage = async (prompt: string) => {
  const response = await fetch(
<!-- SUPABASE DISABLED:     `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/replicate-generate`, -->
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ prompt })
    }
  )
  
  return await response.json()
}
```

### Polling for Results

Many Replicate models process asynchronously. Implement polling:

```typescript
const checkStatus = async (predictionId: string) => {
  const response = await fetch(
<!-- SUPABASE DISABLED:     `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/replicate-generate`, -->
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ predictionId })
    }
  )
  
  return await response.json()
}
```

## Best Practices

### Error Handling
- Always validate input before sending to Replicate
- Implement retry logic for transient failures
- Provide clear user feedback during processing
- Log errors comprehensively for debugging

### Cost Management
- Cache results when possible
- Implement rate limiting on your edge functions
- Monitor usage through Replicate dashboard
- Set user quotas if offering free tier

### Performance Optimization
- Use webhook callbacks for long-running models
- Implement request queuing for high traffic
- Consider CDN caching for generated assets
- Optimize model parameters for speed vs quality

## Security Considerations

### API Key Protection
- **Never expose API keys in frontend code**
- Store keys in Alive Cloud secrets only
- Use edge functions as proxy layer
- Rotate keys periodically

### Access Control
- Authenticate all edge function requests
- Implement user-based rate limiting
- Validate all input parameters
- Sanitize prompts to prevent injection

## Common Models

### Image Generation
- **FLUX Schnell**: Fast, high-quality image generation
- **Stable Diffusion**: Versatile image creation
- **SDXL**: Enhanced quality and control

### Image Manipulation
- **Background removal**: Clean object extraction
- **Upscaling**: Resolution enhancement
- **Style transfer**: Apply artistic styles

### Video Processing
- **Video interpolation**: Frame generation
- **Motion transfer**: Apply motion to images
- **Video enhancement**: Quality improvement

## Troubleshooting

### Common Issues

**API Key Not Found**
- Verify secret is added to Alive Cloud
- Check exact secret name matches code
- Redeploy edge function after adding secret

**Timeout Errors**
- Implement async polling pattern
- Increase function timeout settings
- Use webhook callbacks for long tasks

**Rate Limiting**
- Check Replicate dashboard for limits
- Implement client-side throttling
- Consider upgrading Replicate plan

## Migration from Alive AI

If migrating specific features from Alive AI to Replicate:
1. Document why the migration is necessary
2. Maintain backward compatibility during transition
3. A/B test to compare quality and performance
4. Monitor cost implications carefully

---

**Remember**: Alive AI should always be your first choice for AI features. Use Replicate only when you have specific requirements that demand it.
