/**
 * UI Component Preview Page
 *
 * A Storybook-like component library for testing integration components.
 * Only accessible to superadmins (eedenlars@gmail.com).
 *
 * Categories: Mail, Linear, Stripe
 */

"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Mail, LayoutList, CreditCard, Sparkles } from "lucide-react"

// Component previews
import { MailSendPreview } from "./previews/MailSendPreview"
import { LinearIssuePreview } from "./previews/LinearIssuePreview"
import { LinearIssuesPreview } from "./previews/LinearIssuesPreview"
import { LinearCommentPreview } from "./previews/LinearCommentPreview"
import { StripeCustomersPreview } from "./previews/StripeCustomersPreview"
import { StripeAccountPreview } from "./previews/StripeAccountPreview"
import { ClarificationQuestionsPreview } from "./previews/ClarificationQuestionsPreview"

// Category and component definitions
const CATEGORIES = {
  ai: {
    id: "ai",
    name: "AI",
    icon: Sparkles,
    components: {
      clarification: { id: "clarification", name: "Clarification Questions", component: ClarificationQuestionsPreview },
    },
  },
  mail: {
    id: "mail",
    name: "Mail",
    icon: Mail,
    components: {
      send: { id: "send", name: "Send Email", component: MailSendPreview },
    },
  },
  linear: {
    id: "linear",
    name: "Linear",
    icon: LayoutList,
    components: {
      issue: { id: "issue", name: "Issue", component: LinearIssuePreview },
      issues: { id: "issues", name: "Issues List", component: LinearIssuesPreview },
      comment: { id: "comment", name: "Comment", component: LinearCommentPreview },
    },
  },
  stripe: {
    id: "stripe",
    name: "Stripe",
    icon: CreditCard,
    components: {
      customers: { id: "customers", name: "Customers", component: StripeCustomersPreview },
      account: { id: "account", name: "Account", component: StripeAccountPreview },
    },
  },
} as const

type CategoryId = keyof typeof CATEGORIES

export default function PreviewUIPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [activeCategory, setActiveCategory] = useState<CategoryId>("ai")
  const [activeComponent, setActiveComponent] = useState<string>("clarification")

  useEffect(() => {
    async function checkAccess() {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" })
        if (!res.ok) {
          router.push("/")
          return
        }

        const data = await res.json()
        if (!data.ok || !data.user?.isSuperadmin) {
          router.push("/")
          return
        }

        setAuthorized(true)
      } catch {
        router.push("/")
      } finally {
        setLoading(false)
      }
    }

    checkAccess()
  }, [router])

  // When category changes, select first component
  const handleCategoryChange = (categoryId: CategoryId) => {
    setActiveCategory(categoryId)
    const components = Object.keys(CATEGORIES[categoryId].components)
    setActiveComponent(components[0])
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    )
  }

  if (!authorized) {
    return null
  }

  const category = CATEGORIES[activeCategory]
  const components = category.components as Record<string, { id: string; name: string; component: React.ComponentType }>
  const CurrentPreview = components[activeComponent]?.component

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex">
      {/* Left Sidebar - Categories */}
      <aside className="w-48 min-h-screen border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex-shrink-0">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
          <h1 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Components</h1>
        </div>

        <nav className="p-2">
          {Object.values(CATEGORIES).map(cat => {
            const Icon = cat.icon
            const isActive = activeCategory === cat.id
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleCategoryChange(cat.id as CategoryId)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                }`}
              >
                <Icon className="w-4 h-4" />
                {cat.name}
              </button>
            )
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar - Component Selection */}
        <header className="h-12 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center px-4 gap-2 flex-shrink-0">
          {Object.values(components).map(comp => {
            const isActive = activeComponent === comp.id
            return (
              <button
                key={comp.id}
                type="button"
                onClick={() => setActiveComponent(comp.id)}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                  isActive
                    ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-medium"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                {comp.name}
              </button>
            )
          })}
        </header>

        {/* Preview Area */}
        <main className="flex-1 overflow-auto p-8">{CurrentPreview && <CurrentPreview />}</main>
      </div>
    </div>
  )
}
