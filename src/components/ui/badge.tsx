import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex h-6 items-center rounded-full px-2.5 text-[11px] font-semibold uppercase tracking-[0.08em]',
  {
    variants: {
      tone: {
        neutral: 'bg-zinc-100 text-zinc-600',
        active: 'bg-emerald-50 text-emerald-800 shadow-[inset_0_0_0_1px_rgba(4,120,87,0.14)]',
        warning: 'bg-amber-50 text-amber-800 shadow-[inset_0_0_0_1px_rgba(180,83,9,0.12)]',
        error: 'bg-rose-50 text-rose-700 shadow-[inset_0_0_0_1px_rgba(190,18,60,0.14)]',
      },
    },
    defaultVariants: {
      tone: 'neutral',
    },
  },
);

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
