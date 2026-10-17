import { GENERIC_QUESTION_MESSAGE, waLink } from '@bom/shared';
import Link from 'next/link';
import { SiteHeader } from '@/components/site-header';
import { copy } from '@/content/copy';

// M0 placeholder: header and hero from the design to check tokens and fonts. Full home page in M2.
const SHOP_WHATSAPP = '+996706304803';

export default function HomePage() {
  const hero = copy.homeFallback;

  return (
    <div className="mx-auto min-h-dvh max-w-[1100px] bg-bg">
      <SiteHeader whatsappHref={waLink(SHOP_WHATSAPP, GENERIC_QUESTION_MESSAGE)} />
      <section className="flex flex-col items-center bg-[image:var(--hbg)] px-5 pt-[26px] pb-[30px] text-center">
        <div className="mb-[22px] flex flex-col items-center gap-5">
          <div
            aria-hidden="true"
            className="size-24 rounded-[28px] bg-accent-soft shadow-[0_24px_40px_-18px_rgba(20,20,43,.5)]"
          />
          <span className="inline-flex h-8 items-center gap-2 rounded-full bg-accent-soft px-3.5 text-sm font-semibold text-accent-ink">
            <span className="size-[7px] rounded-full bg-stock" />
            {hero.badge}
          </span>
        </div>
        <h1 className="self-stretch heading text-[calc(var(--h1s)*var(--fhk))] leading-[1.06] text-hero-ink">
          {hero.titleBefore}
          <span className="text-highlight accent-word">{hero.titleAccent}</span>
          {hero.titleAfter}
        </h1>
        <p className="mt-2.5 self-stretch text-base leading-normal text-hero-muted">{hero.subtitle}</p>
        <Link
          href="/programs"
          className="mt-[26px] flex h-[58px] items-center justify-center gap-3 self-stretch rounded-button border-2 border-accent bg-surface px-[22px] text-[17px] font-semibold text-accent hover:bg-accent-soft"
        >
          {copy.hero.toPrograms}
        </Link>
        <p className="mt-[22px] self-stretch text-[15px] leading-[1.45] text-hero-muted">{hero.quizPrompt}</p>
        <Link
          href="/programs"
          className="mt-3 flex h-14 items-center justify-center gap-2.5 self-stretch rounded-button bg-accent px-3 text-base font-semibold text-white shadow-[0_16px_30px_-14px_var(--acsh)]"
        >
          {copy.hero.toQuiz}
        </Link>
      </section>
    </div>
  );
}
