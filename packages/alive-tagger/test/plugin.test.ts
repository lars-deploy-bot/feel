import type { Plugin } from "vite"
import { describe, expect, it, vi } from "vitest"
import { aliveTagger } from "../src/plugin"

/**
 * Test helpers for calling Vite plugin hooks without type assertions.
 *
 * Vite's Plugin hooks have complex `this` context types (PluginContext,
 * MinimalPluginContext) and elaborate parameter/return types. Our plugin
 * doesn't use `this` in any hook, so we call them via function extraction
 * and runtime type narrowing.
 */

/** Extracts a hook function from a plugin, throwing if missing. */
function extractHook(plugin: Plugin, name: keyof Plugin): (...args: unknown[]) => unknown {
  const hook = plugin[name]
  if (typeof hook !== "function") {
    throw new Error(`Expected plugin.${name} to be a function, got ${typeof hook}`)
  }
  return hook
}

/** Call configResolved with a minimal config object. */
function applyConfigResolved(plugin: Plugin, mode: string): void {
  const fn = extractHook(plugin, "configResolved")
  fn({ mode })
}

/** Call resolveId and return string result or null. */
function applyResolveId(plugin: Plugin, id: string, importer?: string): string | null {
  const fn = extractHook(plugin, "resolveId")
  const result: unknown = fn(id, importer)
  if (typeof result === "string") return result
  return null
}

/** Call load and return string result or null. */
function applyLoad(plugin: Plugin, id: string): string | null {
  const fn = extractHook(plugin, "load")
  const result: unknown = fn(id)
  if (typeof result === "string") return result
  return null
}

/** Call transformIndexHtml and return the transformed HTML. */
function applyTransformIndexHtml(plugin: Plugin, html: string): string {
  const fn = extractHook(plugin, "transformIndexHtml")
  const result: unknown = fn(html)
  if (typeof result === "string") return result
  return html
}

