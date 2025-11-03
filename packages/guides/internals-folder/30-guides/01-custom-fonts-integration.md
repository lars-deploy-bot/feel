# Custom Font Integration Guide

## Overview
Integrating custom typography into your web application enhances branding and user experience. This guide covers the recommended approach for adding web fonts to your project.

## Recommended Method: Google Fonts Integration

### Step 1: Link Font in HTML Head
Add the font stylesheet reference to your `index.html` file within the `<head>` section:

```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&display=swap">
```

### Step 2: Configure Tailwind Configuration
Open `tailwind.config.ts` and extend the font family settings:

```javascript
extend: {
  fontFamily: {
    'playfair': ['Playfair Display', 'serif'],
  },
},
```

### Step 3: Apply Font in Components
Use Tailwind utility classes to apply your custom font:

```tsx
<div className="font-playfair">
  Your content here
</div>
```

## Best Practices

### Font Weight Selection
Ensure your Google Fonts URL includes all necessary font weights. This prevents the browser from synthesizing weights, which can result in poor rendering quality.

### Fallback Fonts
Always specify fallback fonts in your Tailwind configuration. This ensures text remains readable if the primary font fails to load.

### Cross-Browser Testing
Test font rendering across multiple browsers and devices to ensure consistent appearance.

### Performance Optimization
Use `font-display: swap` in your font loading strategy for improved perceived performance. This allows text to display immediately with fallback fonts while custom fonts load in the background.

---

**Note**: Alive makes font integration seamless - just describe your typography preferences and the platform handles the technical implementation!
