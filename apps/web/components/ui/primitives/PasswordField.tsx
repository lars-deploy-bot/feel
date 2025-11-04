"use client"

import { motion } from "framer-motion"
import { Eye, EyeOff } from "lucide-react"
import type { FieldErrors, UseFormRegister, Path, FieldValues } from "react-hook-form"
import { fieldVariants } from "@/lib/animations"

interface PasswordFieldProps<T extends FieldValues> {
  register: UseFormRegister<T>
  errors: FieldErrors<T>
  watchPassword: string
  isDeploying: boolean
  showPassword: boolean
  onTogglePassword: () => void
  label?: string
  helperText?: string
  fieldName?: Path<T>
}

export function PasswordField<T extends FieldValues>({
  register,
  errors,
  watchPassword,
  isDeploying,
  showPassword,
  onTogglePassword,
  label = "Site password",
  helperText = "6–16 characters. You'll use this to access the admin panel.",
  fieldName = "password" as Path<T>,
}: PasswordFieldProps<T>) {
  const fieldError = errors[fieldName]
  const errorMessage =
    fieldError && typeof fieldError === "object" && "message" in fieldError ? fieldError.message : undefined

  return (
    <motion.div variants={fieldVariants}>
      <label htmlFor={String(fieldName)} className="block text-sm font-semibold text-gray-900 mb-2">
        {label}
      </label>
      <p className="text-xs text-gray-500 mb-3">{helperText}</p>
      <div className="relative">
        <motion.input
          whileFocus="focus"
          variants={fieldVariants}
          {...register(fieldName)}
          disabled={isDeploying}
          type={showPassword ? "text" : "password"}
          autoComplete="off"
          data-1p-ignore
          data-lpignore
          placeholder="••••••••"
          className={`w-full px-4 py-3 rounded-lg border-2 transition-colors outline-none font-medium pr-12 ${
            fieldError
              ? "border-red-300 bg-red-50 text-gray-900"
              : "border-gray-200 bg-gray-50 text-gray-900 hover:border-gray-300 focus:border-blue-500 focus:bg-blue-50"
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        />
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          type="button"
          onClick={onTogglePassword}
          disabled={isDeploying}
          className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 transition-colors"
        >
          {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </motion.button>
      </div>
      {watchPassword && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 flex gap-1">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full flex-1 ${
                watchPassword.length >= (i + 1) * (16 / 3) ? "bg-blue-500" : "bg-gray-200"
              }`}
            />
          ))}
        </motion.div>
      )}
      {errorMessage && (
        <motion.p
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-1.5 text-red-600 text-xs font-medium"
        >
          {String(errorMessage)}
        </motion.p>
      )}
    </motion.div>
  )
}
