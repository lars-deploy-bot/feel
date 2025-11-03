"use client"

import { motion } from "framer-motion"
import type { FieldErrors, UseFormRegister } from "react-hook-form"

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
  register: UseFormRegister<any>
  errors: FieldErrors<any>
  watchSlug: string
  isDeploying: boolean
}

export function SlugInput({ register, errors, watchSlug, isDeploying }: SlugInputProps) {
  const isValid = watchSlug && /^[a-z0-9]([a-z0-9-]{1,18}[a-z0-9])?$/.test(watchSlug)

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
              : isValid
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

      {errors.slug && typeof errors.slug === "object" && "message" in errors.slug && (
        <motion.p
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-1.5 text-red-600 text-xs font-medium"
        >
          {errors.slug.message as string}
        </motion.p>
      )}

      {isValid && !errors.slug && (
        <motion.p
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-1.5 text-green-600 text-xs font-medium"
        >
          ✓ Available
        </motion.p>
      )}
    </motion.div>
  )
}
