# SettingsModal Animation Test Enhancement

## Status: Future Enhancement

## Context

We fixed a bug where the SettingsModal used JS state (`isDesktop`) to control responsive animations. This caused the wrong animation on mobile during first render (SSR hydration issue).

**The bug:**
```tsx
const [isDesktop, setIsDesktop] = useState(true) // SSR default = wrong on mobile
useEffect(() => setIsDesktop(window.innerWidth >= 640), [])

<motion.div initial={isDesktop ? {clipPath:...} : {y:...}} />
```

**The fix:** Two separate containers with CSS visibility and hardcoded animations.

## Current Test

We have a source-code scanning test that catches the antipattern:
- `apps/web/components/modals/__tests__/SettingsModal.test.tsx`

## Future Enhancement: Mock Framer Motion

For stronger guarantees, we could mock `framer-motion` and verify the exact animation props:

```tsx
import { render } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"

// Capture props passed to motion.div
const motionDivProps: Record<string, unknown>[] = []

vi.mock("framer-motion", () => ({
  motion: {
    div: (props: Record<string, unknown>) => {
      motionDivProps.push(props)
      const { children, initial, animate, exit, ...rest } = props
      return <div {...rest}>{children}</div>
    },
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}))

import { SettingsModal } from "../SettingsModal"

describe("SettingsModal animations", () => {
  beforeEach(() => {
    motionDivProps.length = 0
  })

  it("mobile container uses slide-up animation (y transform)", () => {
    render(<SettingsModal onClose={() => {}} />)

    const mobileModal = motionDivProps.find(
      p => typeof p.className === "string" && p.className.includes("sm:hidden")
    )

    expect(mobileModal).toBeDefined()
    expect(mobileModal?.initial).toEqual({ y: "100%" })
    expect(mobileModal?.animate).toEqual({ y: 0 })
    expect(mobileModal?.exit).toEqual({ y: "100%" })
  })

  it("desktop container uses clip-path animation", () => {
    render(<SettingsModal onClose={() => {}} />)

    const desktopModal = motionDivProps.find(
      p => typeof p.className === "string" && p.className.includes("hidden sm:flex")
    )

    expect(desktopModal).toBeDefined()
    expect(desktopModal?.initial).toEqual({ clipPath: "inset(50% 50% 50% 50%)" })
    expect(desktopModal?.animate).toEqual({ clipPath: "inset(0% 0% 0% 0%)" })
  })
})
```

## Why This Is Deferred

The current source-scanning test is sufficient to prevent regression. The mock-based test would be more robust but:
1. Requires more setup (mocking framer-motion properly)
2. May need maintenance as framer-motion API evolves
3. Current test is simpler and catches the same bug

## When to Implement

Consider implementing if:
- We add more responsive animation components
- The source-scanning approach proves fragile
- We want a reusable pattern for testing framer-motion animations
