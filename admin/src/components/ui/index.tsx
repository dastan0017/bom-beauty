import { ORDER_STATUS_LABELS, type OrderStatus } from '@bom/shared';
import type { ButtonHTMLAttributes, ReactNode, SVGProps } from 'react';
import { copy } from '@/content/copy';
import { cn } from '@/lib/utils';

// Building blocks from design/BomAdmin.dc.html (fixed admin palette, see packages/config/styles/admin.css).

export const inputClass =
  'h-11 w-full rounded-control border border-input bg-surface px-3.5 text-[15px] text-ink outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(20,20,43,.08)]';

type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'danger';

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-ink text-white hover:bg-ink-hover',
  outline: 'border border-input bg-surface text-ink hover:border-input-hover',
  ghost: 'bg-transparent text-muted hover:text-ink',
  danger: 'border border-red-border bg-surface text-red hover:bg-red-hover',
};

export function Button({
  variant = 'primary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        'inline-flex h-11 items-center justify-center gap-2 rounded-control px-[18px] text-[15px] font-semibold whitespace-nowrap transition-colors disabled:cursor-default disabled:opacity-60',
        buttonVariants[variant],
        className,
      )}
    />
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: ReactNode;
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold">{label}</span>
      {children}
      {hint && <span className="text-[13px] leading-normal text-muted">{hint}</span>}
    </label>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('rounded-card border border-line bg-surface', className)}>{children}</div>;
}

export function PageHeader({
  title,
  lead,
  children,
}: {
  title: ReactNode;
  lead?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-[30px] leading-[1.15] font-semibold tracking-[-0.03em]">{title}</h1>
        {lead && <span className="text-[15px] text-muted">{lead}</span>}
      </div>
      {children}
    </div>
  );
}

/** Segmented control (design: periods / oTabs). */
export function Segmented<K extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { key: K; label: string; count?: number }[];
  value: K;
  onChange: (key: K) => void;
  label: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex max-w-full overflow-x-auto rounded-xl border border-line bg-surface p-1"
    >
      {options.map((option) => {
        const active = option.key === value;
        return (
          <button
            key={option.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.key)}
            className={cn(
              'flex h-9 flex-none items-center gap-1.5 rounded-[9px] px-3.5 text-sm font-semibold',
              active ? 'bg-ink text-white' : 'text-muted hover:text-ink',
            )}
          >
            {option.label}
            {option.count !== undefined && <span className="font-normal opacity-75">{option.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

const STATUS_STYLE: Record<OrderStatus, string> = {
  new: 'bg-blue-soft text-blue',
  sent: 'bg-green-soft text-green',
  cancelled: 'bg-red-soft text-red',
};

export function StatusPill({ status }: { status: OrderStatus }) {
  return (
    <span
      className={cn(
        'inline-flex h-7 items-center rounded-full px-2.5 text-[13px] font-semibold',
        STATUS_STYLE[status],
      )}
    >
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}

/** Native select styled as the status pill (design: orderRows → select). */
export function StatusSelect({
  status,
  onChange,
  disabled,
  label,
}: {
  status: OrderStatus;
  onChange: (status: OrderStatus) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <span className="relative inline-flex">
      <select
        aria-label={label}
        value={status}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as OrderStatus)}
        onClick={(event) => event.stopPropagation()}
        className={cn(
          'h-8 cursor-pointer appearance-none rounded-full border-0 pr-[30px] pl-3 text-[13px] font-semibold outline-none disabled:opacity-60',
          STATUS_STYLE[status],
        )}
      >
        {(['new', 'sent', 'cancelled'] as const).map((value) => (
          <option key={value} value={value}>
            {ORDER_STATUS_LABELS[value]}
          </option>
        ))}
      </select>
      <ChevronDownIcon
        className={cn('pointer-events-none absolute top-2.5 right-3', STATUS_STYLE[status].split(' ')[1])}
      />
    </span>
  );
}

export function WhatsAppLink({ phone, className }: { phone: string; className?: string }) {
  return (
    <a
      href={`https://wa.me/${phone.replace(/\D/g, '')}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={copy.writeWhatsApp}
      title={copy.writeWhatsApp}
      onClick={(event) => event.stopPropagation()}
      className={cn(
        'flex size-9 flex-none items-center justify-center rounded-control border border-line text-ink hover:border-[#c5c9da]',
        className,
      )}
    >
      <WhatsAppIcon />
    </a>
  );
}

/** Table header / row grid (design: display:grid with fixed column templates and a min width). */
export function TableHead({ columns, children }: { columns: string; children: ReactNode }) {
  return (
    <div
      role="row"
      style={{ gridTemplateColumns: columns }}
      className="grid min-w-[var(--table-min)] gap-3 border-b border-line-2 bg-table-head px-[22px] py-3 text-[13px] text-muted"
    >
      {children}
    </div>
  );
}

export function TableMessage({ children }: { children: ReactNode }) {
  return <div className="px-[22px] py-12 text-center text-[15px] text-muted">{children}</div>;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent',
        className,
      )}
    />
  );
}

function icon(path: ReactNode, size = 16, strokeWidth = 2.2) {
  return function Icon(props: SVGProps<SVGSVGElement>) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...props}
      >
        {path}
      </svg>
    );
  };
}

export const ExternalIcon = icon(<path d="M7 17L17 7M9 7h8v8" />);
export const ArrowRightIcon = icon(<path d="M5 12h14M13 6l6 6-6 6" />, 14, 2.4);
export const ChevronDownIcon = icon(<path d="M6 9l6 6 6-6" />, 12, 2.6);
export const CloseIcon = icon(<path d="M6 6l12 12M18 6L6 18" />, 18);
export const DownloadIcon = icon(<path d="M12 4v11M7 10l5 5 5-5M5 20h14" />);
export const PhoneIcon = icon(
  <path d="M6.6 3.5h2.6l1.4 4-2 1.3a11 11 0 0 0 6.6 6.6l1.3-2 4 1.4v2.6a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2z" />,
  16,
  2,
);

export function WhatsAppIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2c0 1.3.9 2.5 1 2.7.1.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3z" />
    </svg>
  );
}
