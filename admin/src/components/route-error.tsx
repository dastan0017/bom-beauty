import { useRouteError } from 'react-router';
import { copy } from '@/content/copy';
import { cn } from '@/lib/utils';
import { Button, Spinner } from './ui';

/**
 * Shown when a screen fails to render or its code fails to load (e.g. an old tab after a deploy).
 * Inside the shell it replaces the page only; at the root it fills the window.
 */
export function RouteError({ fullPage = false }: { fullPage?: boolean }) {
  const error = useRouteError();
  console.error(error);
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col gap-3',
        fullPage ? 'min-h-dvh items-center justify-center px-4 text-center' : 'max-w-[560px] py-6',
      )}
    >
      <h1 className="text-[30px] leading-[1.15] font-semibold tracking-[-0.03em]">{copy.crash.title}</h1>
      <p className="text-[15px] leading-normal text-muted">{copy.crash.text}</p>
      <Button onClick={() => window.location.reload()} className={fullPage ? '' : 'self-start'}>
        {copy.crash.reload}
      </Button>
    </div>
  );
}

/** First load while the current screen's code arrives. */
export function RouteLoading() {
  return (
    <div className="flex min-h-dvh items-center justify-center text-muted">
      <Spinner />
    </div>
  );
}
