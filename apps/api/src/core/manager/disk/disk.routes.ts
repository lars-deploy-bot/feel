import { Hono } from "hono"
import type { AppBindings } from "../../../types/hono"
import { getDiskData } from "./disk.service"

export const diskRoutes = new Hono<AppBindings>()

diskRoutes.get("/", async c => {
  const data = await getDiskData()
  return c.json({ ok: true as const, data })
})
