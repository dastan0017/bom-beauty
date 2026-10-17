import { ApiError, createApiClient } from '@bom/shared/api';
import { env } from '@/env';

// Typed client for the admin API (session cookie + X-CSRF-Token on mutations, docs/API.md §2).

let csrfToken: string | null = null;
let onUnauthenticated: () => void = () => undefined;

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

/** Called once by the auth provider: a 401 anywhere sends the user back to the login screen. */
export function setUnauthenticatedHandler(handler: () => void): void {
  onUnauthenticated = handler;
}

export const api = createApiClient({
  apiUrl: env.VITE_API_URL,
  credentials: 'include',
  getCsrfToken: () => csrfToken,
});

/** Unwraps an openapi-fetch result: returns data or throws ApiError (and handles an expired session). */
export async function unwrap<R extends { data?: unknown; error?: unknown; response: Response }>(
  call: Promise<R>,
): Promise<NonNullable<R['data']>> {
  const { data, error, response } = await call;
  if (response.ok) return data as NonNullable<R['data']>;
  const apiError = ApiError.from(response.status, error);
  if (response.status === 401) onUnauthenticated();
  throw apiError;
}

/** GET that returns a file (CSV export) as a Blob, with the same error handling. */
export async function download(path: string): Promise<Blob> {
  const response = await fetch(`${env.VITE_API_URL}${path}`, { credentials: 'include' });
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    if (response.status === 401) onUnauthenticated();
    throw ApiError.from(response.status, body);
  }
  return response.blob();
}

export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export { ApiError };
