import { parseGithubRepo } from "@/lib/deployment/github-import"

interface GithubRepoParts {
  owner: string
  repo: string
}

export interface GithubRepoWithUrls extends GithubRepoParts {
  canonicalUrl: string
  remoteUrl: string
}

export function tryParseGithubRepo(repoRef: string): GithubRepoParts | null {
  try {
    return parseGithubRepo(repoRef)
  } catch {
    return null
  }
}

export function buildCanonicalGithubRepoUrl(parts: GithubRepoParts): string {
  return `https://github.com/${parts.owner}/${parts.repo}`
}

export function buildGithubRemoteUrl(parts: GithubRepoParts): string {
  return `${buildCanonicalGithubRepoUrl(parts)}.git`
}

export function parseGithubRepoWithUrls(repoRef: string): GithubRepoWithUrls {
  const parsedRepo = parseGithubRepo(repoRef)
  return {
    ...parsedRepo,
    canonicalUrl: buildCanonicalGithubRepoUrl(parsedRepo),
    remoteUrl: buildGithubRemoteUrl(parsedRepo),
  }
}

export function tryParseGithubRepoWithUrls(repoRef: string): GithubRepoWithUrls | null {
  try {
    return parseGithubRepoWithUrls(repoRef)
  } catch {
    return null
  }
}
