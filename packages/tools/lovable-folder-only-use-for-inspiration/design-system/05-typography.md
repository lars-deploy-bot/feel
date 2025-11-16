# Typography - Font System and Hierarchy

## Font System Configuration

### Adding Custom Fonts

```html
<!-- index.html -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
```

```typescript
// tailwind.config.ts
export default {
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        heading: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['Fira Code', 'monospace'],
      },
    },
  },
};
```

### CSS Custom Properties

```css
/* index.css */
:root {
  /* Font Families */
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-heading: 'Inter', system-ui, sans-serif;
  --font-mono: 'Fira Code', monospace;
  
  /* Font Sizes */
  --text-xs: 0.75rem;      /* 12px */
  --text-sm: 0.875rem;     /* 14px */
  --text-base: 1rem;       /* 16px */
  --text-lg: 1.125rem;     /* 18px */
  --text-xl: 1.25rem;      /* 20px */
  --text-2xl: 1.5rem;      /* 24px */
  --text-3xl: 1.875rem;    /* 30px */
  --text-4xl: 2.25rem;     /* 36px */
  --text-5xl: 3rem;        /* 48px */
  --text-6xl: 3.75rem;     /* 60px */
  --text-7xl: 4.5rem;      /* 72px */
  
  /* Line Heights */
  --leading-none: 1;
  --leading-tight: 1.25;
  --leading-snug: 1.375;
  --leading-normal: 1.5;
  --leading-relaxed: 1.625;
  --leading-loose: 2;
  
  /* Letter Spacing */
  --tracking-tighter: -0.05em;
  --tracking-tight: -0.025em;
  --tracking-normal: 0;
  --tracking-wide: 0.025em;
  --tracking-wider: 0.05em;
  --tracking-widest: 0.1em;
  
  /* Font Weights */
  --font-light: 300;
  --font-normal: 400;
  --font-medium: 500;
  --font-semibold: 600;
  --font-bold: 700;
  --font-extrabold: 800;
}
```

## Typography Scale

### Heading Hierarchy

```tsx
// H1 - Page Title
<h1 className="
  scroll-m-20
  text-4xl
  font-extrabold
  tracking-tight
  lg:text-5xl
  text-foreground
">
  Main Page Title
</h1>

// H2 - Section Title
<h2 className="
  scroll-m-20
  border-b
  pb-2
  text-3xl
  font-semibold
  tracking-tight
  first:mt-0
  text-foreground
">
  Section Title
</h2>

// H3 - Subsection
<h3 className="
  scroll-m-20
  text-2xl
  font-semibold
  tracking-tight
  text-foreground
">
  Subsection
</h3>

// H4 - Minor Heading
<h4 className="
  scroll-m-20
  text-xl
  font-semibold
  tracking-tight
  text-foreground
">
  Minor Heading
</h4>
```

### Body Text Variants

```tsx
// Lead Paragraph
<p className="
  text-xl
  text-muted-foreground
  leading-relaxed
">
  Lead paragraph for emphasis
</p>

// Regular Paragraph
<p className="
  leading-7
  [&:not(:first-child)]:mt-6
  text-foreground
">
  Regular body text
</p>

// Small Text
<p className="
  text-sm
  text-muted-foreground
  leading-relaxed
">
  Smaller supporting text
</p>

// Muted Text
<p className="
  text-sm
  text-muted-foreground
  leading-normal
">
  De-emphasized text
</p>
```

### Display Text

```tsx
// Hero Title
<h1 className="
  text-5xl
  md:text-6xl
  lg:text-7xl
  font-extrabold
  tracking-tight
  bg-clip-text
  text-transparent
  bg-gradient-to-r
  from-primary
  to-accent
">
  Hero Title
</h1>

// Large Display
<div className="
  text-4xl
  md:text-5xl
  font-bold
  tracking-tight
  text-foreground
">
  Feature Display
</div>
```

## Typography Component

```tsx
// src/components/ui/typography.tsx
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const typographyVariants = cva("", {
  variants: {
    variant: {
      h1: "scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl",
      h2: "scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0",
      h3: "scroll-m-20 text-2xl font-semibold tracking-tight",
      h4: "scroll-m-20 text-xl font-semibold tracking-tight",
      p: "leading-7 [&:not(:first-child)]:mt-6",
      lead: "text-xl text-muted-foreground",
      large: "text-lg font-semibold",
      small: "text-sm font-medium leading-none",
      muted: "text-sm text-muted-foreground",
      code: "relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold",
      blockquote: "mt-6 border-l-2 pl-6 italic",
    },
  },
  defaultVariants: {
    variant: "p",
  },
});

export interface TypographyProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof typographyVariants> {
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p" | "span" | "div";
}

export const Typography = ({
  variant,
  as,
  className,
  ...props
}: TypographyProps) => {
  const Comp = as || "p";
  return (
    <Comp
      className={cn(typographyVariants({ variant }), className)}
      {...props}
    />
  );
};

// Usage
<Typography variant="h1">Title</Typography>
<Typography variant="lead">Lead paragraph</Typography>
<Typography variant="muted" as="span">Small text</Typography>
```

## Semantic HTML with Styling

```tsx
// Use semantic HTML tags with utility classes
<article className="prose prose-slate max-w-none">
  <h1>Article Title</h1>
  <p className="lead">Introduction paragraph</p>
  
  <h2>Section</h2>
  <p>Body text with <strong>emphasis</strong> and <em>italics</em>.</p>
  
  <blockquote className="
    mt-6
    border-l-2
    border-primary
    pl-6
    italic
    text-muted-foreground
  ">
    Quote text
  </blockquote>
  
  <ul className="my-6 ml-6 list-disc [&>li]:mt-2">
    <li>List item one</li>
    <li>List item two</li>
  </ul>
</article>
```

