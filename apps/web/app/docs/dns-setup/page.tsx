"use client"

import { useState } from "react"

export default function DNSSetupPage() {
  const [provider, setProvider] = useState("")
  const [showGeneral, setShowGeneral] = useState(false)

  const providers = [
    { id: "cloudflare", name: "Cloudflare" },
    { id: "transip", name: "TransIP" },
    { id: "strato", name: "Strato" },
    { id: "versio", name: "Versio" },
    { id: "one", name: "ONE.com" },
    { id: "godaddy", name: "GoDaddy" },
    { id: "namecheap", name: "Namecheap" },
    { id: "general", name: "Other / I don't know" }
  ]

  const getInstructions = () => {
    switch (provider) {
      case "cloudflare":
        return (
          <div className="space-y-3">
            <p><strong>1.</strong> Log in to Cloudflare dashboard</p>
            <p><strong>2.</strong> Select your domain</p>
            <p><strong>3.</strong> Go to <strong>DNS → Records</strong></p>
            <p><strong>4.</strong> Click <strong>Add record</strong></p>
            <p><strong>5.</strong> Set: Type = <code>A</code>, Name = <code>@</code>, IPv4 = <code>138.201.56.93</code></p>
            <p><strong>6.</strong> Click <strong>Save</strong></p>
          </div>
        )
      case "godaddy":
        return (
          <div className="space-y-3">
            <p><strong>1.</strong> Log in to GoDaddy account</p>
            <p><strong>2.</strong> Go to <strong>My Products → Domains</strong></p>
            <p><strong>3.</strong> Click <strong>DNS</strong> next to your domain</p>
            <p><strong>4.</strong> Find the A record with Name <code>@</code></p>
            <p><strong>5.</strong> Click edit, change Value to <code>138.201.56.93</code></p>
            <p><strong>6.</strong> Click <strong>Save</strong></p>
          </div>
        )
      case "namecheap":
        return (
          <div className="space-y-3">
            <p><strong>1.</strong> Log in to Namecheap account</p>
            <p><strong>2.</strong> Go to <strong>Domain List → Manage</strong></p>
            <p><strong>3.</strong> Click <strong>Advanced DNS</strong></p>
            <p><strong>4.</strong> Find A Record with Host <code>@</code></p>
            <p><strong>5.</strong> Change Value to <code>138.201.56.93</code></p>
            <p><strong>6.</strong> Click save checkmark</p>
          </div>
        )
      case "transip":
        return (
          <div className="space-y-3">
            <p><strong>1.</strong> Log in to TransIP control panel</p>
            <p><strong>2.</strong> Go to <strong>Domains → DNS</strong></p>
            <p><strong>3.</strong> Select your domain</p>
            <p><strong>4.</strong> Find the A record with Name <code>@</code> (or add new)</p>
            <p><strong>5.</strong> Set Value to <code>138.201.56.93</code></p>
            <p><strong>6.</strong> Click <strong>Save</strong></p>
          </div>
        )
      case "strato":
        return (
          <div className="space-y-3">
            <p><strong>1.</strong> Log in to Strato customer center</p>
            <p><strong>2.</strong> Go to <strong>Domains & SSL</strong></p>
            <p><strong>3.</strong> Click <strong>Manage</strong> next to your domain</p>
            <p><strong>4.</strong> Go to <strong>DNS Settings</strong></p>
            <p><strong>5.</strong> Edit A record: Host <code>@</code>, Value <code>138.201.56.93</code></p>
            <p><strong>6.</strong> Click <strong>Save</strong></p>
          </div>
        )
      case "versio":
        return (
          <div className="space-y-3">
            <p><strong>1.</strong> Log in to Versio control panel</p>
            <p><strong>2.</strong> Go to <strong>My Domains</strong></p>
            <p><strong>3.</strong> Click on your domain</p>
            <p><strong>4.</strong> Go to <strong>DNS Records</strong></p>
            <p><strong>5.</strong> Edit A record: Name <code>@</code>, Content <code>138.201.56.93</code></p>
            <p><strong>6.</strong> Click <strong>Update</strong></p>
          </div>
        )
      case "one":
        return (
          <div className="space-y-3">
            <p><strong>1.</strong> Log in to ONE.com control panel</p>
            <p><strong>2.</strong> Go to <strong>DNS</strong> in the sidebar</p>
            <p><strong>3.</strong> Select your domain</p>
            <p><strong>4.</strong> Find A record with Host <code>@</code> (or add new)</p>
            <p><strong>5.</strong> Set Points to: <code>138.201.56.93</code></p>
            <p><strong>6.</strong> Click <strong>Save</strong></p>
          </div>
        )
      case "general":
        return (
          <div className="space-y-3">
            <p><strong>1.</strong> Log in to your domain registrar (where you bought the domain)</p>
            <p><strong>2.</strong> Look for "DNS", "DNS Records", or "Domain Management"</p>
            <p><strong>3.</strong> Find the A record (or add new one)</p>
            <p><strong>4.</strong> Set these values:</p>
            <div className="bg-gray-100 p-3 rounded font-mono text-sm">
              Type: A<br/>
              Name/Host: @ <span className="text-gray-600">(or your domain)</span><br/>
              Value/Points to: 138.201.56.93<br/>
              TTL: 300 <span className="text-gray-600">(or Auto)</span>
            </div>
            <p><strong>5.</strong> Save the changes</p>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-white py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">DNS Setup Guide</h1>

        <div className="space-y-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h2 className="font-semibold text-blue-900 mb-2">What you need to do:</h2>
            <p className="text-blue-800">Point your domain to our server IP: <code className="bg-white px-2 py-1 rounded">138.201.56.93</code></p>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-3">Where did you buy your domain?</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {providers.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setProvider(p.id)}
                  className={`p-3 border rounded-lg text-left hover:bg-gray-50 ${
                    provider === p.id ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {provider && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">
                Instructions for {providers.find(p => p.id === provider)?.name}
              </h3>
              {getInstructions()}
            </div>
          )}

          {provider && (
            <div className="space-y-4">
              <div className="bg-yellow-50 p-4 rounded-lg">
                <h4 className="font-semibold text-yellow-900 mb-2">⏱️ Wait Time</h4>
                <p className="text-yellow-800">Changes take 5-60 minutes to take effect worldwide.</p>
              </div>

              <div className="bg-green-50 p-4 rounded-lg">
                <h4 className="font-semibold text-green-900 mb-2">✅ Test Your Setup</h4>
                <p className="text-green-800 mb-2">Check if it's working:</p>
                <a
                  href="https://dnschecker.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-700 underline hover:text-green-600"
                >
                  dnschecker.org →
                </a>
                <p className="text-green-800 text-sm mt-2">Enter your domain and verify it shows: 138.201.56.93</p>
              </div>
            </div>
          )}

          <div className="text-center pt-4">
            <button
              onClick={() => window.close()}
              className="text-gray-600 hover:text-gray-800 underline"
            >
              ← Back to deployment
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}