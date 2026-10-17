# Tasks

Every milestone ends with the same gate:

> lint · typecheck · tests green → `pnpm dev` starts everything → checked in the browser → conventional commit →
> 5-line status. No milestone starts before the previous one passes its gate.

## M0 Plan and scaffold

Phase 0

- [x] Docs: ARCHITECTURE, DATA-MODEL, API, TASKS, HANDOFF; root CLAUDE.md
- [x] Open questions answered (Node 24, Next 16, design wins, quiz only, Bunny Stream, design seed, WhatsApp +996706304803)
- [x] Design imported: `Bom Beauty Prototype.dc.html`, `BomAdmin.dc.html`, `support.js`, `image-slot.js`, logos, 5 photos
- [x] Design assets: skipped by decision; the owner uploads all media through the admin after deploy

Scaffold

- [x] `.tool-versions` / `.nvmrc` (Node 24), `packageManager` (pnpm 10), `pnpm-workspace.yaml`, `turbo.json`, root scripts
- [x] `.gitignore`, `.editorconfig`, `prettier.config.mjs`, `.prettierignore`, `.gitattributes`
- [x] `packages/config`: tsconfig bases, ESLint flat presets, Prettier config, `styles/site.css` + `styles/admin.css` (Tailwind v4 `@theme`), self-hosted fonts
- [x] `packages/shared`: tsup build, enums, labels, money, currency, theme engine, quiz ranking, WhatsApp messages, phone, plural, slug, Vitest tests
- [x] `backend`: Nest 11, zod env, pino, `/health`, `--worker` entry, `cli.ts` stub, Vitest with SWC
- [x] `frontend`: Next 16 App Router, Tailwind v4 tokens, fonts, `lang="ru"`, theme vars on `<html>`, `/health`, placeholder home in the design's header/hero
- [x] `admin`: Vite 8 + React 19 + React Router 7 + TanStack Query + Tailwind v4 + shadcn/ui setup, placeholder shell with the design's sidebar
- [x] `infra/docker-compose.yml`: postgres 16, redis 7, SeaweedFS S3 + init (buckets, CORS, public read; MinIO images are no longer published), Mailpit
- [x] `infra/.env.example` + zod env validation in each app
- [x] `pnpm dev` = compose up (wait healthy) + shared watch + api (worker runs in-process in dev) + site + admin
- [x] Gate + `chore: scaffold monorepo` → **stop for review**

## M1 Backend core

- [x] Prisma schema per DATA-MODEL, first migration (order number sequence from 1001, CHECKs), indexes
- [x] Idempotent seed from the design data (products, categories, brands, programs, steps, settings, content, demo orders/leads in dev)
- [x] Shared zod schemas: order and lead create, catalog responses, settings and content per key
- [x] Auth: argon2id, DB sessions (hashed ids), cookie, HMAC CSRF token, Origin check, roles guard, login throttling + lockout
- [x] `cli create-admin`, `cli reset-password`
- [x] Public catalog: categories, products, programs (with steps, sums), brands, sitemap, redirects resolve
- [x] `GET /content/:key`, `GET /reviews` (demo logic), `GET /settings/public`
- [x] `POST /orders` (server prices, phone normalisation, clientRef idempotency, honeypot), `POST /leads/quiz` + `POST /leads/wholesale` (quiz recommendation recomputed)
- [x] Throttler with real-IP extraction
- [x] OpenAPI + `pnpm gen:api` + typed fetch client
- [x] Tests: schemas, money/currency, theme vars, quiz ranking parity with the design, phone, order and lead creation, idempotency, auth guards, CSRF
- [x] Gate + `feat(backend): core api, auth, catalog, orders`

## M2 Client site

- [ ] Layout: header (logo, currency picker, WhatsApp, tabs), footer, theme vars from settings, sticky bars
- [ ] Base components from the design (chips, cards, buttons, sheets, dialogs, stepper, badges); `BbImage`, `Price`
- [ ] `content/copy.ts` with every static string and validation text
- [ ] Pages: `/`, `/programs`, `/programs/[slug]`, `/catalog`, `/catalog/[slug]`, `/wholesale`, `/delivery`, `/privacy`, `/offer`, not-found, error
- [ ] Order sheet (form, validation, keepalive POST + outbox, WhatsApp open, done state, "Открыть ещё раз")
- [ ] Quiz overlay (4 steps, ranking, results, WhatsApp hand-off with lead, "К результатам теста" pill)
- [ ] Wholesale price sheet (buyer kind, country, ETA, lead + WhatsApp), catalog PDF download, call
- [ ] Reviews carousel + lightbox; video player with custom controls and end card (Bunny URLs or placeholder until M5)
- [ ] Currency switching from settings rates; UTM + referrer capture
- [ ] Desktop layouts (≥ 1024 px) per the desktop references
- [ ] SEO: metadata, canonical, sitemap, robots, OG images, JSON-LD
- [ ] `/api/revalidate`, redirect lookup on not-found; Umami + optional Meta Pixel
- [ ] Skeletons, empty and error states
- [ ] Lighthouse mobile (home, programs, program, catalog, product): Perf ≥ 90, SEO 100, A11y ≥ 95, report in `docs/lighthouse/`
- [ ] Gate + `feat(frontend): client site`

