"use client"

import { create } from "zustand"

const IMAGE_PATH_PREFIX = "/_images/"

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

function transformImageVariants(image: UploadedImage): UploadedImage {
  return {
    ...image,
    variants: {
      orig: `${IMAGE_PATH_PREFIX}${image.variants.orig}`,
      w640: `${IMAGE_PATH_PREFIX}${image.variants.w640}`,
      w1280: `${IMAGE_PATH_PREFIX}${image.variants.w1280}`,
      thumb: `${IMAGE_PATH_PREFIX}${image.variants.thumb}`,
    },
  }
}

// State interface
interface ImageState {
  images: UploadedImage[]
  loading: boolean
  error: string | null
}

// Actions interface - grouped under stable object (Guide §14.3)
interface ImageActions {
  actions: {
    loadImages: (workspace?: string) => Promise<void>
  }
}

// Extended type for backwards compatibility
type ImageStoreWithCompat = ImageState &
  ImageActions & {
    // Legacy direct action export for backwards compatibility
    loadImages: (workspace?: string) => Promise<void>
  }

const useImageStoreBase = create<ImageStoreWithCompat>((set, get) => {
  const loadImages = async (workspace?: string) => {
    const currentState = get()
    if (currentState.loading) return

    set({ loading: true, error: null })

    try {
      const url = new URL("/api/images/list", window.location.origin)
      if (workspace) {
        url.searchParams.set("workspace", workspace)
      }

      const response = await fetch(url.toString())
      if (!response.ok) {
        throw new Error("Failed to load images")
      }

      const data = await response.json()
      const transformedImages = (data.images || []).map(transformImageVariants)

      set({
        images: transformedImages,
        loading: false,
        error: null,
      })
    } catch (err) {
      console.error("Failed to load images:", err)
      set({
        images: [],
        loading: false,
        error: err instanceof Error ? err.message : "Failed to load images",
      })
    }
  }

  const actions = { loadImages }
  return {
    images: [],
    loading: false,
    error: null,
    actions,
    // Legacy direct export for backwards compatibility
    ...actions,
  }
})

// Atomic selector: images list (Guide §14.1)
export const useImages = () => useImageStoreBase(state => state.images)

// Atomic selector: loading state (Guide §14.1)
export const useImagesLoading = () => useImageStoreBase(state => state.loading)

// Atomic selector: error state (Guide §14.1)
export const useImagesError = () => useImageStoreBase(state => state.error)

// Actions hook - stable reference (Guide §14.3)
export const useImageActions = () => useImageStoreBase(state => state.actions)

// Legacy export for backwards compatibility
export const useImageStore = useImageStoreBase
