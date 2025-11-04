"use client"

import { motion } from "framer-motion"
import { Eye, EyeOff } from "lucide-react"
import type { FieldErrors, UseFormRegister } from "react-hook-form"
import { fieldVariants } from "@/lib/animations"

// PasswordField is reused across multiple form types (DeployForm, SubdomainDeployForm)
// Using 'any' here is intentional for component reusability across different form shapes
// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface PasswordFieldProps {
  register: UseFormRegister<any>
  errors: FieldErrors<any>
  watchPassword: string
  isDeploying: boolean
  showPassword: boolean
  onTogglePassword: () => void
}

export function PasswordField({
  register,
  errors,
  watchPassword,
  isDeploying,
  showPassword,
  onTogglePassword,
}: PasswordFieldProps) {
  return (
    <motion.div variants={fieldVariants}>
      <label htmlFor="password" className="block text-sm font-semibold text-gray-900 mb-2">
        Site password
      </label>
      <p className="text-xs text-gray-500 mb-3">6–16 characters. You'll use this to access the admin panel.</p>
      <div className="relative">
        <motion.input
          whileFocus="focus"
          variants={fieldVariants}
          {...register("password")}
          disabled={isDeploying}
          type={showPassword ? "text" : "password"}
          autoComplete="off"
          data-1p-ignore
          data-lpignore
          placeholder="••••••••"
          className={`w-full px-4 py-3 rounded-lg border-2 transition-colors outline-none font-medium pr-12 ${
            errors.password
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
      {errors.password && typeof errors.password === "object" && "message" in errors.password && (
        <motion.p
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-1.5 text-red-600 text-xs font-medium"
        >
          {errors.password.message as string}
        </motion.p>
      )}
    </motion.div>
  )
}
