import { useCallback } from "react"
import toast from "react-hot-toast"
import { useDeployFormStore, useDeploymentHistoryStore, useDeploymentStatusStore } from "@/lib/stores/deployStore"

interface DeployResponse {
  success: boolean
  message: string
  domain?: string
  errors?: string[]
}

export function useDeployment() {
  const { reset: resetForm } = useDeployFormStore()
  const {
    isDeploying,
    deploymentStatus,
    deploymentError,
    deploymentDomain,
    deploymentErrors,
    setIsDeploying,
    setDeploymentStatus,
    setDeploymentError,
    setDeploymentDomain,
    setDeploymentErrors,
  } = useDeploymentStatusStore()
  const { addToHistory } = useDeploymentHistoryStore()

  const deploy = useCallback(
    async (domain: string, password: string): Promise<void> => {
      setIsDeploying(true)
      setDeploymentStatus("validating")
      setDeploymentError(null)
      setDeploymentErrors(null)

      try {
        setDeploymentStatus("deploying")
        const response = await fetch("/api/deploy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ domain, password }),
        })

        const responseText = await response.text()
        const contentType = response.headers.get("content-type")

        if (!contentType?.includes("application/json")) {
          throw new Error(`Server error: ${responseText.substring(0, 200)}`)
        }

        const result: DeployResponse = JSON.parse(responseText)

        if (result.success) {
          setDeploymentStatus("success")
          setDeploymentDomain(result.domain || domain)
          toast.success(`${domain} deployed successfully!`)
          addToHistory({
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            domain,
            timestamp: Date.now(),
            success: true,
          })
          resetForm()
        } else {
          setDeploymentStatus("error")
          setDeploymentError(result.message)
          setDeploymentErrors(result.errors || [])
          toast.error(result.message)
          addToHistory({
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            domain,
            timestamp: Date.now(),
            success: false,
            error: result.message,
          })
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Deployment failed"
        setDeploymentStatus("error")
        setDeploymentError(errorMessage)
        toast.error(errorMessage)
        addToHistory({
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          domain,
          timestamp: Date.now(),
          success: false,
          error: errorMessage,
        })
      } finally {
        setIsDeploying(false)
      }
    },
    [
      setIsDeploying,
      setDeploymentStatus,
      setDeploymentError,
      setDeploymentDomain,
      setDeploymentErrors,
      addToHistory,
      resetForm,
    ],
  )

  return {
    deploy,
    isDeploying,
    deploymentStatus,
    deploymentError,
    deploymentDomain,
    deploymentErrors,
  }
}
