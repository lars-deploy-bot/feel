---
name: design
description: The Alive design language. Reference this before building or modifying any UI. This is what we look like.
---

# Alive Design Language

This is our design. Read it before touching UI.

## Identity

Clean. Quiet. Intentional. The UI should feel like it's barely there — just enough structure to orient, then it gets out of the way. We don't decorate. We don't explain what's obvious. We trust whitespace.

**One word:** Restrained.

## The Island Pattern

Our primary navigation pattern. A group of items inside a soft, barely-visible pill container.

```
┌─────────────────────────────────────────────────┐
│  ┌──────────┐  Tab 2   Fix bug   API refactor   │   ○+   ○↺
│  │ Tab 1  ● │                                    │
│  └──────────┘                                    │
└─────────────────────────────────────────────────┘
                right-click to archive
```

**What makes it ours:**
- Container: `bg-black/[0.025]` with `border border-black/[0.03]` and `rounded-full` — you almost can't see it
- Active item: white pill with a pronounced lift shadow, pops out of the container
- Inactive items: `text-black/35` — they fade into the background until you need them
- Action buttons (+ and archive) sit **outside** the island as their own matching circles

**The shared constant:**
```ts
const ISLAND_BG = "bg-black/[0.025] dark:bg-white/[0.04] border border-black/[0.03] dark:border-white/[0.04]"
```

Use this everywhere an island appears. Tab bar, segment controls, toggle groups.

## The Dot

A `size-1.5 rounded-full` circle. We use it sparingly:

- **Emerald dot** (`bg-emerald-500`) — active/live state. Appears inside the active tab pill.
- **Gray dot** (`bg-black/10`) — inactive/dormant. Used in dropdowns to show items that *could* become active.
- **Black dot** (`bg-black`) — sometimes used as a separator between ghost text items.

The dot is never decorative. It always means something.

## The Active Pill

When something is selected, it gets the full treatment:

```ts
const PILL_ACTIVE =
  "bg-white dark:bg-white/10 text-black dark:text-white shadow-[0_1px_4px_rgba(0,0,0,0.1),0_0_1px_rgba(0,0,0,0.05)]"
```

- White background lifts it above the island
- Dual shadow: soft spread + tight 1px edge for depth
- Text goes full black
- Green dot appears

**Inactive:**
```ts
const PILL_INACTIVE =
  "text-black/35 dark:text-white/35 hover:text-black/55 dark:hover:text-white/55 cursor-pointer"
```

No background. No border. Just faded text that darkens on hover.

## Opacity Scale

We use opacity religiously. These values are non-negotiable:

| Value | Use |
|---|---|
| `/[0.025]` | Island/container background — barely there |
| `/[0.03-0.04]` | Island borders — visible if you look for them |
| `/[0.06-0.08]` | Dividers, dropdown borders |
| `/10` | Dormant dots, faintest UI elements |
| `/20-25` | Hint text, timestamps, icons at rest |
| `/30` | Placeholder text |
| `/35` | Inactive tab text, secondary content |
| `/40-45` | Dropdown item text, muted labels |
| `/50-55` | Icon hover states |
| `full` | Active text, selected items |

## Typography

- **Tab pills:** `text-[13px] font-medium` — slightly larger than 12px, clear but not loud
- **Hint text:** `text-[10px]` — the "right-click to archive" kind. Whisper-quiet.
- **Timestamps:** `text-[10px] tabular-nums` — always monospaced for alignment
- **No uppercase** except rare section headers in dropdowns

## Dropdowns

Frosted glass on a portal:

```
bg-white/80 dark:bg-neutral-900/80
backdrop-blur-xl
border border-black/[0.06]
rounded-2xl
shadow-[0_4px_16px_rgba(0,0,0,0.08)]
```

- Items stagger in with `fadeSlideIn` animation (200ms base, 40ms between items)
- Each item has a gray dot that turns emerald on hover
- Hover state matches the active pill: white background + subtle shadow
- No heavy headers. No "Closed" label needed — context is obvious.
- Timestamps in `text-[10px] text-black/20` at the right edge

## Action Circles

Standalone buttons that sit outside the island:

```ts
const ACTION_CIRCLE = `flex items-center justify-center size-8 rounded-full ${ISLAND_BG} transition-all duration-200`
```

Same background as the island. Same border. They belong to the same family but stand alone. Used for: add tab (+), archive history, settings toggles.

## Nav Bar

Top bar is `h-12` with a `border-b border-black/[0.04]` divider.

Buttons: `rounded-lg` (not full), `bg-black/[0.03]`, `active:scale-95` for a tactile press feel.

Icon size: `16px` with `strokeWidth={1.75}` — thinner than default Lucide.

## Hover Hints

Small instructional text that appears on hover:

```
text-[10px] text-black/0 group-hover/bar:text-black/25
transition-colors duration-300 select-none
```

Starts invisible. Fades to `text-black/25` — barely readable, just enough. Used for non-obvious interactions like "right-click to archive".

## Transitions

- **`duration-200`** — standard for everything (pills, hovers, color changes)
- **`duration-150`** — nav buttons with `ease-out` for snappy feel
- **`duration-300`** — hint text fade-in (slower = more subtle)
- **`transition-all`** — when shadow + color + background all change together
- **`transition-colors`** — when only color changes

## Dark Mode

Always ship dark variants. The pattern:

| Light | Dark |
|---|---|
| `bg-black/[0.025]` | `bg-white/[0.04]` |
| `border-black/[0.03]` | `border-white/[0.04]` |
| `text-black/35` | `text-white/35` |
| `bg-white` (active pill) | `bg-white/10` |
| `bg-white/80` (dropdown glass) | `bg-neutral-900/80` |

Dark borders and fills are slightly *more* opaque than light ones — dark backgrounds eat contrast.

## What We Don't Do

- No gradients
- No colored backgrounds on containers (only black/white at low opacity)
- No visible borders on chips or cards (use fills or shadows)
- No icons with strokeWidth > 2 (feels heavy)
- No `rounded-md` — too small. Minimum `rounded-lg`, prefer `rounded-full` for interactive elements
- No slide-in-from-left/right animations (feels like a mobile app transition)
- No tooltips when a hover hint or the context already makes it clear
- No "Untitled" as visible placeholder — name things or don't show them
- No confirmation dialogs for reversible actions (archiving a tab just archives it)
