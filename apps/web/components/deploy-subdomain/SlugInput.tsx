"use client"

import { motion } from "framer-motion"
import { useEffect, useState } from "react"
import type { FieldErrors, UseFormRegister } from "react-hook-form"

interface DeploySubdomainForm {
  slug: string
  siteIdeas: string
  password: string
}

const fieldVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.4 },
  },
  focus: {
    scale: 1.01,
    transition: { duration: 0.2 },
  },
}

interface SlugInputProps {
  register: UseFormRegister<DeploySubdomainForm>
  errors: FieldErrors<DeploySubdomainForm>
  watchSlug: string
  isDeploying: boolean
}

export function SlugInput({ register, errors, watchSlug, isDeploying }: SlugInputProps) {
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null)
  const [isChecking, setIsChecking] = useState(false)

  const isFormatValid = watchSlug && /^[a-z0-9]([a-z0-9-]{1,18}[a-z0-9])?$/.test(watchSlug)

  // Check availability when slug changes
  useEffect(() => {
    if (!isFormatValid) {
      setIsAvailable(null)
      return
    }

    setIsChecking(true)
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/sites/check-availability?slug=${encodeURIComponent(watchSlug)}`)
        const data = await res.json()
        setIsAvailable(data.available)
      } catch (error) {
        console.error("Failed to check availability:", error)
        setIsAvailable(null)
      } finally {
        setIsChecking(false)
      }
    }, 1000) // Debounce 1 second

    return () => clearTimeout(timer)
  }, [watchSlug, isFormatValid])

  return (
    <motion.div variants={fieldVariants}>
      <label htmlFor="slug" className="block text-sm font-semibold text-gray-900 mb-2">
        Your subdomain name
      </label>
      <p className="text-xs text-gray-500 mb-3">
        3–20 characters. Lowercase letters, numbers, and hyphens only.
      </p>

      <motion.div className="relative">
        <motion.input
          whileFocus="focus"
          variants={fieldVariants}
          {...register("slug")}
          disabled={isDeploying}
          type="text"
          placeholder="my-website"
          autoComplete="off"
          data-1p-ignore
          data-lpignore
          className={`w-full px-4 py-3 rounded-lg border-2 transition-colors outline-none font-medium pr-32 ${
            errors.slug
              ? "border-red-300 bg-red-50 text-gray-900"
              : isAvailable === true
                ? "border-green-300 bg-green-50 text-gray-900"
                : "border-gray-200 bg-gray-50 text-gray-900 hover:border-gray-300 focus:border-blue-500 focus:bg-blue-50"
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        />

        {watchSlug && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute right-4 top-3 text-xs text-gray-600 whitespace-nowrap"
          >
            <span className="text-gray-900 font-medium">{watchSlug}</span>
            <span className="text-gray-500">.alive.best</span>
          </motion.div>
        )}
      </motion.div>

      {errors.slug && (
        <motion.p
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-1.5 text-red-600 text-xs font-medium"
        >
          {errors.slug.message}
        </motion.p>
      )}

      {isFormatValid && !errors.slug && isChecking && (
        <motion.p
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-1.5 text-gray-500 text-xs font-medium"
        >
          Checking availability...
        </motion.p>
      )}

      {isFormatValid && !errors.slug && !isChecking && isAvailable === true && (
        <motion.p
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-1.5 text-green-600 text-xs font-medium"
        >
          ✓ Available
        </motion.p>
      )}

      {isFormatValid && !errors.slug && !isChecking && isAvailable === false && (
        <motion.p
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-1.5 text-red-600 text-xs font-medium"
        >
          ✗ Already taken
        </motion.p>
      )}
    </motion.div>
  )
}
