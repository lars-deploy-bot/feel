"use client"

import { AlertTriangle } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"

interface DeleteProjectModalProps {
  hostname: string
  /** The short display name the user must type to confirm */
  confirmName: string
  onConfirm: () => void
  onClose: () => void
}

export function DeleteProjectModal({ hostname, confirmName, onConfirm, onClose }: DeleteProjectModalProps) {
  const [value, setValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const matches = value === confirmName

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [onClose])

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (matches) onConfirm()
    },
    [matches, onConfirm],
  )

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-[#faf8f5] dark:bg-[#1a1816] border border-red-500/20 rounded-2xl shadow-2xl">
        <form onSubmit={handleSubmit}>
          <div className="p-6">
            {/* Warning icon + title */}
            <div className="flex items-start gap-3 mb-4">
              <div className="size-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} className="text-red-500" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-[#2c2a26] dark:text-[#e8e4dc]">Delete project</h3>
                <p className="text-sm text-[#8a8578] dark:text-[#7a756b] mt-0.5">
                  This will permanently delete <strong className="text-[#2c2a26] dark:text-[#e8e4dc]">{hostname}</strong> and
                  all its files. This cannot be undone.
                </p>
              </div>
            </div>

            {/* Confirmation input */}
            <div className="mt-5">
              <label htmlFor="delete-confirm" className="block text-xs font-medium text-[#8a8578] dark:text-[#7a756b] mb-2">
                Type <strong className="text-[#2c2a26] dark:text-[#e8e4dc]">{confirmName}</strong> to confirm
              </label>
              <input
                ref={inputRef}
                id="delete-confirm"
                type="text"
                value={value}
                onChange={e => setValue(e.target.value)}
                placeholder={confirmName}
                autoComplete="off"
                spellCheck={false}
                className="w-full px-4 py-2.5 bg-white/50 dark:bg-white/[0.03] border border-red-500/20 dark:border-red-500/15 rounded-xl text-sm text-[#2c2a26] dark:text-[#e8e4dc] placeholder:text-[#b5afa3] dark:placeholder:text-[#5c574d] focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500/30 transition-all duration-150"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[#4a7c59]/[0.06] dark:border-[#7cb88a]/[0.04]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium text-[#5c574d] dark:text-[#b5afa3] hover:bg-[#4a7c59]/[0.04] dark:hover:bg-[#7cb88a]/[0.04] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!matches}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-red-500 text-white hover:bg-red-600 disabled:opacity-30 disabled:hover:bg-red-500 transition-all"
            >
              Delete permanently
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
