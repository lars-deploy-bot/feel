import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks"
import { DOMAINS } from "@webalive/shared"
import { Hono } from "hono"
import { z } from "zod"
import { env } from "../../config/env"
import { iam } from "../../db/clients"
import { InternalError } from "../../infra/errors"
import { Sentry } from "../../infra/sentry"
import { validate } from "../../shared/validation"
import type { AppBindings } from "../../types/hono"
import { type PolarAuthBindings, polarSessionAuth } from "./polar.auth"
import { getPolarClient } from "./polar.client"
import { getPolarProducts, USD_TO_CREDITS } from "./polar.config"

export const polarRoutes = new Hono<AppBindings>()

// ---------------------------------------------------------------------------
// Authenticated sub-router (uses JWT session cookie from the web app)
// ---------------------------------------------------------------------------

const authed = new Hono<PolarAuthBindings>()
authed.use("/*", polarSessionAuth)

// POST /checkout — create a Polar checkout session
authed.post("/checkout", async c => {
  const body = await c.req.json()
  const { productId } = validate(z.object({ productId: z.string().min(1) }), body)

  const userId = c.get("polarUserId")
  const email = c.get("polarUserEmail")

  const polar = getPolarClient()
  const checkout = await polar.checkouts.create({
    products: [productId],
    externalCustomerId: userId,
    customerEmail: email || undefined,
    successUrl: `${DOMAINS.APP_PROD}/chat?upgraded=true`,
  })

  return c.json({ url: checkout.url })
})

// GET /portal — create a Polar customer portal session
authed.get("/portal", async c => {
  const userId = c.get("polarUserId")
  const polar = getPolarClient()

  try {
    const customer = await polar.customers.getExternal({ externalId: userId })
    const session = await polar.customerSessions.create({
      customerId: customer.id,
    })
    return c.json({ url: session.customerPortalUrl })
  } catch {
    return c.json({ url: null })
  }
})

// GET /billing — current billing state for the authenticated user
authed.get("/billing", async c => {
  const userId = c.get("polarUserId")
  const polar = getPolarClient()

  let subscription: {
    id: string
    status: string
    productId: string
    currentPeriodEnd: Date | null
  } | null = null
  let portalUrl: string | null = null

  try {
    const customer = await polar.customers.getExternal({ externalId: userId })
    const customerId = customer.id

    const subs = await polar.subscriptions.list({ customerId, active: true })
    const subItems = subs.result?.items
    if (subItems && subItems.length > 0) {
      const sub = subItems[0]
      subscription = {
        id: sub.id,
        status: sub.status,
        productId: sub.productId,
        currentPeriodEnd: sub.currentPeriodEnd,
      }
    }

    const session = await polar.customerSessions.create({ customerId })
    portalUrl = session.customerPortalUrl
  } catch (err) {
    // 404 = customer doesn't exist in Polar yet (free plan) — that's fine
    // Anything else is a real error — propagate it
    const is404 = err instanceof Error && "statusCode" in err && (err as { statusCode: number }).statusCode === 404
    if (!is404) {
      Sentry.captureException(err)
      throw new InternalError("Failed to fetch billing state from Polar")
    }
  }

  let products: Array<{
    id: string
    name: string
    description: string | null
    isRecurring: boolean
    prices: Array<{ id: string; amountType: string; priceAmount: number | null; priceCurrency: string | null }>
  }> = []

  const productList = await polar.products.list({ isArchived: false })
  const productItems = productList.result?.items
  if (productItems) {
    products = productItems.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description ?? null,
      isRecurring: p.isRecurring,
      prices: p.prices.map(pr => ({
        id: pr.id,
        amountType: pr.amountType,
        priceAmount: "priceAmount" in pr ? (pr.priceAmount ?? null) : null,
        priceCurrency: "priceCurrency" in pr ? (pr.priceCurrency ?? null) : null,
      })),
    }))
  }

  return c.json({ subscription, products, portalUrl })
})

// Mount authenticated routes
polarRoutes.route("/", authed)

// ---------------------------------------------------------------------------
// POST /webhook — Polar webhook handler (no auth, signature verification)
// ---------------------------------------------------------------------------

polarRoutes.post("/webhook", async c => {
  const body = await c.req.text()
  const headers: Record<string, string> = {}
  c.req.raw.headers.forEach((value, key) => {
    headers[key] = value
  })

  let event: ReturnType<typeof validateEvent>
  try {
    event = validateEvent(body, headers, env.POLAR_WEBHOOK_SECRET)
  } catch (err) {
    if (err instanceof WebhookVerificationError) {
      Sentry.captureException(err)
      return c.json({ error: "Invalid signature" }, 403)
    }
    throw err
  }

  if (event.type === "order.paid") {
    const order = event.data
    const externalId = order.customer.externalId
    if (!externalId) {
      Sentry.captureMessage(`[polar/webhook] order.paid: customer ${order.customer.id} has no externalId`)
      return c.json({ received: true })
    }

    // Idempotency: skip if this order was already processed
    const { data: existing } = await iam
      .from("processed_polar_orders")
      .select("order_id")
      .eq("order_id", order.id)
      .maybeSingle()

    if (existing) {
      return c.json({ received: true })
    }

    const products = getPolarProducts(env.ALIVE_ENV)
    let creditsToAward = 0
    if (order.productId && products[order.productId]) {
      creditsToAward = products[order.productId].credits
    } else {
      creditsToAward = (order.totalAmount / 100) * USD_TO_CREDITS
    }

    if (creditsToAward > 0) {
      const { data: membership, error: membershipError } = await iam
        .from("org_memberships")
        .select("org_id")
        .eq("user_id", externalId)
        .order("created_at", { ascending: true })
        .limit(1)
        .single()

      if (membershipError || !membership) {
        Sentry.captureMessage(`[polar/webhook] No org found for user ${externalId}`, { extra: { membershipError } })
        return c.json({ error: "No org found for user" }, 500)
      }

      const { error: creditError } = await iam.rpc("add_credits", {
        p_org_id: membership.org_id,
        p_amount: creditsToAward,
      })

      if (creditError) {
        Sentry.captureException(creditError)
        return c.json({ error: "Failed to add credits" }, 500)
      }

      // Record as processed (idempotency guard)
      await iam.from("processed_polar_orders").insert({
        order_id: order.id,
        user_id: externalId,
        org_id: membership.org_id,
        credits_awarded: creditsToAward,
      })
    }
  }

  return c.json({ received: true })
})
