"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"

// Feature hooks
import { useWorkspace, useImageManagement, useCopyToClipboard } from "./hooks"

// Feature components
import { ImageCard, UploadCard, DeleteConfirmModal, ImageZoomModal, MessageBanner, LoadingState } from "./components"

export default function PhotobookPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Workspace management
  const { workspace, isTerminal, mounted } = useWorkspace()

  // Image management
  const { images, loadingImages, uploading, error, success, loadImages, uploadImages, deleteImage, clearMessages } =
    useImageManagement(isTerminal, workspace)

  // Copy to clipboard
  const { copyToClipboard, isCopied } = useCopyToClipboard()

  // Local UI state
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null)
  const [showDropHint, setShowDropHint] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [zoomedImage, setZoomedImage] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // Load images when workspace is ready
  useEffect(() => {
    if (mounted && (!isTerminal || workspace)) {
      loadImages()
    }
  }, [mounted, isTerminal, workspace, loadImages])

  // Handlers
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    setSelectedFiles(e.target.files)
    clearMessages()
  }

  function handleDrag(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFiles(e.dataTransfer.files)
      clearMessages()
    }
  }

  async function handleUpload() {
    if (!selectedFiles) return

    await uploadImages(selectedFiles)
    setSelectedFiles(null)

    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  function handleDeleteConfirm() {
    if (deleteConfirm) {
      deleteImage(deleteConfirm)
      setDeleteConfirm(null)
    }
  }

  return (
    <div
      className={`min-h-screen bg-white text-black transition-all ${dragActive ? "bg-blue-50" : ""}`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <div className="max-w-5xl mx-auto p-8">
        {/* Header */}
        <header className="flex items-center justify-between mb-16">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/chat")}
              className="p-2 text-black/30 hover:text-black transition-colors cursor-pointer"
              aria-label="Back to chat"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-light">Photos</h1>
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            aria-label="Select images to upload"
          />

          <div className="relative">
            <label
              onClick={() => fileInputRef.current?.click()}
              className="px-8 py-3 md:px-6 md:py-2 bg-black text-white text-sm md:text-sm rounded-full hover:bg-gray-800 transition-all cursor-pointer font-medium"
              onMouseEnter={() => setShowDropHint(true)}
              onMouseLeave={() => setShowDropHint(false)}
              tabIndex={0}
              role="button"
              onKeyDown={e => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  fileInputRef.current?.click()
                }
              }}
            >
              Add Photos
            </label>

            {showDropHint && !("ontouchstart" in window) && (
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap animate-in fade-in-0 zoom-in-95 duration-200">
                You can also drop pics anywhere!
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
              </div>
            )}
          </div>
        </header>

        {/* Drag overlay */}
        {dragActive && <div className="fixed inset-0 bg-blue-50/50 z-50"></div>}

        {/* Upload card */}
        {selectedFiles && selectedFiles.length > 0 && (
          <UploadCard
            fileCount={selectedFiles.length}
            uploading={uploading}
            hasExistingImages={images.length > 0}
            onUpload={handleUpload}
          />
        )}

        {/* Messages */}
        {error && <MessageBanner message={error} type="error" />}
        {success && <MessageBanner message={success} type="success" />}

        {/* Image gallery or empty states */}
        {images.length === 0 && !uploading && !selectedFiles && !loadingImages ? (
          <div className="text-center py-40">
            <h2 className="text-2xl font-light text-gray-600 mb-2">Drop images here</h2>
            <p className="text-gray-400 text-sm">or click Add Images above</p>
          </div>
        ) : loadingImages ? (
          <LoadingState message="Loading your images..." />
        ) : images.length > 0 ? (
          <div className="masonry-grid">
            <style jsx>{`
              .masonry-grid {
                columns: 1;
                column-gap: 2rem;
              }
              @media (min-width: 640px) {
                .masonry-grid {
                  columns: 2;
                }
              }
              @media (min-width: 1024px) {
                .masonry-grid {
                  columns: 3;
                }
              }
              .masonry-item {
                break-inside: avoid;
                margin-bottom: 2rem;
              }
            `}</style>
            {images.map(image => (
              <ImageCard
                key={image.key}
                image={image}
                onDelete={setDeleteConfirm}
                onZoom={setZoomedImage}
                onCopy={copyToClipboard}
                isCopied={isCopied(image.key)}
              />
            ))}
          </div>
        ) : uploading ? (
          <LoadingState message="Processing your images..." />
        ) : null}

        {/* Modals */}
        {zoomedImage && <ImageZoomModal imageSrc={zoomedImage} onClose={() => setZoomedImage(null)} />}

        {deleteConfirm && (
          <DeleteConfirmModal onConfirm={handleDeleteConfirm} onCancel={() => setDeleteConfirm(null)} />
        )}
      </div>
    </div>
  )
}
