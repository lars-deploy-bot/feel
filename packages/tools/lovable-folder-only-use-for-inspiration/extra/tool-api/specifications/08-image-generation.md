# Image Generation Tools

2 tools for creating and editing images using AI.

---

## `imagegen--generate_image`

Generate images from text prompts using Flux models.

**Signature:**
```typescript
imagegen--generate_image(
  prompt: string,
  target_path: string,
  width?: number,
  height?: number,
  model?: string
): void
```

**Parameters:**
- `prompt` (required): Text description of desired image
  - Be descriptive and specific
  - Mention aspect ratio in prompt for better results
  - Examples: `"A 16:9 hero image of a sunset over calm ocean, ultra high resolution"`, `"Modern minimalist logo for tech startup, clean lines"`
- `target_path` (required): Where to save generated image
  - **Prefer `src/assets/`** for React imports
  - Examples: `"src/assets/hero-image.jpg"`, `"src/assets/product-photo.png"`
- `width` (optional): Image width in pixels (default: 1024)
  - Range: 512-1920
  - Must be multiple of 32
- `height` (optional): Image height in pixels (default: 1024)
  - Range: 512-1920
  - Must be multiple of 32
- `model` (optional): Generation model to use
  - Options: `"flux.schnell"` (default, fast), `"flux.dev"` (high quality, slower)
  - **Use `flux.schnell` for most cases** (fast and excellent quality)
  - **Use `flux.dev` for large/important images** (hero images, key visuals)

**Returns:** Success message with path to generated image

**Usage:**
```typescript
// Generate hero image (large, use flux.dev)
imagegen--generate_image(
  "A modern office workspace with laptop and coffee, natural lighting, 16:9 aspect ratio, ultra high resolution",
  "src/assets/hero-workspace.jpg",
  1920,
  1080,
  "flux.dev"
)

// Generate icon (small, use flux.schnell)
imagegen--generate_image(
  "Simple icon of a rocket ship, minimalist style, flat design",
  "src/assets/icons/rocket.png",
  512,
  512,
  "flux.schnell"
)

// Generate product image (default size, fast model)
imagegen--generate_image(
  "High-end wireless headphones on white background, product photography style",
  "src/assets/products/headphones.jpg"
)

// Generate background pattern
imagegen--generate_image(
  "Abstract geometric pattern in blue and purple gradients, seamless tileable",
  "src/assets/patterns/geometric-bg.jpg",
  1024,
  1024
)

// Generate avatar placeholder
imagegen--generate_image(
  "Friendly robot avatar, cartoon style, round format",
  "src/assets/avatars/default-avatar.png",
  512,
  512
)
```

**Model Selection:**

**flux.schnell (default):**
- ✅ Fast generation (3-8 seconds)
- ✅ Excellent quality
- ✅ **Use for:** Icons, small images, UI elements, quick iterations, anything under 1000px
- ✅ Should be your default choice

**flux.dev:**
- ✅ Highest quality output
- ⚠️ Slower (10-20 seconds)
- ✅ **Use for:** Hero images, key visuals, large images (>1200px), when quality is critical
- Max resolution: 1920x1920

**Prompting Best Practices:**

**Include these for best results:**
```typescript
// Aspect ratio
"16:9 aspect ratio image of..." // Helps model composition

// Quality keywords
"ultra high resolution"
"high quality" 
"detailed"
"professional photography"

// Lighting
"natural lighting"
"studio lighting"
"soft shadows"

// Style
"modern minimalist"
"photorealistic"
"illustration style"
"3D render"
```

**Good prompts:**
```typescript
"A 16:9 hero image of a modern coworking space with natural light streaming through large windows, people collaborating, ultra high resolution, professional photography"

"Product photo of a sleek smartwatch on a marble surface, studio lighting, reflections, high-end commercial photography, 4:3 aspect ratio"

"Minimalist icon of a paper airplane, simple line art, flat design, centered composition, suitable for app icon"
```

**Common Aspect Ratios:**
```typescript
// Hero images
1920x1080  // 16:9 (standard wide)
1600x900   // 16:9 (smaller)

// Product photos
1024x1024  // 1:1 (square)
1280x960   // 4:3 (standard photo)

// Social media
1200x630   // OG images
1080x1080  // Instagram square

// UI elements
512x512    // Icons, avatars
800x600    // Cards
```

