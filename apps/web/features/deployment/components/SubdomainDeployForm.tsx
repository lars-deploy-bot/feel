"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { motion } from "framer-motion"
import { useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { EmailField } from "@/components/ui/primitives/EmailField"
import { PasswordField } from "@/components/ui/primitives/PasswordField"
import { useAuth } from "@/features/deployment/hooks/useAuth"
import { checkSlugAvailability } from "@/features/deployment/lib/slug-api"
import type { DeploySubdomainForm, DeploySubdomainResponse } from "@/features/deployment/types/deploy-subdomain"
import { fieldVariants } from "@/lib/animations"
import { WILDCARD_DOMAIN } from "@/lib/config"
import { useOnboardingActions, useOnboardingStore } from "@/lib/stores/onboardingStore"
import { DeploymentStatus } from "./DeploymentStatus"
import { SlugInput } from "./SlugInput"
import { SubmitButton } from "./SubmitButton"

// Base schema (always required)
const baseSchema = z.object({
  slug: z
    .string()
    .min(3, "Must be at least 3 characters")
    .max(20, "Must be 20 characters or less")
    .regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and dashes"),
  email: z.string().email("Please enter a valid email address"),
  siteIdeas: z.string().optional().default(""),
})

// Schema for logged-in users (password optional)
const deploySubdomainSchemaLoggedIn = baseSchema.extend({
  password: z.string().optional(),
})

// Schema for anonymous users (password required)
const deploySubdomainSchemaAnonymous = baseSchema.extend({
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
  const searchParams = useSearchParams()
  const [isDeploying, setIsDeploying] = useState(false)
  const [deploymentStatus, setDeploymentStatus] = useState<DeploySubdomainResponse | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [showIdeaConfirmation, setShowIdeaConfirmation] = useState(true)
  const isDev = process.env.NODE_ENV === "development"

  // Authentication state
  const { user, loading: _authLoading, isAuthenticated } = useAuth()

  // Onboarding store
  const { siteIdea, selectedTemplate } = useOnboardingStore()
  const { setSiteIdea, setSelectedTemplate } = useOnboardingActions()

  // Extract the 'q' search parameter for site ideas
  const siteIdeasFromUrl = searchParams.get("q") || ""

  // Initialize from URL param if present
  useEffect(() => {
    if (siteIdeasFromUrl && !siteIdea) {
      setSiteIdea(siteIdeasFromUrl)
    }
  }, [siteIdeasFromUrl, siteIdea, setSiteIdea])

  // Auto-select landing template on mount
  useEffect(() => {
    if (!selectedTemplate) {
      setSelectedTemplate("landing")
    }
  }, [selectedTemplate, setSelectedTemplate])

  // Sync URL with current state
  useEffect(() => {
    if (showIdeaConfirmation && (siteIdea || selectedTemplate)) {
      const params = new URLSearchParams(window.location.search)
      if (siteIdea) params.set("q", siteIdea)
      if (selectedTemplate) params.set("template", selectedTemplate)

      const newUrl = `/deploy?${params.toString()}`
      if (window.location.search !== `?${params.toString()}`) {
        window.history.replaceState({}, "", newUrl)
      }
    }
  }, [siteIdea, selectedTemplate, showIdeaConfirmation])

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isValid, touchedFields },
    setValue,
  } = useForm<DeploySubdomainForm>({
    resolver: async (data, context, options) => {
      // Only validate if user has interacted with form, otherwise return no errors
      const hasInteracted = Object.keys(touchedFields).length > 0 || data.slug || data.email || data.password

      if (!hasInteracted) {
        return { values: data, errors: {} }
      }

      // Use different schema based on auth state
      const schema = isAuthenticated ? deploySubdomainSchemaLoggedIn : deploySubdomainSchemaAnonymous
      return zodResolver(schema)(data, context, options)
    },
    mode: "onChange",
    defaultValues: {
      slug: "",
      email: user?.email || "",
      siteIdeas: siteIdeasFromUrl,
      password: "",
    },
  })

  // Pre-fill email when user logs in
  useEffect(() => {
    if (user?.email) {
      setValue("email", user.email)
    }
  }, [user?.email, setValue])

  const watchSlug = watch("slug")
  const watchPassword = watch("password")

  const simulateSuccess = () => {
    setDeploymentStatus({
      ok: true,
      domain: `${watchSlug || "test"}.${WILDCARD_DOMAIN}`,
      message: "Site deployed successfully",
    })
  }

  // Elapsed time + domain polling during deployment
  useEffect(() => {
    if (isDeploying && watchSlug) {
      setElapsedTime(0)
      const domain = `${watchSlug}.${WILDCARD_DOMAIN}`

      // Track elapsed time
      const timeInterval = setInterval(() => {
        setElapsedTime(prev => prev + 1)
      }, 1000)

      // Poll domain liveness every second
      const pollInterval = setInterval(async () => {
        try {
          const response = await fetch(`https://${domain}`, {
            method: "GET",
            cache: "no-store",
          })

          if (response.ok) {
            clearInterval(pollInterval)
            clearInterval(timeInterval)
            setDeploymentStatus({
              ok: true,
              domain,
              message: "Site deployed successfully",
            })
            setIsDeploying(false)
          }
        } catch (_error) {
          // Domain not ready yet, continue polling
        }
      }, 1000)

      return () => {
        clearInterval(timeInterval)
        clearInterval(pollInterval)
      }
    }
  }, [isDeploying, watchSlug])

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
          siteIdeas: siteIdea || data.siteIdeas,
          selectedTemplate: selectedTemplate,
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

  // Show idea confirmation page if there's a site idea
  if (showIdeaConfirmation && (siteIdeasFromUrl || siteIdea)) {
    return (
      <motion.div className="w-full" variants={containerVariants} initial="hidden" animate="visible">
        <div className="w-full max-w-4xl mx-auto px-6">
          <motion.div variants={itemVariants} className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">What are you building?</h2>
            <motion.input
              whileFocus="focus"
              variants={fieldVariants}
              type="text"
              value={siteIdea}
              onChange={e => setSiteIdea(e.target.value)}
              placeholder="A portfolio for my photography work..."
              className="w-full px-5 py-4 text-xl rounded-lg border-2 transition-colors outline-none font-medium border-gray-200 bg-gray-50 text-gray-900 hover:border-gray-300 focus:border-blue-500 focus:bg-blue-50"
              autoFocus
            />
          </motion.div>

          <motion.div variants={itemVariants} className="mb-12">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Pick a template</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Basic Website Template */}
              <button
                type="button"
                onClick={() => setSelectedTemplate("landing")}
                className={`group relative overflow-hidden rounded-xl border-2 transition-all text-left ${
                  selectedTemplate === "landing"
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 bg-white hover:border-blue-500"
                }`}
              >
                <div className="aspect-[4/3] overflow-hidden bg-gray-100">
                  <img
                    src="https://dev.terminal.goalive.nl/_images/t/alive.best/o/633011933261ab39/v/orig.webp"
                    alt="Basic landing page template"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-4">
                  <p className="font-bold text-gray-900 text-lg mb-1">Landing Page</p>
                  <p className="text-sm text-gray-600">Simple, clean page to present your idea</p>
                </div>
              </button>

              {/* Recipe Website Template */}
              <button
                type="button"
                disabled
                className="group relative overflow-hidden rounded-xl border-2 transition-all text-left border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed"
              >
                <div className="aspect-[4/3] overflow-hidden bg-gray-100">
                  <img
                    src="https://dev.terminal.goalive.nl/_images/t/alive.best/o/865d2212725460af/v/orig.webp"
                    alt="Recipe website template"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-4">
                  <p className="font-bold text-gray-900 text-lg mb-1">Recipe Site</p>
                  <p className="text-sm text-gray-600">Coming soon</p>
                </div>
              </button>
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="text-center">
            <button
              type="button"
              onClick={() => setShowIdeaConfirmation(false)}
              disabled={!siteIdea.trim()}
              className="px-12 py-4 bg-black text-white text-base font-medium rounded-full hover:bg-black/90 transition-all duration-200 ease-out disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          </motion.div>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div className="w-full" variants={containerVariants} initial="hidden" animate="visible">
      {/* Form container - only constrains form, not success */}
      {!deploymentStatus || !deploymentStatus.ok ? (
        <div className="w-full max-w-md mx-auto">
          {/* Debug button (dev only) */}
          {isDev && (
            <button
              type="button"
              onClick={simulateSuccess}
              className="mb-4 text-xs text-black/30 hover:text-black/50 font-mono"
            >
              [dev] simulate success
            </button>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <motion.div variants={itemVariants}>
              <SlugInput register={register} errors={errors} watchSlug={watchSlug} isDeploying={isDeploying} />
            </motion.div>

            <motion.div variants={itemVariants}>
              <EmailField
                register={register}
                errors={errors}
                isDeploying={isDeploying}
                disabled={isAuthenticated}
                helperText={isAuthenticated ? "Using your account email" : "We'll create your account with this email"}
              />
            </motion.div>

            <input type="hidden" {...register("siteIdeas")} />

            {/* Only show password field if user is NOT logged in */}
            {!isAuthenticated && (
              <motion.div variants={itemVariants}>
                <PasswordField
                  register={register}
                  errors={errors}
                  watchPassword={watchPassword}
                  isDeploying={isDeploying}
                  showPassword={showPassword}
                  onTogglePassword={() => setShowPassword(!showPassword)}
                  helperText="6–16 characters. This will be your account password."
                />
              </motion.div>
            )}

            {/* Info message for logged-in users */}
            {isAuthenticated && (
              <motion.div variants={itemVariants} className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-900 font-medium">
                  ✓ Logged in as <span className="font-bold">{user?.email}</span>
                </p>
                <p className="text-xs text-blue-700 mt-1">This site will be linked to your account automatically.</p>
              </motion.div>
            )}

            <motion.div variants={itemVariants}>
              <SubmitButton
                isDeploying={isDeploying}
                isValid={isValid && !errors.slug && !errors.email && !errors.password}
                label="Launch Site"
                countdown={elapsedTime}
              />
            </motion.div>
          </form>
        </div>
      ) : null}

      {/* Status - full width, no constraints */}
      {deploymentStatus && (
        <div className="mt-8">
          <DeploymentStatus
            status={deploymentStatus.ok ? "success" : "error"}
            domain={deploymentStatus?.domain}
            error={deploymentStatus?.message}
            chatUrl={deploymentStatus?.chatUrl}
          />
        </div>
      )}
    </motion.div>
  )
}
