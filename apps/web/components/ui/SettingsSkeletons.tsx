/**
 * Skeleton loaders for settings tabs
 * These show while data is loading, giving perception of speed
 */

export function AccountSettingsSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="animate-pulse">
        <div className="h-4 w-24 bg-black/10 dark:bg-white/10 rounded mb-2" />
        <div className="h-10 bg-black/5 dark:bg-white/5 rounded" />
      </div>

      <div className="animate-pulse pt-4 border-t border-black/10 dark:border-white/10">
        <div className="h-4 w-20 bg-black/10 dark:bg-white/10 rounded mb-3" />
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-black/5 dark:bg-white/5 rounded-lg" />
          ))}
        </div>
      </div>

      <div className="animate-pulse pt-4 border-t border-black/10 dark:border-white/10">
        <div className="h-9 w-32 bg-black/10 dark:bg-white/10 rounded" />
      </div>
    </div>
  )
}

export function WebsitesSettingsSkeleton() {
  return (
    <div className="space-y-5">
      <div className="animate-pulse">
        <div className="h-10 bg-black/5 dark:bg-white/5 rounded-lg mb-4" />
      </div>

      {[1, 2].map(orgIdx => (
        <div key={orgIdx} className="animate-pulse">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-4 w-4 bg-black/10 dark:bg-white/10 rounded" />
            <div className="h-4 w-32 bg-black/10 dark:bg-white/10 rounded" />
            <div className="h-3 w-12 bg-black/5 dark:bg-white/5 rounded" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-12 bg-black/5 dark:bg-white/5 rounded-lg" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function WorkspaceSettingsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="animate-pulse">
        <div className="h-4 w-32 bg-black/10 dark:bg-white/10 rounded mb-3" />
        <div className="h-10 bg-black/5 dark:bg-white/5 rounded mb-4" />

        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center justify-between p-3 bg-black/5 dark:bg-white/5 rounded-lg">
              <div className="h-4 w-32 bg-black/10 dark:bg-white/10 rounded" />
              <div className="h-4 w-12 bg-black/10 dark:bg-white/10 rounded" />
            </div>
          ))}
        </div>
      </div>

      <div className="animate-pulse border-t border-black/10 dark:border-white/10 pt-6">
        <div className="h-4 w-32 bg-black/10 dark:bg-white/10 rounded mb-3" />
        <div className="space-y-2">
          {[1, 2].map(i => (
            <div key={i} className="h-10 bg-black/5 dark:bg-white/5 rounded" />
          ))}
        </div>
      </div>
    </div>
  )
}

export function IntegrationsSettingsSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="animate-pulse p-4 border border-black/10 dark:border-white/10 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 bg-black/10 dark:bg-white/10 rounded" />
            <div className="flex-1">
              <div className="h-4 w-32 bg-black/10 dark:bg-white/10 rounded mb-2" />
              <div className="h-3 w-48 bg-black/5 dark:bg-white/5 rounded" />
            </div>
            <div className="h-8 w-16 bg-black/10 dark:bg-white/10 rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function GeneralSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="animate-pulse">
          <div className="h-4 w-24 bg-black/10 dark:bg-white/10 rounded mb-2" />
          <div className="h-10 bg-black/5 dark:bg-white/5 rounded" />
        </div>
      ))}
    </div>
  )
}
