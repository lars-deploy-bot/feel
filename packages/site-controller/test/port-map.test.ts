import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { readTemplatePortMap } from "../src/executors/port-map"

describe("readTemplatePortMap", () => {
  const tempDirs: string[] = []

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it("reads template hostnames and ports from template env files", () => {
    const dir = mkdtempSync(join(tmpdir(), "template-envs-"))
    tempDirs.push(dir)

    writeFileSync(join(dir, "blank.test.example.env"), "PORT=3594\n")
    writeFileSync(join(dir, "template1.test.example.env"), "PORT=3352\n")

    expect(readTemplatePortMap(dir)).toEqual({
      "blank.test.example": 3594,
      "template1.test.example": 3352,
    })
  })

  it("ignores files without a valid PORT line", () => {
    const dir = mkdtempSync(join(tmpdir(), "template-envs-"))
    tempDirs.push(dir)
    mkdirSync(join(dir, "nested"))

    writeFileSync(join(dir, "blank.test.example.env"), "PORT=not-a-number\n")
    writeFileSync(join(dir, "template1.test.example.env"), "OTHER=1\n")
    writeFileSync(join(dir, "ignored.txt"), "PORT=9999\n")

    expect(readTemplatePortMap(dir)).toEqual({})
  })
})
