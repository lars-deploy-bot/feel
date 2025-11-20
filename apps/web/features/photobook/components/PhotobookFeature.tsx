"use client"

import { ArrowLeft, Upload } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { DeleteModal } from "@/components/modals/DeleteModal"
import { useWorkspace } from "@/features/workspace/hooks/useWorkspace"
// Feature hooks
import { useCopyToClipboard, useImageManagement } from "../hooks"
// Feature components
import { ImageCard } from "./ImageCard"
import { LoadingState } from "./LoadingState"
import { ImageZoomModal, MessageBanner } from "./modals"

export default function PhotobookPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Workspace management
  const { workspace, isTerminal, mounted } = useWorkspace({ allowEmpty: true })

  // Image management
  const { images, loadingImages, uploading, error, success, loadImages, uploadImages, deleteImage, clearMessages } =
    useImageManagement(isTerminal, workspace || "")

  // Copy to clipboard
  const { copyToClipboard, isCopied } = useCopyToClipboard()

  // Local UI state
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
  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (files && files.length > 0) {
      clearMessages()
      await uploadImages(files)
      // Reset file input so same files can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
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

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      clearMessages()
      await uploadImages(files)
    }
  }

  function handleDeleteConfirm() {
    if (deleteConfirm) {
      deleteImage(deleteConfirm)
      setDeleteConfirm(null)
    }
  }

  return (
    <main
      className={`min-h-screen bg-white text-black transition-all ${dragActive ? "bg-blue-50" : ""}`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <div className="max-w-5xl mx-auto p-8">
        {/* Header */}
        <header className="mb-12">
          <div className="flex items-center gap-4 mb-3">
            <button
              type="button"
              onClick={() => router.push("/chat")}
              className="p-2 text-black/30 hover:text-black transition-colors cursor-pointer"
              aria-label="Back to chat"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-semibold">Photos</h1>
          </div>
          <p className="text-base text-gray-700 font-medium">Copy photo links and paste them in chat</p>
        </header>

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

        {/* Drag overlay */}
        {dragActive && (
          <div className="fixed inset-0 bg-blue-500/10 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-white rounded-xl shadow-xl p-10 border-4 border-dashed border-blue-500">
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center mb-3">
                  <Upload className="w-8 h-8 text-white" />
                </div>
                <p className="text-xl font-semibold text-gray-900">Drop to upload</p>
              </div>
            </div>
          </div>
        )}

        {/* Messages */}
        {error && <MessageBanner message={error} type="error" />}
        {success && <MessageBanner message={success} type="success" />}

        {/* Image gallery or empty states */}
        {images.length === 0 && !uploading && !loadingImages ? (
          <div className="text-center py-24">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex flex-col items-center cursor-pointer group"
            >
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-blue-100 mb-6 group-hover:bg-blue-200 transition-colors">
                <Upload className="w-12 h-12 text-blue-600" />
              </div>
              <h2 className="text-3xl font-semibold text-gray-900 mb-3">Drop photos here</h2>
              <p className="text-lg text-gray-600 mb-2">Drag files from your computer</p>
              <p className="text-base text-blue-600">or click to browse</p>
            </button>
          </div>
        ) : loadingImages ? (
          <LoadingState message="Loading your images..." />
        ) : images.length > 0 ? (
          <div className="masonry-grid">
            <style>{`
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

            {/* Add photos block - always first in grid */}
            <div className="masonry-item group">
              <div className="bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full aspect-square border-3 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-gray-400 transition-all cursor-pointer flex flex-col items-center justify-center gap-3"
                >
                  <div className="w-16 h-16 rounded-full bg-gray-200 group-hover:bg-gray-300 flex items-center justify-center transition-all">
                    <Upload className="w-8 h-8 text-gray-600" />
                  </div>
                  <span className="text-base font-semibold text-gray-700 group-hover:text-gray-900 transition-all">
                    Add Photos
                  </span>
                </button>
              </div>
            </div>

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
          <DeleteModal
            title="Delete this image?"
            message="This action cannot be undone."
            confirmText="Yes, delete"
            cancelText="No, keep it"
            onConfirm={handleDeleteConfirm}
            onCancel={() => setDeleteConfirm(null)}
          />
        )}
      </div>
    </main>
  )
}
