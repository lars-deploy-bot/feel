import NextTopLoader from "nextjs-toploader"
import { NuqsAdapter } from "nuqs/adapters/next/app"
import { AuthModal } from "@/components/modals/AuthModal"
import { FlowgladProviderWrapper } from "@/components/providers/FlowgladProviderWrapper"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { UserPromptsStoreProvider } from "@/lib/providers/UserPromptsStoreProvider"
import { UserStoreProvider } from "@/lib/providers/UserStoreProvider"
import { HydrationManager } from "@/lib/stores/HydrationBoundary"
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
        {/* HydrationManager coordinates hydration of ALL persisted stores */}
        {/* Must be early in the tree to hydrate stores before components use them */}
        {/* Sets window.__APP_HYDRATED__ for E2E test synchronization */}
        <HydrationManager />
        <NextTopLoader color="#000" height={2} showSpinner={false} />
        <NuqsAdapter>
          <ThemeProvider>
            <FlowgladProviderWrapper>
              <UserStoreProvider>
                <UserPromptsStoreProvider>
                  {children}
                  <AuthModal />
                </UserPromptsStoreProvider>
              </UserStoreProvider>
            </FlowgladProviderWrapper>
          </ThemeProvider>
        </NuqsAdapter>
      </body>
    </html>
  )
}
