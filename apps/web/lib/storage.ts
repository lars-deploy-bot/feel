import { env } from "@webalive/env/server"
import { FilesystemStorage } from "@webalive/images"
import { PATHS } from "@webalive/shared"

export const imageStorage = new FilesystemStorage({
  basePath: PATHS.IMAGES_STORAGE,
  signatureSecret: env.IMAGES_SIGNATURE_SECRET,
})
