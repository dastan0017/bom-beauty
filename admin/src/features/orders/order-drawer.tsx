import {
  formatKgs,
  formatPhoneDisplay,
  ORDER_ITEM_TYPE_LABELS,
  ORDER_STATUS_LABELS,
  relativeDateTime,
  type OrderDetail,
} from '@bom/shared';
import { AlertDialog, Dialog } from 'radix-ui';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Button, CloseIcon, PhoneIcon, Spinner, StatusSelect, WhatsAppLink } from '@/components/ui';
import { copy } from '@/content/copy';
import { useUser } from '@/features/auth/auth';
import { errorText } from '@/lib/format';
import { useDeleteOrder, useOrder, useUpdateOrder } from '@/api/orders';

/** Order details (gap: the design has no detail view; the brief asks for one with a note). */
export function OrderDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const order = useOrder(id);
  return (
    <Dialog.Root open={id !== null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[rgba(20,20,43,.32)] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[520px] flex-col bg-surface shadow-[-24px_0_60px_rgba(20,20,43,.18)] outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-right"
        >
          {order.data ? (
            <OrderBody key={order.data.id} order={order.data} onClose={onClose} />
          ) : (
            <div className="flex flex-1 flex-col">
              <div className="flex items-center justify-between border-b border-line-2 px-6 py-4">
                <Dialog.Title className="text-xl font-semibold">{copy.loading}</Dialog.Title>
                <CloseButton />
              </div>
              <div className="flex flex-1 items-center justify-center text-[15px] text-muted">
                {order.isError ? copy.errors.load : <Spinner />}
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function CloseButton() {
  return (
    <Dialog.Close
      aria-label={copy.order.close}
      className="flex size-10 items-center justify-center rounded-full bg-subtle text-ink"
    >
      <CloseIcon />
    </Dialog.Close>
  );
}

function OrderBody({ order, onClose }: { order: OrderDetail; onClose: () => void }) {
  const user = useUser();
  const update = useUpdateOrder();
  const remove = useDeleteOrder();
  const [note, setNote] = useState(order.note);
  const created = new Date(order.createdAt);

  const save = (change: Parameters<typeof update.mutate>[0]['change'], success: string) =>
    update.mutate(
      { id: order.id, change },
      { onSuccess: () => toast.success(success), onError: (error) => toast.error(errorText(error)) },
    );

  const source = [order.utm?.source, order.utm?.medium, order.utm?.campaign].filter(Boolean).join(' / ');

  return (
    <>
      <div className="flex items-center justify-between gap-3 border-b border-line-2 px-6 py-4">
        <div className="flex flex-col gap-0.5">
          <Dialog.Title className="text-xl font-semibold tracking-[-0.02em]">
            {copy.order.title(order.number)}
          </Dialog.Title>
          <span className="text-sm text-muted">
            {copy.order.created} {relativeDateTime(created).toLowerCase()}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <StatusSelect
            label={copy.table.status}
            status={order.status}
            disabled={update.isPending}
            onChange={(status) => save({ status }, copy.orders.statusChanged)}
          />
          <CloseButton />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">
        <Section title={copy.order.customer}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[17px] font-semibold">{order.name}</span>
              <span className="text-[15px] text-muted">{formatPhoneDisplay(order.phone)}</span>
            </div>
            <div className="flex gap-2">
              <a
                href={`tel:${order.phone}`}
                aria-label={copy.order.call}
                title={copy.order.call}
                className="flex size-9 items-center justify-center rounded-control border border-line hover:border-[#c5c9da]"
              >
                <PhoneIcon />
              </a>
              <WhatsAppLink phone={order.phone} />
            </div>
          </div>
          <Row label={copy.order.address}>{order.address}</Row>
        </Section>

        <Section title={copy.order.item}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-[15px] font-semibold">{order.itemTitle}</span>
              <span className="text-[13px] text-muted">
                {ORDER_ITEM_TYPE_LABELS[order.itemType]} · {formatKgs(order.unitPriceKgs)} × {order.qty}
              </span>
            </div>
            <span className="text-[17px] font-semibold whitespace-nowrap">{formatKgs(order.totalKgs)}</span>
          </div>
          {order.displayCurrency !== 'KGS' && order.displayRate && (
            <span className="text-[13px] text-muted">
              {copy.order.currency(order.displayCurrency, String(order.displayRate))}
            </span>
          )}
          {order.fromQuiz && (
            <span className="self-start rounded-full bg-blue-soft px-2.5 py-1 text-xs font-semibold text-blue">
              {copy.order.fromQuiz}
            </span>
          )}
          {order.comment && <Row label={copy.order.comment}>{order.comment}</Row>}
        </Section>

        <Section title={copy.order.message}>
          <p className="rounded-xl bg-[#e6f6ec] px-3.5 py-3 text-sm leading-normal whitespace-pre-line text-[#14142B]">
            {order.message}
          </p>
        </Section>

        {(order.pageUrl || order.referrer || source) && (
          <Section title={copy.order.source}>
            {source && <Row label={copy.order.utm}>{source}</Row>}
            {order.pageUrl && <Row label={copy.order.page}>{shortUrl(order.pageUrl)}</Row>}
            {order.referrer && <Row label={copy.order.referrer}>{shortUrl(order.referrer)}</Row>}
          </Section>
        )}

        <Section title={copy.order.note}>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            maxLength={2000}
            placeholder={copy.order.notePlaceholder}
            aria-label={copy.order.note}
            className="w-full resize-y rounded-control border border-input bg-surface px-3.5 py-3 text-[15px] leading-normal outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(20,20,43,.08)]"
          />
          <Button
            variant="outline"
            className="self-start"
            disabled={note.trim() === order.note || update.isPending}
            onClick={() => save({ note }, copy.saved)}
          >
            {copy.order.saveNote}
          </Button>
        </Section>

        <Section title={copy.order.history}>
          <ol className="flex flex-col gap-2 text-sm">
            <HistoryItem at={order.createdAt} text={copy.order.historyCreated} />
            {order.history.map((entry, index) => (
              <HistoryItem
                key={`${entry.at}-${index}`}
                at={entry.at}
                text={
                  entry.action === 'status' && entry.from && entry.to
                    ? copy.order.historyStatus(ORDER_STATUS_LABELS[entry.from], ORDER_STATUS_LABELS[entry.to])
                    : copy.order.historyNote
                }
                by={entry.userName}
              />
            ))}
          </ol>
        </Section>
      </div>

      {user.role === 'owner' && (
        <div className="border-t border-line-2 px-6 py-4">
          <AlertDialog.Root>
            <AlertDialog.Trigger asChild>
              <Button variant="danger">{copy.order.delete}</Button>
            </AlertDialog.Trigger>
            <AlertDialog.Portal>
              <AlertDialog.Overlay className="fixed inset-0 z-[60] bg-[rgba(20,20,43,.4)]" />
              <AlertDialog.Content className="fixed top-1/2 left-1/2 z-[70] flex w-[calc(100%-40px)] max-w-[420px] -translate-1/2 flex-col gap-3 rounded-card bg-surface p-6 shadow-xl">
                <AlertDialog.Title className="text-lg font-semibold">
                  {copy.order.deleteTitle}
                </AlertDialog.Title>
                <AlertDialog.Description className="text-[15px] leading-normal text-muted">
                  {copy.order.deleteText}
                </AlertDialog.Description>
                <div className="mt-2 flex justify-end gap-2">
                  <AlertDialog.Cancel asChild>
                    <Button variant="outline">{copy.order.cancel}</Button>
                  </AlertDialog.Cancel>
                  <AlertDialog.Action asChild>
                    <Button
                      variant="danger"
                      disabled={remove.isPending}
                      onClick={() =>
                        remove.mutate(order.id, {
                          onSuccess: () => {
                            toast.success(copy.order.deleted);
                            onClose();
                          },
                          onError: (error) => toast.error(errorText(error)),
                        })
                      }
                    >
                      {copy.order.deleteConfirm}
                    </Button>
                  </AlertDialog.Action>
                </div>
              </AlertDialog.Content>
            </AlertDialog.Portal>
          </AlertDialog.Root>
        </div>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="text-[13px] font-semibold tracking-[.02em] text-muted uppercase">{title}</h3>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[13px] text-muted">{label}</span>
      <span className="text-[15px] break-words">{children}</span>
    </div>
  );
}

function HistoryItem({ at, text, by }: { at: string; text: string; by?: string | null }) {
  return (
    <li className="flex gap-2">
      <span className="w-[120px] flex-none text-muted">{relativeDateTime(new Date(at))}</span>
      <span>
        {text} {by && <span className="text-muted">{copy.order.by(by)}</span>}
      </span>
    </li>
  );
}

function shortUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname === '/' ? '' : parsed.pathname}`;
  } catch {
    return url;
  }
}
