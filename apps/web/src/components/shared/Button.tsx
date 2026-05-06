import type { ButtonHTMLAttributes } from 'react'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
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

export function Button({ variant = 'primary', size = 'md', className = '', ...props }: Props) {
  return (
    <button
      {...props}
      className={[
        'rounded-xl font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed',
        variantClass[variant],
        sizeClass[size],
        className,
      ].join(' ')}
    />
  )
}
