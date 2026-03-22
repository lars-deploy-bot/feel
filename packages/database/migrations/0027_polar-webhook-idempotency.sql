-- Idempotency table for Polar webhook deliveries.
-- Prevents double-crediting when Polar retries order.paid webhooks.
-- Uses the Polar order ID as a unique key.

CREATE TABLE IF NOT EXISTS iam.processed_polar_orders (
  order_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  org_id UUID NOT NULL,
  credits_awarded NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE iam.processed_polar_orders IS 'Idempotency guard for Polar order.paid webhooks — prevents double credit awards on retry';
