import { describe, expect, it } from "vitest"
import { extractReusableLiveDeploySlugsFromCaddy, isReusableLiveDeployDomain } from "../e2e-site-deployment"

describe("e2e-site-deployment", () => {
  it("recognizes reusable live deploy domains", () => {
    expect(isReusableLiveDeployDomain("dl1.alive.best")).toBe(true)
    expect(isReusableLiveDeployDomain("blog.alive.best")).toBe(false)
  })

  it("extracts reusable live deploy slugs from generated caddy blocks", () => {
    const caddy = `
app.alive.best {
    reverse_proxy localhost:9000
}

dl2.alive.best {
    reverse_proxy localhost:3334
}

preview.app.alive.best {
    reverse_proxy localhost:9000
}

DL1.alive.best {
    reverse_proxy localhost:3333
}
`

    expect(extractReusableLiveDeploySlugsFromCaddy(caddy, "alive.best")).toEqual(["dl1", "dl2"])
  })

  it("ignores wildcard and preview hosts", () => {
    const caddy = `
*.alive.best {
    reverse_proxy localhost:5055
}

preview--dl4.alive.best {
    reverse_proxy localhost:5055
}

dl3.sonno.tech {
    reverse_proxy localhost:3335
}
`

    expect(extractReusableLiveDeploySlugsFromCaddy(caddy, "alive.best")).toEqual([])
  })
})
