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
		cell_type: 'code' | 'markdown'
		source: string
		outputs?: any[]
		execution_count?: number
	}>
	metadata?: Record<string, any>
}

export function ReadOutput(props: ReadOutputProps) {
	// Text file
	if ('content' in props && 'total_lines' in props) {
		return (
			<div className="space-y-2">
				<div className="text-xs text-black/40 font-thin">
					{props.lines_returned} of {props.total_lines} lines
				</div>
				<div className="text-xs text-black/80 font-diatype-mono leading-relaxed whitespace-pre-wrap bg-black/[0.02] p-3 border border-black/10 max-h-80 overflow-auto">
					{props.content}
				</div>
			</div>
		)
	}

	// Image file
	if ('image' in props && 'file_size' in props) {
		return (
			<div className="space-y-2">
				<div className="text-xs text-black/40 font-thin">image • {Math.round(props.file_size / 1024)}KB</div>
				<img
					src={`data:${props.mime_type};base64,${props.image}`}
					alt="File content"
					className="max-w-full h-auto border border-black/10"
				/>
			</div>
		)
	}

	// PDF file
	if ('pages' in props && 'total_pages' in props) {
		return (
			<div className="space-y-2">
				<div className="text-xs text-black/40 font-thin">pdf • {props.total_pages} pages</div>
				<div className="space-y-4 max-h-80 overflow-auto">
					{props.pages.map((page, index) => (
						<div key={index} className="border border-black/10 p-3">
							<div className="text-xs text-black/40 font-thin mb-2">page {page.page_number}</div>
							{page.text && (
								<div className="text-xs text-black/80 font-thin leading-relaxed whitespace-pre-wrap">{page.text}</div>
							)}
							{page.images?.map((img, imgIndex) => (
								<img
									key={imgIndex}
									src={`data:${img.mime_type};base64,${img.image}`}
									alt={`Page ${page.page_number} image ${imgIndex + 1}`}
									className="max-w-full h-auto mt-2"
								/>
							))}
						</div>
					))}
				</div>
			</div>
		)
	}

	// Notebook file
	if ('cells' in props) {
		return (
			<div className="space-y-2">
				<div className="text-xs text-black/40 font-thin">notebook • {props.cells.length} cells</div>
				<div className="space-y-3 max-h-80 overflow-auto">
					{props.cells.map((cell, index) => (
						<div key={index} className="border border-black/10 p-3">
							<div className="text-xs text-black/40 font-thin mb-2">
								{cell.cell_type} {cell.execution_count && `[${cell.execution_count}]`}
							</div>
							<div className="text-xs text-black/80 font-diatype-mono leading-relaxed whitespace-pre-wrap">
								{cell.source}
							</div>
							{cell.outputs && cell.outputs.length > 0 && (
								<div className="mt-2 pt-2 border-t border-black/5">
									<pre className="text-xs text-black/60 font-diatype-mono">{JSON.stringify(cell.outputs, null, 2)}</pre>
								</div>
							)}
						</div>
					))}
				</div>
			</div>
		)
	}

	return null
}
