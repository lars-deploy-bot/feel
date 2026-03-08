interface BuildInfo {
  commit: string
  branch: string
  buildTime: string
}

const buildInfo: BuildInfo = {
  commit: process.env.NEXT_PUBLIC_BUILD_COMMIT || "unknown",
  branch: process.env.NEXT_PUBLIC_BUILD_BRANCH || "unknown",
  buildTime: process.env.NEXT_PUBLIC_BUILD_TIME || new Date().toISOString(),
}

export function getBuildInfo(): BuildInfo {
  return buildInfo
}

export default buildInfo
