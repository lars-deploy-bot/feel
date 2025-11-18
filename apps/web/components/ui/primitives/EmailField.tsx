"use client"

import { motion } from "framer-motion"
import { Mail } from "lucide-react"
import { useState } from "react"
import type { FieldErrors, FieldValues, Path, UseFormRegister } from "react-hook-form"
import { fieldVariants } from "@/lib/animations"

interface EmailFieldProps<T extends FieldValues> {
  register: UseFormRegister<T>
  errors: FieldErrors<T>
  isDeploying: boolean
  fieldName?: Path<T>
  disabled?: boolean
  helperText?: string
}

export function EmailField<T extends FieldValues>({
  register,
  errors,
  isDeploying,
  fieldName = "email" as Path<T>,
  disabled = false,
  helperText = "We'll use this to help you recover your site if needed.",
}: EmailFieldProps<T>) {
  const [isFocused, setIsFocused] = useState(false)
  const fieldError = errors[fieldName]
  const errorMessage =
    fieldError && typeof fieldError === "object" && "message" in fieldError ? fieldError.message : undefined

  const { ref, ...rest } = register(fieldName)
  const isDisabled = isDeploying || disabled

  return (
    <motion.div variants={fieldVariants}>
      <label htmlFor={String(fieldName)} className="block text-base font-bold text-gray-900 mb-2">
        Email address
      </label>
      <p className="text-sm text-gray-600 mb-3 font-medium">{helperText}</p>
      <div className="relative">
        <motion.input
          whileFocus="focus"
          variants={fieldVariants}
          {...rest}
          ref={ref}
          onFocus={() => {
            setIsFocused(true)
          }}
          onBlur={e => {
            setIsFocused(false)
            rest.onBlur(e)
          }}
          disabled={isDisabled}
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          data-testid="email-input"
          className={`w-full px-4 py-3 rounded-lg border-2 transition-colors outline-none font-medium pl-11 ${
            fieldError
              ? "border-red-300 bg-red-50 text-gray-900"
              : isDisabled
                ? "border-gray-200 bg-gray-100 text-gray-700 cursor-not-allowed"
                : "border-gray-200 bg-gray-50 text-gray-900 hover:border-gray-300 focus:border-blue-500 focus:bg-blue-50"
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        />
        <motion.div
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          animate={{ scale: isFocused ? 1.01 : 1 }}
          transition={{ duration: 0.2 }}
        >
          <Mail className="h-5 w-5" />
        </motion.div>
      </div>
      {errorMessage && (
        <motion.p
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 text-red-600 text-sm font-bold"
        >
          {String(errorMessage)}
        </motion.p>
      )}
    </motion.div>
  )
}
