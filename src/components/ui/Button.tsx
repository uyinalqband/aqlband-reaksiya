import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { motion } from 'framer-motion';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'lg' | 'md' | 'sm';

type NativeButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children' | 'onAnimationStart' | 'onAnimationEnd' | 'onDrag' | 'onDragStart' | 'onDragEnd'
>;

interface ButtonProps extends NativeButtonProps {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  children: ReactNode;
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-gradient-to-b from-violet-500 to-violet-600 text-mist-100 shadow-glow border border-violet-400/30',
  secondary: 'bg-ink-700 text-mist-100 border border-ink-600',
  ghost: 'bg-transparent text-mist-300 border border-transparent hover:border-ink-600',
};

const sizeClasses: Record<Size, string> = {
  lg: 'h-14 px-7 text-base rounded-2xl',
  md: 'h-12 px-5 text-sm rounded-xl',
  sm: 'h-9 px-3.5 text-xs rounded-lg',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'lg', icon, children, className = '', ...rest }, ref) => {
    return (
      <motion.button
        ref={ref}
        whileTap={{ scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className={`inline-flex items-center justify-center gap-2 font-display font-semibold tracking-tight
          transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none
          active:brightness-95 select-none
          ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        {...rest}
      >
        {icon}
        {children}
      </motion.button>
    );
  },
);

Button.displayName = 'Button';
