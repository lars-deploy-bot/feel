"use client"

import { FREE_CREDITS } from "@webalive/shared"
import { motion } from "framer-motion"
import { Github, Zap } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect } from "react"
import { trackDeployPageViewed } from "@/lib/analytics/events"
import { ModeOption } from "@/features/deployment/components/ModeOption"

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
}

function DeployPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    trackDeployPageViewed()
  }, [])

  // Forward existing query params (q, template) to sub-pages
  function navigateTo(path: string) {
    const params = new URLSearchParams()
    const q = searchParams.get("q")
    const template = searchParams.get("template")
    if (q) params.set("q", q)
    if (template) params.set("template", template)
    const qs = params.toString()
    router.push(qs ? `${path}?${qs}` : path)
  }

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 py-16 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col items-center">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={containerVariants}
          className="w-full max-w-lg mx-auto min-h-[60vh] flex flex-col justify-center"
        >
          <motion.div variants={itemVariants} className="text-center mb-12">
            <h1
              className="text-4xl font-bold tracking-tight text-black dark:text-white mb-4"
              data-testid="deploy-heading"
            >
              Launch your site
            </h1>
            <p className="text-lg text-black/60 dark:text-white/60 font-medium">Get started in under a minute</p>
          </motion.div>

          <motion.div variants={itemVariants} className="flex flex-col gap-4">
            <ModeOption
              icon={Zap}
              title="Quick Launch"
              description={`Get a free live website and ${FREE_CREDITS} free credits, on us.`}
              time="~1 min"
              badge="Start here"
              testId="mode-option-quick-launch"
              onClick={() => navigateTo("/deploy/start")}
            />
            <ModeOption
              icon={Github}
              title="Import from GitHub"
              description="Create a new site from an existing GitHub repository."
              time="~2 min"
              testId="mode-option-github"
              onClick={() => navigateTo("/deploy/github")}
            />
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}

export default function DeployPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white dark:bg-zinc-950" />}>
      <DeployPageContent />
    </Suspense>
  )
}
