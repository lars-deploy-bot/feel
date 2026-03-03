import { describe, expect, it } from "vitest"
import { formDataToObject } from "../form-data"

describe("formDataToObject", () => {
  it("preserves File values instead of stringifying them", () => {
    const formData = new FormData()
    const file = new File(["hello"], "hello.txt", { type: "text/plain" })
    formData.append("file", file)

    const parsed = formDataToObject(formData)

    expect(parsed.file).toBeInstanceOf(File)
    expect((parsed.file as File).name).toBe("hello.txt")
  })

  it("keeps repeated keys as arrays", () => {
    const formData = new FormData()
    formData.append("tags", "a")
    formData.append("tags", "b")

    const parsed = formDataToObject(formData)
    expect(parsed.tags).toEqual(["a", "b"])
  })
})
