import { useState } from "react"
import { Dropzone } from "./components/Dropzone"
import { FilePreview } from "./components/FilePreview"
import { FileTree } from "./components/FileTree"
import { Header } from "./components/Header"
import { Message } from "./components/Message"
import { SiteDropdown } from "./components/SiteDropdown"
import { UploadControls } from "./components/UploadControls"

export function App() {
  const [selectedFilePath, setSelectedFilePath] = useState("")

  function handleUploadSuccess() {
    setSelectedFilePath("")
  }

  return (
    <div className="container max-w-[1800px] mx-auto transition-all duration-300">
      <Header />
      <div className="main-content grid-3col">
        <div className="bg-shell-surface p-8 md:p-5 rounded-lg">
          <SiteDropdown />
          <Dropzone />
          <UploadControls onUploadSuccess={handleUploadSuccess} />
          <Message />
        </div>
        <FileTree onFileSelect={setSelectedFilePath} />
        <FilePreview filePath={selectedFilePath} />
      </div>
    </div>
  )
}
