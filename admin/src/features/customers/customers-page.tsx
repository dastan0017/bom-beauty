import { formatKgs, formatPhoneDisplay, relativeDateTime } from '@bom/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState, type CSSProperties } from 'react';
import {
  Card,
  inputClass,
  PageHeader,
  TableHead,
  TableMessage,
  TableRow,
  WhatsAppLink,
} from '@/components/ui';
import { copy } from '@/content/copy';
import { keys } from '@/api/keys';
import { api, unwrap } from '@/lib/api';
import { cn } from '@/lib/utils';

const COLUMNS = '1.5fr 1fr .7fr 1fr 1fr 1.6fr 44px';

/** Customers built from orders (design: isCustomers / custRows). */
export function CustomersPage() {
  const [query, setQuery] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const timer = window.setTimeout(() => setQ(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);
  const customers = useQuery({
    queryKey: keys.customers(q),
    queryFn: () => unwrap(api.GET('/v1/admin/customers', { params: { query: q ? { q } : {} } })),
    placeholderData: keepPreviousData,
  });
  const now = new Date();

  return (
    <>
      <PageHeader title={copy.customers.title} lead={copy.customers.lead}>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={copy.customers.search}
          aria-label={copy.customers.search}
          className={cn(inputClass, 'w-full sm:w-[340px]')}
        />
      </PageHeader>
      <Card className="mt-6 overflow-x-auto">
        <div role="table" style={{ '--table-min': '880px' } as CSSProperties}>
          <TableHead columns={COLUMNS}>
            <span>{copy.table.client}</span>
            <span>{copy.table.city}</span>
            <span>{copy.customers.count}</span>
            <span>{copy.customers.sum}</span>
            <span>{copy.customers.last}</span>
            <span>{copy.customers.favorite}</span>
            <span />
          </TableHead>
          {customers.data?.map((customer) => (
            <TableRow
              key={customer.phone}
              style={{ gridTemplateColumns: COLUMNS }}
              className="grid min-h-16 min-w-[880px] items-center gap-3 border-b border-line-2 px-[22px] last:border-b-0"
            >
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[15px] font-semibold">{customer.name}</span>
                <span className="truncate text-[13px] text-muted">{formatPhoneDisplay(customer.phone)}</span>
              </span>
              <span className="text-[15px] text-muted">{customer.city}</span>
              <span className="text-[15px]">{customer.count}</span>
              <span className="text-[15px] font-semibold whitespace-nowrap">
                {formatKgs(customer.totalKgs)}
              </span>
              <span className="text-sm text-muted">
                {relativeDateTime(new Date(customer.lastOrderAt), now)}
              </span>
              <span className="text-sm">{customer.favorite}</span>
              <WhatsAppLink phone={customer.phone} />
            </TableRow>
          ))}
          {customers.isPending && <TableMessage>{copy.loading}</TableMessage>}
          {customers.isError && !customers.data && <TableMessage>{copy.errors.load}</TableMessage>}
          {customers.data?.length === 0 && (
            <TableMessage>{q ? copy.nothingFound : copy.customers.empty}</TableMessage>
          )}
        </div>
      </Card>
    </>
  );
}
