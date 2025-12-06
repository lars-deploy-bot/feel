import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

describe("SettingsModal", () => {
  const filePath = path.join(__dirname, "../SettingsModal.tsx")
  const source = fs.readFileSync(filePath, "utf-8")

  /**
   * BUG PREVENTED:
   *
   * Using JS state (useState + window.innerWidth) to switch between
   * mobile/desktop animations causes wrong animation on first render.
   *
   * Example of the bug:
   *   const [isDesktop, setIsDesktop] = useState(true) // SSR default
   *   useEffect(() => setIsDesktop(window.innerWidth >= 640), [])
   *
   *   <motion.div initial={isDesktop ? {clipPath:...} : {y:...}} />
   *
   * On mobile: first render uses clipPath (wrong), then switches to y.
   *
   * ACCEPTABLE FIX: Use useIsDesktop() hook that returns null during SSR,
   * and check for null before rendering to prevent wrong animation.
   *
   * NOT ALLOWED: Direct useState + innerWidth check in the component.
   */
  describe("responsive animation pattern", () => {
    it("does not use JS state to control responsive animations", () => {
      // This pattern indicates the bug: defining isDesktop state directly in the component
      // Using useIsDesktop() hook is OK because it returns null during SSR
      const hasDirectIsDesktopState = source.includes("useState<boolean>") && source.includes("isDesktop")
      // Direct window.innerWidth check with useState is the problematic pattern
      const hasWindowCheck = source.includes("innerWidth") && source.includes("useState")

      expect(hasDirectIsDesktopState).toBe(false)
      expect(hasWindowCheck).toBe(false)
    })

    it("has separate mobile and desktop modal containers", () => {
      // Mobile container should be hidden on sm+ screens
      expect(source).toContain('className="sm:hidden')
      // Desktop container should be hidden below sm, visible on sm+
      expect(source).toContain('className="hidden sm:flex')
    })
  })
})
