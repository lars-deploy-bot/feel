"use client"

import { useState } from "react"

interface DeployResponse {
  success: boolean
  message: string
  domain?: string
  port?: number
  errors?: string[]
}

export default function DeployPage() {
  const [domain, setDomain] = useState("")
  const [port, setPort] = useState("")
  const [isDeploying, setIsDeploying] = useState(false)
  const [result, setResult] = useState<DeployResponse | null>(null)

  const handleDeploy = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!domain) {
      setResult({
        success: false,
        message: "Domain is required",
      })
      return
    }

    setIsDeploying(true)
    setResult(null)

    try {
      const response = await fetch("/api/deploy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          domain,
          port: port ? parseInt(port) : undefined,
        }),
      })

      // Get response text first
      const responseText = await response.text()

      // Check if response is JSON
      const contentType = response.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error(`Server returned non-JSON response (${response.status}): ${responseText.substring(0, 200)}`)
      }

      // Parse JSON
      let data: DeployResponse
      try {
        data = JSON.parse(responseText)
      } catch (jsonError) {
        throw new Error(`Invalid JSON response: ${responseText.substring(0, 200)}`)
      }

      setResult(data)
    } catch (error) {
      setResult({
        success: false,
        message: "Failed to connect to deployment API",
        errors: [error instanceof Error ? error.message : "Unknown error"],
      })
    } finally {
      setIsDeploying(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Deploy Website</h1>
        </div>

        <div className="bg-white py-8 px-6 shadow rounded-lg">
          <form onSubmit={handleDeploy} className="space-y-6">
            <div>
              <label htmlFor="domain" className="block text-sm font-medium text-gray-700">
                Domain
              </label>
              <input
                type="text"
                id="domain"
                value={domain}
                onChange={e => setDomain(e.target.value)}
                placeholder="example.com"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                disabled={isDeploying}
              />
            </div>

            <div>
              <label htmlFor="port" className="block text-sm font-medium text-gray-700">
                Port (optional)
              </label>
              <input
                type="number"
                id="port"
                value={port}
                onChange={e => setPort(e.target.value)}
                placeholder="Auto-detect"
                min="1024"
                max="65535"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                disabled={isDeploying}
              />
              <p className="mt-1 text-sm text-gray-500">Leave empty to auto-detect available port</p>
            </div>

            <button
              type="submit"
              disabled={isDeploying}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeploying ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Deploying...
                </>
              ) : (
                "Deploy Site"
              )}
            </button>
          </form>

          {result && (
            <div
              className={`mt-6 p-4 rounded-md ${
                result.success ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"
              }`}
            >
              <div className="flex">
                <div className="flex-shrink-0">
                  {result.success ? (
                    <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
                <div className="ml-3">
                  <h3 className={`text-sm font-medium ${result.success ? "text-green-800" : "text-red-800"}`}>
                    {result.success ? "Success!" : "Error"}
                  </h3>
                  <div className={`mt-2 text-sm ${result.success ? "text-green-700" : "text-red-700"}`}>
                    <p>{result.message}</p>
                    {result.success && result.domain && result.port && (
                      <div className="mt-2">
                        <p>
                          <strong>Domain:</strong> {result.domain}
                        </p>
                        <p>
                          <strong>Port:</strong> {result.port}
                        </p>
                        <p className="mt-2">
                          <a
                            href={`https://${result.domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium underline"
                          >
                            Visit your site →
                          </a>
                        </p>
                      </div>
                    )}
                    {result.errors && result.errors.length > 0 && (
                      <div className="mt-2">
                        <details>
                          <summary className="cursor-pointer font-medium">Error Details</summary>
                          <pre className="mt-2 text-xs bg-red-100 p-3 rounded border max-w-full overflow-auto max-h-40 whitespace-pre-wrap break-words">
                            {result.errors.join("\n")}
                          </pre>
                        </details>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
