# Responsive Design - Mobile-First Patterns

## Mobile-First Philosophy

Always design for mobile first, then enhance for larger screens.

```tsx
❌ WRONG - Desktop first
<div className="w-1/2 md:w-full"> // Breaks on mobile

✅ CORRECT - Mobile first
<div className="w-full md:w-1/2"> // Works everywhere
```

## Tailwind Breakpoints

```typescript
// Default Tailwind breakpoints
sm: '640px'   // Small tablets
md: '768px'   // Tablets
lg: '1024px'  // Small laptops
xl: '1280px'  // Desktops
2xl: '1536px' // Large desktops
```

### Usage Pattern

```tsx
<div className="
  text-sm      /* Mobile: small text */
  md:text-base /* Tablet: normal text */
  lg:text-lg   /* Desktop: large text */
">
```

## Responsive Layout Patterns

### Container Patterns

```tsx
// Responsive container with max-width
<div className="
  container           /* Centered container */
  mx-auto            /* Center horizontally */
  px-4               /* Mobile: 16px padding */
  sm:px-6            /* Small: 24px padding */
  lg:px-8            /* Large: 32px padding */
  max-w-7xl          /* Max width constraint */
">
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
  gap-4              /* Mobile: 16px gap */
  lg:gap-6           /* Large: 24px gap */
">
```

### Flex Layouts

```tsx
// Stack on mobile, row on desktop
<div className="
  flex
  flex-col           /* Mobile: stack vertically */
  md:flex-row        /* Desktop: horizontal */
  gap-4
  md:gap-6
">
```

## Typography Responsiveness

```tsx
// Responsive headings
<h1 className="
  text-3xl           /* Mobile: 30px */
  sm:text-4xl        /* Small: 36px */
  md:text-5xl        /* Medium: 48px */
  lg:text-6xl        /* Large: 60px */
  font-bold
  leading-tight      /* Tighter line height */
  sm:leading-normal  /* Normal on larger screens */
">
```

```tsx
// Responsive paragraph
<p className="
  text-sm            /* Mobile: 14px */
  md:text-base       /* Desktop: 16px */
  leading-relaxed    /* Mobile: More line spacing for readability */
  md:leading-normal
  max-w-prose        /* Optimal reading width */
">
```

## Spacing Responsiveness

```tsx
// Responsive padding
<section className="
  py-8               /* Mobile: 32px vertical */
  md:py-12           /* Medium: 48px */
  lg:py-16           /* Large: 64px */
  px-4
  md:px-8
">
```

```tsx
// Responsive margins
<div className="
  mb-4               /* Mobile: 16px bottom */
  md:mb-6            /* Medium: 24px */
  lg:mb-8            /* Large: 32px */
">
```

## Component Responsiveness

### Navigation

```tsx
// Mobile hamburger, desktop horizontal
<nav className="
  flex
  flex-col           /* Mobile: vertical menu */
  md:flex-row        /* Desktop: horizontal */
  items-start        /* Mobile: left align */
  md:items-center    /* Desktop: center align */
  gap-2
  md:gap-6
">
  <a className="
    w-full           /* Mobile: full width */
    md:w-auto        /* Desktop: auto width */
    py-2
    md:py-0
  ">
    Link
  </a>
</nav>
```

### Cards

```tsx
<div className="
  w-full             /* Mobile: full width */
  sm:w-1/2           /* Small: half width */
  lg:w-1/3           /* Large: third width */
  p-4                /* Mobile: 16px padding */
  md:p-6             /* Desktop: 24px padding */
">
```

### Images

```tsx
<img 
  className="
    w-full           /* Always full width of container */
    h-48             /* Mobile: fixed height */
    md:h-64          /* Medium: taller */
    lg:h-auto        /* Large: natural height */
    object-cover     /* Maintain aspect ratio */
    rounded-lg
  "
  src="..."
  alt="..."
/>
```

## Hiding/Showing Elements

```tsx
// Hide on mobile, show on desktop
<div className="hidden md:block">
  Desktop only content
</div>

// Show on mobile, hide on desktop
<div className="block md:hidden">
  Mobile only content
</div>

// Complex visibility
<div className="
  hidden             /* Hidden on mobile */
  sm:block           /* Show on small+ */
  lg:hidden          /* Hide on large */
  xl:block           /* Show on xl+ */
">
```

## Button Responsiveness

```tsx
<Button className="
  w-full             /* Mobile: full width */
  sm:w-auto          /* Small: auto width */
  text-sm            /* Mobile: smaller text */
  md:text-base       /* Desktop: normal text */
  px-4               /* Mobile: 16px horizontal */
  md:px-6            /* Desktop: 24px horizontal */
  py-2
  md:py-3
">
  Click Me
</Button>
```

## Forms Responsiveness

```tsx
<form className="
  space-y-4          /* Mobile: 16px gap */
  md:space-y-6       /* Desktop: 24px gap */
">
  <div className="
    grid
    grid-cols-1      /* Mobile: 1 column */
    md:grid-cols-2   /* Desktop: 2 columns */
    gap-4
  ">
    <Input className="
      text-base      /* Mobile: 16px (prevents zoom on iOS) */
      md:text-sm     /* Desktop: 14px */
    " />
  </div>
</form>
```

