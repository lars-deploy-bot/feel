import { ReactNode } from 'react'

interface ToolButtonProps {
	onClick: () => void
	isExpanded?: boolean
	hasContent?: boolean
	children: ReactNode
	variant?: 'default' | 'error'
}

export function ToolButton({
	onClick,
	isExpanded = false,
	hasContent = true,
	children,
	variant = 'default',
}: ToolButtonProps) {
	return (
		<button
			onClick={onClick}
			className={`text-sm font-medium normal-case tracking-normal hover:text-black transition-colors ${
				variant === 'error' ? 'text-red-600' : 'text-gray-600'
			}`}
		>
			{children}
			{hasContent && <span className="ml-1 text-gray-500">{isExpanded ? '−' : '+'}</span>}
		</button>
	)
}
