'use client'

import type { ReactNode } from 'react'

export type ButtonProps = {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
  icon?: ReactNode
  trailing?: ReactNode
  disabled?: boolean
  type?: 'button' | 'submit'
  title?: string
  'aria-label'?: string
  className?: string
}

const variantClass: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'primary-button',
  ghost: 'ghost-button',
  danger: 'danger-button',
}

export function Button({
  children,
  onClick,
  variant = 'ghost',
  size = 'md',
  icon,
  trailing,
  disabled,
  type = 'button',
  title,
  className,
  ...aria
}: ButtonProps) {
  const classes = [variantClass[variant], size === 'sm' ? 'ui-button-sm' : '', className].filter(Boolean).join(' ')
  return <button
    type={type}
    className={classes}
    onClick={onClick}
    disabled={disabled}
    title={title}
    aria-label={aria['aria-label']}
  >
    {icon}
    {children}
    {trailing}
  </button>
}