describe("aliveTagger plugin", () => {
  describe("plugin creation", () => {
    it("creates plugin with correct name", () => {
      const plugin = aliveTagger()
      expect(plugin.name).toBe("alive-tagger")
    })

    it("uses pre enforcement", () => {
      const plugin = aliveTagger()
      expect(plugin.enforce).toBe("pre")
    })

    it("has all required hooks", () => {
      const plugin = aliveTagger()
      expect(typeof plugin.configResolved).toBe("function")
      expect(typeof plugin.resolveId).toBe("function")
      expect(typeof plugin.load).toBe("function")
      expect(typeof plugin.transformIndexHtml).toBe("function")
    })
  })

  describe("options", () => {
    it("defaults to enabled", () => {
      const plugin = aliveTagger()
      applyConfigResolved(plugin, "development")

      // Should intercept jsx-dev-runtime
      const result = applyResolveId(plugin, "react/jsx-dev-runtime", "src/App.tsx")
      expect(result).toBe("\0alive-jsx/jsx-dev-runtime")
    })

    it("respects enabled: false option", () => {
      const plugin = aliveTagger({ enabled: false })
      applyConfigResolved(plugin, "development")

      // Should NOT intercept when disabled
      const result = applyResolveId(plugin, "react/jsx-dev-runtime", "src/App.tsx")
      expect(result).toBeNull()
    })

    it("respects debug option", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {})
      const plugin = aliveTagger({ debug: true })
      applyConfigResolved(plugin, "development")

      // Debug logging should happen - first arg is the prefix
      expect(consoleSpy).toHaveBeenCalled()
      expect(consoleSpy.mock.calls[0][0]).toBe("[alive-tagger]")

      consoleSpy.mockRestore()
    })
  })

  describe("resolveId", () => {
    it("returns null in production mode", () => {
      const plugin = aliveTagger()
      applyConfigResolved(plugin, "production")

      const result = applyResolveId(plugin, "react/jsx-dev-runtime", "src/App.tsx")
      expect(result).toBeNull()
    })

    it("returns null for non jsx-dev-runtime imports", () => {
      const plugin = aliveTagger()
      applyConfigResolved(plugin, "development")

      const result = applyResolveId(plugin, "react", "src/App.tsx")
      expect(result).toBeNull()
    })

    it("intercepts react/jsx-dev-runtime in development", () => {
      const plugin = aliveTagger()
      applyConfigResolved(plugin, "development")

      const result = applyResolveId(plugin, "react/jsx-dev-runtime", "src/App.tsx")
      expect(result).toBe("\0alive-jsx/jsx-dev-runtime")
    })

    it("does not intercept its own virtual module", () => {
      const plugin = aliveTagger()
      applyConfigResolved(plugin, "development")

      // Importing from within our virtual module should not trigger interception
      const result = applyResolveId(plugin, "react/jsx-dev-runtime", "\0alive-jsx/something")
      expect(result).toBeNull()
    })
  })

  describe("load", () => {
    it("returns null for unknown ids", () => {
      const plugin = aliveTagger()
      const result = applyLoad(plugin, "unknown-module")
      expect(result).toBeNull()
    })

    it("returns JSX runtime code for virtual module", () => {
      const plugin = aliveTagger()
      const result = applyLoad(plugin, "\0alive-jsx/jsx-dev-runtime")
      expect(result).toContain("jsxDEV")
      expect(result).toContain("Fragment")
      expect(result).toContain("SOURCE_KEY")
      expect(result).toContain("sourceElementMap")
    })

    it("includes WeakRef cleanup interval", () => {
      const plugin = aliveTagger()
      const result = applyLoad(plugin, "\0alive-jsx/jsx-dev-runtime")
      expect(result).toContain("setInterval")
      expect(result).toContain("30000")
      expect(result).toContain("deref()")
    })
  })

  describe("transformIndexHtml", () => {
    it("returns unchanged html in production", () => {
      const plugin = aliveTagger()
      applyConfigResolved(plugin, "production")

      const html = "<html><body><div id='root'></div></body></html>"
      const result = applyTransformIndexHtml(plugin, html)
      expect(result).toBe(html)
    })

    it("returns unchanged html when disabled", () => {
      const plugin = aliveTagger({ enabled: false })
      applyConfigResolved(plugin, "development")

      const html = "<html><body><div id='root'></div></body></html>"
      const result = applyTransformIndexHtml(plugin, html)
      expect(result).toBe(html)
    })

    it("injects client script in development", () => {
      const plugin = aliveTagger()
      applyConfigResolved(plugin, "development")

      const html = "<html><body><div id='root'></div></body></html>"
      const result = applyTransformIndexHtml(plugin, html)

      // Should inject script before </body>
      expect(result).toContain('<script type="module">')
      expect(result).toContain("alive-tagger")
      expect(result).toContain("__aliveTaggerInitialized")
      expect(result).toContain("</body>")
    })

    it("injects client script with all UI elements", () => {
      const plugin = aliveTagger()
      applyConfigResolved(plugin, "development")

      const html = "<html><body></body></html>"
      const result = applyTransformIndexHtml(plugin, html)

      // Check for UI element IDs
      expect(result).toContain("alive-tagger-overlay")
      expect(result).toContain("alive-tagger-label")
      expect(result).toContain("alive-tagger-crosshair-h")
      expect(result).toContain("alive-tagger-crosshair-v")
      expect(result).toContain("alive-tagger-coords")
    })

    it("injects script with correct event handlers", () => {
      const plugin = aliveTagger()
      applyConfigResolved(plugin, "development")

      const html = "<html><body></body></html>"
      const result = applyTransformIndexHtml(plugin, html)

      // Check for event handlers
      expect(result).toContain("keydown")
      expect(result).toContain("keyup")
      expect(result).toContain("mousemove")
      expect(result).toContain("click")
      expect(result).toContain("blur")
    })

    it("injects postMessage for parent communication", () => {
      const plugin = aliveTagger()
      applyConfigResolved(plugin, "development")

      const html = "<html><body></body></html>"
      const result = applyTransformIndexHtml(plugin, html)

      expect(result).toContain("window.parent.postMessage")
      expect(result).toContain("alive-element-selected")
    })
  })
})
