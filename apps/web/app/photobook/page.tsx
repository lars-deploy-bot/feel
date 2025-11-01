"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Image as ImageIcon, Trash2, ArrowLeft, Copy } from "lucide-react"
import { getErrorMessage } from "@/lib/error-codes"

interface UploadedImage {
  key: string
  variants: {
    orig: string
    w640: string
    w1280: string
    thumb: string
  }
  uploadedAt: string
}

export default function PhotobookPage() {
  const router = useRouter()
  const [images, setImages] = useState<UploadedImage[]>([])
  const [uploading, setUploading] = useState(false)
  const [loadingImages, setLoadingImages] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [copiedImages, setCopiedImages] = useState<Set<string>>(new Set())
  const [showDropHint, setShowDropHint] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [workspace, setWorkspace] = useState("")
  const [isTerminal, setIsTerminal] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [zoomedImage, setZoomedImage] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
    setIsTerminal(window.location.hostname.startsWith("terminal."))
  }, [])

  useEffect(() => {
    if (isTerminal) {
      const savedWorkspace = sessionStorage.getItem("workspace")
      if (savedWorkspace) {
        setWorkspace(savedWorkspace)
      } else {
        // Redirect to workspace setup
        router.push("/workspace")
        return
      }
    }
  }, [isTerminal, router])

  // Load existing images when workspace is ready
  useEffect(() => {
    if (mounted && (!isTerminal || workspace)) {
      loadImages()
    }
  }, [mounted, isTerminal, workspace])

  async function loadImages() {
    try {
      setLoadingImages(true)
      const url = new URL("/api/images/list", window.location.origin)

      // Add workspace parameter for terminal mode
      if (isTerminal && workspace) {
        url.searchParams.set("workspace", workspace)
      }

      const response = await fetch(url.toString())
      if (response.ok) {
        const data = await response.json()
        setImages(data.images || [])
      }
    } catch (err) {
      console.log("Could not load images:", err)
    } finally {
      setLoadingImages(false)
    }
  }

  async function handleUpload() {
    if (!selectedFiles || selectedFiles.length === 0) return

    setUploading(true)
    setError("")
    setSuccess("")

    try {
      const uploadPromises = Array.from(selectedFiles).map(async (file) => {
        const formData = new FormData()
        formData.append("file", file)

        // Add workspace parameter for terminal mode
        if (isTerminal && workspace) {
          formData.append("workspace", workspace)
        }

        const response = await fetch("/api/images/upload", {
          method: "POST",
          body: formData,
        })

        if (!response.ok) {
          const errorData = await response.json()
          const errorMessage = errorData.error ? getErrorMessage(errorData.error) : "Upload failed"
          throw new Error(errorMessage)
        }

        return await response.json()
      })

      const results = await Promise.all(uploadPromises)

      setSuccess(`Uploaded ${results.length} image${results.length > 1 ? 's' : ''}`)
      setSelectedFiles(null)
      // Reset file input
      const fileInput = document.getElementById("file-input") as HTMLInputElement
      if (fileInput) fileInput.value = ""

      // Reload images
      await loadImages()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    setSelectedFiles(e.target.files)
    setError("")
    setSuccess("")
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
      setError("")
      setSuccess("")
    }
  }

  async function deleteImage(key: string) {
    // Optimistically remove the image
    const imageToDelete = images.find(img => img.key === key)
    setImages(prev => prev.filter(img => img.key !== key))
    setDeleteConfirm(null)
    setError("")
    setSuccess("")

    try {
      const body: any = { key }

      // Add workspace parameter for terminal mode
      if (isTerminal && workspace) {
        body.workspace = workspace
      }

      const response = await fetch(`/api/images/delete`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        // Restore the image if deletion failed
        if (imageToDelete) {
          setImages(prev => [...prev, imageToDelete].sort((a, b) =>
            new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
          ))
        }
        setError("Failed to delete image. Please try again.")
      }
    } catch (err) {
      // Restore the image if deletion failed
      if (imageToDelete) {
        setImages(prev => [...prev, imageToDelete].sort((a, b) =>
          new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
        ))
      }
      setError("Failed to delete image. Please try again.")
    }
  }

  function confirmDelete(key: string) {
    setDeleteConfirm(key)
  }

  return (
    <div
      className={`min-h-screen bg-white text-black transition-all ${
        dragActive ? 'bg-blue-50' : ''
      }`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <div className="max-w-5xl mx-auto p-8">
        {/* Minimal Header */}
        <header className="flex items-center justify-between mb-16">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/chat")}
              className="p-2 text-black/30 hover:text-black transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-light">Photos</h1>
          </div>

          {/* Hidden file input */}
          <input
            id="file-input"
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          <div className="relative">
            <label
              htmlFor="file-input"
              className="px-8 py-3 md:px-6 md:py-2 bg-black text-white text-sm md:text-sm rounded-full hover:bg-gray-800 transition-all cursor-pointer font-medium"
              onMouseEnter={() => setShowDropHint(true)}
              onMouseLeave={() => setShowDropHint(false)}
            >
              Add Photos
            </label>

            {showDropHint && !('ontouchstart' in window) && (
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap animate-in fade-in-0 zoom-in-95 duration-200">
                You can also drop pics anywhere!
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
              </div>
            )}
          </div>
        </header>

        {/* Upload State */}
        {dragActive && (
          <div className="fixed inset-0 bg-blue-50/50 z-50"></div>
        )}

        {/* Selected Files State */}
        {selectedFiles && selectedFiles.length > 0 && (
          <div className={`text-center ${images.length === 0 ? 'py-32' : 'mb-12'}`}>
            <div className="bg-gray-50 rounded-3xl p-12 max-w-md mx-auto">
              <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center mx-auto mb-6">
                <ImageIcon className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-light text-gray-800 mb-3">
                {selectedFiles.length} image{selectedFiles.length > 1 ? 's' : ''} ready
              </h3>
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="px-8 py-3 bg-black text-white rounded-full hover:bg-gray-800 disabled:opacity-50 transition-all cursor-pointer font-medium"
              >
                {uploading ? 'Uploading...' : 'Upload Now'}
              </button>
            </div>
          </div>
        )}

        {/* Messages */}
        {error && (
          <div className="mb-8 text-center">
            <p className="text-red-600 bg-red-50 px-4 py-2 rounded-full inline-block">
              {error}
            </p>
          </div>
        )}

        {success && (
          <div className="mb-8 text-center">
            <p className="text-green-700 bg-green-50 px-6 py-3 rounded-full inline-block font-medium">
              {success}
            </p>
          </div>
        )}

        {/* Images - No artificial boundaries */}
        {images.length === 0 && !uploading && !selectedFiles && !loadingImages ? (
          <div className="text-center py-40">
            <h2 className="text-2xl font-light text-gray-600 mb-2">Drop images here</h2>
            <p className="text-gray-400 text-sm">or click Add Images above</p>
          </div>
        ) : loadingImages ? (
          <div className="text-center py-32">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
              <ImageIcon className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500">Loading your images...</p>
          </div>
        ) : images.length > 0 ? (
          <div className="masonry-grid">
            <style jsx>{`
              .masonry-grid {
                columns: 1;
                column-gap: 2rem;
              }
              @media (min-width: 640px) {
                .masonry-grid { columns: 2; }
              }
              @media (min-width: 1024px) {
                .masonry-grid { columns: 3; }
              }
              .masonry-item {
                break-inside: avoid;
                margin-bottom: 2rem;
              }
            `}</style>
            {images.map((image) => (
              <div key={image.key} className="masonry-item group">
                <div className="bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300">
                  <div className="relative">
                    <img
                      src={`/_images/${image.variants.w640}`}
                      alt=""
                      className="w-full h-auto cursor-pointer"
                      loading="lazy"
                      onClick={() => setZoomedImage(`/_images/${image.variants.orig}`)}
                    />
                    <button
                      onClick={() => confirmDelete(image.key)}
                      className="absolute top-4 right-4 p-3 md:p-2 bg-white/90 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-full backdrop-blur-sm opacity-0 group-hover:opacity-100 md:group-hover:opacity-100 sm:opacity-100 transition-all cursor-pointer min-w-[44px] min-h-[44px] md:min-w-auto md:min-h-auto flex items-center justify-center"
                    >
                      <Trash2 className="w-5 h-5 md:w-4 md:h-4" />
                    </button>
                  </div>

                  <div className="p-6">
                    <button
                      onClick={() => {
                        const url = `/_images/${image.variants.orig}`
                        navigator.clipboard.writeText(url)
                        setCopiedImages(prev => new Set(prev).add(image.key))
                        setTimeout(() => {
                          setCopiedImages(prev => {
                            const newSet = new Set(prev)
                            newSet.delete(image.key)
                            return newSet
                          })
                        }, 2000)
                      }}
                      className={`w-full py-3 rounded-2xl transition-all cursor-pointer text-sm font-medium ${
                        copiedImages.has(image.key)
                          ? 'bg-black text-white'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }`}
                    >
                      {copiedImages.has(image.key) ? 'Copied!' : 'Copy Link'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : uploading ? (
          <div className="text-center py-32">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
              <ImageIcon className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500">Processing your images...</p>
          </div>
        ) : null}

        {/* Image Zoom Modal */}
        {zoomedImage && (
          <div
            className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
            onClick={() => setZoomedImage(null)}
          >
            <div className="relative max-w-full max-h-full">
              <img
                src={zoomedImage}
                alt=""
                className="max-w-full max-h-full object-contain"
                onClick={(e) => e.stopPropagation()}
              />
              <button
                onClick={() => setZoomedImage(null)}
                className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 text-white rounded-full backdrop-blur-sm transition-all cursor-pointer"
              >
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setDeleteConfirm(null)}
          >
            <div
              className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-xl animate-in fade-in-0 zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-xl font-light text-gray-800 mb-2 text-center">
                Delete this image?
              </h3>
              <p className="text-gray-500 text-sm text-center mb-8">
                This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition-all cursor-pointer font-medium"
                >
                  No, keep it
                </button>
                <button
                  onClick={() => deleteImage(deleteConfirm)}
                  className="flex-1 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-full transition-all cursor-pointer font-medium"
                >
                  Yes, delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}