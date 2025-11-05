"use client"

import type { ReactNode } from "react"

interface InputContainerProps {
  children: ReactNode
  isDragging: boolean
}

/**
 * InputContainer - bordered wrapper for the chat input
 * Handles drag state visual feedback with minimal design
 */
export function InputContainer({ children, isDragging }: InputContainerProps) {
  return (
    <div
      className={`relative border-2 transition-all duration-200 ${
        isDragging
          ? "border-black dark:border-white bg-black/[0.02] dark:bg-white/[0.02]"
          : "border-black/20 dark:border-white/20 focus-within:border-black/40 dark:focus-within:border-white/40"
      }`}
      data-dragging={isDragging ? "" : undefined}
    >
      {/* Minimal drag hint - integrated with design */}
      <div
        className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-200 ${
          isDragging ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="text-center">
          <p className="text-sm font-medium text-black/60 dark:text-white/60">Drop to attach</p>
        </div>
      </div>

      {/* Content - fade out slightly when dragging */}
      <div className={`transition-opacity duration-200 ${isDragging ? "opacity-30" : "opacity-100"}`}>{children}</div>
    </div>
  )
}
