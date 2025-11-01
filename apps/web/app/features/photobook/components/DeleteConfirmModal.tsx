import { Trash2 } from "lucide-react"

interface DeleteConfirmModalProps {
  onConfirm: () => void
  onCancel: () => void
}

export function DeleteConfirmModal({ onConfirm, onCancel }: DeleteConfirmModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
    >
      <div
        className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-xl animate-in fade-in-0 zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <Trash2 className="w-8 h-8 text-red-500" />
        </div>
        <h3 id="delete-dialog-title" className="text-xl font-light text-gray-800 mb-2 text-center">
          Delete this image?
        </h3>
        <p className="text-gray-500 text-sm text-center mb-8">This action cannot be undone.</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition-all cursor-pointer font-medium"
            aria-label="Cancel deletion"
          >
            No, keep it
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-full transition-all cursor-pointer font-medium"
            aria-label="Confirm deletion"
          >
            Yes, delete
          </button>
        </div>
      </div>
    </div>
  )
}
