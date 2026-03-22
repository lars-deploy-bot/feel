// Canonical implementation: @webalive/shared formatFileSize (packages/shared/src/text-utils.ts)
// Duplicated here because shell-server-go client is a standalone Vite app without workspace deps.
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`
}
