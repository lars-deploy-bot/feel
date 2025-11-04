"use client"

import { motion } from "framer-motion"
import type { LucideIcon } from "lucide-react"

interface ModeOptionProps {
  icon: LucideIcon
  title: string
  description: string
  time: string
  onClick: () => void
}

export function ModeOption({ icon: Icon, title, description, time, onClick }: ModeOptionProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className="w-full p-6 rounded-2xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50/50 transition-all text-left group"
    >
      <div className="flex items-start gap-4">
        <div className="p-2.5 rounded-lg bg-gray-100 group-hover:bg-gray-200 transition-colors">
          <Icon className="h-5 w-5 text-gray-700" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 text-base mb-1">{title}</h3>
          <p className="text-gray-600 text-sm leading-relaxed">{description}</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-400 font-medium">{time}</div>
          <div className="text-xs text-gray-300 mt-0.5">Free</div>
        </div>
      </div>
    </motion.button>
  )
}
