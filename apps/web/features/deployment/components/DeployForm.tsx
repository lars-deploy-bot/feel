"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { AnimatePresence, motion } from "framer-motion"
import { Globe, Info, Zap } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { PasswordField } from "@/components/ui/primitives/PasswordField"
import { containerVariants, fieldVariants, itemVariants } from "@/lib/animations"
import { useDeployStore } from "@/lib/stores/deployStore"
import { DeploymentStatus } from "./DeploymentStatus"
import { generateRandomDomain } from "./formUtils"
import { ModeOption } from "./ModeOption"
import { SubdomainDeployForm } from "./SubdomainDeployForm"
import { SubmitButton } from "./SubmitButton"
import { useDeployment } from "./useDeployment"

const deployWithDomainSchema = z.object({
  domain: z
    .string()
    .min(1, "Domain is required")
    .regex(/^([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/, "Invalid domain format"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(16, "Password must be at most 16 characters")
    .regex(/^[a-zA-Z0-9!@#$%^&*()_+=\-[\]{}|;:,.<>?/~`]+$/, "Password must contain valid characters"),
})

const deployOnlySchema = z.object({
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(16, "Password must be at most 16 characters")
    .regex(/^[a-zA-Z0-9!@#$%^&*()_+=\-[\]{}|;:,.<>?/~`]+$/, "Password must contain valid characters"),
})

type DeployWithDomainInput = z.infer<typeof deployWithDomainSchema>
type DeployOnlyInput = z.infer<typeof deployOnlySchema>
type DeploymentMode = "deploy-only" | "deploy-with-domain"

interface ModeSelectionScreenProps {
  onSelect: (mode: DeploymentMode) => void
}

function ModeSelectionScreen({ onSelect }: ModeSelectionScreenProps) {
  return (
    <motion.div
      key="mode-selection"
      initial="hidden"
      animate="visible"
      exit="hidden"
      variants={containerVariants}
      className="w-full max-w-lg mx-auto"
    >
      <motion.div variants={itemVariants} className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 mb-4">Launch your site</h1>
        <p className="text-lg text-gray-600 font-medium">Pick one to start:</p>
      </motion.div>

      <motion.div variants={itemVariants} className="space-y-3">
        <ModeOption
          icon={Zap}
          title="Quick Launch"
          description="Get a free live website and 200 free credits, on us."
          time="~1 min"
          badge="Start here"
          onClick={() => onSelect("deploy-only")}
        />
        <ModeOption icon={Globe} title="Custom Domain" description="Coming soon" time="" disabled onClick={() => {}} />
      </motion.div>
    </motion.div>
  )
}

export function DeployForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [showPassword, setShowPassword] = useState<boolean>(false)
  const [isClient, setIsClient] = useState<boolean>(false)
  const [deploymentMode, setDeploymentModeState] = useState<"choose" | DeploymentMode>("choose")

  // Stores and hooks
  const { domain, password, setDomain, setPassword, resetForm, setDeploymentStatus, deploymentStatus } =
    useDeployStore()
  const { deploy, isDeploying, deploymentDomain, deploymentErrors } = useDeployment()

  // Sync mode with URL
  const setDeploymentMode = (mode: "choose" | DeploymentMode) => {
    setDeploymentModeState(mode)
    const siteIdeas = searchParams.get("q")

    if (mode === "choose") {
      const url = siteIdeas ? `/deploy?q=${encodeURIComponent(siteIdeas)}` : "/deploy"
      router.replace(url)
    } else {
      const url = siteIdeas ? `/deploy?mode=${mode}&q=${encodeURIComponent(siteIdeas)}` : `/deploy?mode=${mode}`
      router.replace(url)
    }
  }

  // Initialize client state
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Sync deployment mode with URL params (handles back/forward navigation)
  useEffect(() => {
    const isValidMode = (mode: string | null): mode is DeploymentMode => {
      return mode === "deploy-only" || mode === "deploy-with-domain"
    }

    const modeParam = searchParams.get("mode")
    if (isValidMode(modeParam)) {
      setDeploymentModeState(modeParam)
    } else {
      setDeploymentModeState("choose")
    }
  }, [searchParams])

  // Deploy with domain form
  const deployWithDomainForm = useForm<DeployWithDomainInput>({
    resolver: zodResolver(deployWithDomainSchema),
    mode: "onBlur",
    defaultValues: {
      domain,
      password,
    },
  })

  // Deploy only form
  const deployOnlyForm = useForm<DeployOnlyInput>({
    resolver: zodResolver(deployOnlySchema),
    mode: "onBlur",
    defaultValues: {
      password,
    },
  })

  const watchDomain = deployWithDomainForm.watch("domain")
  const watchPassword =
    deploymentMode === "deploy-with-domain" ? deployWithDomainForm.watch("password") : deployOnlyForm.watch("password")

  useEffect(() => {
    if (deploymentMode === "deploy-with-domain") {
      setDomain(watchDomain)
    }
  }, [watchDomain, deploymentMode, setDomain])

  useEffect(() => {
    setPassword(watchPassword)
  }, [watchPassword, setPassword])

  useEffect(() => {
    setIsClient(true)
  }, [])

  const onSubmitWithDomain = async (data: DeployWithDomainInput): Promise<void> => {
    await deploy(data.domain, data.password)
  }

  const _onSubmitDeployOnly = async (data: DeployOnlyInput): Promise<void> => {
    const randomDomain = generateRandomDomain()
    await deploy(randomDomain, data.password)
  }

  if (!isClient) {
    return null
  }

  const _isWithDomain = deploymentMode === "deploy-with-domain"

  return (
    <AnimatePresence mode="wait">
      {deploymentMode === "choose" ? (
        <ModeSelectionScreen key="mode-selection" onSelect={setDeploymentMode} />
      ) : deploymentMode === "deploy-only" ? (
        <SubdomainDeployForm key="subdomain-form" />
      ) : (
        <motion.div
          key="form"
          initial="hidden"
          animate="visible"
          exit="hidden"
          variants={containerVariants}
          className="w-full max-w-md mx-auto"
        >
          {/* Header */}
          <motion.div variants={itemVariants} className="text-center mb-12">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setDeploymentStatus("idle")
                deployWithDomainForm.reset()
                deployOnlyForm.reset()
                resetForm()
                setDeploymentMode("choose")
              }}
              className="text-gray-400 hover:text-gray-600 text-xs font-medium mb-6 inline-block transition-colors uppercase tracking-wide"
            >
              ← Back to options
            </motion.button>
            <div>
              <h1 className="text-5xl font-normal tracking-tight text-gray-900 mb-3">Custom domain</h1>
              <p className="text-lg text-gray-500 font-normal max-w-md mx-auto leading-relaxed">
                Point your DNS to our server and launch immediately
              </p>
            </div>
          </motion.div>

          {/* DNS Info Banner */}
          <motion.div variants={itemVariants} className="mb-6 p-4 rounded-lg bg-blue-50 border border-blue-200">
            <div className="flex gap-3">
              <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-blue-900 text-sm mb-1">Quick DNS setup</h3>
                <p className="text-blue-800 text-xs mb-2">
                  We'll guide you through pointing your domain to us. Just takes a minute.
                </p>
                <a
                  href="/docs/dns-setup"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700 font-medium text-xs underline"
                >
                  Show me how →
                </a>
              </div>
            </div>
          </motion.div>

          {/* Form Card */}
          <motion.div
            variants={itemVariants}
            className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
          >
            <form onSubmit={deployWithDomainForm.handleSubmit(onSubmitWithDomain)} className="p-8 space-y-5">
              {/* Domain Field */}
              <motion.div variants={fieldVariants}>
                <label htmlFor="domain" className="block text-sm font-semibold text-gray-900 mb-2">
                  Your domain
                </label>
                <p className="text-xs text-gray-500 mb-3">e.g., mysite.com or app.example.com</p>
                <div className="relative">
                  <motion.input
                    whileFocus="focus"
                    variants={fieldVariants}
                    {...deployWithDomainForm.register("domain")}
                    disabled={isDeploying}
                    type="text"
                    autoComplete="off"
                    data-1p-ignore
                    data-lpignore
                    placeholder="mysite.com"
                    className={`w-full px-4 py-3 rounded-lg border-2 transition-colors outline-none font-medium ${
                      deployWithDomainForm.formState.errors.domain
                        ? "border-red-300 bg-red-50 text-gray-900"
                        : "border-gray-200 bg-gray-50 text-gray-900 hover:border-gray-300 focus:border-blue-500 focus:bg-blue-50"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  />
                </div>
                {deployWithDomainForm.formState.errors.domain && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-1.5 text-red-600 text-xs font-medium"
                  >
                    {deployWithDomainForm.formState.errors.domain.message}
                  </motion.p>
                )}
              </motion.div>

              {/* Password Field */}
              <PasswordField
                register={deployWithDomainForm.register}
                errors={deployWithDomainForm.formState.errors}
                watchPassword={watchPassword}
                isDeploying={isDeploying}
                showPassword={showPassword}
                onTogglePassword={() => setShowPassword(!showPassword)}
              />

              {/* Submit Button */}
              <motion.div variants={fieldVariants} className="pt-3">
                <SubmitButton
                  isDeploying={isDeploying}
                  isValid={deployWithDomainForm.formState.isValid}
                  label="Launch Site"
                />
              </motion.div>
            </form>
          </motion.div>

          {/* Status Messages */}
          {deploymentStatus !== "idle" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
              <DeploymentStatus
                status={deploymentStatus === "success" ? "success" : deploymentStatus === "error" ? "error" : "loading"}
                domain={deploymentDomain}
                error={deploymentErrors[0] ?? null}
                errorDetails={deploymentErrors}
              />
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
