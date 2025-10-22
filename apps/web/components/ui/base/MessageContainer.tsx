import { ReactNode } from 'react'

interface MessageContainerProps {
	children: ReactNode
	className?: string
}

export function MessageContainer({ children, className = '' }: MessageContainerProps) {
	return <div className={`py-2 mb-4 ${className}`}>{children}</div>
}
