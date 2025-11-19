export interface DeploymentConfig {
  domain: string
  email: string
  password?: string
  orgId?: string
}

export interface DeploymentResult {
  domain: string
  port: number
  serviceName: string
  siteUser: string
  siteDirectory: string
  envFile: string
  success: boolean
}
