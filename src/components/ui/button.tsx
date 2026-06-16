import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  [
    'inline-flex min-h-10 items-center justify-center gap-2 rounded-[10px] px-3.5 py-2 text-sm font-medium',
    'outline-none transition-[background-color,color,box-shadow,scale,transform] duration-150 ease-out active:scale-[0.96]',
    'focus-visible:ring-2 focus-visible:ring-emerald-600/35 disabled:pointer-events-none disabled:opacity-45',
  ],
  {
    variants: {
      variant: {
        primary: 'bg-zinc-950 text-white shadow-[0_1px_2px_rgba(0,0,0,0.18)] hover:bg-zinc-800',
        secondary: 'bg-white text-zinc-900 shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)] hover:bg-zinc-50',
        ghost: 'bg-transparent text-zinc-700 hover:bg-zinc-100',
        danger: 'bg-rose-50 text-rose-700 shadow-[0_0_0_1px_rgba(225,29,72,0.12)] hover:bg-rose-100',
      },
      size: {
        sm: 'min-h-9 px-3 text-xs',
        md: 'min-h-10 px-3.5 text-sm',
        icon: 'size-10 p-0',
      },
    },
    defaultVariants: {
      variant: 'secondary',
      size: 'md',
    },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
  },
);

Button.displayName = 'Button';
