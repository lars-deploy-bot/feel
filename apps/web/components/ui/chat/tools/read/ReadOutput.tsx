type ReadOutputProps = TextFileOutputProps | ImageFileOutputProps | PDFFileOutputProps | NotebookFileOutputProps

interface TextFileOutputProps {
  content: string
  total_lines: number
  lines_returned: number
}

interface ImageFileOutputProps {
  image: string
  mime_type: string
  file_size: number
}

interface PDFFileOutputProps {
  pages: Array<{
    page_number: number
    text?: string
    images?: Array<{
      image: string
      mime_type: string
    }>
  }>
  total_pages: number
}

interface NotebookFileOutputProps {
  cells: Array<{
    cell_type: "code" | "markdown"
    source: string
    outputs?: any[]
    execution_count?: number
  }>
  metadata?: Record<string, any>
}

export function ReadOutput(props: ReadOutputProps) {
  // Text file
  if ("content" in props && "total_lines" in props) {
    return (
      <div className="text-xs text-black/40 dark:text-white/40 font-normal">
        {props.lines_returned} of {props.total_lines} lines
      </div>
    )
  }

  // Image file
  if ("image" in props && "file_size" in props) {
    return (
      <div className="text-xs text-black/40 dark:text-white/40 font-normal">
        image • {Math.round(props.file_size / 1024)}KB
      </div>
    )
  }

  // PDF file
  if ("pages" in props && "total_pages" in props) {
    return <div className="text-xs text-black/40 dark:text-white/40 font-normal">pdf • {props.total_pages} pages</div>
  }

  // Notebook file
  if ("cells" in props) {
    return (
      <div className="text-xs text-black/40 dark:text-white/40 font-normal">notebook • {props.cells.length} cells</div>
    )
  }

  return null
}
