"use client"

import { useBuilding, useGoal, useGoalActions, useTargetUsers } from "@/lib/stores/goalStore"
import { SettingsTabLayout, type SettingsTabProps } from "./SettingsTabLayout"

export function GoalSettings({ onClose }: SettingsTabProps) {
  const goal = useGoal()
  const building = useBuilding()
  const targetUsers = useTargetUsers()
  const { setGoal, setBuilding, setTargetUsers } = useGoalActions()

  return (
    <SettingsTabLayout
      title="Project Context"
      description="Help the Agent Manager understand your project to give better suggestions"
      onClose={onClose}
    >
      <div className="space-y-4 sm:space-y-5">
        {/* PR Goal */}
        <div className="animate-in fade-in-0 slide-in-from-left-2 duration-300 delay-50">
          <label htmlFor="pr-goal" className="block text-sm font-medium text-black dark:text-white mb-2">
            PR Goal
          </label>
          <p className="text-xs text-black/60 dark:text-white/60 mb-2">
            What should the agent accomplish this session?
          </p>
          <textarea
            id="pr-goal"
            value={goal}
            onChange={e => setGoal(e.target.value)}
            placeholder="e.g., Build a landing page for a plumbing business with hero, services, and contact form"
            rows={3}
            className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-white dark:bg-[#2a2a2a] border border-black/20 dark:border-white/20 rounded text-sm text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-white transition-colors resize-none"
          />
        </div>

        {/* What we're building */}
        <div className="animate-in fade-in-0 slide-in-from-left-2 duration-300 delay-100">
          <label htmlFor="building" className="block text-sm font-medium text-black dark:text-white mb-2">
            What are you building?
          </label>
          <p className="text-xs text-black/60 dark:text-white/60 mb-2">Describe the business/project in one sentence</p>
          <input
            id="building"
            type="text"
            value={building}
            onChange={e => setBuilding(e.target.value)}
            placeholder="e.g., Emergency plumbing service website for Amsterdam"
            className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-white dark:bg-[#2a2a2a] border border-black/20 dark:border-white/20 rounded text-sm text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-white transition-colors"
          />
        </div>

        {/* Target Users */}
        <div className="animate-in fade-in-0 slide-in-from-left-2 duration-300 delay-150">
          <label htmlFor="target-users" className="block text-sm font-medium text-black dark:text-white mb-2">
            Who are the target users?
          </label>
          <p className="text-xs text-black/60 dark:text-white/60 mb-2">Who will visit this site? Be specific.</p>
          <input
            id="target-users"
            type="text"
            value={targetUsers}
            onChange={e => setTargetUsers(e.target.value)}
            placeholder="e.g., Homeowners in Randstad needing urgent plumbing repairs"
            className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-white dark:bg-[#2a2a2a] border border-black/20 dark:border-white/20 rounded text-sm text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-white transition-colors"
          />
        </div>

        {/* Info Box */}
        <div className="p-4 bg-purple-50/50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800/50 animate-in fade-in-0 slide-in-from-bottom-2 duration-300 delay-200">
          <p className="text-xs text-purple-700 dark:text-purple-300 leading-relaxed">
            <strong>Why this matters:</strong> The Agent Manager uses this context to evaluate progress, make
            user-focused suggestions, and keep the project on track. Clear context = better AI guidance.
          </p>
        </div>
      </div>
    </SettingsTabLayout>
  )
}
