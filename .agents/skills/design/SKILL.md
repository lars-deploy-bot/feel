---
name: design
description: The Alive design language. Reference this before building or modifying any UI. This is what we look like.
---

# Alive Design Language

This is our design. Read it before touching UI.

## Identity

Clean. Quiet. Intentional. The UI should feel like it's barely there — just enough structure to orient, then it gets out of the way. We don't decorate. We don't explain what's obvious. We trust whitespace.

**One word:** Restrained.

**No emojis. Ever.** Use minimal SVG icons or nothing at all. Emojis are visual noise.

---

## Layout: Clean Chrome

Our primary layout pattern. A dark shell frames a floating white content surface. The chrome (navigation, structure) recedes. The content elevates. Your eye goes straight to the card.

```text
┌──────────────────────────────────────────────────┐
│ dark bg (#09090b)                                │
│                                                  │
│  sidebar    ┌─ white card (rounded-[16px]) ───┐  │
│  (text)     │                                 │  │
│  alive      │   Content lives here            │  │
│             │                                 │  │
│  Orgs  ←    │   Stats, lists, forms           │  │
│  Users      │                                 │  │
│  Domains    │                                 │  │
│             │                                 │  │
│  sign out   └─────────────────────────────────┘  │
│                                                  │
└──────────────────────────────────────────────────┘
```

**Structure:**
```tsx
<div className="flex h-screen bg-bg overflow-hidden">
  <aside className="w-48 flex-shrink-0 py-5 px-4">
    {/* text-only nav on dark background */}
  </aside>
  <main className="flex-1 m-2 ml-0 bg-surface rounded-card overflow-y-auto">
    <div className="max-w-5xl mx-auto px-8 py-8">
      {/* content */}
    </div>
  </main>
</div>
```

**Why it works:**
- Dark bg + white card = natural depth without shadows
- Sidebar disappears — just text on a dark wall
- Card margin (`m-2 ml-0`) creates the floating effect
- 16px border radius softens the card without looking bubbly
- Content has generous padding (32px) and a max-width constraint

**Login uses the same frame:** dark bg, centered white card, minimal text.

---

## Sidebar Navigation

Text-only. No icons. No containers. No borders.

```tsx
// Logo: just the word
<span className="text-[15px] font-semibold text-nav-active tracking-tight">alive</span>

// Nav items
active:   "text-nav-active font-medium"   // white, stands out
inactive: "text-nav-text hover:text-nav-hover"  // zinc-600 → zinc-400
```

- `text-[13px]` for all nav items
- `py-1.5 px-3 rounded-md` for click targets
- Sign out at the bottom: `text-[12px] text-nav-text`
- No active indicators (dots, bars, backgrounds) — text weight and color are enough

---

## Color System

Built on the zinc scale. Monochrome by default. Color used sparingly and meaningfully.

### Dark Shell
| Token | Value | Use |
|---|---|---|
| `bg` | `#09090b` | Page background (zinc-950) |
| `nav-text` | `#52525b` | Inactive sidebar items (zinc-600) |
| `nav-active` | `#fafafa` | Active sidebar items (zinc-50) |
| `nav-hover` | `#a1a1aa` | Hovered sidebar items (zinc-400) |

### Content Surface
| Token | Value | Use |
|---|---|---|
| `surface` | `#ffffff` | Card background |
| `surface-secondary` | `#f4f4f5` | Subtle backgrounds (zinc-100) |
| `surface-tertiary` | `#e4e4e7` | Hover/active backgrounds (zinc-200) |
| `border` | `#e4e4e7` | Borders and dividers (zinc-200) |
| `border-subtle` | `#f4f4f5` | Faint separators (zinc-100) |

### Text (inside content card)
| Token | Value | Use |
|---|---|---|
| `text-primary` | `#18181b` | Headings, names, values (zinc-900) |
| `text-secondary` | `#52525b` | Body text, descriptions (zinc-600) |
| `text-tertiary` | `#a1a1aa` | Labels, metadata, hints (zinc-400) |

