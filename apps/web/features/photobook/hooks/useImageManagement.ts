import { useCallback, useState } from "react"
import { getErrorMessage } from "@/lib/error-codes"

const API_ENDPOINTS = {
  LIST: "/api/images/list",
  UPLOAD: "/api/images/upload",
  DELETE: "/api/images/delete",
} as const

export interface UploadedImage {
  key: string
  variants: {
    orig: string
    w640: string
    w1280: string
    thumb: string
  }
  uploadedAt: string
}

interface DeleteImageBody {
  key: string
  workspace?: string
}

function sortImagesByDate(images: UploadedImage[]): UploadedImage[] {
  return images.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
}

function buildDeleteBody(key: string, isTerminal: boolean, workspace: string): DeleteImageBody {
  const body: DeleteImageBody = { key }
  if (isTerminal && workspace) {
    body.workspace = workspace
  }
  return body
}

export function useImageManagement(isTerminal: boolean, workspace: string) {
  const [images, setImages] = useState<UploadedImage[]>([])
  const [loadingImages, setLoadingImages] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const clearMessages = useCallback(() => {
    setError("")
    setSuccess("")
  }, [])

  const loadImages = useCallback(async () => {
    try {
      setLoadingImages(true)
      const url = new URL(API_ENDPOINTS.LIST, window.location.origin)

      if (isTerminal && workspace) {
        url.searchParams.set("workspace", workspace)
      }

      const response = await fetch(url.toString())
      if (response.ok) {
        const data = await response.json()
        setImages(data.images || [])
      }
    } catch (err) {
      console.error("Could not load images:", err)
    } finally {
      setLoadingImages(false)
    }
  }, [isTerminal, workspace])

  const uploadImages = useCallback(
    async (files: FileList) => {
      setUploading(true)
      clearMessages()

      try {
        const uploadPromises = Array.from(files).map(async file => {
          const formData = new FormData()
          formData.append("file", file)

          if (isTerminal && workspace) {
            formData.append("workspace", workspace)
          }

          const response = await fetch(API_ENDPOINTS.UPLOAD, {
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
        setSuccess(`Uploaded ${results.length} image${results.length > 1 ? "s" : ""}`)
        await loadImages()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed")
      } finally {
        setUploading(false)
      }
    },
    [isTerminal, workspace, loadImages, clearMessages],
  )

  const deleteImage = useCallback(
    async (key: string) => {
      const imageToDelete = images.find(img => img.key === key)

      // Optimistically remove
      setImages(prev => prev.filter(img => img.key !== key))
      clearMessages()

      try {
        const body = buildDeleteBody(key, isTerminal, workspace)

        const response = await fetch(API_ENDPOINTS.DELETE, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })

        if (!response.ok) {
          // Restore on failure
          if (imageToDelete) {
            setImages(prev => sortImagesByDate([...prev, imageToDelete]))
          }
          setError("Failed to delete image. Please try again.")
        }
      } catch (_err) {
        // Restore on error
        if (imageToDelete) {
          setImages(prev => sortImagesByDate([...prev, imageToDelete]))
        }
        setError("Failed to delete image. Please try again.")
      }
    },
    [images, isTerminal, workspace, clearMessages],
  )

  return {
    images,
    loadingImages,
    uploading,
    error,
    success,
    loadImages,
    uploadImages,
    deleteImage,
    clearMessages,
  }
}
