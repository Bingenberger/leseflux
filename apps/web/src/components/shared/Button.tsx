import type { ButtonHTMLAttributes } from 'react'
import { PhosphorIcon } from './PhosphorIcons.tsx'
import type { PhosphorIconName } from './PhosphorIcons.tsx'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  icon?: PhosphorIconName
  iconPosition?: 'left' | 'right'
}

const variantClass = {
  primary: 'bg-primary text-white hover:bg-blue-700 active:bg-blue-800',
  secondary: 'bg-success text-white hover:bg-teal-700 active:bg-teal-800',
  ghost: 'bg-transparent text-primary border border-primary hover:bg-blue-50',
  danger: 'bg-red-600 text-white hover:bg-red-700',
}

const sizeClass = {
  sm: 'px-3 py-2 text-sm min-h-[44px]',
  md: 'px-5 py-3 text-base min-h-[56px]',
  lg: 'px-8 py-4 text-lg min-h-[64px]',
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  icon,
  iconPosition = 'left',
  children,
  ...props
}: Props) {
  return (
    <button
      {...props}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed',
        variantClass[variant],
        sizeClass[size],
        className,
      ].join(' ')}
    >
      {icon && iconPosition === 'left' && <PhosphorIcon name={icon} size={size === 'lg' ? 22 : 18} />}
      <span>{children}</span>
      {icon && iconPosition === 'right' && <PhosphorIcon name={icon} size={size === 'lg' ? 22 : 18} />}
    </button>
  )
}
