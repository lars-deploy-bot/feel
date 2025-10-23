interface BashOutputProps {
	output: string
	exitCode: number
	killed?: boolean
	shellId?: string
}

export function BashOutput({ output, exitCode, killed, shellId }: BashOutputProps) {
	const getStatusText = () => {
		if (killed) return 'killed (timeout)'
		return exitCode === 0 ? 'completed' : `failed (${exitCode})`
	}

	return (
		<div className="space-y-2">
			<div className="text-xs text-black/40 font-thin">
				{getStatusText()} {shellId && `• shell ${shellId}`}
			</div>
			{output && (
				<div className="text-xs text-black/80 font-diatype-mono leading-relaxed whitespace-pre-wrap bg-black/[0.02] p-3 border border-black/10 max-h-80 overflow-auto">
					{output}
				</div>
			)}
		</div>
	)
}
