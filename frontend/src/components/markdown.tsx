import Link from 'next/link';
import type { Route } from 'next';
import ReactMarkdown, { type Components } from 'react-markdown';

// Owner-edited markdown (delivery, legal pages). Raw HTML is not rendered (react-markdown's default), so the admin
// cannot inject scripts; links to our own pages use client navigation.

const components: Components = {
  h1: ({ children }) => (
    <h2 className="mt-8 heading text-[calc(26px*var(--fhk))] leading-[1.15] first:mt-0">{children}</h2>
  ),
  h2: ({ children }) => (
    <h2 className="mt-8 heading text-[calc(24px*var(--fhk))] leading-[1.2] first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => <h3 className="mt-6 text-lg font-semibold">{children}</h3>,
  p: ({ children }) => <p className="mt-3 text-base leading-[1.6] text-pretty text-muted">{children}</p>,
  ul: ({ children }) => (
    <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-base leading-[1.55] text-muted">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mt-3 flex list-decimal flex-col gap-1.5 pl-5 text-base leading-[1.55] text-muted">
      {children}
    </ol>
  ),
  strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
  hr: () => <hr className="my-8 border-line-2" />,
  a: ({ href = '', children }) =>
    href.startsWith('/') ? (
      <Link href={href as Route} className="font-semibold text-accent-ink underline underline-offset-2">
        {children}
      </Link>
    ) : (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-accent-ink underline underline-offset-2"
      >
        {children}
      </a>
    ),
};

export function Markdown({ children }: { children: string }) {
  return <ReactMarkdown components={components}>{children}</ReactMarkdown>;
}

/** Leading "# Title" of a markdown page, if any, and the rest of the text. */
export function splitTitle(markdown: string): { title: string | null; body: string } {
  const match = /^\s*#\s+(.+)\n?/.exec(markdown);
  return match
    ? { title: match[1]?.trim() ?? null, body: markdown.slice(match[0].length) }
    : { title: null, body: markdown };
}
