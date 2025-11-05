import { FilesystemStorage } from "@alive-brug/images"

export const imageStorage = new FilesystemStorage({
  basePath: process.env.IMAGES_STORAGE_PATH || "/srv/webalive/storage",
  signatureSecret: process.env.IMAGES_SIGNATURE_SECRET,
})
