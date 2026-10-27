import {
  LEAD_KIND_LABELS,
  quizLeadAnswers,
  relativeDateTime,
  WHOLESALE_BUYER_LABELS,
  WHOLESALE_COUNTRY_LABELS,
  type LeadKind,
  type LeadRow,
  type WholesaleBuyer,
  type WholesaleCountry,
} from '@bom/shared';
import { useState, type CSSProperties } from 'react';
import { toast } from 'sonner';
import { useDeleteLead, useLeads } from '@/api/leads';
import {
  Button,
  Card,
  PageHeader,
  Segmented,
  Spinner,
  TableHead,
  TableMessage,
  TableRow,
} from '@/components/ui';
import { copy } from '@/content/copy';
import { useUser } from '@/features/auth/auth';
import { ConfirmDelete } from '@/features/products/product-editor';
import { errorText } from '@/lib/format';
import { cn } from '@/lib/utils';

type Tab = 'all' | LeadKind;
const TABS: Tab[] = ['all', 'quiz', 'wholesale'];
const COLUMNS = '150px 90px 2.2fr 1.6fr 1fr 44px';
function answersText(lead: LeadRow): string[] {
  if (lead.kind === 'quiz') return quizLeadAnswers(lead.answers);
  const buyer = lead.answers.buyer as WholesaleBuyer | undefined;
  const country = lead.answers.country as WholesaleCountry | undefined;
  return [
    ...(buyer && WHOLESALE_BUYER_LABELS[buyer] ? [WHOLESALE_BUYER_LABELS[buyer].label] : []),
    ...(country && WHOLESALE_COUNTRY_LABELS[country] ? [WHOLESALE_COUNTRY_LABELS[country].label] : []),
  ];
}

/** Quiz and wholesale hand-offs (gap: the design has no leads screen). */
export function LeadsPage() {
  const [tab, setTab] = useState<Tab>('all');
  const leads = useLeads(tab);
  const remove = useDeleteLead();
  const owner = useUser().role === 'owner';
  const rows = leads.data?.pages.flatMap((page) => page.items) ?? [];
  const counts = leads.data?.pages[0]?.counts;
  const now = new Date();

  return (
    <>
      <PageHeader title={copy.leads.title} lead={copy.leads.lead} />
      <div className="mt-6">
        <Segmented
          label={copy.leads.title}
          value={tab}
          onChange={setTab}
          options={TABS.map((key) => ({
            key,
            label: copy.leads.tabs[key],
            ...(counts ? { count: counts[key] } : {}),
          }))}
        />
      </div>
      <Card className="mt-4 overflow-x-auto">
        <div role="table" style={{ '--table-min': '820px' } as CSSProperties}>
          <TableHead columns={COLUMNS}>
            <span>{copy.table.when}</span>
            <span>{copy.leads.kind}</span>
            <span>{copy.leads.answers}</span>
            <span>{copy.leads.recommended}</span>
            <span>{copy.leads.source}</span>
            <span />
          </TableHead>
          {rows.map((lead) => (
            <TableRow
              key={lead.id}
              style={{ gridTemplateColumns: COLUMNS }}
              className="grid min-h-16 min-w-[820px] items-center gap-3 border-b border-line-2 px-[22px] py-3 last:border-b-0"
            >
              <span className="text-sm text-muted">{relativeDateTime(new Date(lead.createdAt), now)}</span>
              <span>
                <span
                  className={cn(
                    'inline-flex h-7 items-center rounded-full px-2.5 text-[13px] font-semibold',
                    lead.kind === 'quiz' ? 'bg-blue-soft text-blue' : 'bg-amber-soft text-amber-ink',
                  )}
                >
                  {LEAD_KIND_LABELS[lead.kind]}
                </span>
              </span>
              <span className="flex flex-col gap-0.5 text-sm">
                {answersText(lead).map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </span>
              <span className="flex flex-col gap-0.5 text-sm">
                {lead.recommended.map((program) => (
                  <span key={program.slug}>{program.title}</span>
                ))}
                {lead.kind === 'quiz' && (
                  <span className="text-[13px] text-muted">
                    {lead.choose ? copy.leads.choose : copy.leads.review}
                  </span>
                )}
              </span>
              <span className="truncate text-sm text-muted">{lead.utm?.source ?? copy.leads.direct}</span>
              {owner ? (
                <ConfirmDelete
                  label={copy.leads.delete}
                  title={copy.leads.deleteTitle}
                  text={copy.leads.deleteText}
                  pending={remove.isPending}
                  onConfirm={() =>
                    remove.mutate(lead.id, {
                      onSuccess: () => toast.success(copy.leads.deleted),
                      onError: (error) => toast.error(errorText(error)),
                    })
                  }
                  trigger={
                    <button
                      type="button"
                      aria-label={copy.leads.delete}
                      title={copy.leads.delete}
                      className="flex size-9 items-center justify-center rounded-control text-muted hover:bg-red-hover hover:text-red"
                    >
                      <svg
                        width="17"
                        height="17"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
                      </svg>
                    </button>
                  }
                />
              ) : (
                <span />
              )}
            </TableRow>
          ))}
          {leads.isPending && <TableMessage>{copy.loading}</TableMessage>}
          {leads.isError && !leads.data && <TableMessage>{copy.errors.load}</TableMessage>}
          {leads.data && rows.length === 0 && <TableMessage>{copy.leads.empty}</TableMessage>}
        </div>
      </Card>
      {leads.hasNextPage && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            onClick={() => void leads.fetchNextPage()}
            disabled={leads.isFetchingNextPage}
          >
            {leads.isFetchingNextPage ? <Spinner /> : null}
            {copy.loadMore}
          </Button>
        </div>
      )}
    </>
  );
}
