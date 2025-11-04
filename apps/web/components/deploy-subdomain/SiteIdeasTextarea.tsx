"use client"

import { motion } from "framer-motion"
import type { FieldErrors, UseFormRegister } from "react-hook-form"
import type { DeploySubdomainForm } from "@/lib/types/deploy-subdomain"

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

interface SiteIdeasTextareaProps {
  register: UseFormRegister<DeploySubdomainForm>
  errors: FieldErrors<DeploySubdomainForm>
  watchIdeas: string
  isDeploying: boolean
}

export function SiteIdeasTextarea({ register, errors, watchIdeas, isDeploying }: SiteIdeasTextareaProps) {
  const charCount = watchIdeas?.length || 0
  const isLengthValid = charCount >= 10 && charCount <= 5000

  return (
    <motion.div variants={fieldVariants}>
      <label htmlFor="siteIdeas" className="block text-sm font-semibold text-gray-900 mb-2">
        What do you want to build?
      </label>
      <p className="text-xs text-gray-500 mb-3">Describe your website ideas. Claude will use this to get started.</p>

      <motion.div className="relative">
        <motion.textarea
          whileFocus="focus"
          variants={fieldVariants}
          {...register("siteIdeas")}
          disabled={isDeploying}
          placeholder="e.g., Build a dark-themed portfolio website with a smooth scroll animation and a contact form..."
          rows={4}
          data-1p-ignore
          data-lpignore
          className={`w-full px-4 py-3 rounded-lg border-2 transition-colors outline-none font-medium resize-none ${
            errors.siteIdeas
              ? "border-red-300 bg-red-50 text-gray-900"
              : isLengthValid
                ? "border-green-300 bg-green-50 text-gray-900"
                : "border-gray-200 bg-gray-50 text-gray-900 hover:border-gray-300 focus:border-blue-500 focus:bg-blue-50"
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        />

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute bottom-3 right-4 text-xs text-gray-500"
        >
          <span className={charCount < 10 ? "text-orange-600" : charCount > 5000 ? "text-red-600" : "text-green-600"}>
            {charCount}
          </span>
          <span className="text-gray-400"> / 5000</span>
        </motion.div>
      </motion.div>

      {errors.siteIdeas && (
        <motion.p
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-1.5 text-red-600 text-xs font-medium"
        >
          {errors.siteIdeas.message}
        </motion.p>
      )}

      {charCount > 0 && charCount < 10 && (
        <motion.p
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-1.5 text-orange-600 text-xs font-medium"
        >
          Need at least 10 characters
        </motion.p>
      )}

      {charCount > 5000 && (
        <motion.p
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-1.5 text-red-600 text-xs font-medium"
        >
          Maximum 5000 characters
        </motion.p>
      )}
    </motion.div>
  )
}
