// Storage
export { ImageStorage } from "./storage/interface.js"
export { FilesystemStorage } from "./storage/filesystem.js"
export type { FilesystemStorageConfig } from "./storage/filesystem.js"

// Core
export { uploadImage } from "./core/upload.js"
export { compressImage, generateVariant } from "./core/compress.js"
export { generateContentHash } from "./core/hash.js"
export { generateStorageKey, parseStorageKey } from "./core/keys.js"

// Validation
export { validateImageType, getAllowedMimeTypes } from "./validation/magic-numbers.js"
export { validateFileSize, MAX_FILE_SIZE, MIN_FILE_SIZE } from "./validation/size-limits.js"

// Types
export type { HResponse } from "./types/response.js"
export { Rs } from "./types/response.js"
export type { StorageConfig, UploadOptions, UploadResult, Variant } from "./types/config.js"
export type { CompressOptions, CompressResult } from "./core/compress.js"
