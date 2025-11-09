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
  const [countdown, setCountdown] = useState(20)
  const [_copied, setCopied] = useState(false)

  // Countdown timer for loading state
  useEffect(() => {
    if (status === "loading") {
      setCountdown(20) // Reset to 20 when loading starts
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
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full px-4 sm:px-6"
      >
        {/* Emotional message */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-center text-sm sm:text-base font-light text-black/50 mb-8 sm:mb-16"
        >
          You just got your own website
        </motion.p>

        {/* Hero: Just the domain */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="mb-8 sm:mb-16 relative"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 blur-3xl -z-10 scale-150" />
          <h1 className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-extralight text-black tracking-tight text-center break-words">{domain}</h1>
        </motion.div>

        {/* Single action */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="flex justify-center"
        >
          <a
            href={`https://${domain}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={copyLink}
            className="px-6 sm:px-12 py-3 sm:py-4 bg-gradient-to-br from-blue-600 to-blue-500 text-white text-sm sm:text-base font-medium rounded-full hover:from-blue-500 hover:to-blue-400 transition-all duration-300 shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 hover:scale-105 active:scale-95"
          >
            Open Site
          </a>
        </motion.div>
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

  // Loading state - Clean and minimal
  const stages = ["Launching", "Deploying", "Setting up your site"]
  const currentStage = countdown > 13 ? 0 : countdown > 6 ? 1 : 2
  const progress = ((20 - countdown) / 20) * 100

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
        <h3 className="text-xl font-light text-black text-center">{stages[currentStage]}</h3>
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
            <span className="text-4xl font-light text-black tabular-nums">{countdown}</span>
          </motion.div>

          {/* Label */}
          <p className="text-sm font-light text-black/50">seconds remaining</p>
        </motion.div>
      )}
    </motion.div>
  )
}
