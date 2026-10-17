import {
  bishkekHour,
  formatKgs,
  formatPhoneDisplay,
  longDate,
  ORDER_ITEM_TYPE_LABELS,
  ordersWord,
  relativeDateTime,
  type Dashboard,
  type DashboardPeriod,
} from '@bom/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  ArrowRightIcon,
  Button,
  Card,
  Segmented,
  StatusPill,
  TableHead,
  TableMessage,
} from '@/components/ui';
import { copy } from '@/content/copy';
import { useUser } from '@/features/auth/auth';
import { api, unwrap } from '@/lib/api';
import { itemLabel } from '@/lib/format';
import { cn } from '@/lib/utils';

const PERIODS: DashboardPeriod[] = ['today', 'week', 'month'];
const RECENT_COLUMNS = '1.4fr 1.7fr 1fr .9fr .9fr 1fr';

function greeting(date: Date): string {
  const hour = bishkekHour(date);
  if (hour >= 5 && hour < 12) return copy.dash.greeting.morning;
  if (hour >= 12 && hour < 18) return copy.dash.greeting.day;
  if (hour >= 18 && hour < 23) return copy.dash.greeting.evening;
  return copy.dash.greeting.night;
}

const signed = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');
const decimal = (n: number): string =>
  n >= 10 ? String(Math.round(n)) : n.toFixed(1).replace('.', ',').replace(',0', '');

interface StatCard {
  label: string;
  value: string;
  sub: string;
  tone: 'green' | 'blue' | 'muted';
}

function cards(data: Dashboard): StatCard[] {
  const { cards: c, period } = data;
  const delta = c.orders - c.previousOrders;
  const ordersSub =
    period === 'today'
      ? { sub: copy.dash.vsYesterday(signed(delta)), tone: delta > 0 ? 'green' : 'muted' }
      : c.previousOrders > 0
        ? {
            sub: (period === 'month' ? copy.dash.vsPrevMonth : copy.dash.vsPrevWeek)(
              `${signed(Math.round((delta / c.previousOrders) * 100))}%`,
            ),
            tone: delta > 0 ? 'green' : 'muted',
          }
        : { sub: copy.dash.perDay(decimal(c.orders / (period === 'week' ? 7 : 30))), tone: 'muted' };
  return [
    { label: copy.dash.ordersLabel[period], value: String(c.orders), ...ordersSub } as StatCard,
    { label: copy.dash.awaiting, value: String(c.awaiting), sub: copy.dash.awaitingSub, tone: 'blue' },
    {
      label: copy.dash.sum,
      value: formatKgs(c.sumKgs),
      sub: copy.dash.avg(formatKgs(c.avgKgs)),
      tone: 'muted',
    },
    {
      label: copy.dash.cancelled,
      value: String(c.cancelled),
      sub:
        period === 'today'
          ? copy.dash.cancelledWeek(c.cancelledWeek)
          : copy.dash.cancelledShare(c.orders ? Math.round((c.cancelled / c.orders) * 100) : 0),
      tone: 'muted',
    },
  ];
}

const TONE = { green: 'text-green', blue: 'text-blue', muted: 'text-muted' } as const;

