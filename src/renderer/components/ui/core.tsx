/** Core UI kit. Every control is keyboard accessible and themed only through tokens. */
import { forwardRef, useId, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { AlertTriangle, Loader2, type LucideIcon } from 'lucide-react';
import { cn } from '../../lib/util';

/* ---------- Button ---------- */
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg';
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  loading?: boolean;
}
const VARIANT: Record<Variant, string> = {
  primary: 'text-white bg-gradient-to-b from-accent-hi to-accent hover:shadow-glow border border-white/10 shadow-1',
  secondary: 'bg-bg3 text-t1 border border-line-strong hover:bg-bg4',
  outline: 'bg-transparent text-t1 border border-line-strong hover:border-accent hover:text-white',
  ghost: 'bg-transparent text-t2 hover:text-t1 hover:bg-bg3',
  danger: 'bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20',
};
const SIZE: Record<Size, string> = { sm: 'h-8 px-3 text-xs gap-1.5', md: 'h-10 px-4 text-sm gap-2', lg: 'h-12 px-6 text-md gap-2.5' };
const ICON: Record<Size, string> = { sm: 'w-3.5 h-3.5', md: 'w-4 h-4', lg: 'w-5 h-5' };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon: Icon, iconRight: IconR, loading, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center rounded-md font-semibold whitespace-nowrap transition duration-1 ease-out active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none',
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className={cn(ICON[size], 'animate-spin')} /> : Icon ? <Icon className={ICON[size]} strokeWidth={2} /> : null}
      {children}
      {IconR && <IconR className={ICON[size]} />}
    </button>
  );
});

export function IconButton({ icon: Icon, label, className, size = 'md', active, ...rest }: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & { icon: LucideIcon; label: string; size?: 'sm' | 'md'; active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-grid place-items-center rounded-md text-t2 hover:text-t1 hover:bg-bg3 transition duration-1 disabled:opacity-40 disabled:pointer-events-none',
        size === 'sm' ? 'w-7 h-7' : 'w-9 h-9',
        active && 'text-accent-hi bg-accent-soft',
        className,
      )}
      {...rest}
    >
      <Icon className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-[18px] h-[18px]'} strokeWidth={1.75} />
    </button>
  );
}

/* ---------- Inputs ---------- */
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { icon?: LucideIcon; right?: ReactNode; invalid?: boolean }>(function Input(
  { icon: Icon, right, invalid, className, ...rest },
  ref,
) {
  return (
    <div className={cn('relative flex items-center h-10 rounded-md bg-bg1 border border-line-strong focus-within:border-accent transition', invalid && 'border-danger', className)}>
      {Icon && <Icon className="w-4 h-4 text-t3 ml-3 shrink-0" />}
      <input ref={ref} className="flex-1 min-w-0 h-full bg-transparent px-3 text-sm text-t1 placeholder:text-t3 outline-none" {...rest} />
      {right && <div className="pr-2 flex items-center">{right}</div>}
    </div>
  );
});

export function Field({ label, hint, error, children, className }: { label: string; hint?: string; error?: string | null; children: ReactNode; className?: string }) {
  return (
    <label className={cn('flex flex-col gap-1.5', className)}>
      <span className="text-xs font-medium text-t2">{label}</span>
      {children}
      {error ? <span className="text-xs text-danger">{error}</span> : hint ? <span className="text-xs text-t3">{hint}</span> : null}
    </label>
  );
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn('relative w-10 h-6 rounded-full transition duration-2 shrink-0 disabled:opacity-40', checked ? 'bg-accent' : 'bg-bg4 border border-line-strong')}
    >
      <span className={cn('absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-2 ease-out', checked && 'translate-x-4')} />
    </button>
  );
}

export function Slider({ value, min, max, step = 1, onChange, onCommit, format, label, marker }: { value: number; min: number; max: number; step?: number; onChange: (v: number) => void; onCommit?: (v: number) => void; format?: (v: number) => string; label: string; marker?: { value: number; label: string } }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between text-xs">
        <span className="text-t2 font-medium">{label}</span>
        <span className="text-t1 tnum font-semibold">{format ? format(value) : value}</span>
      </div>
      <div className="relative h-5 flex items-center">
        <div className="absolute inset-x-0 h-1.5 rounded-full bg-bg4" />
        <div className="absolute left-0 h-1.5 rounded-full bg-accent" style={{ width: `${pct}%` }} />
        {marker && (
          <div className="absolute -top-0.5 w-0.5 h-6 bg-success/80 rounded" style={{ left: `${((marker.value - min) / (max - min)) * 100}%` }} title={marker.label} />
        )}
        <input
          type="range"
          aria-label={label}
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          onPointerUp={(e) => onCommit?.(Number((e.target as HTMLInputElement).value))}
          onKeyUp={(e) => onCommit?.(Number((e.target as HTMLInputElement).value))}
          className="relative w-full appearance-none bg-transparent cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_0_0_4px_var(--accent-glow)]"
        />
      </div>
      {marker && <div className="text-2xs text-success">{marker.label}</div>}
    </div>
  );
}

