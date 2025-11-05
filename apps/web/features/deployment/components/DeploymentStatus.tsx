"use client"

import { motion } from "framer-motion"
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react"

type StatusType = "success" | "error" | "loading"

interface DeploymentStatusProps {
  status: StatusType | null
  domain?: string | null
  error?: string | null
  errorDetails?: string[] | null
  chatUrl?: string | null
}

export function DeploymentStatus({ status, domain, error, errorDetails, chatUrl }: DeploymentStatusProps) {
  if (!status) return null

  if (status === "success") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="p-4 rounded-lg bg-gradient-to-r from-green-50 to-green-100/50 border border-green-200/50"
      >
        <div className="flex gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="w-full">
            <h3 className="font-semibold text-green-900 mb-1">Deployment Successful!</h3>
            <p className="text-green-700 text-sm mb-3">{domain} is now live</p>
            <a
              href={`https://${domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-600 hover:text-green-800 font-medium text-sm underline inline-block"
            >
              Visit your site →
            </a>
          </div>
        </div>
      </motion.div>
    )
  }

  if (status === "error") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="p-4 rounded-lg bg-gradient-to-r from-red-50 to-red-100/50 border border-red-200/50"
      >
        <div className="flex gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900 mb-1">Deployment Failed</h3>
            <p className="text-red-700 text-sm mb-3">{error}</p>
            {errorDetails && errorDetails.length > 0 && (
              <details>
                <summary className="cursor-pointer font-medium text-red-700 text-sm hover:text-red-800">
                  Error Details
                </summary>
                <pre className="mt-2 text-xs bg-red-100 p-2 rounded border border-red-200 overflow-auto max-h-32 whitespace-pre-wrap break-words text-red-900">
                  {errorDetails.join("\n")}
                </pre>
              </details>
            )}
          </div>
        </div>
      </motion.div>
    )
  }

  // Loading state
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-4 rounded-lg bg-gradient-to-r from-blue-50 to-blue-100/50 border border-blue-200/50"
    >
      <div className="flex gap-3">
        <Loader2 className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5 animate-spin" />
        <div>
          <h3 className="font-semibold text-blue-900 mb-1">
            {status === "loading" ? "Deploying..." : "Validating..."}
          </h3>
          <p className="text-blue-700 text-sm">
            {status === "loading" ? "Setting up your site" : "Checking domain configuration"}
          </p>
        </div>
      </div>
    </motion.div>
  )
}