### Semantic Colors
| Token | Value | Use |
|---|---|---|
| `accent` | `#3b82f6` | Links, interactive highlights (blue-500) |
| `success` / `success-subtle` | `#22c55e` / `#f0fdf4` | Positive states |
| `warning` / `warning-subtle` | `#eab308` / `#fefce8` | Caution states |
| `danger` / `danger-subtle` | `#ef4444` / `#fef2f2` | Destructive actions |

**Rule:** Accent blue is for links and highlights only. Primary actions use near-black buttons. The UI stays monochrome.

---

## Typography

Font: `"Inter", -apple-system, BlinkMacSystemFont, sans-serif`
Feature settings: `"cv02", "cv03", "cv04", "cv11"` (prettier alternates)

| Element | Size | Weight | Color |
|---|---|---|---|
| Page title | `text-lg` (18px) | `font-semibold` | `text-primary` |
| Nav items | `text-[13px]` | `font-medium` (active) / normal | nav tokens |
| Body text | `text-[13px]` | normal | `text-primary` or `text-secondary` |
| Labels | `text-[13px]` | `font-medium` | `text-primary` |
| Section headers | `text-[11px]` | `font-medium` uppercase `tracking-wider` | `text-tertiary` |
| Metadata | `text-[11px]` | normal | `text-tertiary` |
| Stat numbers | `text-2xl` | `font-semibold` `tabular-nums` | `text-primary` |
| Hints/errors | `text-[12px]` | normal | `text-tertiary` or `text-danger` |

**No uppercase** except section headers inside expanded content. No letter-spacing except on those headers.

---

## Buttons

Primary is near-black. This is deliberate — it's more restrained than a blue/indigo button.

```ts
primary:   "bg-text-primary text-white hover:bg-zinc-800"     // near-black
secondary: "bg-surface border border-border hover:bg-surface-secondary"  // white with border
ghost:     "text-text-secondary hover:bg-surface-secondary"   // just text
danger:    "bg-danger text-white hover:bg-red-600"            // red, for destructive
```

- Sizes: `sm` (px-3 py-1.5 text-xs) and `md` (px-4 py-2 text-[13px])
- Border radius: `8px` (`rounded-button`)
- Transitions: `duration-100` (fast, not sluggish)
- Disabled: `opacity-40` (not 50 — more intentional)
- No shadows on buttons. No inset highlights. Flat and clean.

---

## Badges

Small, slightly rounded rectangles. Not pills.

```ts
default: "bg-surface-secondary text-text-secondary"
success: "bg-success-subtle text-emerald-700"
warning: "bg-warning-subtle text-amber-700"
danger:  "bg-danger-subtle text-red-700"
accent:  "bg-accent-subtle text-blue-700"
```

- `text-[11px] font-medium`
- `rounded-badge` (6px) — not fully rounded, more structured
- `px-2 py-0.5` — compact

---

## Inputs

Clean and quiet. Focus state uses dark tint, not blue rings.

```tsx
"border border-border rounded-input"                           // resting
"focus:ring-2 focus:ring-text-primary/10 focus:border-text-primary/30"  // focused
```

- `text-[13px]` for input text
- `px-3 py-2` for padding
- Error state: `border-danger` with `text-[12px] text-danger` message below
- Labels: `text-[13px] font-medium text-text-primary mb-1.5`
- Transitions: `duration-100`

---

## Modals

White card on a dark overlay. No blur — just darkness.

```tsx
// Overlay
"bg-black/60"  // 60% black, no backdrop-blur

// Card
"bg-surface rounded-card shadow-2xl max-w-md"

// Header: title with bottom border
// Body: px-6 py-5
// Footer: right-aligned buttons with top border, gap-2
```

- Animation: `fadeIn 120ms ease-out`
- Escape closes. Click overlay closes.
- No `X` close button — the overlay click and Escape are enough

---

## Stats

Just numbers and labels. No card containers. No borders. Whitespace separates them.

```tsx
<div className="flex gap-10 pb-8 border-b border-border">
  <div>
    <p className="text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
    <p className="text-[12px] text-text-tertiary mt-1">{label}</p>
  </div>
  {/* repeat */}
</div>
```

Number first, label below. The visual weight of the number speaks for itself.

