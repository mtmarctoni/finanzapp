import { cn } from '@/lib/utils';

/**
 * Large-title page header, iOS style: one title per screen, an optional
 * eyebrow above it and actions on the right.
 */
export function PageHeader({
  title,
  eyebrow,
  actions,
  className,
}: {
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        'flex min-h-14 items-end justify-between gap-3 pb-4 pt-4 md:pt-8',
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1 text-[13px] font-medium text-subtle first-letter:uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="truncate text-[32px] font-bold leading-[1.1] tracking-[-0.045em]">
          {title}
        </h1>
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </header>
  );
}
