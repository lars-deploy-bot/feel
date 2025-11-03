"use client"

import { motion } from "framer-motion"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { SubmitButton } from "@/components/deploy-form/SubmitButton"
import { DeploymentStatus } from "@/components/deploy-form/DeploymentStatus"
import { PasswordField } from "@/components/deploy-form/PasswordField"
import { SlugInput } from "./SlugInput"
import { SiteIdeasTextarea } from "./SiteIdeasTextarea"

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

interface DeploySubdomainFormData {
  slug: string
  siteIdeas: string
  password: string
}

interface DeploymentResult {
  ok: boolean
  message: string
  domain?: string
  chatUrl?: string
  error?: string
}

export function SubdomainDeployForm() {
  const router = useRouter()
  const [isDeploying, setIsDeploying] = useState(false)
  const [deploymentStatus, setDeploymentStatus] = useState<DeploymentResult | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isValid },
  } = useForm<DeploySubdomainFormData>({
    mode: "onChange",
    defaultValues: {
      slug: "",
      siteIdeas: "",
      password: "",
    },
  })

  const watchSlug = watch("slug")
  const watchIdeas = watch("siteIdeas")
  const watchPassword = watch("password")

  const onSubmit = async (data: DeploySubdomainFormData) => {
    setIsDeploying(true)
    setDeploymentStatus(null)

    try {
      // Final availability check before deployment
      const availCheck = await fetch(`/api/sites/check-availability?slug=${encodeURIComponent(data.slug.toLowerCase())}`)
      const availData = await availCheck.json()

      if (!availData.available) {
        setDeploymentStatus({
          ok: false,
          message: "This subdomain is no longer available",
          error: "SLUG_TAKEN",
        })
        setIsDeploying(false)
        return
      }

      const response = await fetch("/api/deploy-subdomain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: data.slug.toLowerCase(),
          siteIdeas: data.siteIdeas,
          password: data.password,
        }),
      })

      const responseText = await response.text()
      const contentType = response.headers.get("content-type")

      if (!contentType || !contentType.includes("application/json")) {
        throw new Error(`Server error (${response.status}): ${responseText.substring(0, 200)}`)
      }

      const result: DeploymentResult = JSON.parse(responseText)
      setDeploymentStatus(result)

      // Auto-redirect on success
      if (result.ok && result.chatUrl) {
        const chatUrl = result.chatUrl
        setTimeout(() => {
          router.push(chatUrl)
        }, 2000)
      }
    } catch (error) {
      setDeploymentStatus({
        ok: false,
        message: "Failed to connect to deployment API",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    } finally {
      setIsDeploying(false)
    }
  }

  return (
    <motion.div
      className="w-full max-w-md"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Deploy to alive.best</h1>
        <p className="text-gray-600">Get your site live in 30 seconds</p>
      </motion.div>

      {/* Info Box */}
      <motion.div variants={itemVariants} className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
        <p className="text-sm text-blue-900">
          Your site will be deployed to{" "}
          <span className="font-semibold">
            {watchSlug.toLowerCase() || "your-slug"}
          </span>
          <span className="text-blue-700">.alive.best</span>
        </p>
        <p className="text-xs text-blue-700 mt-2">
          No domain setup needed. Just describe what you want, and Claude will start building.
        </p>
      </motion.div>

      {/* Form */}
      {!deploymentStatus || !deploymentStatus.ok ? (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <motion.div variants={itemVariants}>
            <SlugInput
              register={register}
              errors={errors}
              watchSlug={watchSlug}
              isDeploying={isDeploying}
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <SiteIdeasTextarea
              register={register}
              errors={errors}
              watchIdeas={watchIdeas}
              isDeploying={isDeploying}
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <PasswordField
              register={register}
              errors={errors}
              watchPassword={watchPassword}
              isDeploying={isDeploying}
              showPassword={showPassword}
              onTogglePassword={() => setShowPassword(!showPassword)}
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <SubmitButton
              isDeploying={isDeploying}
              isValid={isValid && !errors.slug && !errors.siteIdeas && !errors.password}
              label="Deploy Now"
            />
          </motion.div>
        </form>
      ) : null}

      {/* Status */}
      {deploymentStatus && (
        <DeploymentStatus
          result={{
            success: deploymentStatus.ok,
            message: deploymentStatus.message,
            domain: deploymentStatus.domain,
            errors: deploymentStatus.error ? [deploymentStatus.error] : undefined,
          }}
          onClose={() => setDeploymentStatus(null)}
        />
      )}
    </motion.div>
  )
}
