# Color System - HSL Semantic Tokens

## Critical Rules

**NEVER use direct color classes in components:**
```tsx
❌ WRONG - Direct colors
<div className="text-white bg-black border-gray-300">
<Button className="bg-blue-500 hover:bg-blue-600">

✅ CORRECT - Semantic tokens
<div className="text-foreground bg-background border-border">
<Button variant="default">
```

## HSL Color Format (REQUIRED)

All colors MUST use HSL format in CSS variables:

```css
/* index.css */
:root {
  /* Format: hue saturation lightness */
  --primary: 222 47% 11%;
  --primary-foreground: 210 40% 98%;
  --background: 0 0% 100%;
  --foreground: 222 47% 11%;
}
```

**CRITICAL: Do NOT mix RGB and HSL**
- If CSS variables use RGB format, do NOT wrap them in `hsl()` in tailwind.config.ts
- If CSS variables use HSL format, wrap them in `hsl()` in tailwind.config.ts
- Check the format before creating color utilities

## Semantic Token Architecture

### Core Semantic Tokens (Required)

```css
:root {
  /* Brand Colors */
  --primary: [hsl values];           /* Main brand color */
  --primary-foreground: [hsl values]; /* Text on primary */
  
  --secondary: [hsl values];         /* Secondary actions */
  --secondary-foreground: [hsl values];
  
  --accent: [hsl values];            /* Accents and highlights */
  --accent-foreground: [hsl values];
  
  /* UI Foundation */
  --background: [hsl values];        /* Page background */
  --foreground: [hsl values];        /* Main text color */
  
  --card: [hsl values];              /* Card backgrounds */
  --card-foreground: [hsl values];   /* Card text */
  
  --popover: [hsl values];           /* Popover backgrounds */
  --popover-foreground: [hsl values];
  
  /* Interactive States */
  --muted: [hsl values];             /* Muted/disabled states */
  --muted-foreground: [hsl values];
  
  --destructive: [hsl values];       /* Error/danger actions */
  --destructive-foreground: [hsl values];
  
  /* Borders and Separators */
  --border: [hsl values];            /* Border color */
  --input: [hsl values];             /* Input borders */
  --ring: [hsl values];              /* Focus rings */
}
```

### Dark Mode Implementation

```css
.dark {
  --primary: [adjusted hsl];
  --primary-foreground: [adjusted hsl];
  --background: 222 47% 11%;
  --foreground: 210 40% 98%;
  /* ... all tokens adjusted for dark mode */
}
```

## Advanced Color Tokens

### Gradient System

```css
:root {
  /* Primary gradients */
  --gradient-primary: linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-glow)));
  --gradient-primary-subtle: linear-gradient(180deg, hsl(var(--background)), hsl(var(--primary) / 0.05));
  
  /* Accent gradients */
  --gradient-accent: linear-gradient(90deg, hsl(var(--accent)), hsl(var(--accent-glow)));
  
  /* Background gradients */
  --gradient-mesh: radial-gradient(at 40% 20%, hsl(var(--primary) / 0.3) 0px, transparent 50%),
                   radial-gradient(at 80% 80%, hsl(var(--accent) / 0.3) 0px, transparent 50%);
}
```

### Shadow System with Color

```css
:root {
  /* Colored shadows using primary */
  --shadow-primary: 0 10px 30px -10px hsl(var(--primary) / 0.3);
  --shadow-primary-lg: 0 20px 50px -15px hsl(var(--primary) / 0.4);
  
  /* Accent shadows */
  --shadow-accent: 0 8px 25px -8px hsl(var(--accent) / 0.35);
  
  /* Glow effects */
  --glow-primary: 0 0 40px hsl(var(--primary) / 0.4);
  --glow-accent: 0 0 30px hsl(var(--accent) / 0.5);
}
```

## Color Usage in Tailwind Config

```typescript
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        // Map semantic tokens to Tailwind utilities
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        // ... all other semantic tokens
      },
    },
  },
};
```

## Color Contrast Requirements

### WCAG AA Compliance (Minimum)

- Normal text: 4.5:1 contrast ratio
- Large text (18pt+): 3:1 contrast ratio
- Interactive elements: 3:1 contrast ratio

### Testing Colors

Always verify:
1. Light mode contrast meets WCAG AA
2. Dark mode contrast meets WCAG AA
3. Hover states are clearly distinguishable
4. Focus states have sufficient contrast

## Common Color Mistakes

### ❌ Anti-Patterns

```tsx
// Direct color values
<div className="text-white bg-black">
<div className="border-gray-300">
<Button className="bg-blue-500">

// Mixing RGB and HSL
// CSS: --primary: 255 0 0; (RGB)
// Config: "hsl(var(--primary))" ❌ WRONG

// Missing dark mode consideration
.card {
  background: white; /* Breaks in dark mode */
}
```

### ✅ Correct Patterns

```tsx
// Semantic tokens
<div className="text-foreground bg-background">
<div className="border-border">
<Button variant="default">

// Proper HSL wrapping
// CSS: --primary: 220 50% 50%; (HSL)
// Config: "hsl(var(--primary))" ✅ CORRECT

// Dark mode aware
.card {
  background-color: hsl(var(--card));
}
```

## Project-Specific Color Palettes

When creating a new color scheme:

1. **Choose your primary color** based on brand
2. **Calculate complementary colors** for secondary/accent
3. **Define all semantic tokens** in both light and dark modes
4. **Test contrast ratios** for all text combinations
5. **Create color variants** (hover, active, disabled states)

### Example: Tech Startup Theme

```css
:root {
  /* Brand: Electric Blue */
  --primary: 220 90% 56%;
  --primary-foreground: 0 0% 100%;
  --primary-glow: 220 100% 70%;
  
  /* Secondary: Deep Purple */
  --secondary: 270 60% 45%;
  --secondary-foreground: 0 0% 100%;
  
  /* Accent: Cyan */
  --accent: 180 100% 50%;
  --accent-foreground: 0 0% 10%;
  
  /* Neutral palette */
  --background: 0 0% 100%;
  --foreground: 220 10% 10%;
  --muted: 220 10% 95%;
  --border: 220 10% 85%;
}

.dark {
  --background: 220 15% 8%;
  --foreground: 0 0% 98%;
  --muted: 220 10% 15%;
  --border: 220 10% 25%;
}
```

## Using Colors with Opacity

```tsx
// Tailwind opacity modifiers with semantic tokens
<div className="bg-primary/10">        {/* 10% opacity */}
<div className="text-primary/70">      {/* 70% opacity */}
<div className="border-accent/20">     {/* 20% opacity */}

// In CSS
.overlay {
  background-color: hsl(var(--primary) / 0.8);
}
```

## Color State Variants

Define state-specific colors for interactive elements:

```css
:root {
  --primary-hover: 220 90% 50%;   /* Slightly darker */
  --primary-active: 220 90% 45%;  /* Even darker */
  --primary-disabled: 220 20% 70%; /* Desaturated */
}
```

## Key Takeaways

1. **Always use semantic tokens** - Never hardcode colors
2. **HSL format required** - All colors must use HSL
3. **Dark mode first** - Design for both modes simultaneously
4. **Test contrast** - Ensure WCAG AA compliance minimum
5. **Use opacity modifiers** - Leverage Tailwind's `/` syntax
6. **Match HSL wrapping** - Check CSS format before wrapping in config
