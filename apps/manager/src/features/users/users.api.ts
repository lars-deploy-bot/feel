import type { ManagerUserProfile } from "@webalive/shared"
import type { ClaudeModel } from "@webalive/shared/models"
import { api } from "@/lib/api"
import type { User, UserEvent } from "./users.types"

interface UsersListResponse {
  data: User[]
}

interface UserEventsResponse {
  data: UserEvent[]
}

interface UserProfileResponse {
  data: ManagerUserProfile | null
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
