export function getParentFilePath(filePath: string): string {
  const index = filePath.lastIndexOf("/")
  return index > 0 ? filePath.slice(0, index) : ""
}
