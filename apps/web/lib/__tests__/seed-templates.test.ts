import { describe, expect, it } from "vitest"
import { buildTemplateSeedSql } from "../../e2e-tests/lib/seed-templates"

describe("buildTemplateSeedSql", () => {
  it("builds an idempotent server and template upsert with verification", () => {
    const sql = buildTemplateSeedSql(
      [
        {
          templateId: "tmpl_blank",
          name: "Blank Canvas",
          description: "Minimal starter - build from scratch",
          sourcePath: "/srv/webalive/templates/blank.alive.best",
          previewUrl: "https://blank.sonno.tech",
        },
      ],
      {
        serverId: "srv_sonno_dot_tech_95_217_89_48",
        name: "Sonno Tech",
        ip: "95.217.89.48",
        hostname: "sonno.tech",
      },
    )

    expect(sql).toContain("INSERT INTO app.servers")
    expect(sql).toContain("ON CONFLICT (server_id) DO UPDATE")
    expect(sql).toContain("INSERT INTO app.templates")
    expect(sql).toContain("ON CONFLICT (template_id) DO UPDATE")
    expect(sql).toContain("template_id IN ('tmpl_blank')")
    expect(sql).toContain("server_id = 'srv_sonno_dot_tech_95_217_89_48'")
    expect(sql).toContain("Expected 1 active templates after seed")
    expect(sql).toContain("https://blank.sonno.tech")
  })
})
