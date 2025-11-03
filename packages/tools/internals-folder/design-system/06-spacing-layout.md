# Spacing & Layout - Grid and Spacing Tokens

## Spacing Scale System

### Tailwind Default Spacing

```typescript
// Tailwind spacing scale (in rem)
0: 0px
px: 1px
0.5: 0.125rem  // 2px
1: 0.25rem     // 4px
1.5: 0.375rem  // 6px
2: 0.5rem      // 8px
2.5: 0.625rem  // 10px
3: 0.75rem     // 12px
3.5: 0.875rem  // 14px
4: 1rem        // 16px
5: 1.25rem     // 20px
6: 1.5rem      // 24px
7: 1.75rem     // 28px
8: 2rem        // 32px
10: 2.5rem     // 40px
12: 3rem       // 48px
14: 3.5rem     // 56px
16: 4rem       // 64px
20: 5rem       // 80px
24: 6rem       // 96px
```

### Custom Spacing Tokens

```css
/* index.css */
:root {
  /* Semantic Spacing */
  --spacing-xs: 0.5rem;    /* 8px */
  --spacing-sm: 0.75rem;   /* 12px */
  --spacing-md: 1rem;      /* 16px */
  --spacing-lg: 1.5rem;    /* 24px */
  --spacing-xl: 2rem;      /* 32px */
  --spacing-2xl: 3rem;     /* 48px */
  --spacing-3xl: 4rem;     /* 64px */
  
  /* Layout Spacing */
  --spacing-section: 5rem;        /* 80px - Between sections */
  --spacing-component: 2rem;      /* 32px - Between components */
  --spacing-element: 1rem;        /* 16px - Between elements */
  
  /* Container Spacing */
  --container-padding-sm: 1rem;   /* Mobile */
  --container-padding-md: 1.5rem; /* Tablet */
  --container-padding-lg: 2rem;   /* Desktop */
}
```

## Layout Patterns

### Container System

```tsx
// Standard container
<div className="
  container           /* Centered, responsive max-width */
  mx-auto            /* Center horizontally */
  px-4               /* Mobile: 16px padding */
  sm:px-6            /* Small: 24px */
  lg:px-8            /* Large: 32px */
  max-w-7xl          /* Maximum width: 1280px */
">
  Content
</div>

// Full-width sections with centered content
<section className="w-full bg-muted">
  <div className="container mx-auto px-4 sm:px-6 lg:px-8">
    Centered content in full-width section
  </div>
</section>

// Narrow container for reading
<div className="
  container
  mx-auto
  px-4
  max-w-3xl          /* Narrower for articles */
">
  Article content
</div>
```

### Grid Layouts

```tsx
// Responsive grid
<div className="
  grid
  grid-cols-1        /* Mobile: 1 column */
  sm:grid-cols-2     /* Small: 2 columns */
  md:grid-cols-3     /* Medium: 3 columns */
  lg:grid-cols-4     /* Large: 4 columns */
  gap-4              /* 16px gap */
  md:gap-6           /* 24px gap on medium+ */
">
  {items.map(item => <Card key={item.id} />)}
</div>

// Auto-fit grid (responsive without breakpoints)
<div className="
  grid
  grid-cols-[repeat(auto-fit,minmax(250px,1fr))]
  gap-6
">
  Cards auto-arrange
</div>

// Grid with different sized items
<div className="
  grid
  grid-cols-2
  md:grid-cols-4
  gap-4
">
  <div className="col-span-2">Wide item</div>
  <div>Regular</div>
  <div>Regular</div>
  <div className="md:col-span-2">Desktop wide</div>
</div>
```

### Flexbox Layouts

