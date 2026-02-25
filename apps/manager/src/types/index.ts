/** Standard API response envelope */
export interface ApiResponse<T> {
  ok: boolean
  data?: T
  error?: string
}

/** Navigation item for sidebar */
export interface NavItem {
  label: string
  path: string
  icon: string
}
