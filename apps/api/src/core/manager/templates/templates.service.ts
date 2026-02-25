import { templatesRepo } from "../../../db/repos"
import type { ManagerTemplate } from "./templates.types"

export async function listTemplates(): Promise<ManagerTemplate[]> {
  return templatesRepo.findAll()
}
