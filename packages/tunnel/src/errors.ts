/** Missing or invalid tunnel configuration in server-config.json */
export class TunnelConfigError extends Error {
  readonly code = "TUNNEL_CONFIG" as const
  constructor(message: string) {
    super(message)
    this.name = "TunnelConfigError"
  }
}

/** Cloudflare Tunnel API call failed */
export class TunnelApiError extends Error {
  readonly code = "TUNNEL_API" as const
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = "TunnelApiError"
  }
}

/** DNS record operation failed */
export class TunnelDnsError extends Error {
  readonly code = "TUNNEL_DNS" as const
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = "TunnelDnsError"
  }
}

/** Bulk sync operation failed */
export class TunnelSyncError extends Error {
  readonly code = "TUNNEL_SYNC" as const
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = "TunnelSyncError"
  }
}
