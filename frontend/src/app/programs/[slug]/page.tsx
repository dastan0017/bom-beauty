import type { Route } from 'next';
import type { ProgramDetail, RoutineStep } from '@bom/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect, redirect } from 'next/navigation';
import { BbImage, PhotoPlaceholder } from '@/components/bb-image';
import { Price } from '@/components/currency';
import { CheckIcon } from '@/components/icons';
import { JsonLd } from '@/components/json-ld';
import {
  OrderProgramButton,
  ProgramBackLink,
  ProgramOrderBar,
  ProgramVideo,
  ProtocolCard,
} from '@/components/program/program-client';
import { AccentTitle, card, SectionTitle, StockBadge } from '@/components/ui';
import { copy } from '@/content/copy';
import { cn } from '@/lib/cn';
import { getContent, getProgram, resolveRedirect } from '@/lib/data';
import { BASE_OPEN_GRAPH, breadcrumbsLd, excerpt, imageUrl, productLd } from '@/lib/seo';
import { productsCount, productsGenitive, stepsCount } from '@/lib/words';

type Params = { params: Promise<{ slug: string }> };

async function loadProgram(slug: string): Promise<ProgramDetail> {
  const program = await getProgram(slug);
  if (program) return program;
  const target = await resolveRedirect(`/programs/${slug}`);
  if (target)
    (target.statusCode === 301 || target.statusCode === 308 ? permanentRedirect : redirect)(
      target.toPath as Route,
    );
  notFound();
}

const headingOf = (program: ProgramDetail): string =>
  program.headline ? `${copy.program.careFor}${program.headline}` : program.title;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const program = await getProgram((await params).slug);
  if (!program) return {};
  return {
    title: program.seo.title ?? headingOf(program),
    description: program.seo.description ?? excerpt(program.description || program.symptom),
    alternates: { canonical: `/programs/${program.slug}` },
    openGraph: { ...BASE_OPEN_GRAPH, title: program.seo.title ?? headingOf(program) },
  };
}

