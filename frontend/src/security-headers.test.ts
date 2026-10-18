import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy, securityHeaders } from './security-headers';

const PROD = {
  api: 'https://api.bom-beauty.com/v1',
  media: 'https://media.bom-beauty.com',
  site: 'https://bom-beauty.com',
  dev: false,
};
const LOCAL = {
  api: 'http://localhost:4000/v1',
  media: 'http://localhost:9000/bom-public',
  site: 'http://localhost:3100',
};

const directive = (csp: string, name: string) =>
  csp
    .split('; ')
    .find((part) => part.startsWith(`${name} `) || part === name)
    ?.split(' ')
    .slice(1);

describe('site security headers', () => {
  it('limits the production CSP to the hosts the site uses', () => {
    const csp = contentSecurityPolicy(PROD);
    expect(directive(csp, 'connect-src')).toContain('https://api.bom-beauty.com');
    expect(directive(csp, 'img-src')).toContain('https://media.bom-beauty.com');
    expect(directive(csp, 'media-src')).toContain('https://*.b-cdn.net');
    expect(directive(csp, 'frame-src')).toEqual(['https://challenges.cloudflare.com']);
    expect(directive(csp, 'frame-ancestors')).toEqual(["'none'"]);
    expect(directive(csp, 'object-src')).toEqual(["'none'"]);
    expect(directive(csp, 'upgrade-insecure-requests')).toEqual([]);
    expect(csp).not.toContain('unsafe-eval');
    expect(csp).not.toContain('ws:');
  });

  it('relaxes only what the dev server needs', () => {
    const csp = contentSecurityPolicy({ ...LOCAL, dev: true });
    expect(directive(csp, 'script-src')).toContain("'unsafe-eval'");
    expect(directive(csp, 'connect-src')).toEqual(
      expect.arrayContaining(['ws:', 'http://localhost:4000', 'http://localhost:9000']),
    );
  });

  it('keeps a local production run on http', () => {
    const csp = contentSecurityPolicy({ ...LOCAL, dev: false });
    expect(directive(csp, 'upgrade-insecure-requests')).toBeUndefined();
    expect(csp).not.toContain('unsafe-eval');
  });

  it('sends the hardening headers', () => {
    const keys = securityHeaders(PROD).map((header) => header.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        'Content-Security-Policy',
        'X-Content-Type-Options',
        'X-Frame-Options',
        'Referrer-Policy',
        'Permissions-Policy',
      ]),
    );
  });
});
