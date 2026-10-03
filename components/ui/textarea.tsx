import * as React from 'react';

import { cn } from '@/lib/utils';

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<'textarea'>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        'flex min-h-[80px] w-full rounded-xl border border-hairline bg-surface-2 px-3.5 py-2 text-base ring-offset-background transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-hairline-strong focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = 'Textarea';

export { Textarea };
