# Bom Beauty

Website and owner admin for a Korean professional skincare shop in Kyrgyzstan. Visitors pick a care program or product,
fill a short order form and land in a prefilled WhatsApp chat; every order is recorded in the admin.

Read before working: `docs/ARCHITECTURE.md` (system, flows, decisions), `docs/DATA-MODEL.md`, `docs/API.md`,
`docs/TASKS.md` (current milestone). A change to the schema, an endpoint or a decision updates the matching doc in the
same commit.

## Layout

```
frontend/          Next.js 16 App Router client site (RSC, ISR, SEO)
backend/           NestJS 11 API + BullMQ worker (--worker) + Prisma 7 + cli.ts
admin/             Vite 8 + React 19 SPA (shadcn/ui restyled to the design)
packages/shared/   zod schemas, enums, RU labels, money/currency, theme engine, quiz, WhatsApp texts, API client
packages/config/   tsconfig bases, ESLint, Prettier, tokens.css, fonts
infra/             compose files, Caddyfile, .env.example, backup scripts
design/            exported Claude Design files: read-only source of truth for UI
```

## Commands

```
pnpm dev                          compose up (postgres, redis, minio, mailpit) + all apps + worker
pnpm lint | typecheck | test      whole repo via turbo
pnpm --filter <pkg> <script>      one package (@bom/frontend | @bom/backend | @bom/admin | @bom/shared)
pnpm db:migrate | db:seed         Prisma migrate dev / idempotent seed
pnpm gen:api                      regenerate backend/openapi.json and packages/shared/src/api/schema.d.ts (commit both)
pnpm e2e                          Playwright specs in frontend/e2e and admin/e2e
pnpm --filter @bom/backend cli create-admin
```

Node 24 (see `.tool-versions`), pnpm via corepack (`packageManager` in `package.json`).

## Working rules

- Work milestone by milestone (`docs/TASKS.md`). Gate: lint, typecheck, tests green → `pnpm dev` → check in the browser →
  commit → 5-line status. Never skip the browser check for UI work.
- Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`).
- Add dependencies when needed (owner's go-ahead, 2026-10-17): boring, maintained libraries only, and record each in
  `docs/ARCHITECTURE.md` §14 in the same commit.
- The stack is fixed; no swaps without asking.
- No secrets in the repo. Every env var goes into `infra/.env.example` and the app's zod env schema.

## Design fidelity

- `design/Bom Beauty Prototype.dc.html` (site, phone) and `design/BomAdmin.dc.html` (admin) are the source of truth for
  layout, spacing, type, colours and copy. Desktop site layouts follow the desktop references noted in ARCHITECTURE §6.2.
- Where the design is silent, follow the brief's gap list (ARCHITECTURE §15 D1) and keep the same visual language.
- Ignore prototype chrome: the phone frame, demo side panel, theme switcher dots, heading-font switch, "Сбросить демо".
- Compare implemented screens with the design at 390 px and 1280 px before calling UI work done.

## Content and copy

- All user-facing copy is **Russian**. Single locale, no i18n library.
- Never invent real data. Seed data comes from the design (marked demo in `docs/HANDOFF.md`); gaps use `[...]`, and every
  new placeholder gets a HANDOFF line.
- No media in the repo: photos, videos and PDFs are uploaded by the owner through the admin after deploy. Every screen
  must look right with no images (placeholders). The one exception: the hero sakura decor in `frontend/public/decor`
  (ARCHITECTURE §15 D20).
- Copy taken verbatim from the design stays verbatim. Copy we write never uses em-dashes (—): colons, commas or shorter
  sentences instead.
- Tone: warm, short sentences, "вы".
- Static UI strings and validation texts: `frontend/src/content/copy.ts`, `admin/src/content/copy.ts`. Owner-editable
  texts come from content blocks and settings via the API.
- Shared zod schemas use message **codes** (`phone.invalid`); apps map codes to text in `copy.ts`.
- Money: `formatKgs`/`formatMoney` from shared (`5 900 сом`, `67 $`). Never `toLocaleString`.
- Phones: `normalizePhone` (E.164) before storing; `waLink` for WhatsApp links. WhatsApp texts only from `shared/whatsapp.ts`.

## TypeScript

- Strict everywhere, no `any` outside generated code, no non-null assertions to silence errors.
- Domain types come from `packages/shared` (`z.infer`). Never redefine a schema, enum or label in an app.
- Files kebab-case, components PascalCase, hooks `useX`.

## frontend rules

- Server Components by default; `'use client'` only for interactive leaves (sheets, quiz, player, currency, carousel).
- No component library on the site. Build components from the design; colours only through theme CSS variables
  (`var(--ac)` etc. via Tailwind tokens), never hard-coded hex, because the owner can change the theme.
- Prices always through `<Price kgs>` so currency switching works.
- Catalog and content pages work without JS: order buttons fall back to `wa.me` links, chips are links.
- Data only through `lib/api.ts` with cache tags; server fetches use `INTERNAL_API_URL`.
- Images only through `<BbImage>` (AVIF/WebP from pre-built variants), always with dimensions.
- Tap targets ≥ 44 px, every input labelled, visible focus states.
- Every list and form has loading, empty and error states.

## admin rules

- shadcn/ui primitives in `admin/src/components/ui`, restyled to the design; features in `admin/src/features/<name>`.
- Server state only via TanStack Query hooks in `admin/src/api`; query keys from one factory.
- Every mutation shows a toast; status changes are optimistic with rollback.
- Sidebar at ≥ 1024 px, top bar with scrolling tabs below, as in the design.

## backend rules

- One Nest module per domain; thin controllers; DTOs via `createZodDto` from shared schemas.
- Prisma: always `select` the needed fields.
- Never trust prices from the client: compute from the DB.
- Every admin mutation writes `AuditLog`; catalog/content/settings mutations enqueue `web.revalidate`.
- Logs: pino with request id; never log phones, names, addresses, cookies, tokens or signed URLs.

## Tests

- Vitest: shared helpers (money, currency, theme vars, quiz ranking parity with the design, phone, plural, slug, WhatsApp
  texts), order/lead creation, idempotency, auth guards, CSRF, dashboard and customer aggregation.
- Playwright smoke: home, catalog filter, order sheet (WhatsApp mocked), quiz, admin login + status change.
- Backend integration tests (`backend/test/`) run the real app against the `bom_test` database (migrated by the test
  global setup through `MIGRATE_DATABASE_URL`) and Redis db 15, so Docker services must be up. Each file re-seeds.
- A bug fix comes with a test that fails without it.
