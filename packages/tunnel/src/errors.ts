/** Extract a human-readable message from an unknown caught value. */
export function errorMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/** Base class for all tunnel errors — provides code + name boilerplate. */
abstract class TunnelError extends Error {
  abstract readonly code: string
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = this.constructor.name
  }
}

/** Missing or invalid tunnel configuration in server-config.json */
export class TunnelConfigError extends TunnelError {
  readonly code = "TUNNEL_CONFIG" as const
}

/** Cloudflare Tunnel API call failed */
export class TunnelApiError extends TunnelError {
  readonly code = "TUNNEL_API" as const
}

/** DNS record operation failed */
export class TunnelDnsError extends TunnelError {
  readonly code = "TUNNEL_DNS" as const
}

/** Bulk sync operation failed */
export class TunnelSyncError extends TunnelError {
  readonly code = "TUNNEL_SYNC" as const
}
