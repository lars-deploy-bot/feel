interface BuildInfo {
  commit: string | undefined
  branch: string | undefined
  buildTime: string | undefined
}

const buildInfo: BuildInfo = {
  commit: process.env.NEXT_PUBLIC_BUILD_COMMIT,
  branch: process.env.NEXT_PUBLIC_BUILD_BRANCH,
  buildTime: process.env.NEXT_PUBLIC_BUILD_TIME,
}

export function getBuildInfo(): BuildInfo {
  return buildInfo
}

export default buildInfo
