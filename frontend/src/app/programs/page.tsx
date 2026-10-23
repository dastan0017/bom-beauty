import { GENERIC_QUESTION_MESSAGE, waLink } from '@bom/shared/web';
import type { Metadata } from 'next';
import { TrackedLink } from '@/components/header-client';
import { QuizBanner } from '@/components/home/home-client';
import { ArrowRightIcon } from '@/components/icons';
import { JsonLd } from '@/components/json-ld';
import { ProgramCard } from '@/components/program/program-card';
import { QuizStickyBar } from '@/components/sticky-bar';
import { AccentTitle, card, container, PageIntro, PageTitle, SectionTitle } from '@/components/ui';
import { copy } from '@/content/copy';
import { cn } from '@/lib/cn';
import { getPrograms, getSettings } from '@/lib/data';
import { breadcrumbsLd } from '@/lib/seo';

export const metadata: Metadata = {
  title: copy.seo.programs,
  description: copy.programs.lead,
  alternates: { canonical: '/programs' },
};

export default async function ProgramsPage() {
  const [programs, settings] = await Promise.all([getPrograms(), getSettings()]);

  return (
    <>
      <JsonLd
        data={breadcrumbsLd([
          { name: copy.common.toHome, path: '/' },
          { name: copy.header.tabs.programs, path: '/programs' },
        ])}
      />
      <PageIntro>
        <PageTitle>
          <AccentTitle text={`${copy.programs.titleBefore}*${copy.programs.titleAccent}*`} />
        </PageTitle>
        <p className="mt-3.5 max-w-[640px] self-stretch text-base leading-normal text-muted">
          {copy.programs.lead}
        </p>
      </PageIntro>

      <section className={cn(container, 'flex flex-col gap-2.5 px-4 pt-6 lg:grid lg:grid-cols-2 lg:gap-4')}>
        <QuizBanner className="lg:col-span-2" />
        {programs.map((program) => (
          <ProgramCard key={program.slug} program={program} />
        ))}
        {programs.length === 0 && (
          <p className={cn(card, 'px-5 py-6 text-center text-base text-muted lg:col-span-2')}>
            {copy.programs.empty}
          </p>
        )}
      </section>

      <section className="mx-auto flex max-w-[1100px] flex-col gap-5 px-4 pt-14 lg:px-6 lg:pt-20">
        <SectionTitle center title={copy.programs.howTitle} lead={copy.programs.howLead} />
        <ol className={cn(card, 'flex flex-col lg:grid lg:grid-cols-3')}>
          {(settings.payments.finik
            ? [...copy.programs.how.slice(0, 2), copy.programs.howOnline]
            : copy.programs.how
          ).map((step, index) => (
            <li
              key={step.title}
              className={cn(
                'flex gap-3.5 px-[18px] py-5',
                index > 0 && 'border-t border-line-2 lg:border-t-0 lg:border-l',
              )}
            >
              <span className="flex size-8 flex-none items-center justify-center rounded-full bg-accent-soft text-[15px] font-semibold text-accent-ink">
                {index + 1}
              </span>
              <span className="flex flex-col gap-1 pt-1">
                <span className="text-[17px] leading-[1.3] font-semibold">{step.title}</span>
                <span className="text-base leading-normal text-muted">{step.text}</span>
              </span>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[15px]">
          <span className="text-muted">{copy.programs.notFound}</span>
          <TrackedLink
            href={waLink(settings.shop.whatsapp, GENERIC_QUESTION_MESSAGE)}
            event="whatsapp_click"
            place="programs"
            className="inline-flex h-11 items-center gap-1.5 font-semibold text-accent-ink"
          >
            {copy.programs.writeNurai}
            <ArrowRightIcon size={16} />
          </TrackedLink>
        </div>
      </section>

      <QuizStickyBar />
    </>
  );
}