export function DashboardPage() {
  const user = useUser();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<DashboardPeriod>('today');
  const dashboard = useQuery({
    queryKey: ['dashboard', period],
    queryFn: () => unwrap(api.GET('/v1/admin/dashboard', { params: { query: { period } } })),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
  const now = new Date();
  const data = dashboard.data;
  const maxCount = Math.max(1, ...(data?.byProgram.map((row) => row.count) ?? [1]));

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="flex flex-col gap-1">
          <span className="text-[15px] text-muted">{longDate(now)}</span>
          <h1 className="text-[30px] leading-[1.15] font-semibold tracking-[-0.03em]">
            {greeting(now)}, {user.name.split(/\s+/)[0]}
          </h1>
        </div>
        <Segmented
          label={copy.nav.dash}
          value={period}
          onChange={setPeriod}
          options={PERIODS.map((key) => ({ key, label: copy.dash.periods[key] }))}
        />
      </div>

      {dashboard.isError && !data ? (
        <Card className="mt-6 flex flex-col items-center gap-4 p-10 text-[15px] text-muted">
          {copy.errors.load}
          <Button variant="outline" onClick={() => void dashboard.refetch()}>
            {copy.retry}
          </Button>
        </Card>
      ) : (
        <>
          <div className={cn('mt-[26px] grid grid-cols-2 gap-4 xl:grid-cols-4', !data && 'animate-pulse')}>
            {(data ? cards(data) : Array.from({ length: 4 }, () => null)).map((card, index) => (
              <Card key={card?.label ?? index} className="flex min-h-[132px] flex-col p-4 sm:p-[22px]">
                {card && (
                  <>
                    <span className="text-sm text-muted">{card.label}</span>
                    <span className="mt-2.5 text-[clamp(22px,6.4vw,32px)] leading-none font-semibold tracking-[-0.03em] whitespace-nowrap">
                      {card.value}
                    </span>
                    <span className={cn('mt-2.5 text-sm', TONE[card.tone])}>{card.sub}</span>
                  </>
                )}
              </Card>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-start gap-4">
            <Card className="flex min-w-0 flex-[999_1_764px] flex-col overflow-x-auto">
              <div className="flex items-center justify-between gap-4 px-[22px] py-[18px]">
                <h2 className="text-lg font-semibold">{copy.dash.recent}</h2>
                <Link to="/orders" className="flex items-center gap-1.5 text-sm font-semibold">
                  {copy.dash.allOrders}
                  <ArrowRightIcon />
                </Link>
              </div>
              <div
                role="table"
                style={{ '--table-min': '720px' } as CSSProperties}
                className="border-t border-line-2"
              >
                <TableHead columns={RECENT_COLUMNS}>
                  <span>{copy.table.client}</span>
                  <span>{copy.table.order}</span>
                  <span>{copy.table.city}</span>
                  <span>{copy.table.sum}</span>
                  <span>{copy.table.time}</span>
                  <span>{copy.table.status}</span>
                </TableHead>
                {data?.recent.map((order) => (
                  <div
                    key={order.id}
                    role="row"
                    tabIndex={0}
                    onClick={() => void navigate(`/orders/${order.id}`)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') void navigate(`/orders/${order.id}`);
                    }}
                    style={{ gridTemplateColumns: RECENT_COLUMNS }}
                    className="grid min-h-[62px] min-w-[720px] cursor-pointer items-center gap-3 border-b border-line-2 px-[22px] last:border-b-0 hover:bg-table-head"
                  >
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-[15px] font-semibold">{order.name}</span>
                      <span className="truncate text-[13px] text-muted">
                        {formatPhoneDisplay(order.phone)}
                      </span>
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-[15px]">{itemLabel(order)}</span>
                      <span className="text-[13px] text-muted">{ORDER_ITEM_TYPE_LABELS[order.itemType]}</span>
                    </span>
                    <span className="text-[15px] text-muted">{order.city}</span>
                    <span className="text-[15px] font-semibold whitespace-nowrap">
                      {formatKgs(order.totalKgs)}
                    </span>
                    <span className="text-sm text-muted">
                      {relativeDateTime(new Date(order.createdAt), now)}
                    </span>
                    <span className="flex">
                      <StatusPill status={order.status} />
                    </span>
                  </div>
                ))}
                {data && data.recent.length === 0 && <TableMessage>{copy.dash.noRecent}</TableMessage>}
              </div>
            </Card>

            <Card className="flex min-w-0 flex-[1_1_300px] flex-col px-[22px] pt-5 pb-[22px]">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-lg font-semibold">{copy.dash.byProgram}</h2>
                <span className="text-sm text-muted">{copy.dash.week}</span>
              </div>
              <div className="mt-[22px] flex flex-col gap-[18px]">
                {data?.byProgram.map((row) => (
                  <div key={row.title} className="flex flex-col gap-2">
                    <div className="flex justify-between gap-3 text-[15px]">
                      <span>{row.title}</span>
                      <span className="font-semibold">{row.count}</span>
                    </div>
                    <span className="block h-1.5 rounded-full bg-line-2">
                      <span
                        className="block h-1.5 rounded-full bg-ink"
                        style={{ width: `${Math.round((row.count / maxCount) * 100)}%` }}
                      />
                    </span>
                  </div>
                ))}
                {data && data.byProgram.length === 0 && (
                  <span className="text-[15px] text-muted">{copy.dash.noPrograms}</span>
                )}
              </div>
              {data && data.programOrdersTotal > 0 && (
                <span className="mt-[22px] border-t border-line-2 pt-4 text-sm text-muted">
                  {copy.dash.programTotal(data.programOrdersTotal, ordersWord(data.programOrdersTotal))}
                </span>
              )}
            </Card>
          </div>
        </>
      )}
    </>
  );
}
