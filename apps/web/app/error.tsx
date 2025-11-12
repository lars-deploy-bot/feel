"use client"

import { motion } from "framer-motion"
import { RefreshCw, Home } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

// biome-ignore lint/suspicious/noShadowRestrictedNames: Next.js error boundary requires Error type
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter()

  useEffect(() => {
    console.error("Root error boundary caught:", error)
    // TODO: Send to error tracking service (Sentry)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-lg w-full"
      >
        {/* Icon */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="flex justify-center mb-8"
        >
          <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center">
            <svg
              className="w-10 h-10 text-blue-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
          </div>
        </motion.div>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-center mb-10"
        >
          <h1 className="text-3xl font-normal tracking-tight text-gray-900 mb-3">Something unexpected happened</h1>
          <p className="text-base text-gray-600 font-normal leading-relaxed">
            We've logged the issue and your data is safe. Try refreshing or head back to continue working.
          </p>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="flex flex-col sm:flex-row gap-3 justify-center"
        >
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 h-12 px-6 bg-black text-white text-[15px] font-normal tracking-[-0.011em] rounded-full hover:bg-black/90 transition-all duration-200 ease-out active:scale-[0.98]"
          >
            <RefreshCw className="w-4 h-4" />
            Try again
          </button>

          <button
            type="button"
            onClick={() => router.push("/")}
            className="inline-flex items-center justify-center gap-2 h-12 px-6 bg-gray-100 text-gray-900 text-[15px] font-normal tracking-[-0.011em] rounded-full hover:bg-gray-200 transition-all duration-200 ease-out active:scale-[0.98]"
          >
            <Home className="w-4 h-4" />
            Go home
          </button>
        </motion.div>

        {/* Development error details */}
        {process.env.NODE_ENV === "development" && (
          <motion.details
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-8 p-4 rounded-lg bg-gray-50 border border-gray-200"
          >
            <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-900 font-medium">
              Error details (development only)
            </summary>
            <pre className="mt-3 text-xs bg-white p-3 rounded border border-gray-200 overflow-auto max-h-60 text-gray-900 font-mono">
              {error.message}
              {"\n\n"}
              {error.stack}
            </pre>
          </motion.details>
        )}
      </motion.div>
    </div>
  )
}
