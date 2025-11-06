"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { motion } from "framer-motion"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { EmailField } from "@/components/ui/primitives/EmailField"
import { PasswordField } from "@/components/ui/primitives/PasswordField"
import { checkSlugAvailability } from "@/features/deployment/lib/slug-api"
import type { DeploySubdomainForm, DeploySubdomainResponse } from "@/features/deployment/types/deploy-subdomain"
import { WILDCARD_DOMAIN } from "@/lib/config"
import { DeploymentStatus } from "./DeploymentStatus"
import { SlugInput } from "./SlugInput"
import { SubmitButton } from "./SubmitButton"

const deploySubdomainSchema = z.object({
  slug: z
    .string()
    .min(3, "Must be at least 3 characters")
    .max(20, "Must be 20 characters or less")
    .regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and dashes"),
  email: z.string().email("Please enter a valid email address"),
  siteIdeas: z.string().optional(),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(16, "Password must be at most 16 characters"),
})

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

export function SubdomainDeployForm() {
  const [isDeploying, setIsDeploying] = useState(false)
  const [deploymentStatus, setDeploymentStatus] = useState<DeploySubdomainResponse | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isValid },
  } = useForm<DeploySubdomainForm>({
    resolver: zodResolver(deploySubdomainSchema),
    mode: "onChange",
    defaultValues: {
      slug: "",
      email: "",
      siteIdeas: "",
      password: "",
    },
  })

  const watchSlug = watch("slug")
  const watchPassword = watch("password")

  const onSubmit = async (data: DeploySubdomainForm) => {
    setIsDeploying(true)
    setDeploymentStatus(null)

    try {
      // Final availability check before deployment
      const availCheck = await checkSlugAvailability(data.slug)

      if (availCheck.error || availCheck.available === null) {
        setDeploymentStatus({
          ok: false,
          message: availCheck.error || "Failed to check availability",
          error: "AVAILABILITY_CHECK_FAILED",
        })
        setIsDeploying(false)
        return
      }

      if (!availCheck.available) {
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
          email: data.email,
          siteIdeas: data.siteIdeas,
          password: data.password,
        }),
      })

      const responseText = await response.text()
      const contentType = response.headers.get("content-type")

      if (!contentType || !contentType.includes("application/json")) {
        throw new Error(`Server error (${response.status}): ${responseText.substring(0, 200)}`)
      }

      const result: DeploySubdomainResponse = JSON.parse(responseText)
      setDeploymentStatus(result)
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
    <motion.div className="w-full max-w-md" variants={containerVariants} initial="hidden" animate="visible">
      {/* Header */}
      <motion.div variants={itemVariants} className="text-center mb-12">
        <h1 className="text-4xl font-light mb-3 text-black">Launch Your Site</h1>
        <p className="text-base text-black/50 font-light">Get online in 30 seconds</p>
      </motion.div>

      {/* Info Box */}
      <motion.div variants={itemVariants} className="bg-black/5 border border-black/10 rounded-lg p-5 mb-8">
        <p className="text-base text-black/70 mb-4 font-light">
          Your site will be at: <span className="font-medium text-black">{watchSlug.toLowerCase() || "your-name"}</span>
          <span className="text-black/60">.{WILDCARD_DOMAIN}</span>
        </p>
        <div className="space-y-2 text-sm text-black/60 font-light">
          <p>✓ No domain setup needed</p>
          <p>✓ Start building now</p>
          <p>✓ Add your own domain later</p>
        </div>
      </motion.div>

      {/* Form */}
      {!deploymentStatus || !deploymentStatus.ok ? (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <motion.div variants={itemVariants}>
            <SlugInput register={register} errors={errors} watchSlug={watchSlug} isDeploying={isDeploying} />
          </motion.div>

          <motion.div variants={itemVariants}>
            <EmailField register={register} errors={errors} isDeploying={isDeploying} />
          </motion.div>

          {/* Hidden field for siteIdeas */}
          <input type="hidden" {...register("siteIdeas")} value="" />

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

          <motion.div variants={itemVariants} className="space-y-3">
            <p className="text-center text-sm text-black/50 font-light">
              You'll be able to start building immediately
            </p>
            <SubmitButton
              isDeploying={isDeploying}
              isValid={isValid && !errors.slug && !errors.email && !errors.password}
              label="Launch Site"
            />
          </motion.div>
        </form>
      ) : null}

      {/* Status */}
      {deploymentStatus && (
        <DeploymentStatus
          status={deploymentStatus.ok ? "success" : "error"}
          domain={deploymentStatus.domain}
          error={deploymentStatus.error}
          chatUrl={deploymentStatus.chatUrl}
        />
      )}
    </motion.div>
  )
}
