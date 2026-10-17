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

- [x] Layout: header (logo, currency picker, WhatsApp, tabs), footer, theme vars from settings, sticky bars
- [x] Base components from the design (chips, cards, buttons, sheets, dialogs, stepper, badges); `BbImage`, `Price`
- [x] `content/copy.ts` with every static string and validation text
- [x] Pages: `/`, `/programs`, `/programs/[slug]`, `/catalog`, `/catalog/[slug]`, `/wholesale`, `/delivery`, `/privacy`, `/offer`, not-found, error
- [x] Order sheet (form, validation, keepalive POST + outbox, WhatsApp open, done state, "Открыть ещё раз")
- [x] Quiz overlay (4 steps, ranking, results, WhatsApp hand-off with lead, "К результатам теста" pill)
- [x] Wholesale price sheet (buyer kind, country, ETA, lead + WhatsApp), catalog PDF download, call
- [x] Reviews carousel + lightbox; video player with custom controls and end card (Bunny URLs or placeholder until M5)
- [x] Currency switching from settings rates; UTM + referrer capture
- [x] Desktop layouts (≥ 1024 px) per the desktop references
- [x] SEO: metadata, canonical, sitemap, robots, OG images, JSON-LD
- [x] `/api/revalidate`, redirect lookup on not-found; Umami + optional Meta Pixel
- [x] Empty and error states; no skeleton screens (pages render in < 50 ms and a root `loading.tsx` delayed LCP, see
      `docs/lighthouse/2026-10-17-m2.md`)
- [x] Lighthouse mobile (home, programs, program, catalog, product): Perf ≥ 90, SEO 100, A11y ≥ 95, report in `docs/lighthouse/`
- [x] Playwright flows in `frontend/e2e` (order, program order, quiz, wholesale, currency, 404) on phone and desktop
- [x] Gate + `feat(frontend): client site`

## M3 Admin: orders and overview

- [x] Login, `/auth/me` bootstrap, CSRF header, 401 handling, role-aware nav, sidebar/topbar layout from the design
- [x] Обзор: period tabs, 4 cards, recent orders, orders by program
- [x] Заказы: tabs with counts, search, status select, WhatsApp button, detail drawer with note, CSV export, delete (owner)
- [x] Nav counter polling (15 s) and refetch on focus
- [x] Заявки (quiz, wholesale) list
- [x] Клиенты aggregation
- [x] Tests: status changes, export format, customers aggregation, role restrictions (`backend/test/admin.test.ts`)
- [x] Playwright flows in `admin/e2e` (login error, status change, note and history, leads, customers, logout)
- [x] Gate + `feat(admin): orders, overview, customers`

## M4 Admin: catalog, content, appearance

- [x] Товары: categories (add, delete empty), table with stock toggle, editor (all fields, brand autocomplete, 3 photos, badge, publish, SEO, slug)
- [x] Программы: list (video/protocol/publish status), editor (basics, fit list, ordered items with catalog picker, steps, price with savings, quiz matching, publish/stock, protocol PDF, video slot)
- [x] Оптовикам editor (all `wholesale` content, featured products, delivery table, catalog PDF, video slot)
- [x] Отзывы: multi-upload, drag and drop, order, hide/show, delete, demo banner
- [x] Тексты: home, delivery + FAQ, privacy, offer
- [x] Оформление: presets, header and accent swatches + custom colour, contrast warnings, currencies, live preview
- [x] Настройки: shop, notifications (+ test), SEO/analytics, users, audit log, revoke sessions
- [x] Revalidation of the site on every save (verified end to end); redirects on slug change
- [x] Media slots show current files and processing state; uploading photos, PDFs, videos and review screenshots is wired
      in M5 with the media pipeline, as is the notifications test button
- [x] Tests: `backend/test/admin-catalog.test.ts` (categories, products, programs, reviews, content, settings, users,
      revalidation calls), `admin/e2e` product flow
- [x] Gate + `feat(admin): catalog, content, appearance, settings`

## M5 Media, video and jobs

- [x] Spike: presigned POST + CORS (passed on SeaweedFS; a real Hetzner bucket is re-checked in M7, no account yet)
- [x] BullMQ queues, worker, schedules (Asia/Bishkek), failure logging
- [x] `media.process` (variants, blur, metadata strip, HEIC fallback, PDF publish)
- [x] Bunny Stream: create + TUS signature, admin upload with progress (`tus-js-client`), webhook + `video.sync`, player wiring
- [x] `notify.telegram`, `notify.email`, `uploads.cleanup`, `sessions.cleanup`, `web.revalidate`, `indexnow.submit`
- [x] Admin uploads: product photos, program video and protocol, home and wholesale media, review screenshots, share image, notification test
- [x] Tests: variant generation, EXIF removal (fixture with GPS), Bunny signature, notification formatting
- [x] Gate + `feat(backend): media, video, jobs`

## M6 Hardening

- [x] Anti-spam review (honeypot, limits, optional Turnstile with timeout); site server reads exempt via internal secret, admin limited per session
- [x] Security headers and CSP (Next for the site, build-time meta for the admin, API headers; Caddy part in M7), cookie flags in prod mode, CORS review
- [x] Error pages and empty states audit (admin route error boundary inside the shell)
- [x] Accessibility pass (axe WCAG 2.2 AA in both e2e suites, 44 px targets via `tap`, contrast fixes, keyboard paths for sheet and quiz, label-in-name)
- [x] Playwright e2e: home, catalog filter (with and without JS), product order sheet (WhatsApp mocked), quiz, admin login + status change
- [x] Performance pass: first-load JS 305 → 166 KB gz, admin route chunks, video lazy, API p95 (`docs/lighthouse/2026-10-17-m6.md`)
- [x] Gate + `fix: hardening pass`

## M7 Deploy

- [x] Dockerfiles (multi-stage, non-root): web standalone, api/worker, admin static (BuildKit checks pass; full local image builds pending disk space, CI builds them)
- [x] `docker-compose.prod.yml`, `Caddyfile` (hosts, Cloudflare trusted proxies, origin cert, headers, `/s/*` Umami, media proxy); `caddy validate` passes
- [x] `ci.yml` (lint, typecheck, test with services, build, OpenAPI drift) and `deploy.yml` (GHCR, SSH, migrate, up, health)
- [x] Backups: nightly `pg_dump`, weekly bucket sync, 30-day retention, `infra/scripts/restore.md` tested once (dev stack)
- [x] Umami, optional Uptime Kuma
- [x] `docs/DEPLOY.md`, final `docs/HANDOFF.md`, first production deploy checklist (incl. Hetzner presigned POST + CORS check, Bunny MP4 fallback and webhook URL, Telegram bot)
- [ ] First production deploy (needs the owner's domain, Cloudflare, Hetzner, Bunny and GitHub accounts: HANDOFF §4)
- [x] Gate + `chore(infra): production deploy`
