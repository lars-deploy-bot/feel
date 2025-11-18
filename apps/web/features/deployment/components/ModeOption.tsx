"use client"

import { motion } from "framer-motion"
import type { LucideIcon } from "lucide-react"

interface ModeOptionProps {
  icon: LucideIcon
  title: string
  description: string
  time: string
  onClick: () => void
  badge?: string
  disabled?: boolean
  testId?: string
}

export function ModeOption({
  icon: Icon,
  title,
  description,
  time,
  onClick,
  badge,
  disabled = false,
  testId,
}: ModeOptionProps) {
  return (
    <motion.button
      whileHover={!disabled ? { scale: 1.01 } : {}}
      whileTap={!disabled ? { scale: 0.99 } : {}}
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className={`w-full p-6 rounded-2xl border transition-all text-left group relative ${
        disabled
          ? "border-gray-200 bg-gray-50 cursor-not-allowed opacity-60"
          : badge
            ? "border-blue-300 bg-blue-50/30 hover:bg-blue-50/50 hover:border-blue-400"
            : "border-gray-200 hover:border-gray-300 hover:bg-gray-50/50"
      }`}
    >
      {badge && (
        <div className="absolute -top-2.5 left-4 px-3 py-1 bg-blue-500 text-white text-sm font-bold rounded-full shadow-sm">
          {badge}
        </div>
      )}
      <div className="flex items-start gap-4">
        <div
          className={`p-2.5 rounded-lg transition-colors ${
            disabled
              ? "bg-gray-100"
              : badge
                ? "bg-blue-100 group-hover:bg-blue-200"
                : "bg-gray-100 group-hover:bg-gray-200"
          }`}
        >
          <Icon className={`h-5 w-5 ${disabled ? "text-gray-400" : badge ? "text-blue-700" : "text-gray-700"}`} />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-gray-900 text-lg mb-2">{title}</h3>
          <p className="text-gray-700 text-base font-medium leading-relaxed">{description}</p>
        </div>
        {time && (
          <div className="text-right flex flex-col gap-1">
            <div className="text-sm text-gray-500 font-semibold">{time}</div>
            <div className="text-xs text-green-600 font-semibold">Free</div>
          </div>
        )}
      </div>
    </motion.button>
  )
}
