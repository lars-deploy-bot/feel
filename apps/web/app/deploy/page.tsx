import { DeployFormWrapper } from "@/components/deploy-form/DeployFormWrapper"

export default function DeployPage() {
  return (
    <div className="min-h-screen bg-white py-16 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col items-center">
        <DeployFormWrapper />
      </div>
    </div>
  )
}
