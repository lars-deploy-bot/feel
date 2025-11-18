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
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmStyle = "primary",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const confirmButtonClass =
    confirmStyle === "danger"
      ? "bg-red-600 hover:bg-red-700 text-white"
      : confirmStyle === "warning"
        ? "bg-orange-600 hover:bg-orange-700 text-white"
        : "bg-blue-600 hover:bg-blue-700 text-white"

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white dark:bg-[#1a1a1a] rounded-lg shadow-xl w-full max-w-md animate-in fade-in-0 zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
        role="document"
      >
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
          <div className="text-sm text-gray-600 dark:text-gray-400">{message}</div>
        </div>

        <div className="px-6 pb-6 flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${confirmButtonClass}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
