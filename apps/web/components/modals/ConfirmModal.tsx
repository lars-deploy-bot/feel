"use client"

import type { ReactNode } from "react"

interface ConfirmModalProps {
  title: string
  message: ReactNode
  confirmText?: string
  cancelText?: string
  confirmStyle?: "danger" | "primary" | "warning"
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  title,
  message,
  confirmText = "Continue",
  cancelText = "Cancel",
  confirmStyle = "primary",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const confirmButtonClass =
    confirmStyle === "danger"
      ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200"
      : "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200"

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-sm"
        onClick={e => e.stopPropagation()}
        role="document"
      >
        <div className="p-6">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
          <div className="text-[13px] text-zinc-400 dark:text-zinc-500 mt-2 leading-relaxed">{message}</div>
        </div>

        <div className="px-6 pb-6 flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 px-4 text-[13px] text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg transition-colors duration-100"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`h-9 px-5 text-[13px] font-medium rounded-lg transition-colors duration-100 ${confirmButtonClass}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
