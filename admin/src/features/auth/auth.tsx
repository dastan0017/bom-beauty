import type { AuthSession, SessionUser } from '@bom/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, use, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Button, Field, inputClass } from '@/components/ui';
import { copy } from '@/content/copy';
import { api, ApiError, setCsrfToken, setUnauthenticatedHandler, unwrap } from '@/lib/api';

const ME_KEY = ['me'] as const;

const SessionContext = createContext<SessionUser | null>(null);

/** The signed-in user (only rendered inside AuthGate, so never null there). */
export function useUser(): SessionUser {
  const user = use(SessionContext);
  if (!user) throw new Error('useUser outside AuthGate');
  return user;
}

async function fetchMe(): Promise<AuthSession | null> {
  try {
    const session = await unwrap(api.GET('/v1/auth/me'));
    setCsrfToken(session.csrfToken);
    return session;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

/** Bootstraps the session from /auth/me; shows the login screen when there is none. */
export function AuthGate({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ME_KEY, queryFn: fetchMe, staleTime: Infinity, retry: false });

  useEffect(() => {
    setUnauthenticatedHandler(() => {
      setCsrfToken(null);
      queryClient.setQueryData(ME_KEY, null);
    });
  }, [queryClient]);

  if (me.isPending) return <Splash>{copy.loading}</Splash>;
  if (me.isError) {
    return (
      <Splash>
        <span>{copy.errors.load}</span>
        <Button variant="outline" onClick={() => void me.refetch()}>
          {copy.retry}
        </Button>
      </Splash>
    );
  }
  if (!me.data) return <LoginPage />;
  return <SessionContext value={me.data.user}>{children}</SessionContext>;
}

function Splash({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg text-[15px] text-muted">
      {children}
    </div>
  );
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.POST('/v1/auth/logout')),
    onSettled: () => {
      setCsrfToken(null);
      // Null session first (the gate shows the login screen), then forget everything else that was loaded.
      queryClient.setQueryData(ME_KEY, null);
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== ME_KEY[0] });
    },
  });
}

function LoginPage() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const login = useMutation({
    mutationFn: () => unwrap(api.POST('/v1/auth/login', { body: { email, password, remember } })),
    onSuccess: (session) => {
      setCsrfToken(session.csrfToken);
      queryClient.setQueryData(ME_KEY, session);
    },
  });

  const error = login.error
    ? login.error instanceof ApiError && login.error.status === 429
      ? copy.login.locked
      : login.error instanceof ApiError && (login.error.status === 401 || login.error.status === 400)
        ? copy.login.wrong
        : copy.errors.generic
    : null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!login.isPending) login.mutate();
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-5 py-10">
      <form
        onSubmit={submit}
        className="flex w-full max-w-[400px] flex-col gap-5 rounded-card border border-line bg-surface p-7"
      >
        <div className="flex flex-col items-start gap-3">
          <img src="/brand/bom-lockup-full.png" alt={copy.brand.logoAlt} className="block h-6 w-auto" />
          <h1 className="text-2xl font-semibold tracking-[-0.03em]">{copy.login.title}</h1>
        </div>
        <Field label={copy.login.email}>
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label={copy.login.password}>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={inputClass}
          />
        </Field>
        <label className="flex items-center gap-2.5 text-[15px]">
          <input
            type="checkbox"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
            className="size-[18px] accent-ink"
          />
          {copy.login.remember}
        </label>
        {error && (
          <p role="alert" className="rounded-control bg-red-soft px-3.5 py-2.5 text-sm text-red">
            {error}
          </p>
        )}
        <Button type="submit" disabled={login.isPending} className="h-12">
          {login.isPending ? copy.login.submitting : copy.login.submit}
        </Button>
      </form>
    </main>
  );
}
