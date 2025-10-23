interface StartMessageProps {
	data: {
		host: string
		cwd: string
		message: string
		messageLength: number
	}
	timestamp: string
}

export function StartMessage({ data, timestamp }: StartMessageProps) {
	return (
		<div className="py-2 mb-4 text-sm text-gray-600">
			<div className="mb-1 normal-case tracking-normal underline">Session Initialized</div>
			<div className="text-xs text-gray-400 normal-case tracking-normal">
				<span>Directory:</span>
				<span className="ml-1">{data.cwd}</span>
			</div>
		</div>
	)
}
