import * as Sentry from "@sentry/nextjs"
import { SENTRY } from "@webalive/shared"
import { serverBeforeSend } from "./lib/sentry/server-before-send"

if (process.env.PLAYWRIGHT_TEST !== "true" && SENTRY.DSN) {
  Sentry.init({
    dsn: SENTRY.DSN,
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE ?? "unknown",
    environment: process.env.STREAM_ENV ?? process.env.NODE_ENV ?? "unknown",
    serverName: process.env.MAIN_DOMAIN ?? "unknown",

    // Send 100% of errors
    sampleRate: 1.0,

    // Performance: sample 20% of transactions
    tracesSampleRate: 0.2,

    // Don't send PII
    sendDefaultPii: false,

    beforeSend: serverBeforeSend,
  })
}