**After Generation:**
```typescript
// MUST import in component (since saved to src/assets/)
import heroImage from '@/assets/hero-workspace.jpg'

// Then use:
<img src={heroImage} alt="Modern workspace" />

// Or as background:
<div style={{ backgroundImage: `url(${heroImage})` }} />
```

**Critical Rules:**
- ✅ Dimensions must be 512-1920 pixels
- ✅ Dimensions must be multiples of 32
- ✅ Always import generated images in code (ES6 imports)
- ✅ Use `flux.schnell` by default (fast and good)
- ✅ Use `flux.dev` only for large/important images
- ✅ Mention aspect ratio in prompt
- ✅ Add "ultra high resolution" for quality
- ❌ **DO NOT** replace user-uploaded images unless explicitly requested

---

## `imagegen--edit_image`

Edit existing images or merge multiple images using AI.

**Signature:**
```typescript
imagegen--edit_image(
  image_paths: string[],
  prompt: string,
  target_path: string
): void
```

**Parameters:**
- `image_paths` (required): Array of image paths to edit/merge
  - Single image: `["src/assets/photo.jpg"]`
  - Multiple images: `["src/assets/bg.jpg", "src/assets/character.png"]`
- `prompt` (required): How to edit or merge the images
  - Single image: Describe changes to make
  - Multiple images: Describe how to combine them
- `target_path` (required): Where to save edited image
  - Examples: `"src/assets/edited-photo.jpg"`

**Returns:** Success message with path to edited image

**Usage:**

### Single Image Editing
```typescript
// Change lighting
imagegen--edit_image(
  ["src/assets/landscape.jpg"],
  "add dramatic sunset lighting with orange sky and golden hour glow",
  "src/assets/landscape-sunset.jpg"
)

// Change weather
imagegen--edit_image(
  ["src/assets/photo.jpg"],
  "make it a snowy winter scene with falling snowflakes",
  "src/assets/photo-winter.jpg"
)

// Add elements
imagegen--edit_image(
  ["src/assets/room.jpg"],
  "add modern furniture and plants, make it cozy",
  "src/assets/room-furnished.jpg"
)

// Change style
imagegen--edit_image(
  ["src/assets/portrait.jpg"],
  "convert to watercolor painting style",
  "src/assets/portrait-watercolor.jpg"
)

// Adjust colors
imagegen--edit_image(
  ["src/assets/product.jpg"],
  "make colors more vibrant and saturated",
  "src/assets/product-vibrant.jpg"
)
```

### Merge Multiple Images
```typescript
// Composite character into scene
imagegen--edit_image(
  ["src/assets/background.jpg", "src/assets/character.png"],
  "place character in center of background, matching lighting and shadows",
  "src/assets/final-scene.jpg"
)

// Merge product with environment
imagegen--edit_image(
  ["src/assets/desk-setup.jpg", "src/assets/laptop.png"],
  "place the laptop on the desk naturally, with realistic shadows",
  "src/assets/workspace-complete.jpg"
)

// Create collage
imagegen--edit_image(
  ["src/assets/photo1.jpg", "src/assets/photo2.jpg", "src/assets/photo3.jpg"],
  "create an artistic collage with these three photos, modern layout",
  "src/assets/collage.jpg"
)

// Combine foreground and background
imagegen--edit_image(
  ["src/assets/sky.jpg", "src/assets/building.png"],
  "combine the building foreground with the dramatic sky background",
  "src/assets/composite.jpg"
)
```

### User-Uploaded Images
```typescript
// Edit user's uploaded image
imagegen--edit_image(
  ["user-uploads://original-photo.jpg"],
  "enhance the photo, improve lighting and colors",
  "src/assets/enhanced-photo.jpg"
)
```

**Use Cases:**

**1. Iterating on Generated Images:**
```typescript
// First generate
imagegen--generate_image("Modern office", "src/assets/office.jpg")

// Then refine with edits
imagegen--edit_image(
  ["src/assets/office.jpg"],
  "add more plants and natural light",
  "src/assets/office-v2.jpg"
)
```

**2. Character/Object Consistency:**
```typescript
// Generate character once
imagegen--generate_image("Cartoon cat mascot", "src/assets/cat.png")

// Place in different scenes
imagegen--edit_image(
  ["src/assets/beach.jpg", "src/assets/cat.png"],
  "place cat on beach, playing in sand",
  "src/assets/cat-beach.jpg"
)

imagegen--edit_image(
  ["src/assets/office.jpg", "src/assets/cat.png"],
  "place cat in office, sitting at desk",
  "src/assets/cat-office.jpg"
)
```

