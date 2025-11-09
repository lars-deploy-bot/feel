import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { existsSync, unlinkSync } from "node:fs"
import { join } from "node:path"
import { addFeedbackEntry, getAllFeedback, getFeedbackByWorkspace, loadFeedback } from "../feedback"

describe("Feedback Storage", () => {
  const testFeedbackPath = join(process.cwd(), "feedback.json")

  // Clean up test file before and after each test
  beforeEach(() => {
    if (existsSync(testFeedbackPath)) {
      unlinkSync(testFeedbackPath)
    }
  })

  afterEach(() => {
    if (existsSync(testFeedbackPath)) {
      unlinkSync(testFeedbackPath)
    }
  })

  it("should create empty feedback store when file doesn't exist", () => {
    const store = loadFeedback()
    expect(store).toEqual({ entries: [] })
  })

  it("should add feedback entry with generated id and timestamp", () => {
    const entry = addFeedbackEntry({
      workspace: "test.com",
      feedback: "This is great!",
    })

    expect(entry.id).toBeDefined()
    expect(entry.timestamp).toBeDefined()
    expect(entry.workspace).toBe("test.com")
    expect(entry.feedback).toBe("This is great!")
  })

  it("should save and retrieve feedback entries", () => {
    addFeedbackEntry({
      workspace: "example.com",
      feedback: "Feature request",
    })

    addFeedbackEntry({
      workspace: "demo.com",
      feedback: "Bug report",
    })

    const allFeedback = getAllFeedback()
    expect(allFeedback).toHaveLength(2)
    expect(allFeedback[0].workspace).toBe("example.com")
    expect(allFeedback[1].workspace).toBe("demo.com")
  })

  it("should filter feedback by workspace", () => {
    addFeedbackEntry({
      workspace: "example.com",
      feedback: "Feedback 1",
    })

    addFeedbackEntry({
      workspace: "example.com",
      feedback: "Feedback 2",
    })

    addFeedbackEntry({
      workspace: "other.com",
      feedback: "Feedback 3",
    })

    const exampleFeedback = getFeedbackByWorkspace("example.com")
    expect(exampleFeedback).toHaveLength(2)
    expect(exampleFeedback.every(f => f.workspace === "example.com")).toBe(true)

    const otherFeedback = getFeedbackByWorkspace("other.com")
    expect(otherFeedback).toHaveLength(1)
  })

  it("should include optional fields when provided", () => {
    const entry = addFeedbackEntry({
      workspace: "test.com",
      feedback: "Test feedback",
      conversationId: "550e8400-e29b-41d4-a716-446655440000",
      userAgent: "Mozilla/5.0",
    })

    expect(entry.conversationId).toBe("550e8400-e29b-41d4-a716-446655440000")
    expect(entry.userAgent).toBe("Mozilla/5.0")
  })
})