## M3 Admin: orders and overview

- [ ] Login, `/auth/me` bootstrap, CSRF header, 401 handling, role-aware nav, sidebar/topbar layout from the design
- [ ] Обзор: period tabs, 4 cards, recent orders, orders by program
- [ ] Заказы: tabs with counts, search, status select, WhatsApp button, detail drawer with note, CSV export, delete (owner)
- [ ] Nav counter polling (15 s) and refetch on focus
- [ ] Заявки (quiz, wholesale) list
- [ ] Клиенты aggregation
- [ ] Tests: status changes, export format, customers aggregation, role restrictions
- [ ] Gate + `feat(admin): orders, overview, customers`

## M4 Admin: catalog, content, appearance

- [ ] Товары: categories (add, delete empty), table with stock toggle, editor (all fields, brand autocomplete, 3 photos, badge, publish, SEO, slug)
- [ ] Программы: list (video/protocol/publish status), editor (basics, fit list, ordered items with catalog picker, steps, price with savings, quiz matching, publish/stock, protocol PDF, video slot)
- [ ] Оптовикам editor (all `wholesale` content, featured products, delivery table, catalog PDF, video slot)
- [ ] Отзывы: multi-upload, drag and drop, order, hide/show, delete, demo banner
- [ ] Тексты: home, delivery + FAQ, privacy, offer
- [ ] Оформление: presets, header and accent swatches + custom colour, contrast warnings, currencies, live preview
- [ ] Настройки: shop, notifications (+ test), SEO/analytics, users, audit log, revoke sessions
- [ ] Revalidation of the site on every save (verified end to end); redirects on slug change
- [ ] Gate + `feat(admin): catalog, content, appearance, settings`

## M5 Media, video and jobs

- [ ] Spike: presigned POST + CORS against a real Hetzner bucket (fallback presigned PUT)
- [ ] BullMQ queues, worker, schedules (Asia/Bishkek), failure logging
- [ ] `media.process` (variants, blur, metadata strip, HEIC fallback, PDF publish)
- [ ] Bunny Stream: create + TUS signature, admin upload with progress (`tus-js-client` pending approval), webhook + `video.sync`, player wiring
- [ ] `notify.telegram`, `notify.email`, `uploads.cleanup`, `sessions.cleanup`, `web.revalidate`, `indexnow.submit`
- [ ] Tests: variant generation, EXIF removal (fixture with GPS), Bunny signature, notification formatting
- [ ] Gate + `feat(backend): media, video, jobs`

## M6 Hardening

- [ ] Anti-spam review (honeypot, limits, optional Turnstile)
- [ ] Security headers and CSP (Caddy + Next), cookie flags in prod mode, CORS review
- [ ] Error pages and empty states audit
- [ ] Accessibility pass (focus, labels, 44 px targets, contrast incl. owner-chosen colours, keyboard paths, screen reader on sheets and quiz)
- [ ] Playwright e2e: home, catalog filter, product order sheet (WhatsApp mocked), quiz, admin login + status change
- [ ] Performance pass: bundles, images, video lazy load, API p95
- [ ] Gate + `fix: hardening pass`

## M7 Deploy

- [ ] Dockerfiles (multi-stage, non-root): web standalone, api/worker, admin static
- [ ] `docker-compose.prod.yml`, `Caddyfile` (hosts, Cloudflare trusted proxies, origin cert, headers, `/s/*` Umami, media proxy)
- [ ] `ci.yml` (lint, typecheck, test with services, build, OpenAPI drift) and `deploy.yml` (GHCR, SSH, migrate, up, health)
- [ ] Backups: nightly `pg_dump`, weekly bucket sync, 30-day retention, `infra/scripts/restore.md` tested once
- [ ] Umami, optional Uptime Kuma
- [ ] `docs/DEPLOY.md`, final `docs/HANDOFF.md`, first production deploy checklist
- [ ] Gate + `chore(infra): production deploy`
