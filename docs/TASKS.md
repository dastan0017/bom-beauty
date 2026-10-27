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
- [x] First production deploy (2026-10-18, https://bom-beauty.com): Hetzner CX23 fsn1, Cloudflare, buckets, Umami, backups and restore drill; presigned POST + CORS accepted by Hetzner. Still open: Bunny Stream, Telegram bot, SMTP (HANDOFF §4)
- [x] Gate + `chore(infra): production deploy`

## M8 Client revisions (October 2026)

Spec: `design/updates-2026-10/README.md`; design files in `design/` replaced with the revised prototypes.

- [x] Global: «Новинка» label wins over other badges; Состав on products; «протокол» → «схема ухода» everywhere
- [x] Home: 봄 pill, trust rows with the KR flag, two-line quiz CTA; programs grid with 5:4 covers and the quiz banner;
      «Каталог» card with chips; comparison points with title + text on aligned rows; rails Бестселлеры / Новинки /
      Выбор клиник Сеула; entry tiles and hero badge removed
- [x] Quiz: goal, skin, experience, age; ranking with related goals, combo → oily, sensitive bonus (parity test with the
      prototype); «Отлично!» result with alternatives; WhatsApp text lists the offered programs
- [x] Programs: 8 programs in the admin order (3 new, 2 renamed); program page without the AM/PM section; «Схема ухода»
      card: uploaded PDF or one generated on the fly (pdf-lib, Onest), WhatsApp fallback on failure
- [x] Catalog: «По проблеме» and «По типу средства» chips (`?problem=`, `?category=`), program banner, empty state, cart
      bar replacing the quiz bar
- [x] Product: «С этим средством ещё берут» rail, order bar with the cart's other items, Состав section
- [x] Cart and order: `localStorage` cart (products only, 1–20), order sheet in cart and direct modes, `order_lines`
      table, `items[]` API with the old one-item body still accepted, multi-line WhatsApp, Telegram and admin views
- [x] Header: home cart pill stacked with «К результатам теста»; no header cart icon
- [x] Admin: product rail switches and Состав; program cover photo; quiz goals and skins; texts editor for the catalog
      photo and comparison points; orders show lines (list, drawer, CSV, dashboard, customers)
- [x] Migration with guarded demo updates (only rows still equal to the seed); seed for the 3 new programs
- [x] Tests: quiz parity, order lines and legacy body, related products, CSV; e2e for cart order, extras, direct program
      order, problem filter, scheme PDF, new quiz
- [x] Gate + `feat: client revisions (cart, quiz, home rails, care scheme PDF)`

## M9 Online payment (Finik)

Spec: `docs/finik/SPEC.md` (§0 final decisions win); implementation prompt `docs/finik/PROMPT.md`.

- [x] Shared: payment enums and labels, `paymentMethod` on orders, pay page / attempt / Finik status schemas, the
      `payments` setting with the owner's WhatsApp templates, error codes `payment_unavailable` and `payment_failed`
- [x] Data: payment fields on `orders` (method, status, paid at, pay token, adjustment), `payments`, `payment_events`;
      additive migration with CHECKs; existing orders read as WhatsApp / «Не оплачен»
- [x] Finik: own RSA-SHA256 signer (Finik's two published samples as test vectors), client (`/v1/payment`, 302 or 201,
      10 s timeout, nothing secret logged), webhook verification on the raw body, `FINIK_ENV=mock` with a fake page
- [x] API: online `POST /orders`, `GET`/`POST /pay/:token`, `POST /webhooks/finik` (dedupe, row locks, amount check
      against the link and the order's current amount), `payments.expire` every 5 minutes, admin payment status and
      adjustment (row-locked), Finik status and the 1 сом check, CSV columns
- [x] Telegram: one message per situation with the customer's WhatsApp text quoted and a `wa.me` button; review alerts
- [x] Site: «Онлайн» / «WhatsApp» in the order sheet, phone hint, «Оплатить 5 900 сом», 409 → WhatsApp fallback,
      network retry with the same `clientRef`, back-from-Finik screen, unpaid-order banner; `/pay/[token]` page
      (states, polling, «Написать Нурайым»); cart emptied once paid; online wording (D36); pay token kept out of
      analytics; robots
- [x] Admin: payment chip in the list, «Оплата» in the drawer (status with confirmations, link to send, adjustment,
      attempts, history), «Настройки → Оплата» (connection, 1 сом check, switch, default method, link lifetime, Visa,
      unpaid messages, templates)
- [x] Tests: signer vectors, client, env, webhook outcomes, pay page, expiry, admin, mock end to end (backend
      integration); message builders; shared texts; e2e for program, cart and link payments with axe, admin payments
- [x] Docs: ARCHITECTURE (§1, §2, §6, §7.9, §8, §14, D28–D37, risks), DATA-MODEL, API, HANDOFF, DEPLOY, `.env.example`
- [x] Gate + `feat: online payment with Finik (M9)`
- [x] Go-live (2026-10-23): `FINIK_*` on the server, 1 сом check and the first real orders paid through Finik's webhook,
      Telegram bot `@bom_beauty_orders_bot` posting to the shop's group, «Принимать онлайн-оплату на сайте» on.
      Follow-ups (owner): Visa acceptance from Finik, payment wording in the texts (HANDOFF §3), delivery days abroad

## M10 Owner feedback (2026-10-26)

Requests from Нурайым while filling the admin, plus the developer's follow-ups.

- [x] Site catalog: search (`?q=`, every word, Russian endings, works without JS) and «По бренду» (`?brand=`); one
      sticky row with the search and «Фильтры», chip groups in a sheet, chosen filters as pills (D38)
- [x] Admin «Товары»: brand chips and search over the list; delete button with a confirmation in every row
- [x] Product delete: in the editor at the end of the form; also allowed for products in programs, which lose it with
      its steps; the wholesale featured list drops it too (D39)
- [x] Up to 10 photos per product: multi-upload, order arrows, «Сделать главным» (D40)
- [x] «Оптовикам»: second PDF «Готовые протоколы от производителя» (admin slot, site button once uploaded)
- [x] «О бренде» (2026-10-27): one text per brand, edited in the product form above «Описание», shown on every product
      page of the brand (migration `brand_description`, additive) (D41)
- [x] Product video (2026-10-27): «Видео» slot in the product editor (Bunny), play badge on catalog cards, player end
      card «Заказать» (migration `product_video`, additive) (D42); the product gallery has a thumbnail row with the video
      as its last tile (the owner chose mockup «D» of four)
- [x] Unique categories and brands (2026-10-27): names compared without case, spaces and punctuation; «⋯» on every
      chip to rename, merge into another or delete; a hint lists likely duplicates (D43)
- [x] Admin usability pass (2026-10-27): product checkboxes with a bulk bar (stock, visibility, category, delete),
      quick filters «Без фото» / «Скрытые» / «Нет в наличии», «Сделать копию», rows open the product, phone cards for
      products and orders, lead delete, programs table fits 1280 px (D44)
- [x] Tests: search helper, photo limit, wholesale content defaults, delete with programs and featured list, protocols
      PDF refs; e2e for the filter sheet, brand and search (with and without JS), admin list delete
- [x] Gate + `feat: catalog search and brand filter, product delete, 10 photos, wholesale protocols`
