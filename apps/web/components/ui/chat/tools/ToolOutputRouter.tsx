import { BashOutput } from "@/components/ui/chat/tools/bash/BashOutput"
import { EditOutput } from "@/components/ui/chat/tools/edit/EditOutput"
import { GlobOutput } from "@/components/ui/chat/tools/glob/GlobOutput"
import { GrepOutput } from "@/components/ui/chat/tools/grep/GrepOutput"
import { ReadOutput } from "@/components/ui/chat/tools/read/ReadOutput"
import { TaskOutput } from "@/components/ui/chat/tools/task/TaskOutput"
import { WriteOutput } from "@/components/ui/chat/tools/write/WriteOutput"

interface ToolOutputRouterProps {
  toolName: string
  // Tool output is dynamic JSON - SDK doesn't provide output types
  // Runtime structural validation ensures type safety
  content: any
}

export function ToolOutputRouter({ toolName, content }: ToolOutputRouterProps) {
  const tool = toolName.toLowerCase()

  switch (tool) {
    case "bash":
      if (content.output !== undefined && content.exitCode !== undefined) {
        return <BashOutput {...content} />
      }
      break

    case "read":
      // TextFileOutput
      if (content.total_lines !== undefined && content.content) {
        return <ReadOutput {...content} />
      }
      // ImageFileOutput
      if (content.image && content.file_size !== undefined) {
        return <ReadOutput {...content} />
      }
      // PDFFileOutput
      if (content.pages && content.total_pages !== undefined) {
        return <ReadOutput {...content} />
      }
      // NotebookFileOutput
      if (content.cells) {
        return <ReadOutput {...content} />
      }
      break

    case "edit":
      if (content.replacements !== undefined) {
        return <EditOutput {...content} />
      }
      break

    case "write":
      if (content.bytes_written !== undefined) {
        return <WriteOutput {...content} />
      }
      break

    case "grep":
      // GrepFilesOutput
      if (content.files && content.count !== undefined) {
        return <GrepOutput {...content} />
      }
      // GrepContentOutput
      if (content.matches && content.total_matches !== undefined) {
        return <GrepOutput {...content} />
      }
      // GrepCountOutput
      if (content.counts && content.total !== undefined) {
        return <GrepOutput {...content} />
      }
      break

    case "glob":
      if (content.matches && content.count !== undefined) {
        return <GlobOutput {...content} />
      }
      break

    case "task":
      if (content.result) {
        return <TaskOutput {...content} />
      }
      break

    // Add other tools as needed
    default:
      // Fallback to JSON for unknown tools
      return (
        <pre className="text-xs text-black/60 dark:text-white/60 font-diatype-mono leading-relaxed overflow-auto max-h-80 p-3 bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10">
          {typeof content === "string" ? content : JSON.stringify(content, null, 2)}
        </pre>
      )
  }

  // Fallback if tool is recognized but content doesn't match expected schema
  return (
    <pre className="text-xs text-black/60 dark:text-white/60 font-diatype-mono leading-relaxed overflow-auto max-h-80 p-3 bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10">
      {typeof content === "string" ? content : JSON.stringify(content, null, 2)}
    </pre>
  )
}
