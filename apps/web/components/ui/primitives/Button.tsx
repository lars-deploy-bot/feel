import { type ButtonHTMLAttributes, forwardRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: 'primary' | 'ghost' | 'destructive'
	size?: 'sm' | 'md' | 'lg'
	loading?: boolean
	icon?: ReactNode
	iconPosition?: 'left' | 'right'
	fullWidth?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
	(
		{
			className,
			variant = 'primary',
			size = 'md',
			loading = false,
			icon,
			iconPosition = 'left',
			fullWidth = false,
			disabled,
			children,
			...props
		},
		ref,
	) => {
		const isDisabled = disabled || loading

		return (
			<button
				className={cn(
					// Base styles
					'inline-flex items-center justify-center font-medium uppercase tracking-wide transition-colors',
					'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black',
					'disabled:opacity-50 disabled:cursor-not-allowed',

					// Size variants
					{
						'px-3 py-2 text-xs': size === 'sm',
						'px-4 py-3 text-sm': size === 'md',
						'px-6 py-4 text-base': size === 'lg',
					},

					// Width
					{
						'w-full': fullWidth,
					},

					// Variant styles
					{
						'bg-black text-white hover:bg-gray-800 focus:ring-black': variant === 'primary',
						'bg-transparent text-black border border-black hover:bg-black hover:text-white focus:ring-black':
							variant === 'ghost',
						'bg-red-600 text-white hover:bg-red-700 focus:ring-red-600': variant === 'destructive',
					},

					className,
				)}
				disabled={isDisabled}
				ref={ref}
				{...props}
			>
				{loading && (
					<svg
						className="animate-spin -ml-1 mr-2 h-4 w-4"
						fill="none"
						viewBox="0 0 24 24"
						aria-label="Loading spinner"
						role="img"
					>
						<title aria-label="Loading spinner">Loading spinner</title>
						<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
						<path
							className="opacity-75"
							fill="currentColor"
							d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
						/>
					</svg>
				)}

				{icon && iconPosition === 'left' && !loading && <span className="mr-2">{icon}</span>}

				{children}

				{icon && iconPosition === 'right' && !loading && <span className="ml-2">{icon}</span>}
			</button>
		)
	},
)

Button.displayName = 'Button'

export { Button }
