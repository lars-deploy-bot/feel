import { Hono } from "hono"
import { env } from "../../config/env"

const BASE_PROMPT =
  "Full body portrait of an adult {gender} standing on pure white background, no shadows, no ground shadow. Disney Pixar 3D animation style. {description}. Full body visible from head to shoes. Clean flat studio render, even lighting, no shadows."

const PRESETS: Record<string, { gender: "man" | "woman"; description: string }> = {
  // Male presets
  "m-analyst": {
    gender: "man",
    description:
      "He is a data analyst, standing confidently holding a tablet showing charts. Wearing a smart navy blue sweater and chinos. Short dark hair, glasses, friendly focused expression",
  },
  "m-developer": {
    gender: "man",
    description:
      "He is a software developer, standing with a laptop under his arm, other hand gesturing as if explaining code. Wearing a green hoodie and jeans. Messy brown hair, beard stubble, energetic smile",
  },
  "m-strategist": {
    gender: "man",
    description:
      "He is a business strategist, standing with arms crossed looking confident. Wearing a crisp white shirt with rolled-up sleeves. Salt and pepper hair, strong jawline, warm determined expression",
  },
  "m-scientist": {
    gender: "man",
    description:
      "He is a scientist, holding a clipboard and pointing at it. Wearing a white lab coat over a blue shirt. Asian features, neat black hair, round glasses, thoughtful expression",
  },
  "m-chef": {
    gender: "man",
    description:
      "He is a chef, holding a wooden spoon and wearing a white chef coat. Stocky build, curly dark hair, big warm mustache, joyful expression",
  },
  "m-photographer": {
    gender: "man",
    description:
      "He is a photographer, holding a camera up to his eye, about to take a shot. Wearing a black turtleneck and cargo pants. Lean build, short blond hair, creative intense focus",
  },
  "m-salesman": {
    gender: "man",
    description:
      "He is a sales executive, mid-stride with a briefcase in one hand and phone in the other, talking enthusiastically. Wearing a sharp navy suit with no tie, top button open. Tall, clean-shaven, dark skin, charismatic grin",
  },
  "m-pilot": {
    gender: "man",
    description:
      "He is a pilot, standing tall in a crisp uniform with captain epaulettes, aviator sunglasses pushed up on his forehead, holding a flight map. Short cropped hair, square jaw, calm confident expression",
  },
  "m-architect": {
    gender: "man",
    description:
      "He is an architect, holding a rolled-up blueprint in one hand, other hand adjusting his glasses while studying something. Wearing a fitted gray blazer and dark jeans. Curly brown hair, thoughtful creative expression",
  },

  // Female presets
  "f-writer": {
    gender: "woman",
    description:
      "She is a content writer, sitting cross-legged with a notebook and pen, mid-writing. Wearing a cozy purple knit sweater and black leggings. Wavy auburn hair, warm creative smile",
  },
  "f-designer": {
    gender: "woman",
    description:
      "She is a designer, standing holding a large color palette, other hand on hip. Wearing a stylish coral blazer and dark trousers. Black hair in a bun, dark skin, confident artistic expression",
  },
  "f-marketer": {
    gender: "woman",
    description:
      "She is a marketing manager, standing holding a megaphone in one hand, phone in the other. Wearing a bright yellow jacket and white tee. Blonde bob haircut, energetic excited expression",
  },
  "f-engineer": {
    gender: "woman",
    description:
      "She is an engineer, holding a wrench and a blueprint roll. Wearing overalls over a red tee. Brown ponytail, freckles, proud determined smile",
  },
  "f-teacher": {
    gender: "woman",
    description:
      "She is a teacher, holding a book in one hand and pointing with the other. Wearing a teal cardigan and skirt. Gray streaked hair in a loose bun, warm wise expression, reading glasses on nose",
  },
  "f-advisor": {
    gender: "woman",
    description:
      "She is a financial advisor, holding a folder and a calculator. Wearing a sharp charcoal blazer and pants. Straight black hair, East Asian features, composed confident smile",
  },
  "f-saleswoman": {
    gender: "woman",
    description:
      "She is a sales director, standing with a presentation clicker in one hand, pointing forward with the other. Wearing a ruby red blazer and black skirt. Curly dark hair, Latina features, persuasive warm smile",
  },
  "f-doctor": {
    gender: "woman",
    description:
      "She is a doctor, standing with a stethoscope around her neck, holding a medical chart. Wearing a white coat over scrubs. Red hair tied back, kind reassuring expression",
  },
  "f-journalist": {
    gender: "woman",
    description:
      "She is a journalist, holding a notepad and pen, mid-interview posture. Wearing a olive green field jacket and jeans. Short pixie cut, South Asian features, sharp inquisitive expression",
  },
}

function buildPrompt(preset: string, custom?: string): string {
  const p = PRESETS[preset]
  if (!p) throw new Error(`Unknown preset: ${preset}`)
  const description = custom ?? p.description
  return BASE_PROMPT.replace("{gender}", p.gender).replace("{description}", description)
}

export const avatarsRoutes = new Hono()

/** GET /avatars/presets — list all available presets */
avatarsRoutes.get("/presets", c => {
  return c.json(
    Object.entries(PRESETS).map(([key, val]) => ({
      key,
      gender: val.gender,
      description: val.description,
    })),
  )
})

/** POST /avatars/generate — generate an avatar image */
avatarsRoutes.post("/generate", async c => {
  const body = await c.req.json<{ preset?: string; gender?: "man" | "woman"; description?: string }>()

  let prompt: string
  if (body.preset) {
    if (!PRESETS[body.preset]) {
      return c.json({ error: `Unknown preset: ${body.preset}` }, 400)
    }
    prompt = buildPrompt(body.preset, body.description)
  } else if (body.gender && body.description) {
    prompt = BASE_PROMPT.replace("{gender}", body.gender).replace("{description}", body.description)
  } else {
    return c.json({ error: "Provide either `preset` or `gender` + `description`" }, 400)
  }

  const res = await fetch("https://services.alive.best/tools/reve/create", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.ALIVE_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      aspect_ratio: "9:16",
      store: true,
    }),
  })

  if (!res.ok) {
    return c.json({ error: "Avatar generation failed" }, 502)
  }

  const raw = await res.json()
  const fileUrl = typeof raw === "object" && raw !== null && "file_url" in raw ? String(raw.file_url) : null
  return c.json({ prompt, file_url: fileUrl, preset: body.preset })
})