/* ---------- Segmented & Tabs ---------- */
export function Segmented<T extends string>({ value, onChange, options, size = 'md' }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; count?: number }[]; size?: 'sm' | 'md' }) {
  return (
    <div role="tablist" className="inline-flex p-1 rounded-md bg-bg1 border border-line gap-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-[7px] font-medium transition duration-1 inline-flex items-center gap-1.5',
            size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-sm',
            value === o.value ? 'bg-bg3 text-t1 shadow-1' : 'text-t3 hover:text-t1',
          )}
        >
          {o.label}
          {o.count !== undefined && <span className="text-2xs text-t3 tnum">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: { value: T; label: string; icon?: LucideIcon; count?: number }[] }) {
  return (
    <div role="tablist" className="flex gap-1 border-b border-line">
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={cn(
            'relative h-10 px-3 text-sm font-medium inline-flex items-center gap-2 transition-colors',
            value === t.value ? 'text-t1' : 'text-t3 hover:text-t1',
          )}
        >
          {t.icon && <t.icon className="w-4 h-4" />}
          {t.label}
          {t.count !== undefined && <span className="text-2xs text-t3 tnum">{t.count}</span>}
          {value === t.value && <span className="absolute left-2 right-2 -bottom-px h-0.5 rounded bg-accent" />}
        </button>
      ))}
    </div>
  );
}

/* ---------- Display ---------- */
export function Chip({ children, tone = 'default', className }: { children: ReactNode; tone?: 'default' | 'accent' | 'success' | 'warning' | 'danger'; className?: string }) {
  const tones = {
    default: 'bg-bg3 text-t2 border-line-strong',
    accent: 'bg-accent-soft text-accent-hi border-accent/30',
    success: 'bg-success/10 text-success border-success/30',
    warning: 'bg-warning/10 text-warning border-warning/30',
    danger: 'bg-danger/10 text-danger border-danger/30',
  };
  return <span className={cn('inline-flex items-center gap-1 h-6 px-2 rounded-md border text-2xs font-semibold tnum whitespace-nowrap', tones[tone], className)}>{children}</span>;
}

export function Card({ className, children, interactive, ...rest }: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div className={cn('surface', interactive && 'transition duration-2 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-2 cursor-pointer', className)} {...rest}>
      {children}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('w-5 h-5 animate-spin text-accent-hi', className)} aria-label="Loading" />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-md', className)} aria-hidden />;
}

export function ProgressBar({ value, className, sheen }: { value: number; className?: string; sheen?: boolean }) {
  return (
    <div className={cn('relative h-1.5 rounded-full bg-bg4 overflow-hidden', className)} role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-accent to-ember transition-[width] duration-3 ease-out" style={{ width: `${Math.max(2, value * 100)}%` }} />
      {sheen && <div className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent" style={{ animation: 'progress-sheen 1.6s linear infinite' }} />}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, body, action }: { icon: LucideIcon; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="w-14 h-14 rounded-xl bg-bg3 border border-line-strong grid place-items-center mb-4">
        <Icon className="w-6 h-6 text-t3" strokeWidth={1.75} />
      </div>
      <div className="text-md font-semibold text-t1">{title}</div>
      {body && <p className="text-sm text-t3 mt-1 max-w-sm">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorCard({ title = 'Something went wrong', error, onRetry }: { title?: string; error: unknown; onRetry?: () => void }) {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    <div className="rounded-lg border border-danger/30 bg-danger/5 p-4 flex gap-3" role="alert">
      <AlertTriangle className="w-5 h-5 text-danger shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-t1">{title}</div>
        <div className="text-sm text-t2 mt-0.5 break-words selectable">{msg}</div>
        <div className="flex gap-2 mt-3">
          {onRetry && <Button size="sm" onClick={onRetry}>Retry</Button>}
          <Button size="sm" variant="ghost" onClick={() => void navigator.clipboard.writeText(msg)}>Copy details</Button>
        </div>
      </div>
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="inline-flex items-center h-5 px-1.5 rounded border border-line-strong bg-bg3 text-2xs text-t2 font-mono">{children}</kbd>;
}

export function Tooltip({ label, children, side = 'right' }: { label: string; children: ReactNode; side?: 'right' | 'bottom' | 'top' }) {
  const [show, setShow] = useState(false);
  const id = useId();
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const pos = { right: 'left-full ml-3 top-1/2 -translate-y-1/2', bottom: 'top-full mt-2 left-1/2 -translate-x-1/2', top: 'bottom-full mb-2 left-1/2 -translate-x-1/2' }[side];
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => (timer.current = setTimeout(() => setShow(true), 200))}
      onMouseLeave={() => {
        clearTimeout(timer.current);
        setShow(false);
      }}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
      aria-describedby={show ? id : undefined}
    >
      {children}
      {show && (
        <span id={id} role="tooltip" className={cn('absolute z-50 whitespace-nowrap rounded-md bg-bg4 border border-line-strong px-2 py-1 text-xs text-t1 shadow-2 pointer-events-none animate-fade', pos)}>
          {label}
        </span>
      )}
    </span>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="label">{children}</h2>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-6 mb-6">
      <div className="min-w-0">
        <h1 className="font-pixel text-xl text-t1 truncate">{title}</h1>
        {subtitle && <p className="text-sm text-t3 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