```tsx
// Horizontal stack
<div className="
  flex
  items-center      /* Vertical center */
  gap-4             /* 16px between items */
">
  <Icon />
  <span>Text</span>
</div>

// Responsive stack
<div className="
  flex
  flex-col          /* Mobile: vertical stack */
  md:flex-row       /* Desktop: horizontal */
  gap-4
  md:gap-6
">
  <div>Item 1</div>
  <div>Item 2</div>
</div>

// Space between
<div className="
  flex
  items-center
  justify-between   /* Max space between items */
">
  <span>Left</span>
  <span>Right</span>
</div>

// Center everything
<div className="
  flex
  items-center
  justify-center
  min-h-screen
">
  Centered content
</div>
```

### Stack Utility

```tsx
// Vertical stack with consistent spacing
<div className="space-y-4">      /* 16px vertical gap */
  <div>Item 1</div>
  <div>Item 2</div>
  <div>Item 3</div>
</div>

// Horizontal stack
<div className="space-x-4">      /* 16px horizontal gap */
  <button>Button 1</button>
  <button>Button 2</button>
</div>

// Responsive stack
<div className="
  space-y-4         /* Mobile: vertical */
  md:space-y-0
  md:space-x-6      /* Desktop: horizontal */
">
```

## Section Spacing

```tsx
// Page sections
<section className="
  py-12             /* Mobile: 48px vertical */
  md:py-16          /* Medium: 64px */
  lg:py-20          /* Large: 80px */
  px-4
  md:px-8
">
  Section content
</section>

// Alternating sections
<section className="py-16 bg-background">
  <div className="container mx-auto px-4">
    Content
  </div>
</section>

<section className="py-16 bg-muted">
  <div className="container mx-auto px-4">
    Different background
  </div>
</section>
```

## Component Spacing

### Card Spacing

```tsx
<Card className="
  p-6              /* Internal padding */
  space-y-4        /* Spacing between children */
">
  <CardHeader className="p-0">
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent className="p-0">
    Content
  </CardContent>
</Card>
```

### Form Spacing

```tsx
<form className="
  space-y-6        /* 24px between fields */
  max-w-md
">
  <div className="space-y-2">
    <Label>Email</Label>
    <Input />
  </div>
  
  <div className="space-y-2">
    <Label>Password</Label>
    <Input type="password" />
  </div>
  
  <Button className="w-full mt-8">
    Submit
  </Button>
</form>
```

### List Spacing

```tsx
// Vertical list
<ul className="
  space-y-3        /* 12px between items */
  divide-y         /* Add dividers */
  divide-border
">
  <li className="pt-3 first:pt-0">Item 1</li>
  <li className="pt-3">Item 2</li>
</ul>

// Horizontal list
<ul className="
  flex
  flex-wrap
  gap-2            /* 8px gap, wraps nicely */
">
  <li><Badge>Tag 1</Badge></li>
  <li><Badge>Tag 2</Badge></li>
</ul>
```

## Margin and Padding Patterns

### Margin Utilities

```tsx
// Top margin
<div className="mt-4">        /* 16px top */

// Responsive margin
<div className="
  mt-4             /* Mobile: 16px */
  md:mt-6          /* Desktop: 24px */
">

// Negative margin (overlap)
<div className="-mt-16">      /* Pull up by 64px */

// Auto margin (centering)
<div className="
  mx-auto          /* Horizontal center */
  my-8             /* Vertical margins */
">
```

### Padding Utilities

```tsx
// Uniform padding
<div className="p-4">         /* 16px all sides */

// Directional padding
<div className="
  px-6             /* 24px horizontal */
  py-4             /* 16px vertical */
">

// Individual sides
<div className="
  pt-8             /* 32px top */
  pr-6             /* 24px right */
  pb-4             /* 16px bottom */
  pl-6             /* 24px left */
">

// Responsive padding
<div className="
  p-4
  md:p-6
  lg:p-8
">
```

## Safe Area Spacing (Mobile)

```tsx
// Account for notches and home indicators
<div className="
  pt-safe          /* Safe area top */
  pb-safe          /* Safe area bottom */
  px-4
">
  Mobile-safe content
</div>

// Bottom navigation
<nav className="
  fixed
  bottom-0
  w-full
  pb-safe          /* Above home indicator */
  bg-background
">
```

