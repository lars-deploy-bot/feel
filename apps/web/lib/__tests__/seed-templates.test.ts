import { describe, expect, it } from "vitest"
import { buildTemplateSeedSql } from "../../e2e-tests/lib/seed-templates"

describe("buildTemplateSeedSql", () => {
  it("builds an idempotent template upsert with verification", () => {
    const sql = buildTemplateSeedSql([
      {
        templateId: "tmpl_blank",
        name: "Blank Canvas",
        description: "Minimal starter - build from scratch",
        sourcePath: "/srv/webalive/templates/blank.alive.best",
        previewUrl: "https://blank.alive.best",
      },
    ])

    expect(sql).toContain("INSERT INTO app.templates")
    expect(sql).toContain("ON CONFLICT (template_id) DO UPDATE")
    expect(sql).toContain("template_id IN ('tmpl_blank')")
    expect(sql).toContain("Expected 1 active templates after seed")
    expect(sql).toContain("https://blank.alive.best")
  })
})
