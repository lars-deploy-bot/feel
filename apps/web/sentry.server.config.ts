import * as Sentry from "@sentry/nextjs"
import { DOMAINS, SENTRY } from "@webalive/shared"
import { serverBeforeSend } from "./lib/sentry/server-before-send"

if (process.env.PLAYWRIGHT_TEST !== "true" && SENTRY.DSN) {
  Sentry.init({
    dsn: SENTRY.DSN,
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
    environment: process.env.ALIVE_ENV,
    serverName: DOMAINS.MAIN,

    // Send 100% of errors
    sampleRate: 1.0,

    // Performance: sample 20% of transactions
    tracesSampleRate: 0.2,

    // Don't send PII
    sendDefaultPii: false,

    beforeSend: serverBeforeSend,
  })
}
