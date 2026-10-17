import type { ReactNode } from 'react';
import { Markdown, splitTitle } from './markdown';
import { card, PageIntro, PageTitle } from './ui';
import { cn } from '@/lib/cn';

/** Delivery and legal pages: the site's intro block and a card with owner-edited markdown. */
export function TextPage({
  fallbackTitle,
  markdown,
  children,
}: {
  fallbackTitle: string;
  markdown: string;
  children?: ReactNode;
}) {
  const { title, body } = splitTitle(markdown);
  return (
    <>
      <PageIntro className="max-w-[760px]">
        <PageTitle>{title ?? fallbackTitle}</PageTitle>
      </PageIntro>
      <div className="mx-auto max-w-[760px] px-4 pt-6">
        {body.trim() && (
          <article className={cn(card, 'px-5 pt-3 pb-6 lg:px-8 lg:pt-5 lg:pb-8')}>
            <Markdown>{body}</Markdown>
          </article>
        )}
        {children}
      </div>
    </>
  );
}
