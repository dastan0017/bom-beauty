import type { Route } from 'next';
import type { ProgramDetail } from '@bom/shared';
import { programDetailVariants } from '@bom/shared/web';
import type { Metadata } from 'next';
import { notFound, permanentRedirect, redirect } from 'next/navigation';
import { CheckIcon } from '@/components/icons';
import { JsonLd } from '@/components/json-ld';
import {
  OrderProgramButton,
  ProgramBackLink,
  ProgramContentsLead,
  ProgramItems,
  ProgramOrderBar,
  ProgramPriceSummary,
  ProgramReadyOf,
  ProgramVariantProvider,
  ProgramVideo,
  SchemeCard,
  VariantSwitch,
} from '@/components/program/program-client';
import { AccentTitle, card, SectionTitle, StockBadge } from '@/components/ui';
import { copy } from '@/content/copy';
import { cn } from '@/lib/cn';
import { getContent, getProgram, resolveRedirect } from '@/lib/data';
import { BASE_OPEN_GRAPH, breadcrumbsLd, excerpt, imageUrl, productLd } from '@/lib/seo';

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
  // Order lines show the program's cover (README §11). Only what ordering needs goes to the browser.
  const forOrder = {
    slug: program.slug,
    title: program.title,
    headline: program.headline,
    course: program.course,
    image: program.cover,
  };
  const facts = delivery?.data.programFacts ?? [];

  return (
    // Everything derived from the products follows the chosen variant (key: a new program starts on its default).
    <ProgramVariantProvider key={program.slug} slug={program.slug} variants={programDetailVariants(program)}>
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
                <ProgramReadyOf />
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
              <SectionTitle title={copy.program.contentsTitle} lead={<ProgramContentsLead />} />
              <VariantSwitch />
              <ProgramItems />
            </section>
          </div>

          <aside className="flex flex-col gap-4 px-4 pt-10 lg:sticky lg:top-[92px] lg:self-start lg:px-0 lg:pt-[60px]">
            <div className={cn(card, 'flex flex-col px-5 py-[22px]')}>
              <ProgramPriceSummary />
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
            <SchemeCard file={program.protocol} programSlug={program.slug} programTitle={program.title} />
          </aside>
        </div>
      </div>

      <ProgramOrderBar program={forOrder} />
    </ProgramVariantProvider>
  );
}
