import { describe, expect, it } from "vitest"
import {
  aliveTagger,
  ELEMENT_SELECTED_MESSAGE_TYPE,
  formatSourceLocation,
  getElementSource,
  hasSourceInfo,
  isElementSelectedMessage,
  SOURCE_KEY,
} from "../src/index"
import type { SourceInfo } from "../src/types"

/**
 * Test wrappers for DOM-element utilities.
 *
 * `getElementSource` and `hasSourceInfo` accept `Element | null`, but in a
 * Node test environment we can't construct real DOM Elements. Instead of
 * using `as Element` assertions, these wrappers accept plain objects and
 * call the real functions via `Reflect.apply`, which accepts `unknown` args.
 * The functions only access symbol-keyed properties, so plain objects work
 * correctly at runtime.
 */
function isSourceInfo(value: unknown): value is SourceInfo {
  if (typeof value !== "object" || value === null) return false
  if (!("fileName" in value) || !("lineNumber" in value)) return false
  if (!("columnNumber" in value) || !("displayName" in value)) return false
  // After `in` narrowing, TypeScript knows these properties exist on value
  const { fileName, lineNumber } = value
  return typeof fileName === "string" && typeof lineNumber === "number"
}

function testGetElementSource(obj: Record<symbol, unknown> | null): SourceInfo | undefined {
  // Reflect.apply calls the function with the provided args.
  // The result is `unknown`, so we narrow with a type guard.
  const result: unknown = Reflect.apply(getElementSource, undefined, [obj])
  if (result === undefined) return undefined
  if (isSourceInfo(result)) return result
  return undefined
}

function testHasSourceInfo(obj: Record<symbol, unknown> | null): boolean {
  const result: unknown = Reflect.apply(hasSourceInfo, undefined, [obj])
  return result === true
}

describe("index exports", () => {
  describe("aliveTagger", () => {
    it("is exported as a function", () => {
      expect(typeof aliveTagger).toBe("function")
    })

    it("returns a Vite plugin object", () => {
      const plugin = aliveTagger()
      expect(plugin).toHaveProperty("name", "alive-tagger")
      expect(plugin).toHaveProperty("enforce", "pre")
      expect(plugin).toHaveProperty("configResolved")
      expect(plugin).toHaveProperty("resolveId")
      expect(plugin).toHaveProperty("load")
      expect(plugin).toHaveProperty("transformIndexHtml")
    })

    it("accepts options", () => {
      const plugin = aliveTagger({ enabled: false, debug: true })
      expect(plugin.name).toBe("alive-tagger")
    })
  })

  describe("getElementSource", () => {
    it("returns undefined for null", () => {
      expect(testGetElementSource(null)).toBeUndefined()
    })

    it("returns undefined for element without source", () => {
      const mockElement: Record<symbol, unknown> = {}
      expect(testGetElementSource(mockElement)).toBeUndefined()
    })

    it("returns source info when present", () => {
      const sourceInfo: SourceInfo = {
        fileName: "test.tsx",
        lineNumber: 10,
        columnNumber: 5,
        displayName: "TestComponent",
      }
      const mockElement: Record<symbol, unknown> = {
        [SOURCE_KEY]: sourceInfo,
      }

      expect(testGetElementSource(mockElement)).toEqual(sourceInfo)
    })
  })

  describe("hasSourceInfo", () => {
    it("returns false for null", () => {
      expect(testHasSourceInfo(null)).toBe(false)
    })

    it("returns false for element without source", () => {
      const mockElement: Record<symbol, unknown> = {}
      expect(testHasSourceInfo(mockElement)).toBe(false)
    })

    it("returns true when source info is present", () => {
      const mockElement: Record<symbol, unknown> = {
        [SOURCE_KEY]: {
          fileName: "test.tsx",
          lineNumber: 10,
          columnNumber: 5,
          displayName: "TestComponent",
        },
      }

      expect(testHasSourceInfo(mockElement)).toBe(true)
    })
  })

  describe("formatSourceLocation", () => {
    it("formats source info correctly", () => {
      const source: SourceInfo = {
        fileName: "client/pages/Index.tsx",
        lineNumber: 42,
        columnNumber: 10,
        displayName: "Index",
      }
      expect(formatSourceLocation(source)).toBe("client/pages/Index.tsx:42:10")
    })

    it("handles zero column number", () => {
      const source: SourceInfo = {
        fileName: "test.tsx",
        lineNumber: 1,
        columnNumber: 0,
        displayName: "Test",
      }
      expect(formatSourceLocation(source)).toBe("test.tsx:1:0")
    })
  })

  describe("isElementSelectedMessage", () => {
    it("returns false for null", () => {
      expect(isElementSelectedMessage(null)).toBe(false)
    })

    it("returns false for undefined", () => {
      expect(isElementSelectedMessage(undefined)).toBe(false)
    })

    it("returns false for string", () => {
      expect(isElementSelectedMessage("not a message")).toBe(false)
    })

    it("returns false for object with wrong type", () => {
      expect(isElementSelectedMessage({ type: "wrong-type", context: {} })).toBe(false)
    })

    it("returns false for object missing context", () => {
      expect(isElementSelectedMessage({ type: ELEMENT_SELECTED_MESSAGE_TYPE })).toBe(false)
    })

    it("returns true for valid message", () => {
      const message = {
        type: ELEMENT_SELECTED_MESSAGE_TYPE,
        context: {
          fileName: "test.tsx",
          lineNumber: 10,
          columnNumber: 5,
          displayName: "Test",
          html: "<div>Test</div>",
          tagName: "div",
          className: "",
          id: "",
          parentComponents: [],
        },
      }
      expect(isElementSelectedMessage(message)).toBe(true)
    })
  })

  describe("re-exported constants", () => {
    it("exports SOURCE_KEY", () => {
      expect(SOURCE_KEY).toBe(Symbol.for("__aliveSource__"))
    })

    it("exports ELEMENT_SELECTED_MESSAGE_TYPE", () => {
      expect(ELEMENT_SELECTED_MESSAGE_TYPE).toBe("alive-element-selected")
    })
  })
})
