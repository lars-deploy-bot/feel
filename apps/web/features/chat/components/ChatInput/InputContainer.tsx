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
    <div className="relative rounded-3xl border border-black/[0.08] dark:border-white/[0.08] shadow-lg ring-1 ring-black/[0.06] dark:ring-white/[0.06] transition-[border-color,box-shadow] duration-150 ease-in-out focus-within:ring-black/[0.14] dark:focus-within:ring-white/[0.14] hover:ring-black/[0.10] dark:hover:ring-white/[0.10] focus-within:hover:ring-black/[0.14] dark:focus-within:hover:ring-white/[0.14] bg-white dark:bg-[#1a1a1a]">
      {children}
    </div>
  )
}
