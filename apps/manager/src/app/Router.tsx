import { lazy, Suspense } from "react"
import { Spinner } from "@/components/ui/Spinner"

const OrgsPage = lazy(() => import("@/features/orgs/OrgsPage").then(m => ({ default: m.OrgsPage })))
const UsersPage = lazy(() => import("@/features/users/UsersPage").then(m => ({ default: m.UsersPage })))
const DomainsPage = lazy(() => import("@/features/domains/DomainsPage").then(m => ({ default: m.DomainsPage })))
const DeploysPage = lazy(async () => {
  const module = await import("@/features/deploys/DeploysPage")
  return { default: module.DeploysPage }
})
const AutomationsPage = lazy(() =>
  import("@/features/automations/AutomationsPage").then(m => ({ default: m.AutomationsPage })),
)
const TemplatesPage = lazy(() => import("@/features/templates/TemplatesPage").then(m => ({ default: m.TemplatesPage })))
const FeedbackPage = lazy(() => import("@/features/feedback/FeedbackPage").then(m => ({ default: m.FeedbackPage })))
const SdkLogsPage = lazy(() => import("@/features/sdk-logs/SdkLogsPage").then(m => ({ default: m.SdkLogsPage })))
const SettingsPage = lazy(() => import("@/features/settings/SettingsPage").then(m => ({ default: m.SettingsPage })))

interface RouterProps {
  page: string
}

function PageFallback() {
  return (
    <div className="flex items-center justify-center py-32">
      <Spinner size="md" />
    </div>
  )
}

export function Router({ page }: RouterProps) {
  let content: React.ReactNode

  switch (page) {
    case "organizations":
      content = <OrgsPage />
      break
    case "users":
      content = <UsersPage />
      break
    case "domains":
      content = <DomainsPage />
      break
    case "deploys":
      content = <DeploysPage />
      break
    case "automations":
      content = <AutomationsPage />
      break
    case "templates":
      content = <TemplatesPage />
      break
    case "feedback":
      content = <FeedbackPage />
      break
    case "sdk-logs":
      content = <SdkLogsPage />
      break
    case "settings":
      content = <SettingsPage />
      break
    default:
      content = <OrgsPage />
  }

  return <Suspense fallback={<PageFallback />}>{content}</Suspense>
}
