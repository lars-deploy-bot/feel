"use client"

import { motion } from "framer-motion"
import { useEffect, useRef, useState } from "react"
import type { FieldErrors, UseFormRegister } from "react-hook-form"
import { fieldVariants } from "@/lib/animations"
import { WILDCARD_DOMAIN } from "@/lib/config"
import { isValidSlug } from "@/features/deployment/lib/slug-utils"
import type { DeploySubdomainForm } from "../types/deploy-subdomain"

interface SlugInputProps {
  register: UseFormRegister<DeploySubdomainForm>
  errors: FieldErrors<DeploySubdomainForm>
  watchSlug: string
  isDeploying: boolean
}

export function SlugInput({ register, errors, watchSlug, isDeploying }: SlugInputProps) {
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const isFormatValid = watchSlug && isValidSlug(watchSlug)

  // Auto-focus on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [])

  // Check availability when slug changes
  useEffect(() => {
    if (!isFormatValid) {
      setIsAvailable(null)
      return
    }

    setIsChecking(true)
    const timer = setTimeout(async () => {
      try {
        const lowercaseSlug = watchSlug.toLowerCase()
        console.log(`[Frontend] Checking availability for: "${lowercaseSlug}"`)
        const res = await fetch(`/api/sites/check-availability?slug=${encodeURIComponent(lowercaseSlug)}`)
        const data = await res.json()
        console.log("[Frontend] Availability result:", data)
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
      <label htmlFor="slug" className="block text-base font-bold text-gray-900 mb-2">
        Choose your site name
      </label>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-600 font-medium">Pick your unique name.</p>
        {watchSlug && (
          <motion.span
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-xs text-gray-500 font-semibold"
          >
            {watchSlug.length}/20
          </motion.span>
        )}
      </div>

      <motion.div className="relative">
        <motion.input
          whileFocus="focus"
          variants={fieldVariants}
          {...register("slug", {
            setValueAs: value => value.toLowerCase(),
          })}
          ref={e => {
            register("slug").ref(e)
            inputRef.current = e
          }}
          disabled={isDeploying}
          type="text"
          placeholder="yourname"
          autoComplete="off"
          data-1p-ignore
          data-lpignore
          className={`w-full px-4 py-3 rounded-lg border-2 transition-colors outline-none font-bold text-lg pr-32 ${
            errors.slug
              ? "border-red-300 bg-red-50 text-gray-900"
              : isAvailable === true
                ? "border-green-300 bg-green-50 text-gray-900"
                : "border-gray-200 bg-gray-50 text-gray-900 hover:border-gray-300 focus:border-purple-500 focus:bg-purple-50 focus:border-purple-400"
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        />

        {watchSlug && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-600 whitespace-nowrap"
          >
            <span className="text-gray-900 font-bold">{watchSlug}</span>
            <span className="text-gray-500 font-medium">.{WILDCARD_DOMAIN}</span>
          </motion.div>
        )}
      </motion.div>

      {errors.slug && (
        <motion.p
          initial={{ opacity: 0, x: 0 }}
          animate={{
            opacity: 1,
            x: [0, -10, 10, -10, 10, 0],
          }}
          transition={{ duration: 0.5 }}
          className="mt-2 text-red-600 text-sm font-bold"
        >
          {errors.slug.message}
        </motion.p>
      )}

      {isFormatValid && !errors.slug && isChecking && (
        <motion.p
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 text-gray-600 text-sm font-semibold flex items-center gap-2"
        >
          <motion.span
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="inline-block w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full"
          />
          Checking...
        </motion.p>
      )}

      {isFormatValid && !errors.slug && !isChecking && isAvailable === true && (
        <motion.p
          initial={{ opacity: 0, y: -5, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="mt-2 text-green-600 text-sm font-bold"
        >
          Available! It's yours!
        </motion.p>
      )}

      {isFormatValid && !errors.slug && !isChecking && isAvailable === false && (
        <motion.p
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 text-red-600 text-sm font-bold"
        >
          ✗ Already taken
        </motion.p>
      )}
    </motion.div>
  )
}
