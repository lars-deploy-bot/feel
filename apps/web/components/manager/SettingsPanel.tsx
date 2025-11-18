"use client"

interface Service {
  service: string
  status: "operational" | "degraded" | "offline"
  message: string
  latency?: number
}

interface SettingsPanelProps {
  serviceStatus: { services: Service[]; timestamp: string } | null
  checkingStatus: boolean
  reloadingCaddy: boolean
  restartingBridge: boolean
  loadingStatus: boolean
  backingUp: boolean
  cleaningTestData: boolean
  testDataStats: any
  onCheckStatus: () => void
  onReloadCaddy: () => void
  onRestartBridge: () => void
  onRefreshDomains: () => void
  onBackupWebsites: () => void
  onCleanupTestData: (preview: boolean) => void
}

export function SettingsPanel({
  serviceStatus,
  checkingStatus,
  reloadingCaddy,
  restartingBridge,
  loadingStatus,
  backingUp,
  cleaningTestData,
  testDataStats,
  onCheckStatus,
  onReloadCaddy,
  onRestartBridge,
  onRefreshDomains,
  onBackupWebsites,
  onCleanupTestData,
}: SettingsPanelProps) {
  return (
    <div className="space-y-6 p-6">
      {/* External Services */}
      <div className="border border-slate-200 rounded-lg">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h3 className="text-sm font-semibold text-slate-900">External Services</h3>
          <p className="text-xs text-slate-600 mt-1">Groq API health for content safety checks</p>
        </div>
        <div className="p-6">
          {!serviceStatus ? (
            <div className="text-sm text-slate-600 text-center py-4">Click refresh to check service status</div>
          ) : (
            <div className="space-y-3">
              {serviceStatus.services.map((service: Service) => (
                <div
                  key={service.service}
                  className="flex items-center justify-between p-3 rounded border border-slate-200"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        service.status === "operational"
                          ? "bg-emerald-500"
                          : service.status === "degraded"
                            ? "bg-amber-500"
                            : "bg-red-500"
                      }`}
                    />
                    <div>
                      <div className="text-sm font-medium text-slate-900">{service.service}</div>
                      <div className="text-xs text-slate-600">{service.message}</div>
                    </div>
                  </div>
                  {service.latency !== undefined && (
                    <div className="text-xs text-slate-600 font-medium">{service.latency}ms</div>
                  )}
                </div>
              ))}
              <div className="text-xs text-slate-500 pt-2 text-center">
                Last checked: {new Date(serviceStatus.timestamp).toLocaleTimeString()}
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={onCheckStatus}
            disabled={checkingStatus}
            className="mt-4 w-full text-xs px-3 py-2 text-indigo-700 bg-indigo-50 border border-indigo-200 rounded hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {checkingStatus ? "Checking..." : "Check status"}
          </button>
        </div>
      </div>

      {/* Caddy */}
      <div className="border border-slate-200 rounded-lg">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h3 className="text-sm font-semibold text-slate-900">Caddy Web Server</h3>
          <p className="text-xs text-slate-600 mt-1">Reload configuration from Caddyfile</p>
        </div>
        <div className="p-6">
          <button
            type="button"
            onClick={onReloadCaddy}
            disabled={reloadingCaddy}
            className="text-xs px-3 py-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {reloadingCaddy ? "Reloading..." : "Reload Caddy"}
          </button>
        </div>
      </div>

      {/* Claude Bridge */}
      <div className="border border-slate-200 rounded-lg">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h3 className="text-sm font-semibold text-slate-900">Claude Bridge</h3>
          <p className="text-xs text-slate-600 mt-1">Restart server (disconnects all active sessions)</p>
        </div>
        <div className="p-6">
          <button
            type="button"
            onClick={onRestartBridge}
            disabled={restartingBridge}
            className="text-xs px-3 py-2 text-amber-700 bg-amber-50 border border-amber-200 rounded hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {restartingBridge ? "Restarting..." : "Restart Bridge"}
          </button>
        </div>
      </div>

      {/* Domain Status */}
      <div className="border border-slate-200 rounded-lg">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h3 className="text-sm font-semibold text-slate-900">Domain Status</h3>
          <p className="text-xs text-slate-600 mt-1">Check HTTP, HTTPS, systemd, Caddy, and file status</p>
        </div>
        <div className="p-6">
          <button
            type="button"
            onClick={onRefreshDomains}
            disabled={loadingStatus}
            className="text-xs px-3 py-2 text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loadingStatus ? "Checking..." : "Refresh all statuses"}
          </button>
        </div>
      </div>

      {/* Backup */}
      <div className="border border-slate-200 rounded-lg">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h3 className="text-sm font-semibold text-slate-900">Backup Websites</h3>
          <p className="text-xs text-slate-600 mt-1">Push changes to GitHub (eenlars/all_websites)</p>
        </div>
        <div className="p-6">
          <button
            type="button"
            onClick={onBackupWebsites}
            disabled={backingUp}
            className="text-xs px-3 py-2 text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {backingUp ? "Backing up..." : "Backup to GitHub"}
          </button>
        </div>
      </div>

      {/* Cleanup Test Data */}
      <div className="border border-red-200 rounded-lg">
        <div className="px-6 py-4 border-b border-red-200 bg-red-50">
          <h3 className="text-sm font-semibold text-red-900">Clean Up Test Data</h3>
          <p className="text-xs text-red-700 mt-1">Delete test users, organizations, and domains</p>
        </div>
        <div className="p-6">
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => onCleanupTestData(true)}
              disabled={cleaningTestData}
              className="text-xs px-3 py-2 text-amber-700 bg-amber-50 border border-amber-200 rounded hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {cleaningTestData ? "Checking..." : "Preview"}
            </button>
            <button
              type="button"
              onClick={() => onCleanupTestData(false)}
              disabled={cleaningTestData}
              className="text-xs px-3 py-2 text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {cleaningTestData ? "Deleting..." : "Delete"}
            </button>
          </div>
          {testDataStats && (
            <div className="p-3 bg-slate-50 rounded border border-slate-200 text-xs">
              <div className="font-medium text-slate-900 mb-2">Cleanup stats:</div>
              <div className="grid grid-cols-2 gap-1 text-slate-700">
                <div>Users deleted: {testDataStats.usersDeleted}</div>
                <div>Organizations deleted: {testDataStats.orgsDeleted}</div>
                <div>Domains deleted: {testDataStats.domainsDeleted}</div>
                <div>Memberships deleted: {testDataStats.membershipsDeleted}</div>
                <div>Invites deleted: {testDataStats.invitesDeleted}</div>
                <div>Sessions deleted: {testDataStats.sessionsDeleted}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
