# Component Variants - Customizing shadcn Components

## Critical Principle

**shadcn components are DESIGNED to be customized.** Don't hack around them - create proper variants.

## Button Component Variants

### Anatomy of Button Variants

```tsx
// src/components/ui/button.tsx
import { cva, type VariantProps } from "class-variance-authority";

const buttonVariants = cva(
  // Base styles (always applied)
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        
        // ✅ ADD CUSTOM VARIANTS
        premium: "bg-gradient-to-r from-primary to-accent text-primary-foreground hover:shadow-lg hover:scale-105 transition-all",
        hero: "bg-white/10 text-white border border-white/20 hover:bg-white/20 backdrop-blur-sm",
        glass: "bg-background/80 backdrop-blur-md border border-border/50 hover:bg-background/90",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
        
        // ✅ ADD CUSTOM SIZES
        xl: "h-14 rounded-lg px-10 text-lg",
        hero: "h-16 rounded-xl px-12 text-xl font-bold",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);
```

### Common Button Variant Mistakes

```tsx
❌ WRONG - Inline overrides
<Button className="bg-white text-black border-white">Click me</Button>
<Button className="!bg-blue-500 hover:!bg-blue-600">Click me</Button>

✅ CORRECT - Proper variant
<Button variant="hero">Click me</Button>
<Button variant="premium" size="xl">Click me</Button>
```

## Card Component Variants

```tsx
// src/components/ui/card.tsx
const cardVariants = cva(
  "rounded-lg border bg-card text-card-foreground shadow-sm",
  {
    variants: {
      variant: {
        default: "",
        elevated: "shadow-lg hover:shadow-xl transition-shadow",
        bordered: "border-2",
        ghost: "border-none shadow-none",
        gradient: "bg-gradient-to-br from-card to-accent/10",
        glass: "bg-card/80 backdrop-blur-md border-border/50",
      },
      padding: {
        none: "",
        sm: "p-4",
        default: "p-6",
        lg: "p-8",
      },
    },
    defaultVariants: {
      variant: "default",
      padding: "default",
    },
  }
);

// Usage
<Card variant="glass" padding="lg">
  <CardHeader>...</CardHeader>
</Card>
```

## Input Component Variants

```tsx
// src/components/ui/input.tsx
const inputVariants = cva(
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "",
        filled: "bg-muted border-transparent focus-visible:bg-background",
        flushed: "border-x-0 border-t-0 rounded-none focus-visible:border-primary",
        ghost: "border-none bg-transparent",
      },
      inputSize: {
        sm: "h-8 text-xs",
        default: "h-10 text-sm",
        lg: "h-12 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      inputSize: "default",
    },
  }
);
```

## Badge Component Variants

```tsx
// src/components/ui/badge.tsx
const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        
        // Custom variants
        success: "border-transparent bg-green-500 text-white",
        warning: "border-transparent bg-yellow-500 text-black",
        info: "border-transparent bg-blue-500 text-white",
        gradient: "border-transparent bg-gradient-to-r from-primary to-accent text-white",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);
```

## Alert Component Variants

```tsx
// src/components/ui/alert.tsx
const alertVariants = cva(
  "relative w-full rounded-lg border p-4",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        destructive: "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive",
        success: "border-green-500/50 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950",
        warning: "border-yellow-500/50 text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950",
        info: "border-blue-500/50 text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);
```

## Creating Compound Variants

Handle variant combinations:

```tsx
const buttonVariants = cva("...", {
  variants: {
    variant: { default: "...", outline: "..." },
    size: { sm: "...", lg: "..." },
  },
  compoundVariants: [
    {
      variant: "outline",
      size: "lg",
      className: "border-2", // Only when both conditions match
    },
  ],
});
```

## Dark Mode Variant Patterns

```tsx
const cardVariants = cva("rounded-lg border", {
  variants: {
    variant: {
      default: "bg-card text-card-foreground",
      // Explicit dark mode handling
      contrast: "bg-background dark:bg-foreground text-foreground dark:text-background",
      // Opacity-based for both modes
      glass: "bg-card/80 dark:bg-card/60 backdrop-blur",
    },
  },
});
```

## Responsive Variants

While CVA doesn't handle responsive directly, combine with Tailwind:

```tsx
<Button 
  variant="default"
  size="sm"
  className="md:h-12 md:px-6 lg:h-14 lg:px-8"
>
  Responsive Button
</Button>
```

## Best Practices for Variants

### ✅ Do's

1. **Create variants for recurring patterns**
   ```tsx
   // If you use this style 3+ times, make it a variant
   <Button variant="premium">...</Button>
   ```

2. **Use semantic names**
   ```tsx
   variant="primary" // Good
   variant="blue-gradient" // Bad - too specific
   ```

3. **Provide defaults**
   ```tsx
   defaultVariants: {
     variant: "default",
     size: "default",
   }
   ```

4. **Compose with className when needed**
   ```tsx
   <Button variant="primary" className="w-full mt-4">
   ```

### ❌ Don'ts

1. **Don't override with !important**
   ```tsx
   <Button className="!bg-red-500"> // Bad
   ```

2. **Don't create variants for one-off styles**
   ```tsx
   // If only used once, just use className
   <Button className="mt-8 shadow-2xl">
   ```

3. **Don't duplicate Tailwind utilities**
   ```tsx
   // Bad - just use Tailwind directly
   variant: { redText: "text-red-500" }
   ```

## Typography Component Example

```tsx
// src/components/ui/typography.tsx
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
    },
  },
  defaultVariants: {
    variant: "p",
  },
});

export const Typography = ({ variant, className, ...props }) => {
  return <div className={cn(typographyVariants({ variant }), className)} {...props} />;
};
```

## Navigation Variants

```tsx
const navItemVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "text-muted-foreground hover:text-foreground",
        active: "text-foreground bg-accent",
        pill: "px-4 py-2 rounded-full hover:bg-accent",
        underline: "relative after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:bg-primary after:scale-x-0 hover:after:scale-x-100 after:transition-transform",
      },
    },
  }
);
```

## Key Takeaways

1. **Customize, don't hack** - shadcn components are meant to be edited
2. **Use CVA properly** - Variants for repeated patterns, className for one-offs
3. **Semantic naming** - Name variants by purpose, not appearance
4. **Default variants** - Always provide sensible defaults
5. **Compound variants** - Handle variant combinations when needed
6. **Test dark mode** - Ensure all variants work in both themes
