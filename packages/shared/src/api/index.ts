import createClient, { type Client, type Middleware } from 'openapi-fetch';
import { errorResponseSchema, type ErrorCode } from '../schemas/common';
import type { paths } from './schema';

export type { components, operations, paths } from './schema';

/** An API error in the shape of docs/API.md §1. `fields` holds message codes for validation errors. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly fields: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static from(status: number, body: unknown): ApiError {
    const parsed = errorResponseSchema.safeParse(body);
    if (parsed.success) {
      const { code, message, fields } = parsed.data.error;
      return new ApiError(status, code, message, fields);
    }
    return new ApiError(status, status >= 500 ? 'internal' : 'validation_failed', `HTTP ${status}`);
  }
}

export interface ApiClientOptions {
  /** e.g. "http://localhost:4000/v1" (the `/v1` is part of the generated paths and is stripped here). */
  apiUrl: string;
  /** "include" for the admin (session cookie); omit for the public site. */
  credentials?: RequestInit['credentials'];
  /** Admin: current CSRF token, sent as X-CSRF-Token on mutations. */
  getCsrfToken?: () => string | null;
  fetch?: typeof fetch;
}

export type ApiClient = Client<paths>;

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Typed client generated from the backend's OpenAPI document (pnpm gen:api). */
export function createApiClient(options: ApiClientOptions): ApiClient {
  const client = createClient<paths>({
    baseUrl: options.apiUrl.replace(/\/v1\/?$/, ''),
    ...(options.credentials ? { credentials: options.credentials } : {}),
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });
  const { getCsrfToken } = options;
  if (getCsrfToken) {
    const csrf: Middleware = {
      onRequest({ request }) {
        const token = getCsrfToken();
        if (token && !SAFE_METHODS.has(request.method)) request.headers.set('X-CSRF-Token', token);
        return request;
      },
    };
    client.use(csrf);
  }
  return client;
}
