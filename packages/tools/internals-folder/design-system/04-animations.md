# Animations - Transition and Animation Tokens

## Animation Philosophy

Animations should:
- **Enhance UX**, not distract
- **Feel natural** with easing curves
- **Be performant** using GPU-accelerated properties
- **Be consistent** across the app

## CSS Custom Properties for Animations

```css
/* index.css */
:root {
  /* Timing Functions */
  --ease-smooth: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-in: cubic-bezier(0.4, 0, 1, 1);
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.6, 1);
  --ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
  
  /* Duration */
  --duration-fast: 150ms;
  --duration-normal: 300ms;
  --duration-slow: 500ms;
  --duration-slower: 700ms;
  
  /* Combined Transitions */
  --transition-smooth: all 300ms var(--ease-smooth);
  --transition-fast: all 150ms var(--ease-smooth);
  --transition-slow: all 500ms var(--ease-smooth);
  --transition-colors: color, background-color, border-color 300ms var(--ease-smooth);
  --transition-transform: transform 300ms var(--ease-smooth);
}
```

## Tailwind Animation Configuration

```typescript
// tailwind.config.ts
export default {
  theme: {
    extend: {
      transitionDuration: {
        'fast': '150ms',
        'normal': '300ms',
        'slow': '500ms',
      },
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'bounce': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      },
      animation: {
        // Utility animations
        'fade-in': 'fadeIn 300ms ease-in-out',
        'fade-out': 'fadeOut 300ms ease-in-out',
        'slide-in-up': 'slideInUp 300ms ease-out',
        'slide-in-down': 'slideInDown 300ms ease-out',
        'slide-in-left': 'slideInLeft 300ms ease-out',
        'slide-in-right': 'slideInRight 300ms ease-out',
        'scale-in': 'scaleIn 200ms ease-out',
        'bounce-in': 'bounceIn 500ms cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        
        // Loading animations
        'spin-slow': 'spin 3s linear infinite',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'bounce-slow': 'bounce 2s infinite',
        
        // Special effects
        'shimmer': 'shimmer 2s linear infinite',
        'float': 'float 3s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        slideInUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideInDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideInLeft: {
          '0%': { transform: 'translateX(-10px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(10px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.9)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        bounceIn: {
          '0%': { transform: 'scale(0.3)', opacity: '0' },
          '50%': { transform: 'scale(1.05)' },
          '70%': { transform: 'scale(0.9)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        glow: {
          '0%, 100%': { boxShadow: '0 0 5px hsl(var(--primary))' },
          '50%': { boxShadow: '0 0 20px hsl(var(--primary))' },
        },
      },
    },
  },
};
```

## Component Animation Patterns

### Button Hover Animations

```tsx
<Button className="
  transition-all
  duration-300
  hover:scale-105
  hover:shadow-lg
  active:scale-95
">
  Hover Me
</Button>

<Button className="
  relative
  overflow-hidden
  before:absolute
  before:inset-0
  before:bg-white/20
  before:translate-x-[-100%]
  before:transition-transform
  before:duration-300
  hover:before:translate-x-0
">
  Slide Effect
</Button>
```

### Card Entrance Animations

```tsx
<Card className="
  animate-fade-in
  hover:shadow-xl
  transition-shadow
  duration-300
">
  Content
</Card>

<Card className="
  opacity-0
  animate-slide-in-up
  [animation-delay:100ms]
">
  Delayed Card
</Card>
```

### Staggered List Animations

```tsx
{items.map((item, index) => (
  <div
    key={item.id}
    className="animate-slide-in-left"
    style={{
      animationDelay: `${index * 100}ms`,
      animationFillMode: 'both',
    }}
  >
    {item.content}
  </div>
))}
```

### Modal/Dialog Animations

```tsx
// Using CSS animations
<Dialog>
  <DialogContent className="
    animate-scale-in
    data-[state=closed]:animate-fade-out
  ">
    Modal Content
  </DialogContent>
</Dialog>
```

### Loading States

```tsx
// Skeleton loader
<div className="
  bg-muted
  rounded
  animate-pulse
">
  <div className="h-4 w-3/4 bg-muted-foreground/20 rounded" />
</div>

// Spinner
<div className="
  h-8
  w-8
  border-4
  border-primary/30
  border-t-primary
  rounded-full
  animate-spin
" />

// Shimmer effect
<div className="
  bg-gradient-to-r
  from-muted
  via-muted-foreground/10
  to-muted
  bg-[length:1000px_100%]
  animate-shimmer
">
  Loading...
</div>
```

