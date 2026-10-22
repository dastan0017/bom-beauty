import { formatKgs, formatPhoneDisplay, relativeDateTime, type OrderStatus } from '@bom/shared';
import { useEffect, useState, type CSSProperties } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import {
  Button,
  Card,
  DownloadIcon,
  inputClass,
  PageHeader,
  Segmented,
  Spinner,
  StatusSelect,
  TableHead,
  TableMessage,
  TableRow,
  WhatsAppLink,
} from '@/components/ui';
import { copy } from '@/content/copy';
import { useUser } from '@/features/auth/auth';
import { download, saveBlob } from '@/lib/api';
import { errorText, itemLabel, kindLabel } from '@/lib/format';
import { cn } from '@/lib/utils';
import { OrderDrawer } from './order-drawer';
import { useOrderCounters, useOrders, useUpdateOrder } from '@/api/orders';

type Tab = 'all' | OrderStatus;
const TABS: Tab[] = ['all', 'new', 'sent', 'cancelled'];
const COLUMNS = '70px 1.4fr 1.7fr 1fr .9fr 1fr 150px 44px';

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

export function OrdersPage() {
  const user = useUser();
  const navigate = useNavigate();
  const { id: openId } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = (TABS as string[]).includes(params.get('status') ?? '') ? (params.get('status') as Tab) : 'all';
  const [query, setQuery] = useState(params.get('q') ?? '');
  const q = useDebounced(query.trim(), 300);
  const filters = { ...(tab !== 'all' ? { status: tab } : {}), ...(q ? { q } : {}) };
  const orders = useOrders(filters);
  const counters = useOrderCounters();
  const update = useUpdateOrder();
  const [exporting, setExporting] = useState(false);
  const rows = orders.data?.pages.flatMap((page) => page.items) ?? [];
  const now = new Date();

  // Keep the search in the URL so a reload or a shared link shows the same list.
  useEffect(() => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (q) next.set('q', q);
        else next.delete('q');
        return next;
      },
      { replace: true },
    );
  }, [q, setParams]);

  const setTab = (next: Tab) =>
    setParams((current) => {
      const updated = new URLSearchParams(current);
      if (next === 'all') updated.delete('status');
      else updated.set('status', next);
      return updated;
    });

  const changeStatus = (id: string, status: OrderStatus) =>
    update.mutate(
      { id, change: { status } },
      {
        onSuccess: () => toast.success(copy.orders.statusChanged),
        onError: (error) => toast.error(errorText(error)),
      },
    );

  const exportCsv = async () => {
    setExporting(true);
    try {
      const search = new URLSearchParams({
        ...(filters.status ? { status: filters.status } : {}),
        ...(q ? { q } : {}),
      });
      const blob = await download(`/admin/orders/export.csv${search.size ? `?${search}` : ''}`);
      saveBlob(blob, `bom-orders-${new Date().toISOString().slice(0, 10)}.csv`);
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setExporting(false);
    }
  };

  const open = (id: string) => void navigate({ pathname: `/orders/${id}`, search: params.toString() });

  return (
    <>
      <PageHeader title={copy.orders.title} lead={copy.orders.lead}>
        {user.role === 'owner' && (
          <Button variant="outline" onClick={() => void exportCsv()} disabled={exporting}>
            {exporting ? <Spinner /> : <DownloadIcon />}
            {exporting ? copy.orders.exporting : copy.orders.export}
          </Button>
        )}
      </PageHeader>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <Segmented
          label={copy.orders.title}
          value={tab}
          onChange={setTab}
          options={TABS.map((key) => ({
            key,
            label: copy.orders.tabs[key],
            ...(counters.data ? { count: counters.data[key] } : {}),
          }))}
        />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={copy.orders.search}
          aria-label={copy.orders.search}
          className={cn(inputClass, 'w-full sm:w-[340px]')}
        />
      </div>

      <Card className="mt-4 overflow-x-auto">
        <div role="table" style={{ '--table-min': '940px' } as CSSProperties}>
          <TableHead columns={COLUMNS}>
            <span>{copy.table.number}</span>
            <span>{copy.table.client}</span>
            <span>{copy.table.order}</span>
            <span>{copy.table.address}</span>
            <span>{copy.table.sum}</span>
            <span>{copy.table.when}</span>
            <span>{copy.table.status}</span>
            <span />
          </TableHead>
          {rows.map((order) => (
            <TableRow
              key={order.id}
              tabIndex={0}
              onClick={() => open(order.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && event.target === event.currentTarget) open(order.id);
              }}
              style={{ gridTemplateColumns: COLUMNS }}
              className={cn(
                'grid min-h-16 min-w-[940px] cursor-pointer items-center gap-3 border-b border-line-2 px-[22px] last:border-b-0 hover:bg-table-head',
                openId === order.id && 'bg-table-head',
              )}
            >
              <span className="text-sm text-muted">#{order.number}</span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[15px] font-semibold">{order.name}</span>
                <span className="truncate text-[13px] text-muted">{formatPhoneDisplay(order.phone)}</span>
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[15px]">{itemLabel(order)}</span>
                <span className="text-[13px] text-muted">{kindLabel(order)}</span>
              </span>
              <span className="truncate text-[15px] text-muted" title={order.address}>
                {order.city}
              </span>
              <span className="text-[15px] font-semibold whitespace-nowrap">{formatKgs(order.totalKgs)}</span>
              <span className="text-sm text-muted">{relativeDateTime(new Date(order.createdAt), now)}</span>
              <span className="flex">
                <StatusSelect
                  label={`${copy.table.status} #${order.number}`}
                  status={order.status}
                  onChange={(status) => changeStatus(order.id, status)}
                />
              </span>
              <WhatsAppLink phone={order.phone} />
            </TableRow>
          ))}
          {orders.isPending && <TableMessage>{copy.loading}</TableMessage>}
          {orders.isError && !orders.data && <TableMessage>{copy.errors.load}</TableMessage>}
          {orders.data && rows.length === 0 && <TableMessage>{copy.nothingFound}</TableMessage>}
        </div>
      </Card>
      {orders.hasNextPage && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            onClick={() => void orders.fetchNextPage()}
            disabled={orders.isFetchingNextPage}
          >
            {orders.isFetchingNextPage ? <Spinner /> : null}
            {copy.loadMore}
          </Button>
        </div>
      )}

      <OrderDrawer
        id={openId ?? null}
        onClose={() => void navigate({ pathname: '/orders', search: params.toString() })}
      />
    </>
  );
}
