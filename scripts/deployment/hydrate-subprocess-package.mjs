#!/usr/bin/env node

import { cpSync, existsSync, mkdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"

const [, , sourcePackageDirArg, standalonePackageDirArg] = process.argv

if (!sourcePackageDirArg || !standalonePackageDirArg) {
  console.error("Usage: hydrate-subprocess-package.mjs <source-package-dir> <standalone-package-dir>")
  process.exit(1)
}

const sourcePackageDir = path.resolve(sourcePackageDirArg)
const standalonePackageDir = path.resolve(standalonePackageDirArg)
const standaloneNodeModulesDir = path.join(standalonePackageDir, "node_modules")
const sourceRequire = createRequire(path.join(sourcePackageDir, "package.json"))

/**
 * Resolve the installed package dir for a dependency from the context of a parent package.
 */
function resolveInstalledPackage(packageName, parentPackageDir) {
  const parentRequire = createRequire(path.join(parentPackageDir, "package.json"))
  const resolutionPaths = parentRequire.resolve.paths(packageName) ?? []

  for (const resolutionPath of resolutionPaths) {
    const packageDir = path.join(resolutionPath, packageName)
    const packageJsonPath = path.join(packageDir, "package.json")
    if (!existsSync(packageJsonPath)) continue

    const packageJson = readPackageJson(packageJsonPath)
    if (packageJson.name === packageName) {
      return { packageDir, packageJsonPath }
    }
  }

  throw new Error(`Could not resolve installed package ${packageName} from ${parentPackageDir}`)
}

function readPackageJson(packageJsonPath) {
  return JSON.parse(readFileSync(packageJsonPath, "utf8"))
}

function listRuntimeDependencies(packageJson) {
  const dependencies = Object.keys(packageJson.dependencies ?? {}).map(packageName => ({
    packageName,
    optional: false,
  }))
  const optionalDependencies = Object.keys(packageJson.optionalDependencies ?? {}).map(packageName => ({
    packageName,
    optional: true,
  }))
  return [...dependencies, ...optionalDependencies]
}

function copyPackageTree(packageName, packageDir) {
  const targetDir = path.join(standaloneNodeModulesDir, packageName)
  mkdirSync(path.dirname(targetDir), { recursive: true })
  cpSync(packageDir, targetDir, { recursive: true, dereference: true, force: true })
}

const visited = new Set()
const queue = listRuntimeDependencies(readPackageJson(path.join(sourcePackageDir, "package.json"))).map(({ packageName, optional }) => ({
  packageName,
  optional,
  parentPackageDir: sourcePackageDir,
}))

mkdirSync(standaloneNodeModulesDir, { recursive: true })

while (queue.length > 0) {
  const next = queue.shift()
  if (!next) continue

  const { packageName, optional, parentPackageDir } = next
  if (packageName.startsWith("@webalive/")) continue

  let resolvedPackage
  try {
    resolvedPackage = resolveInstalledPackage(packageName, parentPackageDir)
  } catch (error) {
    if (optional) continue
    throw error
  }

  const { packageDir, packageJsonPath } = resolvedPackage
  if (!existsSync(packageDir)) {
    throw new Error(`Resolved package dir missing for ${packageName}: ${packageDir}`)
  }

  if (visited.has(packageJsonPath)) continue

  copyPackageTree(packageName, packageDir)
  visited.add(packageJsonPath)

  const packageJson = readPackageJson(packageJsonPath)
  for (const childDependency of listRuntimeDependencies(packageJson)) {
    if (childDependency.packageName.startsWith("@webalive/")) continue
    queue.push({
      packageName: childDependency.packageName,
      optional: childDependency.optional,
      parentPackageDir: packageDir,
    })
  }
}
