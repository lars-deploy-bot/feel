import { Plus } from "lucide-react"

interface ImageZoomModalProps {
  imageSrc: string
  onClose: () => void
}

export function ImageZoomModal({ imageSrc, onClose }: ImageZoomModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Zoomed image view"
    >
      <div className="relative max-w-full max-h-full">
        <img
          src={imageSrc}
          alt=""
          className="max-w-full max-h-full object-contain"
          onClick={(e) => e.stopPropagation()}
        />
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 text-white rounded-full backdrop-blur-sm transition-all cursor-pointer"
          aria-label="Close zoomed view"
        >
          <Plus className="w-6 h-6 rotate-45" />
        </button>
      </div>
    </div>
  )
}
