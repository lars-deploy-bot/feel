import { BashInput } from './bash/input/BashInput'
import { ReadInput } from './read/input/ReadInput'
import { GrepInput } from './grep/input/GrepInput'
import { GlobInput } from './glob/input/GlobInput'
import { TaskInput } from './task/input/TaskInput'

interface ToolInputRouterProps {
	toolName: string
	input: any
}

export function ToolInputRouter({ toolName, input }: ToolInputRouterProps) {
	const tool = toolName.toLowerCase()

	switch (tool) {
		case 'bash':
			if (input.command) {
				return <BashInput {...input} />
			}
			break

		case 'read':
			if (input.file_path) {
				return <ReadInput {...input} />
			}
			break

		case 'grep':
			if (input.pattern) {
				return <GrepInput {...input} />
			}
			break

		case 'glob':
			if (input.pattern) {
				return <GlobInput {...input} />
			}
			break

		case 'task':
			if (input.description && input.prompt && input.subagent_type) {
				return <TaskInput {...input} />
			}
			break

		// Add other tools as needed
		default:
			// Fallback to JSON for unknown tools
			return (
				<pre className="text-xs text-black/60 font-diatype-mono leading-relaxed overflow-auto max-h-80 p-3 bg-black/[0.02] border border-black/10">
					{typeof input === 'string' ? input : JSON.stringify(input, null, 2)}
				</pre>
			)
	}

	// Fallback if tool is recognized but input doesn't match expected schema
	return (
		<pre className="text-xs text-black/60 font-diatype-mono leading-relaxed overflow-auto max-h-80 p-3 bg-black/[0.02] border border-black/10">
			{typeof input === 'string' ? input : JSON.stringify(input, null, 2)}
		</pre>
	)
}