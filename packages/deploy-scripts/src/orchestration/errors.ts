export class DeploymentError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "DeploymentError"
  }
}
