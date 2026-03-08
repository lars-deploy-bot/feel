import { Suspense } from "react"
import { DeploymentHistory } from "@/features/deployment/components/DeploymentHistory"
import { SubdomainDeployForm } from "@/features/deployment/components/SubdomainDeployForm"

export default function DeployStartPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 py-16 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col items-center">
        <Suspense fallback={<div className="w-full max-w-md mx-auto h-64" />}>
          <SubdomainDeployForm />
        </Suspense>
        <DeploymentHistory />
      </div>
    </div>
  )
}
