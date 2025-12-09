/**
 * Alive Tagger Vite Plugin
 *
 * Intercepts React's jsx-dev-runtime to inject source tracking into every element.
 * This enables click-to-select functionality in the Claude Bridge sandbox.
 */

import type { Plugin, ResolvedConfig } from "vite"
import type { AliveTaggerOptions } from "./types"

// The JSX dev runtime code as a string (will be bundled inline)
const JSX_DEV_RUNTIME_CODE = `
import * as React from "react"
import * as ReactJSXDevRuntime from "react/jsx-dev-runtime"

const _jsxDEV = ReactJSXDevRuntime.jsxDEV
export const Fragment = ReactJSXDevRuntime.Fragment

const SOURCE_KEY = Symbol.for("__aliveSource__")
const sourceElementMap = new Map()
window.aliveSourceMap = sourceElementMap

function cleanFileName(fileName) {
  if (!fileName) return ""
  let clean = fileName
  if (clean.includes("?")) clean = clean.split("?")[0]
  clean = clean.replace(/^\\/+/, "")
  if (clean.includes("node_modules")) return ""
  return clean
}

function getSourceKey(fileName, lineNumber, columnNumber) {
  return fileName + ":" + lineNumber + ":" + columnNumber
}

function registerElement(node, fileName, lineNumber, columnNumber) {
  const key = getSourceKey(fileName, lineNumber, columnNumber)
  if (!sourceElementMap.has(key)) {
    sourceElementMap.set(key, new Set())
  }
  sourceElementMap.get(key).add(new WeakRef(node))
}

function unregisterElement(node, fileName, lineNumber, columnNumber) {
  const key = getSourceKey(fileName, lineNumber, columnNumber)
  const refs = sourceElementMap.get(key)
  if (refs) {
    for (const ref of refs) {
      if (ref.deref() === node) {
        refs.delete(ref)
        break
      }
    }
    if (refs.size === 0) {
      sourceElementMap.delete(key)
    }
  }
}

function getTypeName(type) {
  if (typeof type === "string") return type
  if (typeof type === "function") return type.displayName || type.name || "Unknown"
  if (typeof type === "object" && type !== null) {
    return type.displayName || type.render?.displayName || type.render?.name || "Unknown"
  }
  return "Unknown"
}

export function jsxDEV(type, props, key, isStatic, source, self) {
  const fileName = cleanFileName(source?.fileName)
  if (!fileName || !source?.lineNumber) {
    return _jsxDEV(type, props, key, isStatic, source, self)
  }

  const lineNumber = source.lineNumber
  const columnNumber = source.columnNumber || 0
  const displayName = getTypeName(type)

  const sourceInfo = { fileName, lineNumber, columnNumber, displayName }
  const originalRef = props?.ref

  const enhancedProps = {
    ...props,
    ref: (node) => {
      if (node && node instanceof Element) {
        const existing = node[SOURCE_KEY]
        if (existing) {
          const existingKey = getSourceKey(existing.fileName, existing.lineNumber, existing.columnNumber)
          const newKey = getSourceKey(fileName, lineNumber, columnNumber)
          if (existingKey !== newKey) {
            unregisterElement(node, existing.fileName, existing.lineNumber, existing.columnNumber)
            node[SOURCE_KEY] = sourceInfo
            registerElement(node, fileName, lineNumber, columnNumber)
          }
        } else {
          node[SOURCE_KEY] = sourceInfo
          registerElement(node, fileName, lineNumber, columnNumber)
        }
      }
      if (typeof originalRef === "function") {
        originalRef(node)
      } else if (originalRef && typeof originalRef === "object" && "current" in originalRef) {
        originalRef.current = node
      }
    },
  }

  return _jsxDEV(type, enhancedProps, key, isStatic, source, self)
}
`

/**
 * Create the alive-tagger Vite plugin
 */
export function aliveTagger(options: AliveTaggerOptions = {}): Plugin {
  const { enabled = true, debug = false } = options

  let config: ResolvedConfig

  const log = (...args: unknown[]) => {
    if (debug) {
      console.log("[alive-tagger]", ...args)
    }
  }

  return {
    name: "alive-tagger",
    enforce: "pre",

    configResolved(resolvedConfig) {
      config = resolvedConfig
      log("Config resolved, mode:", config.mode)
    },

    resolveId(id, importer) {
      // Only intercept in development mode and when enabled
      if (!enabled || config?.mode !== "development") {
        return null
      }

      // Intercept react/jsx-dev-runtime imports
      // Don't intercept our own virtual module to avoid infinite loop
      if (id === "react/jsx-dev-runtime" && !importer?.includes("\0alive-jsx")) {
        log("Intercepting jsx-dev-runtime import from:", importer)
        return "\0alive-jsx/jsx-dev-runtime"
      }

      return null
    },

    load(id) {
      // Return our custom JSX dev runtime
      if (id === "\0alive-jsx/jsx-dev-runtime") {
        log("Loading custom jsx-dev-runtime")
        return JSX_DEV_RUNTIME_CODE
      }

      return null
    },
  }
}

// Default export for convenience
export default aliveTagger