## Aspect Ratios

```tsx
// Responsive aspect ratios
<div className="
  aspect-square      /* Mobile: square */
  md:aspect-video    /* Desktop: 16:9 */
">
  <img src="..." className="w-full h-full object-cover" />
</div>
```

## Max Width Constraints

```tsx
// Prevent content from becoming too wide
<div className="
  w-full
  max-w-sm           /* Mobile: max 384px */
  md:max-w-2xl       /* Desktop: max 672px */
  mx-auto            /* Center it */
">
```

## Common Responsive Patterns

### Hero Section

```tsx
<section className="
  relative
  min-h-[60vh]       /* Mobile: 60% viewport */
  md:min-h-[80vh]    /* Desktop: 80% viewport */
  flex
  flex-col
  items-center
  justify-center
  px-4
  md:px-8
  py-12
  md:py-20
">
  <h1 className="
    text-4xl
    md:text-5xl
    lg:text-6xl
    xl:text-7xl
    font-bold
    text-center
    max-w-4xl
  ">
    Hero Title
  </h1>
</section>
```

### Two-Column Layout

```tsx
<div className="
  grid
  grid-cols-1        /* Mobile: stack */
  lg:grid-cols-2     /* Desktop: side by side */
  gap-8
  lg:gap-12
  items-center       /* Vertical center on desktop */
">
  <div>Content</div>
  <div>Image</div>
</div>
```

### Card Grid

```tsx
<div className="
  grid
  grid-cols-1                    /* Mobile: 1 */
  sm:grid-cols-2                 /* Small: 2 */
  lg:grid-cols-3                 /* Large: 3 */
  xl:grid-cols-4                 /* XL: 4 */
  gap-4
  sm:gap-6
  lg:gap-8
">
  {items.map(item => <Card key={item.id} />)}
</div>
```

### Sidebar Layout

```tsx
<div className="
  flex
  flex-col           /* Mobile: stack */
  lg:flex-row        /* Desktop: side by side */
  gap-6
  lg:gap-8
">
  {/* Sidebar */}
  <aside className="
    w-full           /* Mobile: full width */
    lg:w-64          /* Desktop: fixed 256px */
    order-2          /* Mobile: bottom */
    lg:order-1       /* Desktop: left */
  ">
    Sidebar
  </aside>
  
  {/* Main content */}
  <main className="
    flex-1           /* Take remaining space */
    order-1          /* Mobile: top */
    lg:order-2       /* Desktop: right */
  ">
    Main Content
  </main>
</div>
```

## Touch-Friendly Design

```tsx
// Larger hit areas on mobile
<button className="
  min-h-[44px]       /* iOS recommended minimum */
  min-w-[44px]
  md:min-h-[36px]
  md:min-w-[36px]
  px-4
  py-2
">
```

## Performance Considerations

### Image Loading

```tsx
<img 
  loading="lazy"     /* Lazy load off-screen images */
  className="..."
  // Use srcset for responsive images
  srcset="
    image-320w.jpg 320w,
    image-640w.jpg 640w,
    image-1024w.jpg 1024w
  "
  sizes="
    (max-width: 640px) 100vw,
    (max-width: 1024px) 50vw,
    33vw
  "
/>
```

## Mobile-Specific Considerations

### Prevent iOS Zoom on Input Focus

```tsx
<Input className="text-base" /> /* 16px+ prevents zoom */
```

### Safe Area for Notched Phones

```tsx
<div className="
  pt-safe           /* Account for notch */
  pb-safe           /* Account for home indicator */
">
```

## Testing Responsive Design

### Key Breakpoints to Test
- Mobile: 375px (iPhone SE)
- Mobile Large: 414px (iPhone Pro Max)
- Tablet: 768px (iPad)
- Desktop: 1280px (laptop)
- Large Desktop: 1920px (desktop monitor)

## Anti-Patterns to Avoid

```tsx
❌ Fixed pixel widths
<div className="w-[500px]">

❌ Desktop-first approach
<div className="w-1/2 md:w-full">

❌ Too many breakpoints
<div className="text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl 2xl:text-2xl">

❌ Hardcoded heights
<div className="h-[800px]">

✅ Flexible, mobile-first
<div className="w-full md:w-1/2">

✅ Semantic breakpoints
<div className="text-sm md:text-base lg:text-lg">

✅ Content-driven heights
<div className="min-h-screen">
```

## Key Takeaways

1. **Mobile first** - Always start with mobile styles
2. **Progressive enhancement** - Add complexity for larger screens
3. **Touch-friendly** - Minimum 44px tap targets on mobile
4. **Flexible layouts** - Use flex/grid, avoid fixed widths
5. **Test on real devices** - Simulators don't catch everything
6. **Consider performance** - Lazy load images, optimize assets
7. **Semantic breakpoints** - Use breakpoints that make sense for your content
