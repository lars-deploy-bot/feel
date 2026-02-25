import { OrgsPage } from "@/features/orgs/OrgsPage"

interface RouterProps {
  page: string
}

export function Router({ page }: RouterProps) {
  switch (page) {
    case "organizations":
      return <OrgsPage />
    case "users":
      return <Placeholder name="Users" />
    case "domains":
      return <Placeholder name="Domains" />
    case "templates":
      return <Placeholder name="Templates" />
    case "feedback":
      return <Placeholder name="Feedback" />
    case "settings":
      return <Placeholder name="Settings" />
    default:
      return <OrgsPage />
  }
}

function Placeholder({ name }: { name: string }) {
  return (
    <div className="flex items-center justify-center py-32">
      <div className="text-center">
        <h2 className="text-lg font-semibold text-text-primary">{name}</h2>
        <p className="mt-1 text-sm text-text-tertiary">Coming soon</p>
      </div>
    </div>
  )
}
