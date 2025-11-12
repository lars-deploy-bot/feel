import NextTopLoader from "nextjs-toploader"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { UserStoreProvider } from "@/lib/providers/UserStoreProvider"
import { UserPromptsStoreProvider } from "@/lib/providers/UserPromptsStoreProvider"
import "./globals.css"

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
