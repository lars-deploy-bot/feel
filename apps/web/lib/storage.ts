import { env } from "@webalive/env/server"
import { FilesystemStorage } from "@webalive/images"
import { PATHS } from "@webalive/shared"

let _imageStorage: FilesystemStorage | undefined

export function getImageStorage(): FilesystemStorage {
  if (!_imageStorage) {
    if (!env.IMAGES_SIGNATURE_SECRET) {
      throw new Error("IMAGES_SIGNATURE_SECRET is required")
    }
    _imageStorage = new FilesystemStorage({
      basePath: PATHS.IMAGES_STORAGE,
      signatureSecret: env.IMAGES_SIGNATURE_SECRET,
    })
  }
  return _imageStorage
}
