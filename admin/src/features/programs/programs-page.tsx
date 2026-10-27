import { formatKgs, type AdminProgramRow } from '@bom/shared';
import type { CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { usePatchProgram, usePrograms } from '@/api/catalog';
import { Button, Card, PageHeader, TableHead, TableMessage, TableRow } from '@/components/ui';
import { Toggle } from '@/components/ui/editor';
import { MediaPreview } from '@/components/ui/media';
import { copy } from '@/content/copy';
import { PlusIcon } from '@/features/products/products-page';
import { errorText } from '@/lib/format';

// Fits the ~930 px content column at 1280 px; narrower screens scroll the table.
const COLUMNS = 'minmax(230px,2.4fr) .5fr .8fr .9fr .9fr .6fr 104px';

function StatusChip({ tone, children }: { tone: 'green' | 'grey'; children: string }) {
  return (
    <span
      className={
        tone === 'green'
          ? 'inline-flex h-7 items-center gap-1.5 rounded-full bg-green-soft px-2.5 text-[13px] font-semibold text-green'
          : 'inline-flex h-7 items-center rounded-full bg-subtle px-2.5 text-[13px] font-semibold text-muted'
      }
    >
      {tone === 'green' && <span className="size-1.5 rounded-full bg-green-dot" />}
      {children}
    </span>
  );
}

const videoChip = (row: AdminProgramRow) =>
  row.videoStatus === 'ready' ? (
    <StatusChip tone="green">{copy.media.uploaded}</StatusChip>
  ) : row.videoStatus ? (
    <StatusChip tone="grey">{copy.media.processing}</StatusChip>
  ) : (
    <StatusChip tone="grey">{copy.media.noVideo}</StatusChip>
  );

const protocolChip = (row: AdminProgramRow) =>
  row.protocolStatus === 'ready' ? (
    <StatusChip tone="green">{copy.media.attached}</StatusChip>
  ) : row.protocolStatus ? (
    <StatusChip tone="grey">{copy.media.processing}</StatusChip>
  ) : (
    <StatusChip tone="grey">{copy.media.noFile}</StatusChip>
  );

/** Программы ухода (design: isPrograms). */
export function ProgramsPage() {
  const navigate = useNavigate();
  const programs = usePrograms();
  const patch = usePatchProgram();

  return (
    <>
      <PageHeader title={copy.programs.title} lead={copy.programs.lead}>
        <Button onClick={() => void navigate('/programs/new')}>
          <PlusIcon />
          {copy.programs.add}
        </Button>
      </PageHeader>
      <Card className="mt-6 overflow-x-auto">
        <div role="table" style={{ '--table-min': '900px' } as CSSProperties}>
          <TableHead columns={COLUMNS}>
            <span>{copy.programs.columns.program}</span>
            <span>{copy.programs.columns.count}</span>
            <span>{copy.programs.columns.price}</span>
            <span>{copy.programs.columns.video}</span>
            <span>{copy.programs.columns.protocol}</span>
            <span>{copy.programs.columns.site}</span>
            <span />
          </TableHead>
          {programs.data?.map((program) => (
            <TableRow
              key={program.id}
              onClick={(event) => {
                const control =
                  event.target instanceof Element && event.target.closest('a, button, input, label');
                if (!control) void navigate(`/programs/${program.id}`);
              }}
              style={{ gridTemplateColumns: COLUMNS }}
              className="grid min-h-[72px] min-w-[900px] cursor-pointer items-center gap-3 border-b border-line-2 px-[22px] py-3.5 last:border-b-0 hover:bg-table-head"
            >
              <span className="flex min-w-0 items-center gap-3.5">
                <span className="flex flex-none pl-2">
                  {program.thumbs.map((image, index) => (
                    <MediaPreview
                      key={index}
                      image={image}
                      label=""
                      size={68}
                      className="-ml-2 size-[34px] rounded-xl border-2 border-white"
                    />
                  ))}
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Link to={`/programs/${program.id}`} className="text-base font-semibold hover:underline">
                      {program.title}
                    </Link>
                    {program.badge && (
                      <span className="inline-flex h-[22px] items-center rounded-full bg-blue-soft px-2 text-xs font-semibold whitespace-nowrap text-blue">
                        {program.badge}
                      </span>
                    )}
                  </span>
                  <span className="text-sm text-muted">{program.symptom || '—'}</span>
                </span>
              </span>
              <span className="text-[15px]">{program.itemCount}</span>
              <span className="text-[15px] font-semibold whitespace-nowrap">
                {formatKgs(program.priceKgs)}
              </span>
              <span className="flex">{videoChip(program)}</span>
              <span className="flex">{protocolChip(program)}</span>
              <Toggle
                checked={program.published}
                label={`${copy.programs.columns.site}: ${program.title}`}
                onChange={(published) =>
                  patch.mutate(
                    { id: program.id, change: { published } },
                    {
                      onSuccess: () => toast.success(copy.saved),
                      onError: (error) => toast.error(errorText(error)),
                    },
                  )
                }
              />
              <Link
                to={`/programs/${program.id}`}
                className="flex h-[38px] items-center justify-center rounded-control border border-input bg-surface px-3.5 text-sm font-semibold hover:border-input-hover"
              >
                {copy.programs.edit}
              </Link>
            </TableRow>
          ))}
          {programs.isPending && <TableMessage>{copy.loading}</TableMessage>}
          {programs.isError && !programs.data && <TableMessage>{copy.errors.load}</TableMessage>}
          {programs.data?.length === 0 && <TableMessage>{copy.programs.empty}</TableMessage>}
        </div>
      </Card>
    </>
  );
}
