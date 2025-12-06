import type { CheckDirectoryResponse, UploadResponse } from "../types/api"

export async function checkDirectory(workspace: string, targetDir: string): Promise<CheckDirectoryResponse> {
  const formData = new FormData()
  formData.append("workspace", workspace)
  formData.append("targetDir", targetDir || "./")
  const res = await fetch("/api/check-directory", { method: "POST", body: formData })
  return res.json()
}

export async function uploadFile(
  file: File,
  workspace: string,
  targetDir: string,
  onProgress?: (progress: number) => void,
): Promise<UploadResponse> {
  const formData = new FormData()
  formData.append("file", file)
  formData.append("workspace", workspace)
  formData.append("targetDir", targetDir || "./")

  onProgress?.(30)
  const res = await fetch("/api/upload", { method: "POST", body: formData })
  onProgress?.(90)
  const result = await res.json()
  onProgress?.(100)
  return result
}
