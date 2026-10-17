import type { ReactNode } from 'react';
import { copy } from '@/content/copy';
import { useUser } from './auth';

/** Owner-only screens show a short note to managers instead (the API refuses them anyway). */
export function OwnerOnly({ children }: { children: ReactNode }) {
  const user = useUser();
  if (user.role === 'owner') return <>{children}</>;
  return <p className="text-[15px] text-muted">{copy.errors.forbidden}</p>;
}
