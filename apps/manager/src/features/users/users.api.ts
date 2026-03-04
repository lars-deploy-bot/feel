import type { ClaudeModel } from "@webalive/shared/models"
import { api } from "@/lib/api"
import type { User, UserEvent } from "./users.types"

interface UsersListResponse {
  data: User[]
}

interface UserEventsResponse {
  data: UserEvent[]
}

export interface UserDevice {
  browser: string | null
  browser_version: string | null
  os: string | null
  os_version: string | null
  device_type: string | null
  screen: string | null
  last_seen: string
}

export interface UserLocation {
  city: string | null
  country: string | null
  region: string | null
  timezone: string | null
  last_seen: string
}

export interface UserProfile {
  devices: UserDevice[]
  locations: UserLocation[]
  referrer: string | null
  initial_referrer: string | null
}

interface UserProfileResponse {
  data: UserProfile | null
}

export interface PasswordResetToken {
  token: string
  expires_at: string
}

interface PasswordResetTokenResponse {
  data: PasswordResetToken
}

export const usersApi = {
  list: () => api.get<UsersListResponse>("/manager/users").then(r => r.data),
  profile: (userId: string) => api.get<UserProfileResponse>(`/manager/users/${userId}/profile`).then(r => r.data),
  events: (userId: string, limit = 50) =>
    api.get<UserEventsResponse>(`/manager/users/${userId}/events?limit=${limit}`).then(r => r.data),
  updateModels: (userId: string, enabledModels: ClaudeModel[]) =>
    api.patch(`/manager/users/${userId}/models`, { enabled_models: enabledModels }),
  issuePasswordResetToken: async (userId: string) => {
    const response = await api.post<PasswordResetTokenResponse>(`/manager/users/${userId}/password-reset-token`)
    return response.data
  },
}