**3. Quick Image Adjustments:**
Instead of regenerating entire image, make targeted edits:
```typescript
// User: "Can you make the sky more dramatic?"
imagegen--edit_image(
  ["src/assets/current-hero.jpg"],
  "make the sky more dramatic with storm clouds and dramatic lighting",
  "src/assets/hero-dramatic.jpg"
)
```

**4. Seasonal Variations:**
```typescript
// Create seasonal versions from one base image
imagegen--edit_image(
  ["src/assets/product-base.jpg"],
  "add autumn leaves and warm fall colors",
  "src/assets/product-fall.jpg"
)

imagegen--edit_image(
  ["src/assets/product-base.jpg"],
  "add winter snow and cold blue tones",
  "src/assets/product-winter.jpg"
)
```

**After Editing:**
```typescript
// Import and use like any other image
import editedImage from '@/assets/landscape-sunset.jpg'

<img src={editedImage} alt="Sunset landscape" />
```

**Critical Rules:**
- ✅ Great for character/object consistency across scenes
- ✅ Use instead of regenerating when making small changes
- ✅ Can work with user-uploaded images
- ✅ Faster than generating new image from scratch
- ✅ **MUST** import edited images in code (ES6 imports)
- ✅ Can merge 2-5 images at once
- ✅ Describe changes clearly in prompt

---

## Workflow Patterns

### Generate Hero Image
```typescript
// 1. Generate large hero image
imagegen--generate_image(
  "Modern tech office with diverse team collaborating, natural light, 16:9 hero image, ultra high resolution",
  "src/assets/hero-office.jpg",
  1920,
  1080,
  "flux.dev"  // Use high quality for hero
)

// 2. Import and use
import heroImage from '@/assets/hero-office.jpg'
```

### Iterate on Design
```typescript
// 1. Generate initial version
imagegen--generate_image(
  "Product showcase image",
  "src/assets/product-v1.jpg"
)

// 2. Refine with edits
imagegen--edit_image(
  ["src/assets/product-v1.jpg"],
  "add more vibrant colors and better lighting",
  "src/assets/product-v2.jpg"
)

// 3. Further refinement
imagegen--edit_image(
  ["src/assets/product-v2.jpg"],
  "add subtle shadows and depth",
  "src/assets/product-final.jpg"
)
```

### Create Character Variations
```typescript
// 1. Generate base character
imagegen--generate_image(
  "Friendly robot mascot character",
  "src/assets/robot.png",
  512,
  512
)

// 2. Place in different scenes
imagegen--edit_image(
  ["src/assets/scene1.jpg", "src/assets/robot.png"],
  "place robot in scene, match lighting",
  "src/assets/robot-scene1.jpg"
)

imagegen--edit_image(
  ["src/assets/scene2.jpg", "src/assets/robot.png"],
  "place robot in scene, match lighting",
  "src/assets/robot-scene2.jpg"
)
```

### Generate UI Assets
```typescript
// Generate multiple icons/assets in parallel
[
  imagegen--generate_image(
    "Login icon, simple line art",
    "src/assets/icons/login.png",
    512,
    512
  ),
  imagegen--generate_image(
    "Settings icon, simple line art",
    "src/assets/icons/settings.png",
    512,
    512
  ),
  imagegen--generate_image(
    "Profile icon, simple line art",
    "src/assets/icons/profile.png",
    512,
    512
  )
]
```

---

## Best Practices

**Model Selection:**
- Default to `flux.schnell` (fast and great quality)
- Use `flux.dev` only for hero images or key visuals >1200px

**Prompting:**
- Mention aspect ratio
- Add "ultra high resolution"
- Describe lighting and style
- Be specific about composition

**Dimensions:**
- Hero images: 1920x1080 or 1600x900
- Product photos: 1024x1024 or 1280x960
- Icons: 512x512
- Social: 1200x630 (OG), 1080x1080 (Instagram)

**Iterations:**
- Generate initial image
- Use `edit_image` for refinements (faster than regenerating)
- Keep original versions for comparison

**Asset Management:**
- Save to `src/assets/` for React imports
- Use descriptive filenames: `hero-workspace.jpg`, not `image1.jpg`
- Always import in code (ES6 imports)

**Performance:**
- Generate small images (<1000px) with `flux.schnell` (fast)
- Only use `flux.dev` for large/critical images
- Generate multiple small images in parallel for speed