## Page Transition Patterns

```tsx
// Fade in page content
<main className="animate-fade-in">
  <section className="animate-slide-in-up [animation-delay:100ms]">
    Content
  </section>
</main>
```

## Interactive Animations

### Click Ripple Effect

```tsx
<button className="
  relative
  overflow-hidden
  after:content-['']
  after:absolute
  after:inset-0
  after:bg-white/30
  after:scale-0
  after:rounded-full
  after:transition-transform
  after:duration-500
  active:after:scale-100
">
  Click Me
</button>
```

### Underline Animation

```tsx
<a className="
  relative
  after:absolute
  after:bottom-0
  after:left-0
  after:h-0.5
  after:w-full
  after:bg-primary
  after:origin-left
  after:scale-x-0
  after:transition-transform
  after:duration-300
  hover:after:scale-x-100
">
  Hover Link
</a>
```

### Image Zoom on Hover

```tsx
<div className="overflow-hidden rounded-lg">
  <img 
    className="
      transition-transform
      duration-500
      hover:scale-110
    "
    src="..."
  />
</div>
```

## Scroll-Based Animations

Using Intersection Observer pattern:

```tsx
const [isVisible, setIsVisible] = useState(false);
const ref = useRef<HTMLDivElement>(null);

useEffect(() => {
  const observer = new IntersectionObserver(
    ([entry]) => setIsVisible(entry.isIntersecting),
    { threshold: 0.1 }
  );
  
  if (ref.current) observer.observe(ref.current);
  
  return () => observer.disconnect();
}, []);

return (
  <div
    ref={ref}
    className={cn(
      "transition-all duration-700",
      isVisible 
        ? "opacity-100 translate-y-0" 
        : "opacity-0 translate-y-10"
    )}
  >
    Content
  </div>
);
```

## Performance Considerations

### GPU-Accelerated Properties

```tsx
✅ GOOD - GPU accelerated
- transform
- opacity
- filter

<div className="
  transition-transform
  duration-300
  hover:translate-y-[-2px]
">

❌ AVOID - CPU intensive
- width/height
- top/left/right/bottom
- padding/margin

<div className="
  transition-all
  hover:h-20      /* Avoid */
">
```

### Will-Change Optimization

```tsx
<div className="
  will-change-transform
  transition-transform
  duration-300
  hover:scale-110
">
  {/* Only use will-change on elements that will definitely animate */}
</div>
```

## Reduced Motion Support

```tsx
<div className="
  transition-transform
  duration-300
  hover:scale-105
  motion-reduce:transition-none
  motion-reduce:hover:scale-100
">
  Respects user preferences
</div>
```

```css
/* In index.css */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

## Common Animation Patterns

### Toast Notification

```tsx
<div className="
  animate-slide-in-right
  data-[state=closed]:animate-slide-out-right
">
  Notification
</div>
```

### Accordion Expand/Collapse

```tsx
<div className="
  overflow-hidden
  transition-[max-height]
  duration-300
  ease-in-out
  data-[state=open]:max-h-96
  data-[state=closed]:max-h-0
">
  Accordion Content
</div>
```

### Progress Bar

```tsx
<div className="relative h-2 bg-muted rounded-full overflow-hidden">
  <div 
    className="
      h-full
      bg-primary
      transition-all
      duration-500
      ease-out
    "
    style={{ width: `${progress}%` }}
  />
</div>
```

## Anti-Patterns to Avoid

```tsx
❌ Over-animation
<div className="animate-bounce animate-pulse animate-spin">

❌ Long durations
<div className="duration-[5000ms]">

❌ Animating non-GPU properties
<div className="transition-[width,padding]">

❌ Animation on every property
<div className="transition-all hover:*">

✅ Subtle, purposeful
<div className="transition-transform duration-300 hover:scale-105">

✅ Appropriate timing
<div className="duration-300">

✅ GPU-friendly
<div className="transition-[transform,opacity]">

✅ Specific properties
<div className="transition-transform">
```

## Key Takeaways

1. **Use CSS variables** for consistent timing/easing
2. **GPU-accelerated properties** for performance (transform, opacity)
3. **Subtle animations** enhance, don't distract
4. **Respect reduced-motion** preferences
5. **Stagger animations** for visual interest
6. **Test on mobile** - animations can lag on slower devices
7. **Use tailwindcss-animate** - Already included with shadcn
