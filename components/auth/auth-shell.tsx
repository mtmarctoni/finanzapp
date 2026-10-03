import { cn } from '@/lib/utils';

/**
 * Full-screen black stage for the auth routes. It sits above the app layout's
 * padding (there is no navigation on these pages) and centres its content.
 */
export function AuthShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-background">
      <div className="flex min-h-full items-center justify-center px-6 pb-[calc(env(safe-area-inset-bottom)+32px)] pt-[calc(env(safe-area-inset-top)+32px)]">
        <div className={cn('w-full max-w-sm', className)}>{children}</div>
      </div>
    </div>
  );
}

/** The app mark: a lime tile with the F. */
export function LogoTile({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid h-16 w-16 place-items-center rounded-[20px] bg-primary text-[30px] font-bold tracking-[-0.06em] text-primary-foreground',
        className,
      )}
    >
      F
    </span>
  );
}

/** Icon tile, title and body for the simple status screens. */
export function AuthMessage({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <span className="grid h-16 w-16 place-items-center rounded-[20px] border border-hairline bg-surface text-subtle [&_svg]:h-7 [&_svg]:w-7">
        {icon}
      </span>
      <h1 className="mt-6 text-[32px] font-bold leading-[1.1] tracking-[-0.045em]">
        {title}
      </h1>
      {children && (
        <div className="mt-3 text-[15px] leading-relaxed text-subtle">
          {children}
        </div>
      )}
    </div>
  );
}
