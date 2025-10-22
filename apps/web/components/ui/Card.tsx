import { forwardRef, HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
	href?: string
	as?: 'div' | 'a'
}

const Card = forwardRef<HTMLDivElement, CardProps>(({ className, href, as = 'div', children, ...props }, ref) => {
	const Component = as === 'a' ? 'a' : 'div'

	return (
		<Component className={cn('card', className)} href={href} ref={ref} {...props}>
			{children}
		</Component>
	)
})

Card.displayName = 'Card'

interface CardContentProps extends HTMLAttributes<HTMLDivElement> {}

const CardContent = forwardRef<HTMLDivElement, CardContentProps>(({ className, ...props }, ref) => {
	return <div className={cn('card-content', className)} ref={ref} {...props} />
})

CardContent.displayName = 'CardContent'

interface CardImageProps extends HTMLAttributes<HTMLDivElement> {
	src?: string
	alt?: string
}

const CardImage = forwardRef<HTMLDivElement, CardImageProps>(({ className, src, alt, ...props }, ref) => {
	return (
		<div className={cn('card-image', className)} ref={ref} {...props}>
			{src && <img src={src} alt={alt || ''} loading="lazy" />}
		</div>
	)
})

CardImage.displayName = 'CardImage'

export { Card, CardContent, CardImage }
