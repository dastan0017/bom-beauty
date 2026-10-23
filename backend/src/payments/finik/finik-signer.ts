import { sign, verify, type KeyObject } from 'node:crypto';

// Finik's request signature (docs/finik/SPEC.md §2.3), written on node:crypto instead of @mancho.devs/authorizer,
// which logs the API key and request bodies. Byte-for-byte equal to Finik's signer: both of Finik's published
// webhook samples verify with it (finik-signer.test.ts).

export interface CanonicalRequest {
  method: string;
  /** Path without the query string: "/v1/payment", "/v1/webhooks/finik". */
  path: string;
  /** Host header value exactly as sent or received. */
  host: string;
  /** Request headers; only names starting with "x-api-" are signed. */
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, string | undefined> | null;
  body: Record<string, unknown> | null;
}

/** Top-level keys sorted like Finik's signer (localeCompare); nested objects keep their key order. */
export function sortTopLevel(body: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(body).sort(([a], [b]) => a.localeCompare(b, 'en')));
}

/** method \n path \n host:…&x-api-…:… [\n query] \n JSON body (top level sorted). */
export function canonicalString(request: CanonicalRequest): string {
  const apiHeaders = Object.keys(request.headers)
    .filter((name) => name.toLowerCase().startsWith('x-api-'))
    .sort()
    .map((name) => {
      const value = request.headers[name];
      if (typeof value !== 'string') throw new Error(`Header ${name} has no single value`);
      return `${name.toLowerCase()}:${value}`;
    });
  const query = Object.keys(request.query ?? {})
    .sort()
    .map((key) => `${encodeURI(decodeURI(key))}=${encodeURI(decodeURI(request.query?.[key] ?? ''))}`)
    .join('&');
  return [
    request.method.toLowerCase(),
    decodeURI(request.path),
    [`host:${request.host}`, ...apiHeaders].join('&'),
    ...(query ? [query] : []),
    request.body ? JSON.stringify(sortTopLevel(request.body)) : '',
  ].join('\n');
}

/** Base64 RSA-SHA256 (PKCS#1 v1.5) signature of the canonical string. */
export const signCanonical = (data: string, privateKey: KeyObject): string =>
  sign('sha256', Buffer.from(data, 'utf8'), privateKey).toString('base64');

export function verifyCanonical(data: string, signature: string, publicKey: KeyObject): boolean {
  try {
    return verify('sha256', Buffer.from(data, 'utf8'), publicKey, Buffer.from(signature, 'base64'));
  } catch {
    return false;
  }
}
