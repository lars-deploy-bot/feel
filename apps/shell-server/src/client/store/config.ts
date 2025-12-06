// Global configuration from server-rendered template
declare const __UPLOAD_PATH__: string

export const defaultUploadPath = typeof __UPLOAD_PATH__ !== "undefined" ? __UPLOAD_PATH__ : "/root/uploads"
