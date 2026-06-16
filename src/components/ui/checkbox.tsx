import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { CheckIcon } from '@radix-ui/react-icons';

import { cn } from '@/lib/utils';

export const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      'relative flex size-5 shrink-0 items-center justify-center rounded-[6px] bg-white text-white outline-none',
      'shadow-[0_0_0_1px_rgba(0,0,0,0.16),0_1px_2px_rgba(0,0,0,0.06)] transition-[background-color,box-shadow,scale] duration-150 ease-out',
      'after:absolute after:left-1/2 after:top-1/2 after:size-10 after:-translate-x-1/2 after:-translate-y-1/2',
      'focus-visible:ring-2 focus-visible:ring-emerald-600/35 active:scale-[0.96] data-[state=checked]:bg-emerald-700 data-[state=checked]:shadow-[0_0_0_1px_rgba(4,120,87,0.6)]',
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="flex items-center justify-center">
      <CheckIcon className="size-4" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));

Checkbox.displayName = CheckboxPrimitive.Root.displayName;
