'use client';

import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';
type ButtonSize = 'sm' | 'md';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-accent-base text-white shadow-lg shadow-accent-base/15 hover:bg-accent-hover',
  secondary:
    'bg-bg-secondary border border-border-subtle text-text-primary hover:border-accent-base/40 hover:text-accent-hover',
  ghost: 'text-accent-base hover:text-accent-hover',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'px-3 py-2 text-xs rounded-lg',
  md: 'px-4 py-2.5 text-sm rounded-xl',
};

/**
 * Exposes the same visual treatment for non-<button> elements (e.g. an
 * external <a> link that should look like a secondary button) so they don't
 * have to hand-roll a matching class string.
 */
export function buttonClassNames(
  variant: ButtonVariant = 'secondary',
  size: ButtonSize = 'md',
  className = ''
): string {
  return `inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-1.5 font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`;
}

/**
 * Shared button primitive so equivalent actions (secondary buttons, ghost
 * links, etc.) look the same everywhere instead of each component
 * hand-rolling its own Tailwind class string.
 */
export default function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button type={type} className={buttonClassNames(variant, size, className)} {...props}>
      {children}
    </button>
  );
}
