import NextTopLoader from "nextjs-toploader"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { UserPromptsStoreProvider } from "@/lib/providers/UserPromptsStoreProvider"
import { UserStoreProvider } from "@/lib/providers/UserStoreProvider"
import "@/lib/env-validation" // Validate env vars at startup (fail fast)
import "./globals.css"

/**
 * CRITICAL: Import env validation to trigger build-time checks
 * This import ensures missing environment variables fail the build immediately.
 * The validation runs during Next.js static analysis (build phase).
 */
import "@/lib/env-validation"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </head>
      <body>
        <NextTopLoader color="#000" height={2} showSpinner={false} />
        <ThemeProvider>
          <UserStoreProvider>
            <UserPromptsStoreProvider>{children}</UserPromptsStoreProvider>
          </UserStoreProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
