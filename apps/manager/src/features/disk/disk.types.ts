export interface DiskOverview {
  filesystem: string
  size: string
  used: string
  available: string
  usePercent: string
  mount: string
}

export interface SiteDiskUsage {
  site: string
  size: string
}

export interface DiskData {
  overview: DiskOverview[]
  sites: SiteDiskUsage[]
}
