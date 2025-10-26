"use client"

import { useState } from "react"

export default function TestChecks() {
  const [input, setInput] = useState("")
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const checkInput = async () => {
    if (!input.trim()) return

    setLoading(true)
    setResult(null)

    try {
      const response = await fetch("/api/test-safety", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ input: input.trim() }),
      })

      const data = await response.json()
      setResult(data)
    } catch (error) {
      setResult("Network error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-md p-6">
        <h1 className="text-3xl font-bold text-center text-gray-900 mb-6">Safety Check Tester</h1>

        <div className="space-y-6">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
            <h2 className="text-lg font-semibold text-blue-800 mb-2">🔍 Input Safety Checker</h2>
            <p className="text-blue-700 mb-4">
              Test the Groq-powered safety filter that checks for inappropriate content.
            </p>

            <div className="space-y-4">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Enter text to check for safety..."
                className="w-full p-3 border border-gray-300 rounded-md resize-none"
                rows={3}
              />

              <button
                onClick={checkInput}
                disabled={!input.trim() || loading}
                className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loading ? "Checking..." : "Check Safety"}
              </button>

              {result && (
                <div className="space-y-4">
                  <div
                    className={`p-3 rounded-md border ${
                      result.result === "safe"
                        ? "bg-green-50 border-green-200 text-green-800"
                        : result.result === "unsafe"
                          ? "bg-red-50 border-red-200 text-red-800"
                          : "bg-yellow-50 border-yellow-200 text-yellow-800"
                    }`}
                  >
                    <strong>Result:</strong> {result.result || result}
                  </div>

                  {result.debug && (
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-md">
                      <h3 className="font-semibold text-gray-800 mb-2">🐛 Debug Info:</h3>
                      <div className="text-sm text-gray-700 space-y-1 font-mono">
                        <div>
                          <strong>Groq Status:</strong> {result.debug.groqStatus}
                        </div>
                        <div>
                          <strong>Has GROQ_API_SECRET:</strong> {result.debug.hasGroqSecret ? "Yes" : "No"}
                        </div>
                        {result.debug.groqError && (
                          <div className="text-red-600">
                            <strong>Groq Error:</strong> {result.debug.groqError}
                          </div>
                        )}
                        <div>
                          <strong>Raw Groq Response:</strong> "{result.debug.rawGroqResponse}"
                        </div>
                        <div>
                          <strong>Input:</strong> "{result.debug.input}"
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="p-4 bg-gray-50 border border-gray-200 rounded-md">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">📊 System Status</h2>
            <ul className="text-gray-700 space-y-1">
              <li>• Safety Filter: Currently disabled in main stream</li>
              <li>• This tester uses the same isInputSafe function</li>
              <li>• Requires GROQ_API_SECRET environment variable</li>
            </ul>
          </div>
        </div>

        <div className="mt-6 text-center">
          <a
            href="/chat"
            className="inline-block bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Go to Chat Interface
          </a>
        </div>
      </div>
    </div>
  )
}
