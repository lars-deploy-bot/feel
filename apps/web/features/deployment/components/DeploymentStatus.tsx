"use client"

import { motion } from "framer-motion"
import { AlertCircle, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"

type StatusType = "success" | "error" | "loading"

interface DeploymentStatusProps {
  status: StatusType | null
  domain?: string | null
  error?: string | null
  errorDetails?: string[] | null
  chatUrl?: string | null
}

export function DeploymentStatus({ status, domain, error, errorDetails }: DeploymentStatusProps) {
  const [countdown, setCountdown] = useState(30)
  const [_copied, setCopied] = useState(false)

  // Countdown timer for loading state
  useEffect(() => {
    if (status === "loading") {
      setCountdown(30) // Reset to 30 when loading starts
      const interval = setInterval(() => {
        setCountdown(prev => {
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
    const copyLink = () => {
      navigator.clipboard.writeText(`https://${domain}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full min-h-[80vh] flex items-center justify-center"
      >
        <a
          href={`https://${domain}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={copyLink}
          className="inline-flex items-center justify-center h-12 px-8 bg-black text-white text-[15px] font-normal tracking-[-0.011em] rounded-full hover:bg-black/90 transition-all duration-200 ease-out active:scale-[0.98]"
        >
          Start Building
        </a>
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
            <p className="text-red-700 text-sm font-normal mb-3">{error}</p>
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

  // Loading state - Clean and minimal
  const stages = ["Launching", "Deploying", "Setting up your site"]
  const currentStage = countdown > 20 ? 0 : countdown > 10 ? 1 : 2
  const progress = ((30 - countdown) / 30) * 100

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-md flex flex-col items-center"
    >
      {/* Circular progress indicator */}
      <div className="relative mb-12">
        {/* Background ring */}
        <svg className="w-28 h-28 -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="54" fill="none" stroke="currentColor" strokeWidth="1" className="text-black/5" />
          {/* Progress ring */}
          <motion.circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            stroke="url(#progressGradient)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeDasharray={339.292} // 2πr
            initial={{ strokeDashoffset: 339.292 }}
            animate={{ strokeDashoffset: 339.292 - (339.292 * progress) / 100 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          />
          <defs>
            <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgb(59, 130, 246)" />
              <stop offset="100%" stopColor="rgb(147, 51, 234)" />
            </linearGradient>
          </defs>
        </svg>

        {/* Center icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 3, ease: "linear", repeat: Infinity }}>
            <Loader2 className="w-7 h-7 text-black/20" strokeWidth={1.5} />
          </motion.div>
        </div>
      </div>

      {/* Stage label with smooth transitions */}
      <motion.div
        key={currentStage}
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -5 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="mb-6"
      >
        <h3 className="text-xl font-normal text-black text-center">{stages[currentStage]}</h3>
      </motion.div>

      {/* Time remaining */}
      {countdown > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col items-center gap-2"
        >
          {/* Countdown number */}
          <motion.div
            key={countdown}
            initial={{ scale: 1.05, opacity: 0.8 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="text-4xl font-normal text-black tabular-nums">{countdown}</span>
          </motion.div>

          {/* Label */}
          <p className="text-sm font-normal text-black/50">seconds remaining</p>
        </motion.div>
      )}
    </motion.div>
  )
}
