import type { Route } from 'next';
import { notFound, permanentRedirect, redirect } from 'next/navigation';
import { resolveRedirect } from '@/lib/data';

// Any path no route matches: old URLs from the admin's redirect list move on, everything else is a 404.
export default async function MissingPage({ params }: { params: Promise<{ missing: string[] }> }) {
  const { missing } = await params;
  const path = `/${missing.map((segment) => encodeURIComponent(decodeURIComponent(segment))).join('/')}`;
  const target = await resolveRedirect(path).catch(() => null);
  if (target)
    (target.statusCode === 301 || target.statusCode === 308 ? permanentRedirect : redirect)(
      target.toPath as Route,
    );
  notFound();
}