## Link Styling

```tsx
// Standard link
<a className="
  font-medium
  text-primary
  underline
  underline-offset-4
  hover:no-underline
  transition-colors
">
  Link Text
</a>

// Subtle link
<a className="
  text-foreground
  hover:text-primary
  transition-colors
  duration-200
">
  Subtle Link
</a>

// External link with icon
<a className="
  inline-flex
  items-center
  gap-1
  text-primary
  hover:underline
">
  External Link
  <ExternalLink className="h-4 w-4" />
</a>
```

## Code and Preformatted Text

```tsx
// Inline code
<code className="
  relative
  rounded
  bg-muted
  px-[0.3rem]
  py-[0.2rem]
  font-mono
  text-sm
  font-semibold
">
  const code = true;
</code>

// Code block
<pre className="
  mt-6
  overflow-x-auto
  rounded-lg
  bg-muted
  p-4
">
  <code className="
    font-mono
    text-sm
    text-foreground
  ">
    {codeString}
  </code>
</pre>
```

## List Styling

```tsx
// Unordered list
<ul className="
  my-6
  ml-6
  list-disc
  [&>li]:mt-2
  text-foreground
">
  <li>Item one</li>
  <li>Item two</li>
</ul>

// Ordered list
<ol className="
  my-6
  ml-6
  list-decimal
  [&>li]:mt-2
  text-foreground
">
  <li>First item</li>
  <li>Second item</li>
</ol>

// Styled list (no bullets)
<ul className="
  space-y-2
  text-foreground
">
  <li className="flex items-start gap-2">
    <CheckCircle className="h-5 w-5 text-primary mt-0.5" />
    <span>List item with icon</span>
  </li>
</ul>
```

## Responsive Typography

```tsx
// Responsive heading
<h1 className="
  text-3xl          /* Mobile */
  sm:text-4xl       /* Small */
  md:text-5xl       /* Medium */
  lg:text-6xl       /* Large */
  font-extrabold
  tracking-tight
  leading-tight     /* Mobile */
  sm:leading-normal /* Larger screens */
">
  Responsive Title
</h1>

// Responsive paragraph
<p className="
  text-sm           /* Mobile: 14px */
  md:text-base      /* Desktop: 16px */
  lg:text-lg        /* Large: 18px */
  leading-relaxed   /* More line-height on mobile */
  max-w-prose       /* Optimal reading width */
">
  Body text
</p>
```

## Text Truncation

```tsx
// Single line truncate
<p className="
  truncate
  max-w-xs
">
  Very long text that will be truncated with ellipsis
</p>

// Multi-line clamp
<p className="
  line-clamp-3      /* Show 3 lines max */
  text-muted-foreground
">
  Longer text that will be clamped to 3 lines with an ellipsis at the end
</p>
```

## Alignment and Spacing

```tsx
// Text alignment
<p className="text-left md:text-center">
<p className="text-center">
<p className="text-right">
<p className="text-justify">

// Text transform
<span className="uppercase">Uppercase</span>
<span className="lowercase">Lowercase</span>
<span className="capitalize">Capitalize Each Word</span>
<span className="normal-case">Normal Case</span>

// Word break
<p className="break-words">  /* Break long words */
<p className="break-all">    /* Break anywhere */
```

## Reading Optimization

```tsx
// Optimal reading width
<article className="max-w-prose mx-auto">
  <p className="text-base leading-relaxed">
    Content optimized for reading
  </p>
</article>

// Increased readability
<p className="
  text-base
  md:text-lg
  leading-relaxed       /* 1.625 line-height */
  tracking-wide         /* Slight letter spacing */
  text-foreground
  max-w-2xl
">
  Highly readable paragraph
</p>
```

## Accessibility Considerations

```tsx
// Screen reader only text
<span className="sr-only">
  Hidden text for screen readers
</span>

// Focus visible for keyboard navigation
<a className="
  focus-visible:outline-none
  focus-visible:ring-2
  focus-visible:ring-ring
  focus-visible:ring-offset-2
  rounded
">
  Accessible Link
</a>

// Sufficient color contrast (WCAG AA minimum)
<p className="text-foreground">      /* 4.5:1 on background */
<p className="text-muted-foreground"> /* 3:1 minimum */
```

## Anti-Patterns to Avoid

```tsx
❌ Fixed font sizes everywhere
<p className="text-[14px]">

❌ All caps for long text
<p className="uppercase">Long paragraph all caps is hard to read</p>

❌ Tiny line-height
<p className="leading-none">Makes text hard to read</p>

❌ Very long line lengths
<p className="max-w-full">Text spanning entire screen</p>

✅ Responsive font sizes
<p className="text-sm md:text-base">

✅ Appropriate capitalization
<h2 className="uppercase">Short Heading</h2>

✅ Comfortable line-height
<p className="leading-relaxed">

✅ Optimal line length
<p className="max-w-prose">
```

## Key Takeaways

1. **Use semantic HTML** - h1-h6, p, ul, ol, blockquote
2. **Maintain hierarchy** - Clear visual distinction between levels
3. **Responsive scaling** - Smaller on mobile, larger on desktop
4. **Readable line lengths** - Use max-w-prose (65ch)
5. **Comfortable line-height** - leading-relaxed for body text
6. **Sufficient contrast** - WCAG AA minimum (4.5:1)
7. **Performance** - Preconnect to font providers
8. **Semantic colors** - Use foreground/muted-foreground tokens
