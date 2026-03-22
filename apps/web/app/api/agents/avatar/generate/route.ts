import { requireEnv } from "@webalive/shared"
import { requireSessionUser } from "@/features/auth/lib/auth"

const BASE_PROMPT =
  "Full body portrait of an adult {description}. Standing on pure white background, no shadows, no ground shadow. Disney Pixar 3D animation style. Full body visible from head to shoes. Clean flat studio render, even lighting, no shadows."

export async function POST(req: Request) {
  await requireSessionUser()

  const { description } = (await req.json()) as { description?: string }
  if (!description || typeof description !== "string" || description.trim().length === 0) {
    return Response.json({ error: "description is required" }, { status: 400 })
  }

  if (description.length > 500) {
    return Response.json({ error: "description too long (max 500 chars)" }, { status: 400 })
  }

  const prompt = BASE_PROMPT.replace("{description}", description.trim())
  const apiKey = requireEnv("ALIVE_SECRET_KEY")

  const res = await fetch("https://services.alive.best/tools/reve/create", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      aspect_ratio: "9:16",
      store: true,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    return Response.json({ error: `Generation failed: ${text}` }, { status: 502 })
  }

  const data = await res.json()
  return Response.json({ file_url: data.file_url, prompt })
}