## Aspect Ratios

```tsx
// Square
<div className="aspect-square">
  <img src="..." className="w-full h-full object-cover" />
</div>

// Video (16:9)
<div className="aspect-video">
  <iframe className="w-full h-full" />
</div>

// Custom ratio
<div className="aspect-[4/3]">
  Content
</div>
```

## Max Width Constraints

```tsx
// Prose (optimal reading)
<div className="max-w-prose">  /* ~65 characters */

// Responsive max widths
<div className="
  max-w-sm         /* 384px */
  md:max-w-2xl     /* 672px */
  lg:max-w-4xl     /* 896px */
  mx-auto
">

// Full width on mobile, constrained on desktop
<div className="
  w-full
  md:max-w-md
  mx-auto
">
```

## Min/Max Height

```tsx
// Full viewport height
<div className="min-h-screen">
  Full height content
</div>

// Partial viewport
<div className="min-h-[80vh]">
  80% viewport height
</div>

// Max height with scroll
<div className="
  max-h-96
  overflow-y-auto
">
  Scrollable content
</div>
```

## Gap vs Space

```tsx
// Use gap for flex/grid
<div className="flex gap-4">
  <div>Item 1</div>
  <div>Item 2</div>
</div>

// Use space-* for direct children stacking
<div className="space-y-4">
  <div>Item 1</div>
  <div>Item 2</div>
</div>

// Gap is more flexible
<div className="
  flex
  gap-4            /* Horizontal */
  gap-y-6          /* Override vertical gap */
">
```

## Common Layout Patterns

### Hero Section

```tsx
<section className="
  relative
  min-h-screen
  flex
  items-center
  justify-center
  px-4
  py-20
  md:py-32
">
  <div className="
    max-w-4xl
    mx-auto
    text-center
    space-y-6
  ">
    <h1>Hero Title</h1>
    <p>Subtitle</p>
    <div className="flex gap-4 justify-center">
      <Button>CTA 1</Button>
      <Button variant="outline">CTA 2</Button>
    </div>
  </div>
</section>
```

### Two-Column Layout

```tsx
<div className="
  grid
  grid-cols-1
  lg:grid-cols-2
  gap-8
  lg:gap-12
  items-center
">
  <div className="space-y-4">
    <h2>Content</h2>
    <p>Description</p>
  </div>
  <div>
    <img className="w-full rounded-lg" />
  </div>
</div>
```

### Sidebar Layout

```tsx
<div className="
  flex
  flex-col
  lg:flex-row
  gap-8
">
  <aside className="
    w-full
    lg:w-64
    shrink-0
  ">
    Sidebar
  </aside>
  <main className="flex-1 min-w-0">
    Main content
  </main>
</div>
```

## Anti-Patterns to Avoid

```tsx
❌ Arbitrary spacing everywhere
<div className="mt-[23px] ml-[17px]">

❌ Inconsistent gaps
<div className="space-y-3">
  <div className="mb-5">...</div>
</div>

❌ Magic numbers
<div className="p-[37px]">

❌ Pixel-perfect rigidity
<div className="w-[732px]">

✅ Use spacing scale
<div className="mt-6 ml-4">

✅ Consistent spacing
<div className="space-y-4">

✅ Semantic values
<div className="p-6">

✅ Flexible, responsive
<div className="w-full md:w-2/3 lg:w-1/2">
```

## Key Takeaways

1. **Use spacing scale** - Stick to 4px increments (4, 8, 12, 16, 24, 32...)
2. **Container pattern** - Centered, max-width, responsive padding
3. **Grid for layouts** - Use CSS Grid for complex layouts
4. **Flex for components** - Use Flexbox for component-level layouts
5. **Responsive spacing** - Increase spacing on larger screens
6. **Gap over margins** - Use gap in flex/grid when possible
7. **Consistent rhythm** - Maintain vertical rhythm with space-y-*
8. **Mobile-first** - Start with mobile spacing, enhance for desktop
