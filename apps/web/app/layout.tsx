import { CONTACT_EMAIL, DOMAINS } from "@webalive/shared"
import NextTopLoader from "nextjs-toploader"
import { NuqsAdapter } from "nuqs/adapters/next/app"
import { AuthModal } from "@/components/modals/AuthModal"
import { PostHogProvider } from "@/components/providers/PostHogProvider"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { DomainConfigProvider } from "@/lib/providers/DomainConfigProvider"
import { QueryClientProvider } from "@/lib/providers/QueryClientProvider"
import { SkillsStoreProvider } from "@/lib/providers/SkillsStoreProvider"
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

const jsonLdOrganization = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Alive",
  description: "AI-Powered Website Development Platform with Claude AI assistance",
  url: "https://alive.best",
  applicationCategory: "DeveloperApplication",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  operatingSystem: "Web",
  inLanguage: "en-US",
  image: "https://alive.best/og-image.png",
}

export const metadata = {
  title: "Alive - AI-Powered Website Development Platform",
  description:
    "Alive is an interactive development platform where Claude AI assists with website creation, development, and deployment. Build, design, and deploy web projects with AI collaboration.",
  keywords: [
    "AI website builder",
    "Claude AI development",
    "web development platform",
    "AI-assisted coding",
    "website deployment",
    "development tools",
  ].join(", "),
  authors: [{ name: "Alive Team" }],
  creator: "Alive",
  publisher: "Alive",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://alive.best",
    siteName: "Alive",
    title: "Alive - AI-Powered Website Development Platform",
    description: "Interactive development platform where Claude AI assists with website creation and deployment.",
    images: [
      {
        url: "https://alive.best/og-image.png",
        width: 1200,
        height: 630,
        alt: "Alive Platform - AI-Powered Website Development",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@alive_platform",
    creator: "@alive_platform",
    title: "Alive - AI-Powered Website Development",
    description: "Build and deploy websites with Claude AI assistance. Interactive development platform.",
    images: ["https://alive.best/twitter-image.png"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Alive",
  },
  formatDetection: {
    telephone: false,
    email: true,
  },
  metadataBase: new URL("https://alive.best"),
  alternates: {
    canonical: "https://alive.best",
  },
}

// Server-side: read domain config from server-config.json (runtime, not build time)
const domainConfig = {
  wildcard: DOMAINS.WILDCARD,
  main: DOMAINS.MAIN,
  previewBase: DOMAINS.PREVIEW_BASE,
  contactEmail: CONTACT_EMAIL,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />
        <meta name="theme-color" content="#000000" />
        <meta name="color-scheme" content="light dark" />
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
        <meta
          name="description"
          content="Alive is an interactive development platform where Claude AI assists with website creation, development, and deployment."
        />
        <meta name="og:type" content="website" />
        <meta name="og:url" content="https://alive.best/" />
        <meta name="og:title" content="Alive - AI-Powered Website Development Platform" />
        <meta
          name="og:description"
          content="Interactive development platform where Claude AI assists with website creation and deployment."
        />
        <meta name="og:image" content="https://alive.best/og-image.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content="https://alive.best/" />
        <meta name="twitter:title" content="Alive - AI-Powered Website Development" />
        <meta
          name="twitter:description"
          content="Build and deploy websites with Claude AI assistance. Interactive development platform."
        />
        <meta name="twitter:image" content="https://alive.best/twitter-image.png" />
        <link rel="canonical" href="https://alive.best/" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body>
        {/* Strip native title tooltips on touch devices — they're disruptive on mobile */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){if(!("ontouchstart"in window)&&!navigator.maxTouchPoints)return;function s(e){if(e.hasAttribute("title"))e.removeAttribute("title")}function a(r){if(r instanceof HTMLElement){s(r);r.querySelectorAll("[title]").forEach(s)}}new MutationObserver(function(m){for(var i=0;i<m.length;i++){var c=m[i];if(c.type==="childList")c.addedNodes.forEach(a);else if(c.type==="attributes"&&c.target instanceof HTMLElement&&c.target.hasAttribute("title"))c.target.removeAttribute("title")}}).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:["title"]});document.querySelectorAll("[title]").forEach(s)})()`,
          }}
        />
        {/* JSON-LD Structured Data for SEO */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLdOrganization),
          }}
        />
        {/* HydrationManager coordinates hydration of ALL persisted stores */}
        {/* Must be early in the tree to hydrate stores before components use them */}
        {/* Sets window.__APP_HYDRATED__ for E2E test synchronization */}
        <HydrationManager />
        <PostHogProvider>
          <NextTopLoader color="#000" height={2} showSpinner={false} />
          <NuqsAdapter>
            <ThemeProvider>
              <DomainConfigProvider config={domainConfig}>
                <QueryClientProvider>
                  <UserStoreProvider>
                    <SkillsStoreProvider>
                      {children}
                      <AuthModal />
                    </SkillsStoreProvider>
                  </UserStoreProvider>
                </QueryClientProvider>
              </DomainConfigProvider>
            </ThemeProvider>
          </NuqsAdapter>
        </PostHogProvider>
      </body>
    </html>
  )
}
