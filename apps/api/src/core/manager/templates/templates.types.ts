export interface ManagerTemplate {
  template_id: string
  name: string
  description: string | null
  ai_description: string | null
  source_path: string
  preview_url: string | null
  image_url: string | null
  is_active: boolean | null
  deploy_count: number | null
}
