import { Hono } from "hono"
import { z } from "zod"
import { env } from "../../config/env"
import { iam } from "../../db/clients"
import { validate } from "../../shared/validation"
import type { AppBindings } from "../../types/hono"
import { type PolarAuthBindings, polarSessionAuth } from "./polar.auth"
import { getPolarClient } from "./polar.client"
import { POLAR_PRODUCTS, USD_TO_CREDITS } from "./polar.config"

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
    successUrl: `${c.req.header("origin") || "https://app.alive.best"}/chat?upgraded=true`,
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
  } catch {
    // Customer doesn't exist in Polar yet — that's fine (free plan)
  }

  let products: Array<{
    id: string
    name: string
    description: string | null
    isRecurring: boolean
    prices: Array<{ id: string; amountType: string; priceAmount: number | null; priceCurrency: string | null }>
  }> = []

  try {
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
  } catch (err) {
    console.error("[polar/billing] Error fetching products:", err)
  }

  return c.json({ subscription, products, portalUrl })
})

// Mount authenticated routes
polarRoutes.route("/", authed)

// ---------------------------------------------------------------------------
// POST /webhook — Polar webhook handler (no auth, signature verification)
// ---------------------------------------------------------------------------

polarRoutes.post("/webhook", async c => {
  const webhookSecret = env.POLAR_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error("[polar/webhook] POLAR_WEBHOOK_SECRET is not configured")
    return c.json({ error: "Webhook not configured" }, 500)
  }

  const polar = getPolarClient()
  const body = await c.req.text()
  const headers: Record<string, string> = {}
  c.req.raw.headers.forEach((value, key) => {
    headers[key] = value
  })

  let event: Awaited<ReturnType<typeof polar.validateWebhook>>
  try {
    event = await polar.validateWebhook({
      request: { body, headers, url: c.req.url, method: "POST" },
    })
  } catch (err) {
    console.error("[polar/webhook] Signature verification failed:", err)
    return c.json({ error: "Invalid signature" }, 400)
  }

  if (event.type === "order.paid") {
    const order = event.data
    const externalId = order.customer.externalId
    if (!externalId) {
      console.error("[polar/webhook] order.paid: customer has no externalId", order.customer.id)
      return c.json({ received: true })
    }

    let creditsToAward = 0
    if (order.productId && POLAR_PRODUCTS[order.productId]) {
      creditsToAward = POLAR_PRODUCTS[order.productId].credits
    } else {
      // Fallback: convert order total (cents) to credits
      creditsToAward = (order.totalAmount / 100) * USD_TO_CREDITS
    }

    if (creditsToAward > 0) {
      const { data: membership } = await iam
        .from("org_memberships")
        .select("org_id")
        .eq("user_id", externalId)
        .order("created_at", { ascending: true })
        .limit(1)
        .single()

      if (membership) {
        const { error } = await iam.rpc("add_credits", {
          p_org_id: membership.org_id,
          p_amount: creditsToAward,
        })
        if (error) {
          console.error("[polar/webhook] Failed to add credits:", error)
        } else {
          console.log(
            `[polar/webhook] Awarded ${creditsToAward} credits to org ${membership.org_id} for user ${externalId}`,
          )
        }
      } else {
        console.error("[polar/webhook] No org found for user:", externalId)
      }
    }
  }

  return c.json({ received: true })
})
