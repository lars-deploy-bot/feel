import { DEPLOY_DEPLOYMENT_ACTION_DEPLOY, DEPLOY_DEPLOYMENT_ACTIONS } from "@webalive/database"
import { type Context, Hono } from "hono"
import { z } from "zod"
import { ValidationError } from "../../../infra/errors"
import { validate } from "../../../shared/validation"
import type { AppBindings } from "../../../types/hono"
import { listDeployApplications, queueBuild, queueDeployment, readBuildLog, readDeploymentLog } from "./deploys.service"

export const deploysRoutes = new Hono<AppBindings>()

const createBuildSchema = z
  .object({
    application_id: z.string().trim().min(1),
    git_ref: z.string().trim().min(1).optional(),
  })
  .strict()

const createDeploymentSchema = z
  .object({
    environment_id: z.string().trim().min(1),
    release_id: z.string().trim().min(1),
    action: z.enum(DEPLOY_DEPLOYMENT_ACTIONS).optional().default(DEPLOY_DEPLOYMENT_ACTION_DEPLOY),
  })
  .strict()

async function readJson(c: Context<AppBindings>): Promise<unknown> {
  try {
    return await c.req.json()
  } catch {
    throw new ValidationError("Invalid JSON body")
  }
}

deploysRoutes.get("/", async c => {
  const data = await listDeployApplications()
  return c.json({ ok: true, data })
})

deploysRoutes.post("/builds", async c => {
  const body = validate(createBuildSchema, await readJson(c))
  const build = await queueBuild(body.application_id, body.git_ref)
  return c.json({ ok: true, data: build }, 201)
})

deploysRoutes.post("/deployments", async c => {
  const body = validate(createDeploymentSchema, await readJson(c))
  const deployment = await queueDeployment(body.environment_id, body.release_id, body.action)
  return c.json({ ok: true, data: deployment }, 201)
})

deploysRoutes.get("/builds/:id/log", async c => {
  const log = await readBuildLog(c.req.param("id"))
  c.header("Content-Type", "text/plain; charset=utf-8")
  return c.text(log)
})

deploysRoutes.get("/deployments/:id/log", async c => {
  const log = await readDeploymentLog(c.req.param("id"))
  c.header("Content-Type", "text/plain; charset=utf-8")
  return c.text(log)
})
