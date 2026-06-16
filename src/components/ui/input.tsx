import * as React from 'react';

import { cn } from '@/lib/utils';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'min-h-10 w-full rounded-[10px] bg-white px-3 py-2 text-sm text-zinc-900 shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)]',
        'placeholder:text-zinc-400 outline-none transition-[box-shadow,background-color] duration-150 ease-out',
        'focus:shadow-[0_0_0_1px_rgba(5,150,105,0.45),0_0_0_4px_rgba(5,150,105,0.09)]',
        'disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500',
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = 'Input';
