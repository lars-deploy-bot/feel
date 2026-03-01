import * as Sentry from "@sentry/nextjs"
import { env } from "@webalive/env/client"
import { serverBeforeSend } from "./lib/sentry/server-before-send"

// DSN injected at build time via next.config.js from server-config.json
const sentryDsn = env.NEXT_PUBLIC_SENTRY_DSN

if (process.env.PLAYWRIGHT_TEST !== "true" && sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE ?? "unknown",
    environment: process.env.STREAM_ENV ?? process.env.NODE_ENV ?? "unknown",
    sampleRate: 1.0,
    tracesSampleRate: 0.2,
    sendDefaultPii: false,

    beforeSend: serverBeforeSend,
  })
}
