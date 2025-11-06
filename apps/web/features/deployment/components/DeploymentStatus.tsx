"use client"

import { motion } from "framer-motion"
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"

type StatusType = "success" | "error" | "loading"

interface DeploymentStatusProps {
  status: StatusType | null
  domain?: string | null
  error?: string | null
  errorDetails?: string[] | null
  chatUrl?: string | null
}

export function DeploymentStatus({ status, domain, error, errorDetails, chatUrl }: DeploymentStatusProps) {
  const [countdown, setCountdown] = useState(10)

  // Countdown timer for loading state
  useEffect(() => {
    if (status === "loading") {
      setCountdown(10) // Reset to 10 when loading starts
      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval)
            return 0
          }
          return prev - 1
        })
      }, 1000)

      return () => clearInterval(interval)
    }
  }, [status])

  if (!status) return null

  if (status === "success") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="p-6 rounded-lg bg-black/5 border border-black/10"
      >
        <div className="flex gap-3">
          <CheckCircle2 className="h-5 w-5 text-black flex-shrink-0 mt-0.5" />
          <div className="w-full">
            <h3 className="font-medium text-black mb-1">Deployment Successful!</h3>
            <p className="text-black/60 text-sm font-light mb-4">{domain} is now live</p>
            <a
              href={`https://${domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-4 py-2 bg-black text-white text-sm font-medium rounded-lg hover:bg-black/90 transition-all"
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
        className="p-4 rounded-lg bg-red-50/50 border border-red-200/50"
      >
        <div className="flex gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-red-900 mb-1">Deployment Failed</h3>
            <p className="text-red-700 text-sm font-light mb-3">{error}</p>
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
      className="p-4 rounded-lg bg-black/5 border border-black/10"
    >
      <div className="flex gap-3">
        <Loader2 className="h-5 w-5 text-black flex-shrink-0 mt-0.5 animate-spin" />
        <div className="flex-1">
          <h3 className="font-medium text-black mb-1">
            {status === "loading" ? "Deploying..." : "Validating..."}
          </h3>
          <p className="text-black/60 text-sm font-light">
            {status === "loading" ? "Setting up your site" : "Checking domain configuration"}
          </p>
          {status === "loading" && countdown > 0 && (
            <motion.p
              key={countdown}
              initial={{ scale: 1.2, opacity: 0.8 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-black/70 text-sm font-medium mt-2"
            >
              ~{countdown} seconds remaining
            </motion.p>
          )}
        </div>
      </div>
    </motion.div>
  )
}
