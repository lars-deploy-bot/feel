import { createConnection } from "net"

/**
 * Delay for a given number of milliseconds
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Check if a port is listening
 */
export async function isPortListening(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host: "localhost" })
    socket.setTimeout(100)

    socket.once("connect", () => {
      socket.destroy()
      resolve(true)
    })

    socket.once("error", () => {
      socket.destroy()
      resolve(false)
    })

    socket.once("timeout", () => {
      socket.destroy()
      resolve(false)
    })
  })
}
