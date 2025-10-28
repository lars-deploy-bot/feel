const Index = () => {
  const currentDomain = window.location.hostname
  const terminalUrl = `https://terminal.goalive.nl?domain=${currentDomain}`

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center max-w-2xl mx-auto px-6">
        <h1 className="text-5xl font-bold text-gray-900 mb-6">
          This is your website now
        </h1>

        <p className="text-xl text-gray-600 mb-12">
          Start building immediately at <a href={terminalUrl} className="text-blue-600 underline">this link</a>
        </p>

        <div className="space-y-4">
          <a
            href={terminalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded transition-colors"
          >
            Edit Your Website
          </a>

          <div className="text-sm text-gray-500">
            {currentDomain}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Index
