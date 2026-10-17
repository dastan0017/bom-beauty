import { useEffect, type ReactNode } from 'react';
import { Link, useBlocker } from 'react-router';
import { copy } from '@/content/copy';
import { cn } from '@/lib/utils';
import { Button, Spinner } from './index';

export const textareaClass =
  'w-full resize-y rounded-control border border-input bg-surface px-3.5 py-3 text-[15px] leading-normal text-ink outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(20,20,43,.08)]';
export const selectClass =
  'h-11 w-full cursor-pointer rounded-control border border-input bg-surface px-3.5 text-[15px] text-ink outline-none focus:border-ink';

/** On/off switch from the design (44 × 26). */
export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onChange(!checked);
      }}
      className={cn(
        'relative block h-[26px] w-11 flex-none rounded-full transition-colors disabled:opacity-50',
        checked ? 'bg-ink' : 'bg-toggle-off',
      )}
    >
      <span
        className={cn(
          'absolute top-[3px] size-5 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,.2)] transition-[left]',
          checked ? 'left-[21px]' : 'left-[3px]',
        )}
      />
    </button>
  );
}

export function FieldError({ error }: { error: string | undefined }) {
  if (!error) return null;
  return (
    <span role="alert" className="text-[13px] text-red">
      {error}
    </span>
  );
}

/** Message for an API field code. */
export const fieldText = (code: string | undefined): string | undefined =>
  code ? (copy.validation[code] ?? copy.editor.invalid) : undefined;

export function Panel({
  title,
  hint,
  aside,
  children,
  className,
}: {
  title?: ReactNode;
  hint?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'flex flex-col gap-[18px] rounded-card border border-line bg-surface p-5 sm:p-6',
        className,
      )}
    >
      {(title || hint) && (
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            {title && <h2 className="text-lg font-semibold">{title}</h2>}
            {hint && <span className="text-sm leading-[1.45] text-muted">{hint}</span>}
          </div>
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

/** Editor header from the design: breadcrumb, title, status, saved note, Назад and Сохранить. */
export function EditorHeader({
  parent,
  title,
  status,
  saved,
  saving,
  dirty,
  onSave,
  extra,
}: {
  parent?: { to: string; label: string };
  title: string;
  status?: { label: string; on: boolean };
  saved: boolean;
  saving: boolean;
  dirty: boolean;
  onSave: () => void;
  extra?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="flex min-w-0 flex-col gap-1.5">
        {parent && (
          <div className="flex gap-2 text-[15px] text-muted">
            <Link to={parent.to} className="hover:text-ink">
              {parent.label}
            </Link>
            <span>/</span>
            <span className="truncate">{title}</span>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[30px] leading-[1.15] font-semibold tracking-[-0.03em]">{title}</h1>
          {status && (
            <span
              className={cn(
                'rounded-full px-2.5 py-[5px] text-[13px] font-semibold',
                status.on ? 'bg-green-soft text-green' : 'bg-subtle text-muted',
              )}
            >
              {status.label}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        {saved && !dirty && (
          <span className="flex items-center gap-1.5 text-sm font-semibold text-green" role="status">
            <CheckIcon />
            {copy.editor.saved}
          </span>
        )}
        {extra}
        {parent && (
          <Link
            to={parent.to}
            className="inline-flex h-11 items-center rounded-control border border-input bg-surface px-[18px] text-[15px] font-semibold hover:border-input-hover"
          >
            {copy.editor.back}
          </Link>
        )}
        <Button onClick={onSave} disabled={saving} className="px-[22px]">
          {saving && <Spinner />}
          {saving ? copy.editor.saving : copy.editor.save}
        </Button>
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

/** Asks before leaving an editor with unsaved changes (in-app navigation and tab close). */
export function useUnsavedGuard(dirty: boolean): void {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (window.confirm(copy.editor.unsaved)) blocker.proceed();
    else blocker.reset();
  }, [blocker]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
}
