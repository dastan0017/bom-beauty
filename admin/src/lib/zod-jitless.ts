import { z } from 'zod';

// The admin's CSP has no 'unsafe-eval'. Without this, zod probes `Function('')` on the first object parse to decide on
// JIT-compiled validators, and the browser reports a CSP violation. Imported first in main.tsx.
z.config({ jitless: true });
