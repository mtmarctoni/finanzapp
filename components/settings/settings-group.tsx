import { cn } from '@/lib/utils';

/**
 * iOS-style inset group: a sentence-case heading, a card of rows divided by
 * hairlines, and an optional footnote under it.
 */
export function SettingsGroup({
  title,
  action,
  footer,
  className,
  children,
}: {
  title?: React.ReactNode;
  action?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn('space-y-2', className)}>
      {(title ?? action) && (
        <div className="flex min-h-8 items-end justify-between gap-3 px-4">
          {title && (
            <h2 className="text-[13px] font-semibold text-subtle">{title}</h2>
          )}
          {action}
        </div>
      )}
      <div className="divide-y divide-hairline overflow-hidden rounded-[20px] border border-hairline bg-surface">
        {children}
      </div>
      {footer && (
        <p className="px-4 text-[12px] leading-relaxed text-faint">{footer}</p>
      )}
    </section>
  );
}

/** One row in a SettingsGroup. The group draws the hairlines between rows. */
export function SettingsRow({
  icon,
  label,
  detail,
  trailing,
  className,
  children,
}: {
  icon?: React.ReactNode;
  label?: React.ReactNode;
  detail?: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn('flex min-h-14 items-center gap-3 px-4 py-2.5', className)}
    >
      {icon}
      {children ?? (
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-medium">{label}</div>
          {detail && (
            <div className="truncate text-[13px] text-subtle">{detail}</div>
          )}
        </div>
      )}
      {trailing}
    </div>
  );
}

/** Small tinted square that leads a settings row. */
export function SettingsIcon({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-surface-3 text-subtle [&_svg]:h-4 [&_svg]:w-4',
        className,
      )}
    >
      {children}
    </span>
  );
}