---

## Lists

Row-based with dividers. Not card-per-item.

```tsx
<div className="divide-y divide-border">
  {items.map(item => (
    <div className="py-4">
      {/* row content */}
    </div>
  ))}
</div>
```

- Expand inline for details (no separate page/modal)
- Actions appear on hover or stay visible as ghost buttons
- Destructive actions (Remove, Delete) use `text-danger`
- Chevron for expand/collapse: 12x12 SVG, rotates 180deg

---

## Empty States

Minimal. SVG icon in a dashed border box. Short text. Optional action button.

```tsx
<div className="w-10 h-10 rounded-lg border border-dashed border-border flex items-center justify-center">
  <svg>...</svg>  // 16x16, strokeWidth 1.5
</div>
<h3 className="text-[13px] font-medium text-text-primary">{title}</h3>
<p className="text-[12px] text-text-tertiary">{description}</p>
```

No emojis. No illustrations. No "Get started!" enthusiasm.

---

## The Island Pattern (Chat UI)

Used in the main chat interface for tab navigation.

```text
┌─────────────────────────────────────────────────┐
│  ┌──────────┐  Tab 2   Fix bug   API refactor   │   ○+   ○↺
│  │ Tab 1  ● │                                    │
│  └──────────┘                                    │
└─────────────────────────────────────────────────┘
```

```ts
const ISLAND_BG = "bg-black/[0.025] dark:bg-white/[0.04] border border-black/[0.03] dark:border-white/[0.04]"

const PILL_ACTIVE =
  "bg-white dark:bg-white/10 text-black dark:text-white shadow-[0_1px_4px_rgba(0,0,0,0.1),0_0_1px_rgba(0,0,0,0.05)]"

const PILL_INACTIVE =
  "text-black/35 dark:text-white/35 hover:text-black/55 dark:hover:text-white/55 cursor-pointer"
```

- Active pill: white bg, dual shadow, green dot, full-black text
- Inactive: no bg, no border, faded text
- Action circles outside the island share `ISLAND_BG`

### The Dot

`size-1.5 rounded-full` — used meaningfully:
- Emerald (`bg-emerald-500`) — active/live
- Gray (`bg-black/10`) — inactive/dormant
- Black (`bg-black`) — separator

### Dropdowns (Chat)

Frosted glass on a portal:
```
bg-white/80 dark:bg-neutral-900/80
backdrop-blur-xl
border border-black/[0.06]
rounded-2xl
shadow-[0_4px_16px_rgba(0,0,0,0.08)]
```

Items stagger with `fadeSlideIn` animation (200ms base, 40ms between items).

---

## Opacity Scale (Chat UI)

| Value | Use |
|---|---|
| `/[0.025]` | Island/container background |
| `/[0.03-0.04]` | Island borders |
| `/[0.06-0.08]` | Dividers, dropdown borders |
| `/10` | Dormant dots |
| `/20-25` | Hint text, timestamps |
| `/30` | Placeholder text |
| `/35` | Inactive tab text |
| `/50-55` | Icon hover states |
| `full` | Active text |

---

## Transitions

| Duration | Use |
|---|---|
| `duration-100` | Buttons, inputs, nav items — snappy |
| `duration-150` | Nav buttons with `ease-out` |
| `duration-200` | Pills, hovers, color changes — standard |
| `duration-300` | Hint text fade-in — slower = more subtle |

Use `transition-colors` when only color changes. Use `transition-all` when shadow + color + bg change together.

---

## What We Don't Do

- No emojis (use SVG or nothing)
- No gradients
- No colored container backgrounds (only black/white at low opacity, or semantic fills for badges)
- No card-per-item in lists (use rows with dividers)
- No heavy shadows (dark bg provides contrast naturally)
- No indigo/purple as primary action color (primary buttons are near-black)
- No icons with strokeWidth > 2
- No `rounded-md` — minimum `rounded-lg`
- No slide-in-from-left/right animations
- No tooltips when context is obvious
- No "Untitled" as placeholder — name things or don't show them
- No confirmation dialogs for reversible actions
- No decorative elements that don't communicate something
