"use client"

import type { HTMLMotionProps } from "framer-motion"
import { motion } from "framer-motion"
import { forwardRef } from "react"
import { fieldVariants } from "@/lib/animations"

export type InputState = "error" | "success" | "loading" | "default"

interface InputProps extends Omit<HTMLMotionProps<"input">, "className"> {
  label?: string
  helperText?: string
  errorMessage?: string
  successMessage?: string
  state?: InputState
  suffix?: React.ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, helperText, errorMessage, successMessage, state = "default", suffix, ...props }, ref) => {
    const getInputClasses = () => {
      const base =
        "w-full px-4 py-3 rounded-lg border-2 transition-colors outline-none font-medium disabled:opacity-50 disabled:cursor-not-allowed"

      switch (state) {
        case "error":
          return `${base} border-red-300 bg-red-50 text-gray-900`
        case "success":
          return `${base} border-green-300 bg-green-50 text-gray-900`
        case "loading":
          return `${base} border-blue-300 bg-blue-50 text-gray-900`
        default:
          return `${base} border-gray-200 bg-gray-50 text-gray-900 hover:border-gray-300 focus:border-blue-500 focus:bg-blue-50`
      }
    }

    return (
      <motion.div variants={fieldVariants}>
        {label && (
          <label htmlFor={props.id} className="block text-sm font-semibold text-gray-900 mb-2">
            {label}
          </label>
        )}

        {helperText && <p className="text-xs text-gray-500 mb-3">{helperText}</p>}

        <motion.div className="relative">
          <motion.input
            ref={ref}
            whileFocus="focus"
            variants={fieldVariants}
            className={getInputClasses()}
            {...props}
          />

          {suffix && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute right-4 top-3 text-xs text-gray-600"
            >
              {suffix}
            </motion.div>
          )}
        </motion.div>

        {state === "error" && errorMessage && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-1.5 text-red-600 text-xs font-medium"
          >
            {errorMessage}
          </motion.p>
        )}

        {state === "success" && successMessage && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-1.5 text-green-600 text-xs font-medium"
          >
            ✓ {successMessage}
          </motion.p>
        )}

        {state === "loading" && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-1.5 text-gray-500 text-xs font-medium"
          >
            Checking...
          </motion.p>
        )}
      </motion.div>
    )
  },
)

Input.displayName = "Input"
