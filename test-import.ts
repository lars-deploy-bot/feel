import { deploySite, DeploymentError } from "@alive-brug/deploy-scripts"

console.log("✓ Library imports successfully")
console.log("✓ DeploymentError:", DeploymentError.name)
console.log("✓ deploySite type:", typeof deploySite)
console.log("✓ deploySite is function:", deploySite instanceof Function)
console.log("\n✓ All exports are available and working!")
