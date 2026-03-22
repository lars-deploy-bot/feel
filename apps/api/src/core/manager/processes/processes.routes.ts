import { Hono } from "hono"
import type { AppBindings } from "../../../types/hono"
import { getProcesses } from "./processes.service"

export const processesRoutes = new Hono<AppBindings>()

processesRoutes.get("/", async c => {
  const processes = await getProcesses()
  return c.json({ ok: true as const, data: processes })
})
