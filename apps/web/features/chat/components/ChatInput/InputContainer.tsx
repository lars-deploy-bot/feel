"use client"

import type { ReactNode } from "react"

interface InputContainerProps {
  children: ReactNode
}

/**
 * InputContainer - bordered wrapper for the chat input
 */
export function InputContainer({ children }: InputContainerProps) {
  return (
    <div className="relative border-2 transition-all duration-200 border-black/20 dark:border-white/20 focus-within:border-black/40 dark:focus-within:border-white/40">
      {children}
    </div>
  )
}
