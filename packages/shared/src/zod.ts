import { z } from 'zod';

// Browsers run zod without its eval-based JIT. Both apps' CSPs forbid 'unsafe-eval', and zod probes `Function('')` as
// soon as it builds an object schema, which the browser reports as a CSP violation. Servers keep the faster JIT path.
// Every schema module imports `z` from here, so this runs before any schema is built.
if ('window' in globalThis) z.config({ jitless: true });

export { z };
