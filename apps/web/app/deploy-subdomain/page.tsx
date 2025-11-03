import { SubdomainDeployForm } from "@/components/deploy-subdomain/SubdomainDeployForm"

export default function DeploySubdomainPage() {
  return (
    <div className="min-h-screen bg-white py-16 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col items-center">
        <SubdomainDeployForm />
      </div>
    </div>
  )
}