export default async function ProgramPage({ params }: Params) {
  const { slug } = await params;
  const [program, delivery] = await Promise.all([loadProgram(slug), getContent('delivery')]);
  const count = program.items.length;
  const saving = program.sumKgs - program.priceKgs;
  const forOrder = { ...program, image: program.items[0]?.image ?? null };
  const facts = delivery?.data.programFacts ?? [];

  return (
    <>
      <JsonLd
        data={[
          breadcrumbsLd([
            { name: copy.common.toHome, path: '/' },
            { name: copy.header.tabs.programs, path: '/programs' },
            { name: program.title, path: `/programs/${program.slug}` },
          ]),
          productLd({
            name: copy.order.programLabel(program.title),
            description: excerpt(program.description || program.symptom, 500),
            path: `/programs/${program.slug}`,
            brand: 'Bom Beauty',
            priceKgs: program.priceKgs,
            inStock: program.inStock,
            images: program.items.map((item) => imageUrl(item.image)),
          }),
        ]}
      />

      <div className="bg-[radial-gradient(120%_300px_at_50%_0%,var(--glow)_0%,rgba(255,255,255,0)_100%)]">
        <div className="mx-auto max-w-[1100px] lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-10 lg:px-6 lg:pt-6">
          <div className="min-w-0">
            <section className="flex flex-col items-start px-5 pt-2.5 lg:px-0">
              <ProgramBackLink slug={program.slug} />
              <StockBadge inStock={program.inStock} className="mt-2.5" />
              <h1 className="mt-4 self-stretch heading text-[calc(33px*var(--fhk))] leading-[1.1] lg:text-[calc(44px*var(--fhk))]">
                {program.headline ? (
                  <AccentTitle text={`${copy.program.careFor}*${program.headline}*`} />
                ) : (
                  program.title
                )}
              </h1>
              <p className="mt-3.5 self-stretch text-[17px] leading-[1.4] font-semibold">
                {copy.program.readyOf(productsGenitive(count))}
              </p>
              {program.course && (
                <p className="mt-1 self-stretch text-base leading-normal text-muted">{program.course}</p>
              )}
              {program.video && (
                <>
                  <ProgramVideo program={forOrder} video={program.video} />
                  <p className="mt-3 self-stretch text-center text-[15px] leading-normal text-balance text-muted">
                    {copy.program.videoCaption}
                  </p>
                </>
              )}
              {program.fit.length > 0 && (
                <div className={cn(card, 'mt-[22px] flex flex-col gap-3 self-stretch p-[18px]')}>
                  <span className="text-base font-semibold">{copy.program.fitTitle}</span>
                  <ul className="flex flex-col gap-3">
                    {program.fit.map((line) => (
                      <li key={line} className="flex items-start gap-2.5">
                        <span className="mt-px flex size-[22px] flex-none items-center justify-center rounded-full bg-accent-soft text-accent-ink">
                          <CheckIcon size={12} strokeWidth={3.2} />
                        </span>
                        <span className="text-base leading-[1.45]">{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            <section className="flex flex-col gap-[18px] px-4 pt-14 lg:px-0">
              <SectionTitle
                title={copy.program.contentsTitle}
                lead={copy.program.contentsLead(productsCount(count))}
              />
              <ul className={cn(card, 'flex flex-col')}>
                {program.items.map((item, index) => (
                  <li key={item.slug} className={cn(index > 0 && 'border-t border-line-2')}>
                    <Link href={`/catalog/${item.slug}`} className="flex items-center gap-3.5 px-4 py-3.5">
                      <span className="relative flex size-[60px] flex-none items-center justify-center overflow-hidden rounded-xl bg-surface-2">
                        <BbImage
                          image={item.image}
                          sizes="60px"
                          width={120}
                          alt={item.name}
                          placeholder={<PhotoPlaceholder label={copy.common.photo} className="text-[10px]" />}
                        />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="text-base leading-[1.3] font-semibold">{item.name}</span>
                        <span className="text-[15px] leading-[1.4] text-muted">{item.purpose}</span>
                      </span>
                      <span className="flex-none text-[15px] whitespace-nowrap text-muted">
                        <Price kgs={item.priceKgs} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            {(program.steps.am.length > 0 || program.steps.pm.length > 0) && (
              <section className="flex flex-col gap-3 px-4 pt-14 lg:px-0">
                <SectionTitle
                  className="pb-1.5"
                  title={copy.program.routineTitle}
                  lead={copy.program.routineLead}
                />
                <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:items-start">
                  <Routine label={copy.program.morning} steps={program.steps.am} />
                  <Routine label={copy.program.evening} steps={program.steps.pm} />
                </div>
              </section>
            )}
          </div>

          <aside className="flex flex-col gap-4 px-4 pt-10 lg:sticky lg:top-[92px] lg:self-start lg:px-0 lg:pt-[60px]">
            <div className={cn(card, 'flex flex-col px-5 py-[22px]')}>
              <div className="flex items-end justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-[15px] text-muted">{copy.program.priceTitle}</span>
                  <span className="text-4xl leading-none font-semibold tracking-[-0.035em] whitespace-nowrap">
                    <Price kgs={program.priceKgs} />
                  </span>
                </div>
                {saving > 0 && (
                  <span className="mb-1 flex-none rounded-full bg-accent-soft px-3 py-1.5 text-sm font-semibold whitespace-nowrap text-accent-ink">
                    −<Price kgs={saving} />
                  </span>
                )}
              </div>
              {saving > 0 && (
                <p className="mt-3 text-[15px] text-muted">
                  {copy.program.separately}
                  <s>
                    <Price kgs={program.sumKgs} />
                  </s>
                </p>
              )}
              {facts.length > 0 && (
                <dl className="mt-5 flex flex-col gap-3 border-t border-line-2 pt-[18px] text-[15px]">
                  {facts.map((fact) => (
                    <div key={fact.label} className="flex justify-between gap-3">
                      <dt className="text-muted">{fact.label}</dt>
                      <dd className="text-right font-semibold">{fact.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              <div className="mt-6 hidden lg:flex">
                <OrderProgramButton program={forOrder} />
              </div>
            </div>
            {program.protocol && <ProtocolCard file={program.protocol} programTitle={program.title} />}
          </aside>
        </div>
      </div>

      <ProgramOrderBar program={forOrder} />
    </>
  );
}

function Routine({ label, steps }: { label: string; steps: RoutineStep[] }) {
  if (steps.length === 0) return null;
  return (
    <div className={cn(card, 'flex flex-col')}>
      <div className="flex items-center justify-between border-b border-line-2 px-[18px] py-4">
        <h3 className="text-lg font-semibold">{label}</h3>
        <span className="text-sm text-muted">{copy.program.stepsHead(stepsCount(steps.length))}</span>
      </div>
      <ol>
        {steps.map((step, index) => (
          <li
            key={`${step.productSlug}-${index}`}
            className={cn('flex items-start gap-3.5 px-[18px] py-4', index > 0 && 'border-t border-line-2')}
          >
            <span className="flex size-7 flex-none items-center justify-center rounded-full bg-ink text-sm font-semibold text-white">
              {index + 1}
            </span>
            <span className="flex flex-col gap-0.5 pt-[3px]">
              <span className="text-base leading-[1.3] font-semibold">{step.title}</span>
              <span className="text-[15px] leading-[1.45] text-muted">{step.text}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
