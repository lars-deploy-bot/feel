import { ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: 'primary' | 'ghost'
	size?: 'sm' | 'md' | 'lg'
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant = 'primary', size = 'md', ...props }, ref) => {
		return (
			<button
				className={cn(
					'btn',
					{
						'btn-primary': variant === 'primary',
						'btn-ghost': variant === 'ghost',
					},
					className,
				)}
				ref={ref}
				{...props}
			/>
		)
	},
)

Button.displayName = 'Button'

export { Button }
