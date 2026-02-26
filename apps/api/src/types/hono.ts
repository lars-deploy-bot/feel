import type { Hono } from "hono"

export type AppVariables = {
  requestId: string
  authenticated: boolean
}

export type AppBindings = {
  Variables: AppVariables
}

// Convenience alias for Env generic parameter
export type Env = AppBindings

export type AppType = Hono<AppBindings>
