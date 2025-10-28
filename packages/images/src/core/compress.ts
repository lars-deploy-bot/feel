import { Transformer } from "@napi-rs/image"

export interface CompressOptions {
  maxWidth?: number
  targetSize?: number
  minQuality?: number
  maxQuality?: number
}

export interface CompressResult {
  buffer: Buffer
  width: number
  height: number
  size: number
}

/**
 * Compress image using binary search for optimal quality
 * Based on huurmatcher's battle-tested approach
 *
 * @param buffer - Original image buffer
 * @param options - Compression options
 * @returns Compressed image with metadata
 */
export async function compressImage(buffer: Buffer, options: CompressOptions = {}): Promise<CompressResult> {
  const {
    maxWidth = 1920,
    targetSize = 150 * 1024, // 150KB default
    minQuality = 1,
    maxQuality = 100,
  } = options

  // Create transformer
  const transformer = new Transformer(buffer)
  const metadata = await transformer.metadata()

  // Calculate resize dimensions (preserve aspect ratio)
  // Based on huurmatcher's approach: limit BOTH width and height
  let resizeWidth = metadata.width
  let resizeHeight = metadata.height
  const aspectRatio = metadata.width / metadata.height

  // Only resize if exceeds max dimension in either direction
  if (metadata.width > maxWidth || metadata.height > maxWidth) {
    if (aspectRatio > 1) {
      // Landscape: width is limiting dimension
      resizeWidth = maxWidth
      resizeHeight = Math.round(maxWidth / aspectRatio)
    } else {
      // Portrait or square: height is limiting dimension
      resizeWidth = Math.max(1, Math.round(maxWidth * aspectRatio))
      resizeHeight = maxWidth
    }
  }

  // Binary search for optimal quality
  let min = minQuality
  let max = maxQuality
  let bestBuffer: Buffer | null = null

  while (min <= max) {
    const mid = Math.floor((min + max) / 2)

    // Create new transformer for this iteration
    const testTransformer = new Transformer(buffer)

    // Resize if dimensions changed
    if (resizeWidth !== metadata.width || resizeHeight !== metadata.height) {
      testTransformer.resize(resizeWidth, resizeHeight)
    }

    // Convert to WebP with current quality
    const compressed = await testTransformer.webp(mid)

    if (compressed.length > targetSize) {
      // Too large, reduce quality
      max = mid - 1
    } else {
      // Good size, try higher quality
      bestBuffer = compressed
      min = mid + 1
    }
  }

  // If no suitable compression found, use lowest quality
  if (!bestBuffer) {
    const fallbackTransformer = new Transformer(buffer)
    if (resizeWidth !== metadata.width || resizeHeight !== metadata.height) {
      fallbackTransformer.resize(resizeWidth, resizeHeight)
    }
    bestBuffer = await fallbackTransformer.webp(minQuality)
  }

  // Get final dimensions
  const finalTransformer = new Transformer(bestBuffer)
  const finalMetadata = await finalTransformer.metadata()

  return {
    buffer: bestBuffer,
    width: finalMetadata.width,
    height: finalMetadata.height,
    size: bestBuffer.length,
  }
}

/**
 * Generate image variant (resize without binary search)
 */
export async function generateVariant(buffer: Buffer, width: number, quality = 85): Promise<CompressResult> {
  const transformer = new Transformer(buffer)
  const metadata = await transformer.metadata()

  // Calculate height maintaining aspect ratio
  const ratio = width / metadata.width
  const height = Math.round(metadata.height * ratio)

  // Resize and convert to WebP
  transformer.resize(width, height)
  const compressed = await transformer.webp(quality)

  return {
    buffer: compressed,
    width,
    height,
    size: compressed.length,
  }
}
