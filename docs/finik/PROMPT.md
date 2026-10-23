Add online payment through Finik to this project (milestone M9).

Spec: `docs/finik/SPEC.md`. Read all of it first, then `CLAUDE.md` and `docs/ARCHITECTURE.md`, `DATA-MODEL.md`,
`API.md`, `TASKS.md`, `DEPLOY.md`. The spec holds everything verified from Finik's documentation: the signing
algorithm, the create-payment and webhook formats, Finik's public keys, two signed test vectors, and the design for
this codebase. You should not need Finik's site; if you do open it, the code tabs (Python, PHP, other languages) live
in the page's JavaScript bundle, not in its HTML.

The shop owner has a working Finik business account. Her API key, account ID and our RSA private key are not in the
repo and must never be: they go into the server's `.env` after review (spec §10). Build and test everything with
`FINIK_ENV=mock` and keys generated inside the tests.

1. Explore the repo, map every spec section to the files you will touch, and show me the plan before editing. Call
   out anything in the spec that does not fit the code as it is now.
2. Build in this order, keeping tests green at each step:
   1. The signer (§2.3) and its unit tests on Finik's two published vectors (§2.8). Nothing calls Finik until both
      vectors verify.
   2. Shared: enums, labels, schemas, the `payments` setting, the WhatsApp builders (§4, §5.3, §7.3).
   3. Backend (§5): migration, env, Finik client, mock mode, order creation, public payment endpoints, webhook, expiry
      job, notifications, admin endpoints. Then `pnpm gen:api`.
   4. Site (§6): order sheet, `/payment/[id]`, pending payment record, wording that depends on online payment.
   5. Admin (§7): orders list and drawer, «Настройки → Оплата».
   6. Tests (§8), docs (§9), `infra/.env.example`. Copy the new `FINIK_*` lines into my local root `.env` too.
3. Hard rules:
   - Do not add `@mancho.devs/authorizer` or any payment SDK: sign and verify with `node:crypto` (§2.4).
   - Verify webhooks against the raw request body, never against a zod-parsed or DTO body (§2.6, §5.7).
   - Amounts come only from the database, in сом. Only a verified webhook marks an order paid.
   - Never log keys, signatures, payment URLs, webhook bodies or personal data.
   - With online payment off or not configured, the site must behave exactly as it does today.
   - `FINIK_ENV=mock` must be impossible in production.
   - The real Finik key pair may sit in the git-ignored `finik/` folder at the repo root. Never open, print, copy,
     move or commit anything from it.
   - Copy is Russian with «вы»; text from the design stays verbatim; new text never uses em-dashes.
   - Do not touch production, the server `.env` or GitHub settings.
4. Gate (CLAUDE.md): `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm format:check` green → `pnpm dev` → check
   the whole flow in the browser at 390 px and 1280 px (cart and program orders paid online, the Finik-error and
   back-button paths, every status page state, the admin chip, drawer, settings tab and connection check) →
   `pnpm e2e` → commit `feat: online payment with Finik (M9)`.
5. Finish with the 5-line status, then list: deviations from the spec and why, what you could not verify without real
   Finik credentials, and what the owner and Finik still need to provide (spec §11).
