"use client"

import { AnimatePresence, motion } from "framer-motion"
import { WifiOff } from "lucide-react"

interface OfflineBannerProps {
  isOnline: boolean
}

export function OfflineBanner({ isOnline }: OfflineBannerProps) {
  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="overflow-hidden"
        >
          <div className="text-[13px] text-zinc-400 dark:text-zinc-500 px-4 py-2 flex items-center justify-center gap-2 border-b border-zinc-100 dark:border-white/[0.04]">
            <WifiOff className="w-3.5 h-3.5" />
            <span>You're offline</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
