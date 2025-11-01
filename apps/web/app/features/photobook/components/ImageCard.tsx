import { Trash2 } from "lucide-react"
import Image from "next/image"
import { memo } from "react"

const IMAGE_PATH_PREFIX = "/_images/"

interface ImageCardProps {
  image: {
    key: string
    variants: {
      orig: string
      w640: string
      w1280: string
      thumb: string
    }
  }
  onDelete: (key: string) => void
  onZoom: (imageSrc: string) => void
  onCopy: (url: string, key: string) => void
  isCopied: boolean
}

export const ImageCard = memo(function ImageCard({ image, onDelete, onZoom, onCopy, isCopied }: ImageCardProps) {
  const imageUrl = `${IMAGE_PATH_PREFIX}${image.variants.orig}`
  const thumbnailUrl = `${IMAGE_PATH_PREFIX}${image.variants.w640}`

  return (
    <div className="masonry-item group">
      <div className="bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300">
        <div className="relative">
          <div
            className="cursor-pointer"
            onClick={() => onZoom(imageUrl)}
            onKeyDown={e => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onZoom(imageUrl)
              }
            }}
            role="button"
            tabIndex={0}
          >
            <Image
              src={thumbnailUrl}
              alt=""
              width={640}
              height={640}
              className="w-full h-auto"
              loading="lazy"
              unoptimized
            />
          </div>
          <button
            type="button"
            onClick={() => onDelete(image.key)}
            className="absolute top-4 right-4 p-3 md:p-2 bg-white/90 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-full backdrop-blur-sm opacity-0 group-hover:opacity-100 md:group-hover:opacity-100 sm:opacity-100 transition-all cursor-pointer min-w-[44px] min-h-[44px] md:min-w-auto md:min-h-auto flex items-center justify-center"
            aria-label="Delete image"
          >
            <Trash2 className="w-5 h-5 md:w-4 md:h-4" />
          </button>
        </div>

        <div className="p-6">
          <button
            type="button"
            onClick={() => onCopy(imageUrl, image.key)}
            className={`w-full py-3 rounded-2xl transition-all cursor-pointer text-sm font-medium ${
              isCopied ? "bg-black text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-700"
            }`}
            aria-label={isCopied ? "Link copied" : "Copy image link"}
          >
            {isCopied ? "Copied!" : "Copy Link"}
          </button>
        </div>
      </div>
    </div>
  )
})
