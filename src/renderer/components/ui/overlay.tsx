/** Modal, dropdown menu, select and toasts. Focus is trapped in modals; Esc closes. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, ChevronDown, Info, TriangleAlert, X, XCircle, type LucideIcon } from 'lucide-react';
import { cn } from '../../lib/util';
import { useToasts } from '../../stores/toasts';
import { IconButton } from './core';

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [open, onClose]);
}

export function Modal({ open, onClose, title, subtitle, children, footer, width = 520 }: { open: boolean; onClose: () => void; title: string; subtitle?: string; children: ReactNode; footer?: ReactNode; width?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEscape(open, onClose);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const first = el?.querySelector<HTMLElement>('input, button:not([aria-label="Close"]), select, textarea, [tabindex]:not([tabindex="-1"])');
    first?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !el) return;
      const items = [...el.querySelectorAll<HTMLElement>('a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((x) => !x.hasAttribute('disabled'));
      if (!items.length) return;
      const [a, b] = [items[0], items[items.length - 1]];
      if (e.shiftKey && document.activeElement === a) {
        e.preventDefault();
        b.focus();
      } else if (!e.shiftKey && document.activeElement === b) {
        e.preventDefault();
        a.focus();
      }
    };
    el?.addEventListener('keydown', trap);
    return () => {
      el?.removeEventListener('keydown', trap);
      prev?.focus?.();
    };
  }, [open]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] grid place-items-center p-6">
      <div className="absolute inset-0 bg-black/60 animate-fade" onClick={onClose} />
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className="relative surface-raised animate-pop max-h-[86vh] flex flex-col" style={{ width }}>
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4">
          <div>
            <h2 className="text-lg font-semibold text-t1">{title}</h2>
            {subtitle && <p className="text-sm text-t3 mt-0.5">{subtitle}</p>}
          </div>
          <IconButton icon={X} label="Close" onClick={onClose} />
        </div>
        <div className="px-6 pb-5 overflow-y-auto">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-line flex justify-end gap-2">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmModal({ open, onClose, onConfirm, title, body, confirmLabel = 'Confirm', danger }: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; body: ReactNode; confirmLabel?: string; danger?: boolean }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width={440}
      footer={
        <>
          <button type="button" className="h-10 px-4 rounded-md text-sm font-semibold text-t2 hover:bg-bg3" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={cn('h-10 px-4 rounded-md text-sm font-semibold text-white', danger ? 'bg-danger hover:brightness-110' : 'bg-accent hover:bg-accent-hi')}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="text-sm text-t2">{body}</div>
    </Modal>
  );
}

export interface MenuItem {
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
  hint?: string;
}

export function Menu({ trigger, items, align = 'right', width = 220 }: { trigger: (p: { open: boolean; toggle: () => void }) => ReactNode; items: (MenuItem | 'sep')[]; align?: 'left' | 'right'; width?: number }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEscape(open, () => setOpen(false));
  useEffect(() => {
    if (!open) return;
    const fn = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener('mousedown', fn);
    return () => window.removeEventListener('mousedown', fn);
  }, [open]);
  return (
    <div ref={ref} className="relative inline-flex">
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div role="menu" className={cn('absolute top-full mt-2 z-50 surface-raised p-1 animate-pop', align === 'right' ? 'right-0' : 'left-0')} style={{ width }}>
          {items.map((it, i) =>
            it === 'sep' ? (
              <div key={i} className="h-px bg-line my-1" />
            ) : (
              <button
                key={it.label}
                type="button"
                role="menuitem"
                disabled={it.disabled}
                onClick={() => {
                  setOpen(false);
                  it.onSelect();
                }}
                className={cn('w-full flex items-center gap-2.5 h-9 px-2.5 rounded-md text-sm text-left disabled:opacity-40', it.danger ? 'text-danger hover:bg-danger/10' : 'text-t1 hover:bg-bg4')}
              >
                {it.icon && <it.icon className="w-4 h-4 shrink-0 opacity-80" />}
                <span className="flex-1 truncate">{it.label}</span>
                {it.hint && <span className="text-2xs text-t3">{it.hint}</span>}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

export function Select<T extends string>({ value, onChange, options, label, className, disabled }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; hint?: string; disabled?: boolean }[]; label: string; className?: string; disabled?: boolean }) {
  return (
    <div className={cn('relative h-10', className)}>
      <select
        aria-label={label}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="appearance-none w-full h-full rounded-md bg-bg1 border border-line-strong pl-3 pr-9 text-sm text-t1 outline-none focus:border-accent disabled:opacity-50"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled} className="bg-bg2">
            {o.label}
            {o.hint ? ` — ${o.hint}` : ''}
          </option>
        ))}
      </select>
      <ChevronDown className="w-4 h-4 text-t3 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  );
}

const TOAST_ICON = { success: CheckCircle2, error: XCircle, info: Info, warn: TriangleAlert } as const;
const TOAST_TONE = { success: 'text-success', error: 'text-danger', info: 'text-info', warn: 'text-warning' } as const;

export function ToastHost() {
  const { toasts, dismiss } = useToasts();
  return (
    <div className="fixed bottom-5 right-5 z-[70] flex flex-col gap-2 w-[360px]" aria-live="polite">
      {toasts.map((t) => {
        const Icon = TOAST_ICON[t.kind];
        return (
          <div key={t.id} className="surface-raised p-3.5 flex gap-3 animate-toast" role={t.kind === 'error' ? 'alert' : 'status'}>
            <Icon className={cn('w-5 h-5 shrink-0 mt-0.5', TOAST_TONE[t.kind])} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-t1">{t.title}</div>
              {t.detail && <div className="text-xs text-t2 mt-0.5 break-words whitespace-pre-line selectable line-clamp-4">{t.detail}</div>}
              {t.action && (
                <button type="button" className="mt-2 text-xs font-semibold text-accent-hi hover:underline" onClick={() => { t.action!.run(); dismiss(t.id); }}>
                  {t.action.label}
                </button>
              )}
            </div>
            <IconButton icon={X} label="Dismiss" size="sm" onClick={() => dismiss(t.id)} />
          </div>
        );
      })}
    </div>
  );
}
