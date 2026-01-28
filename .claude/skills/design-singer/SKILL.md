---
name: Design Singer
description: Design System principles for building robust, type-safe, accessible component libraries.
---

# Design System Principles

Guidelines for building component libraries that are type-safe, accessible, and maintainable.

## Table of Contents

1. [Core Philosophy](#core-philosophy)
2. [Props & Types](#props--types)
3. [Composition Patterns](#composition-patterns)
4. [Constraints & Consistency](#constraints--consistency)
5. [Design Tokens](#design-tokens)
6. [Accessibility](#accessibility)
7. [State Management](#state-management)
8. [Testing & Quality](#testing--quality)
9. [Anti-Patterns](#anti-patterns)

---

## Core Philosophy

**Build for the 90%, not the 100%.** Know your use cases and build for them specifically. Don't over-engineer for edge cases that may never happen.

| Principle | Meaning |
|-----------|---------|
| Type-safety first | Types ARE documentation |
| Accessibility built-in | Not a feature, a requirement |
| One way to do things | No redundancy |
| Constraints are features | Guardrails prevent mistakes |
| Performance isn't optional | Optimize from day one |

---

## Props & Types

### Have Props, But Not Too Many

```typescript
// BAD: Boolean soup
<Button primary secondary disabled loading small large />

// GOOD: Discriminated unions
<Button variant="primary" size="sm" state="loading" />
```

### Avoid Booleans - Use Literals

```typescript
// BAD
interface ButtonProps {
  primary?: boolean
  secondary?: boolean
  danger?: boolean
}

// GOOD
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'danger'
}
```

### Be More Type-Safe Than You Think

```typescript
// BAD: Accepts any string
interface IconProps {
  name: string
}

// GOOD: Only valid icon names
type IconName = 'home' | 'user' | 'settings' | 'search'
interface IconProps {
  name: IconName
}
```

### Lint What Types Can't Enforce

Types can catch a lot, but some rules need linting:
- Prop combinations that don't make sense
- Deprecated prop usage
- Accessibility violations

### Types > Documentation (But Do Both)

```typescript
/**
 * Button component with multiple variants
 * @param variant - Visual style of the button
 * @param size - Size preset (sm/md/lg)
 * @param disabled - Prevents interaction when true
 */
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
}
```

---

## Composition Patterns

### Favor Composition Over Configuration

```typescript
// BAD: One component with 20 props
<Card
  title="Hello"
  subtitle="World"
  image="/img.png"
  imagePosition="left"
  footer={<Button>Click</Button>}
  headerActions={[...]}
/>

// GOOD: Composable parts
<Card>
  <Card.Image src="/img.png" />
  <Card.Header>
    <Card.Title>Hello</Card.Title>
    <Card.Subtitle>World</Card.Subtitle>
  </Card.Header>
  <Card.Footer>
    <Button>Click</Button>
  </Card.Footer>
</Card>
```

### Type-Safe Compound Components

```typescript
// Ensure only valid children are used
interface CardComponent {
  (props: CardProps): JSX.Element
  Header: typeof CardHeader
  Body: typeof CardBody
  Footer: typeof CardFooter
}

const Card: CardComponent = ({ children }) => {
  return <div className="card">{children}</div>
}

Card.Header = CardHeader
Card.Body = CardBody
Card.Footer = CardFooter
```

### Headless When Possible

Separate logic from presentation:

```typescript
// Headless hook
function useToggle(initial = false) {
  const [on, setOn] = useState(initial)
  const toggle = useCallback(() => setOn(v => !v), [])
  const set = useCallback((v: boolean) => setOn(v), [])
  return { on, toggle, set }
}

// UI can be anything
function Switch({ checked, onChange }: SwitchProps) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
    >
      {/* Any visual representation */}
    </button>
  )
}
```

### Providers for Behavior Injection

```typescript
// Allow customization through context
<ThemeProvider theme={customTheme}>
  <ToastProvider position="bottom-right" duration={5000}>
    <App />
  </ToastProvider>
</ThemeProvider>
```

---

## Constraints & Consistency

### Constraints Are Features

```typescript
// BAD: Any color
<Text color="#ff5733" />

// GOOD: Limited palette
<Text color="primary" /> // Only design tokens
```

### Choose Defaults Wisely

```typescript
// Opinionated defaults
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' // Default: 'primary'
  size?: 'sm' | 'md' | 'lg'                    // Default: 'md'
  type?: 'button' | 'submit' | 'reset'         // Default: 'button'
}
```

### One Way to Do Things

```typescript
// BAD: Multiple ways to set size
<Button size="small" />
<Button size="sm" />
<Button small />

// GOOD: One way
<Button size="sm" />
```

### Consistent APIs Across Components

```typescript
// All components use same patterns
<Button size="sm" variant="primary" />
<Input size="sm" variant="outlined" />
<Card size="sm" variant="elevated" />
```

---

## Design Tokens

### Tokens First, Components Second

```typescript
// tokens.ts
export const tokens = {
  colors: {
    primary: { 50: '...', 100: '...', 500: '...', 900: '...' },
    neutral: { 50: '...', 100: '...', 500: '...', 900: '...' },
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
  },
  radii: {
    sm: '0.25rem',
    md: '0.5rem',
    lg: '1rem',
    full: '9999px',
  },
} as const
```

### Semantic Tokens Over Raw Values

```typescript
// BAD
<div style={{ color: '#3b82f6', padding: '16px' }} />

// GOOD
<div className="text-primary-500 p-4" />
// or
<div style={{ color: tokens.colors.primary[500], padding: tokens.spacing.md }} />
```

---

## Accessibility

### Built-In, Not Bolt-On

```typescript
// Accessibility is part of the component, not an afterthought
function Button({ children, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      // Required accessibility
      aria-disabled={props.disabled}
      // Focus management built-in
      className={cn(
        'focus:outline-none focus-visible:ring-2',
        props.className
      )}
    >
      {children}
    </button>
  )
}
```

### Tooltip Components Should Not Exist

Use proper disclosure patterns instead:

```typescript
// BAD: Tooltip for essential info
<Tooltip content="Submit the form">
  <Button>?</Button>
</Tooltip>

// GOOD: Clear labeling
<Button>Submit Form</Button>

// GOOD: For supplementary info, use aria-describedby
<Button aria-describedby="submit-help">Submit</Button>
<p id="submit-help" className="sr-only">Submits the form and sends email</p>
```

### data-testid Is an A11y Smell

If you need test IDs, your accessibility is probably lacking:

```typescript
// BAD: Need test ID to find element
<button data-testid="submit-button">Submit</button>

// GOOD: Accessible name IS the selector
<button aria-label="Submit form">Submit</button>
// In tests: getByRole('button', { name: 'Submit form' })
```

---

## State Management

### State Syncing Is the Root of All Evil

```typescript
// BAD: Derived state
const [items, setItems] = useState([])
const [count, setCount] = useState(0) // Synced with items.length

useEffect(() => {
  setCount(items.length) // BUG: Always out of sync initially
}, [items])

// GOOD: Compute, don't sync
const [items, setItems] = useState([])
const count = items.length // Always correct
```

### Controlled First, Uncontrolled If Necessary

```typescript
// Controlled: Parent owns state
interface InputProps {
  value: string
  onChange: (value: string) => void
}

// Uncontrolled fallback: Internal state with optional override
interface InputProps {
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
}

function Input({ value, defaultValue, onChange }: InputProps) {
  const [internalValue, setInternalValue] = useState(defaultValue ?? '')
  const isControlled = value !== undefined
  const currentValue = isControlled ? value : internalValue

  const handleChange = (newValue: string) => {
    if (!isControlled) setInternalValue(newValue)
    onChange?.(newValue)
  }

  return <input value={currentValue} onChange={e => handleChange(e.target.value)} />
}
```

---

## Testing & Quality

### Visual Regression for Important Things

```typescript
// Storybook + Chromatic/Percy for visual testing
export const Primary: Story = {
  args: { variant: 'primary', children: 'Button' },
}

export const AllVariants: Story = {
  render: () => (
    <div className="flex gap-2">
      {variants.map(v => <Button key={v} variant={v}>{v}</Button>)}
    </div>
  ),
}
```

### Build for the Future of React

- Use Suspense boundaries
- Support concurrent features
- Avoid blocking renders
- Use `useTransition` for non-urgent updates

---

## Anti-Patterns

| Anti-Pattern | Why It's Bad | Do Instead |
|--------------|--------------|------------|
| Boolean props | Can't enforce exclusivity | Discriminated unions |
| Prop drilling | Hard to maintain | Context or composition |
| Tooltip for essential info | Inaccessible | Clear labels |
| `data-testid` | A11y smell | Accessible names |
| State syncing | Always out of sync | Computed values |
| Any color/size | No consistency | Design tokens |
| "One component, 50 props" | Unmaintainable | Composition |

---

## Quick Reference

### Component Checklist

- [ ] Props use discriminated unions, not booleans
- [ ] All props are typed (no `any`)
- [ ] JSDoc for public APIs
- [ ] Accessible by default (roles, labels, focus)
- [ ] Uses design tokens, not raw values
- [ ] Controlled mode supported
- [ ] One way to do each thing
- [ ] No state syncing - compute instead

### Design Token Categories

| Category | Examples |
|----------|----------|
| Colors | `primary`, `secondary`, `danger`, `neutral` |
| Spacing | `xs`, `sm`, `md`, `lg`, `xl` |
| Typography | `body`, `heading`, `caption`, `mono` |
| Radii | `sm`, `md`, `lg`, `full` |
| Shadows | `sm`, `md`, `lg` |
| Transitions | `fast`, `normal`, `slow` |
