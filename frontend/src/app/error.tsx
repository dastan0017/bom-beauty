'use client';

import { GENERIC_QUESTION_MESSAGE, waLink } from '@bom/shared';
import { useEffect } from 'react';
import { WhatsAppIcon } from '@/components/icons';
import { useOverlays } from '@/components/overlays/site-overlays';
import { outlineButton, primaryButton } from '@/components/ui';
import { copy } from '@/content/copy';
import { cn } from '@/lib/cn';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { whatsapp } = useOverlays();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="mx-auto flex max-w-[560px] flex-col items-center px-5 pt-16 text-center lg:pt-24">
      <h1 className="heading text-[calc(30px*var(--fhk))] leading-[1.1]">{copy.error.title}</h1>
      <p className="mt-3 text-base leading-normal text-balance text-muted">{copy.error.text}</p>
      <div className="mt-8 flex w-full flex-col gap-3">
        <button type="button" onClick={reset} className={cn(primaryButton, 'h-14 text-base')}>
          {copy.error.retry}
        </button>
        <a
          href={waLink(whatsapp, GENERIC_QUESTION_MESSAGE)}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(outlineButton, 'h-14 text-base')}
        >
          <WhatsAppIcon size={18} className="text-whatsapp" />
          {copy.programs.writeNurai}
        </a>
      </div>
    </section>
  );
}
