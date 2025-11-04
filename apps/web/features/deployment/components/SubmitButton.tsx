"use client"

import { motion } from "framer-motion"
import { Loader2 } from "lucide-react"

interface SubmitButtonProps {
  isDeploying: boolean
  isValid: boolean
  label: string
}

export function SubmitButton({ isDeploying, isValid, label }: SubmitButtonProps) {
  return (
    <motion.button
      whileHover={!isDeploying && isValid ? { scale: 1.01 } : {}}
      whileTap={!isDeploying && isValid ? { scale: 0.99 } : {}}
      type="submit"
      disabled={isDeploying || !isValid}
      className={`w-full py-3 px-4 rounded-lg font-medium text-sm transition-all duration-300 flex items-center justify-center gap-2 ${
        isDeploying || !isValid
          ? "bg-gray-100 text-gray-400 cursor-not-allowed"
          : "bg-gray-900 text-white hover:bg-black"
      }`}
    >
      {isDeploying ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Deploying...</span>
        </>
      ) : (
        <span>{label}</span>
      )}
    </motion.button>
  )
}
