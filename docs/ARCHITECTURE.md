# Architecture

Status: v3, 2026-10-22. Reconciled with the imported design (`design/`), the decisions taken on 2026-10-17 and the
client revisions of October 2026 (`design/updates-2026-10/README.md`, M8; section 15). Companion docs: `docs/DATA-MODEL.md`, `docs/API.md`, `docs/TASKS.md`.

## 1. What the system does

Bom Beauty sells professional Korean cosmeceuticals in Kyrgyzstan and the CIS. Sales close in WhatsApp and payment is
100% prepayment by bank details sent in WhatsApp. The site's job:

1. present ready-made **care programs** (5 products, a video from Нурайым, a care scheme PDF) and the **catalog** of
   single products, with prices in сом or the visitor's currency;
2. collect products in a **cart** (or order a program directly) and turn it into a short order form (name, phone,
   address) that opens a prefilled WhatsApp chat **and** records the order in the admin;
3. run the 4-question quiz "Подобрать программу ухода за 1 минуту" that recommends programs and hands the answers to
   WhatsApp;
4. sell to professionals on the "Оптовикам" page (price request through WhatsApp, brand catalog PDF);
5. let Нурайым manage orders, programs, products, the wholesale page, reviews, texts and the site's colours and currencies.

No online payment, no customer accounts. The cart lives in the visitor's browser only.

## 2. System overview

```
                         Cloudflare  (DNS · TLS · cache for /_next/static and media · optional Turnstile)
                                                     │
   bom-beauty.com      admin.bom-beauty.com      api.bom-beauty.com      media.bom-beauty.com      stats.bom-beauty.com
        │                    │                      │                      │                      │
        └────────────────────┴──────────── Caddy (Hetzner VPS) ────────────┴──────────────────────┘
        │                    │                      │                      │                      │
   web (Next.js)      admin (static SPA)       api (NestJS)        public bucket (proxy)       umami
        │                                      │       │
        └──── server-side fetch, internal ─────┘       ├── postgres 16 (app DB + umami DB)
              http://api:4000/v1                       ├── redis 7 (BullMQ)
                                                       └── worker (same image, --worker)
                                                              │
                    Hetzner Object Storage: public (processed images, PDFs) · private (uploads, originals) · backups
                    Bunny Stream: program, greeting and wholesale videos (upload from admin via TUS, HLS + MP4 playback)
```

- One VPS with Docker Compose behind Caddy; Cloudflare proxies every hostname.
- `api` and `worker` are one image; `worker` starts with `--worker` and only runs BullMQ processors.
- Next.js fetches the API on the Docker network (`http://api:4000/v1`), never through Cloudflare, so revalidation is
  never served a stale CDN copy.
- Videos never touch our servers: the admin uploads straight to Bunny Stream with a signed TUS session (Cloudflare's
  100 MB request limit would block 200 MB uploads through our API).

## 3. Hosts, ports, origins

| Prod host              | Service       | Notes                                                                                     |
| ---------------------- | ------------- | ----------------------------------------------------------------------------------------- |
| `bom-beauty.com`       | `web:3000`    | Client site; `www.` 301 to apex                                                           |
| `admin.bom-beauty.com` | `admin:8080`  | Static Vite build (unprivileged nginx), `noindex`, strict CSP                             |
| `api.bom-beauty.com`   | `api:4000`    | REST `/v1`; Swagger UI only in dev                                                        |
| `media.bom-beauty.com` | public bucket | Caddy proxies to the bucket endpoint; Cloudflare caches (keys are immutable)              |
| `stats.bom-beauty.com` | `umami:3000`  | Owner analytics UI; the tracker is proxied as `bom-beauty.com/s/*` to survive ad blockers |

| Dev URL                          | Service                                                                                                               |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| http://localhost:3100            | frontend (3000 is often taken by other projects)                                                                      |
| http://localhost:5173            | admin                                                                                                                 |
| http://localhost:4000/v1 · /docs | api · Swagger UI                                                                                                      |
| localhost:5434 / 6379            | postgres / redis                                                                                                      |
| http://localhost:9000            | SeaweedFS S3 API (buckets `bom-public` public-read, `bom-private`, created by `s3-init`; CORS for the site and admin) |
| http://localhost:8025            | Mailpit (SMTP on :1025)                                                                                               |

**API placement:** `api.` subdomain, same site as admin and apex. The admin calls it with `credentials: 'include'`; CORS
allows `ADMIN_ORIGIN` with credentials and `WEB_ORIGIN` without. The session cookie is host-only on `api.bom-beauty.com`
(`__Host-bb_sid` in prod), sent on same-site requests under `SameSite=Lax`. CSRF in section 8.2.

## 4. Repository layout

```
bom-beauty/
  frontend/            Next.js 16 client site
  backend/             NestJS 11 API + worker + Prisma + CLI
  admin/               Vite 8 + React 19 SPA
  packages/shared/     zod schemas, enums, RU domain labels, money/currency, theme engine, quiz, WhatsApp messages, generated API types + client
  packages/config/     tsconfig bases, ESLint flat configs, Prettier config, design tokens (tokens.css), fonts
  infra/               docker-compose(.prod).yml, Caddyfile, .env.example, scripts/ (backup, restore.md)
  design/              exported Claude Design files (read-only reference)
  docs/
  .github/workflows/   ci.yml, deploy.yml
```

Each app owns its Playwright specs in `<app>/e2e/`.

## 5. packages/shared

| Module        | Contents                                                                                                                                                                                                                                      |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `enums.ts`    | `OrderStatus`, `OrderItemType`, `LeadKind`, `UserRole`, `QuizGoal`, `SkinType`, `QuizExperience`, `QuizAge`, `RoutinePeriod`, `ThemeKey`, `CurrencyCode`. Mirrors Prisma enums (a test keeps them equal).                                     |
| `labels.ts`   | Russian labels for domain values (`new: Новый`, `sent: Отправлен`, `cancelled: Отменён`, skin types, goals, badges, wholesale buyer kinds and countries); `displayBadge` («Новинка» wins), `orderSummary` / `orderKindLabel` for order lines. |
| `money.ts`    | `formatKgs(5900) → "5 900 сом"`; grouping with U+00A0 by hand (no `Intl`, so server and browser render identically).                                                                                                                          |
| `currency.ts` | `CURRENCIES` (KGS base; USD, EUR quoted as сом per unit; RUB, KZT, UZS, KRW quoted as units per сом; rounding steps 1/10/1/10/1000/100), `convertFromKgs`, `formatMoney`. Port of the design's `CURS`/`fmt`.                                  |
| `theme.ts`    | Theme presets `rose` (default), `sky`, `indigo` and `buildThemeVars({ theme, headerColor, accentColor })` → CSS custom properties. Port of the design's `TH`, `BLUEHDR`, `hdrOnly`, `siteVars`; also `contrastWarnings()` for the admin.      |
| `quiz.ts`     | The 4 questions (goal, skin, experience, age), `rankPrograms(programs, answers)` (port of `quizScore`/`quizRank` with related goals), `quizLeadAnswers` (labels for new and pre-October leads). Used by the site and the API.                 |
| `whatsapp.ts` | Message builders for order (one bullet per line, «Итого» from 2 lines), quiz (with the offered programs), wholesale and care scheme request (texts verbatim from the design), `waLink(phone, text)`.                                          |
| `phone.ts`    | `normalizePhone(input, 'KG')` → E.164 via `libphonenumber-js`; `formatPhoneDisplay`.                                                                                                                                                          |
| `plural.ts`   | `средство/средства/средств`, `товар/товара/товаров`, `шаг/шага/шагов`, `программа/программы/программ`.                                                                                                                                        |
| `limits.ts`   | `LINE_QTY_MAX` (20 per order line), `ORDER_LINES_MAX` (30 lines per order), shared by the cart, the schemas and the API.                                                                                                                      |
| `slug.ts`     | Cyrillic transliteration + slugify for auto slugs.                                                                                                                                                                                            |
| `schemas/`    | zod: public order and lead create, catalog responses, admin DTOs, Setting and ContentBlock values per key. Message **codes**, not texts.                                                                                                      |
| `api/`        | `schema.d.ts` generated by `openapi-typescript` from `backend/openapi.json` + a small typed `fetch` wrapper.                                                                                                                                  |

Built with `tsup` to ESM + CJS + `.d.ts` (Nest is CJS, Next and Vite are ESM); `pnpm dev` runs it in watch mode.
`pnpm gen:api` writes `backend/openapi.json` and regenerates `schema.d.ts`; both are committed and CI fails on drift.

**Validation messages:** shared schemas emit codes (`order.name.min`, `phone.invalid`); `frontend/src/content/copy.ts` and
`admin/src/content/copy.ts` map codes to the design's texts ("Как к вам обращаться?", "Нужен номер, чтобы Нурайым могла
связаться", "Укажите город, улицу и дом"). The API returns the same codes in `error.fields`.

## 6. Apps

### 6.1 backend (NestJS 11, Express)

| Module                                                                        | Responsibility                                                                       |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `config`                                                                      | zod-validated env, boot fails on invalid config                                      |
| `prisma`                                                                      | PrismaClient (Prisma 7, `@prisma/adapter-pg`)                                        |
| `auth`                                                                        | login/logout/me, DB sessions, CSRF guard, roles guard, login throttling              |
| `users`                                                                       | owner/manager accounts, password reset by owner                                      |
| `catalog`                                                                     | public reads: categories, products, programs, brands, sitemap data, redirect resolve |
| `products` `categories` `programs` `reviews` `content` `settings` `redirects` | admin CRUD; every mutation writes AuditLog and enqueues revalidation                 |
| `media`                                                                       | admin image/PDF uploads (presign → complete → processing)                            |
| `videos`                                                                      | Bunny Stream: create video + TUS signature, status sync, webhook, delete             |
| `orders`                                                                      | public create; admin list/detail/status/note/export; customers aggregation           |
| `leads`                                                                       | public create (quiz, wholesale); admin list                                          |
| `dashboard`                                                                   | Обзор numbers per period                                                             |
| `notifications`                                                               | Telegram + SMTP senders, test endpoint                                               |
| `audit`                                                                       | AuditLog writer + list                                                               |
| `revalidate`                                                                  | `web.revalidate` jobs with cache tags                                                |
| `jobs`                                                                        | BullMQ queues and processors (processors load only with `--worker`)                  |
| `health`                                                                      | `/health`, `/health/ready`                                                           |

Entry points: `main.ts` (HTTP, or worker with `--worker`) and `cli.ts` (`create-admin`, `reset-password`). Conventions:
thin controllers, `createZodDto` from shared schemas, Prisma `select` everywhere, prices computed on the server.

### 6.2 frontend (Next.js 16 App Router)

Routes (design screens in brackets):

| Route                     | Content                                                                                                                                                                                                                                                                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                       | Home [isHome]: hero with Нурайым (tap → greeting video), «봄 (BOM) — Весна» pill, H1, three trust rows, quiz CTA; programs grid with photo cards and the quiz banner; «Каталог» card with category chips; "Профессиональный уход vs масс-маркет"; about card; reviews carousel + lightbox; rails Бестселлеры / Новинки / Выбор клиник Сеула |
| `/programs`               | Programs list [isPrograms] with the quiz banner and "Как это работает"                                                                                                                                                                                                                                                                      |
| `/programs/[slug]`        | Program [isSet]: stock badge, "Уход при …", video, "Кому подходит", "Что входит в программу", price with savings, delivery facts, «Схема ухода» card, sticky "Заказать программу" (direct order, never the cart)                                                                                                                            |
| `/programs/[slug]/scheme` | Route handler: the care scheme as a one-page A4 PDF built with pdf-lib when the owner uploaded none (`noindex`, `no-cache`)                                                                                                                                                                                                                 |
| `/catalog`                | Catalog [isCatalog]: chips «По проблеме» (`?problem=`, a program's products plus a banner to it) and «По типу средства» (`?category=`), product grid with «В корзину», cart bar while the cart has items                                                                                                                                    |
| `/catalog/[slug]`         | Product [isProduct]: gallery, badge, price, «С этим средством ещё берут» rail, "Входит в программы", Описание, Состав, Как использовать, sticky bar with the cart's other items and "Заказать (вместе) · …"                                                                                                                                 |
| `/wholesale`              | Оптовикам [isWholesale]: hero, about, brands and products, benefits, steps, delivery terms by country, contact block                                                                                                                                                                                                                        |
| `/delivery`               | Delivery, payment and FAQ (not in the design; same visual language)                                                                                                                                                                                                                                                                         |
| `/privacy`, `/offer`      | Legal texts (markdown from the admin)                                                                                                                                                                                                                                                                                                       |
| `not-found`, `error`      | Custom pages                                                                                                                                                                                                                                                                                                                                |

Client overlays (client components): order sheet (cart mode or direct program mode), wholesale price sheet, quiz
(full-screen dialog), video player, review lightbox, currency menu. Header: logo, currency picker (shown when more than
one currency is enabled), WhatsApp icon, tabs Каталог / Программы / Оптовикам, and under it a stack of floating pills:
the home cart pill and «К результатам теста». Sticky bottom bars as in the design (quiz CTA on home/programs/catalog,
replaced on the catalog by the cart bar while the cart has items; price request on wholesale; order bars on program and
product pages). Bars publish their height as `--sticky-space`, which the footer reserves.

**Cart:** `CartProvider` keeps `[{ slug, qty }]` in `localStorage` (`bb-cart`), products only, 1–20 each, synced across
tabs. The layout passes the published catalog (name, brand, volume, price, image), so lines always show current data
and products taken off the site drop out. The cart empties after a cart order is sent; a direct program order leaves it
as it was.

**Desktop (≥ 1024 px):** the prototype is phone-only; desktop follows the older desktop references in the design project
(`BomHomeDesktop`, `BomSetDesktop`): 1100 px container, 3-column grids, program page with the vertical video in a left
column and the price card on the right. Copy always comes from the mobile prototype.

**Rendering and caching**

- Server Components fetch `INTERNAL_API_URL` with `next: { tags, revalidate: 3600 }`. Tags: `products`, `product:{slug}`,
  `programs`, `program:{slug}`, `categories`, `reviews`, `content`, `content:{key}`, `settings`, `redirects`.
- Admin mutations call `RevalidateService` (`POST web:3000/api/revalidate` with the tags, three retries over ~20 s so a
  restarting `web` still gets them). M5 moves this onto the `web.revalidate` BullMQ queue.
- Pages render per request (`connection()` in the fetch helper), so `next build` never needs the backend; the API
  responses themselves sit in Next's data cache until their tags are revalidated, so a render costs no API call.
- Cloudflare caches only `/_next/static/*`, fonts and media; HTML is not cached at the edge.

**Theme and currency at runtime**

- The root layout reads `settings.appearance` (tag `settings`) and renders `buildThemeVars()` as inline CSS custom
  properties on `<html>`. Changing colours in "Оформление" revalidates every page; no rebuild.
- Prices render server-side in сом. `<Price kgs>` is a client component that switches to the visitor's currency (kept in
  `localStorage`) after hydration using the rates from `/settings/public`. Visitors on сом see no change; others see a
  one-frame swap, which keeps the HTML identical for everyone.

**Progressive enhancement:** catalog and content pages render fully without JS; category chips are links; the order
buttons fall back to a plain `wa.me` link with a default message; the quiz CTA falls back to `/programs`.

**Images:** `<BbImage>` renders a plain `<picture>` (AVIF + WebP `srcset` from the pre-built variants, WebP `<img>`
fallback) with intrinsic dimensions and the blur placeholder as a background; originals are never served. Not
`next/image`: the variants already exist in object storage, so an optimiser would only add a hop. Every slot has a
placeholder (initials, icon or the design's mono "фото" label) because media is uploaded after launch.

**Open Graph:** `opengraph-image.tsx` for the site (the owner's image from SEO settings when set), programs and
products, rendered with `next/og`. Satori cannot read WOFF2 or variable fonts, so static 600-weight TTF instances of
Onest and Cormorant live in `packages/config/fonts/og` and are traced into the standalone build.

**Video:** native `<video>` with the Bunny HLS playlist as the first `<source>` and Bunny's 720p MP4 fallback as the second
(browsers without native HLS use the MP4), poster from Bunny, custom controls and end card as in the design
("Заказать программу", "Смотреть ещё раз"). No player library.

**Fonts:** Onest (400/600/700) for text, Cormorant Garamond (500/600 + italic) for headings with the italic accent word,
one-glyph Noto Sans KR subset for "봄" in the footer and the hero pill. The care scheme PDF embeds static Onest TTFs
(400/600/700, `packages/config/fonts/pdf`) so its Cyrillic text stays selectable. Self-hosted woff2 (Cyrillic + Latin) in `packages/config/fonts`,
loaded with `next/font/local` in the site and `@font-face` in the admin.

**Analytics:** Umami on every page (cookie-free) with custom events for WhatsApp clicks that don't create records (header
icon, "Написать Нурайым", protocol request). Meta Pixel only when enabled in settings. UTM and referrer captured on
landing into `sessionStorage` and attached to orders and leads.

### 6.3 admin (Vite + React 19)

Screens follow `design/BomAdmin.dc.html`: sidebar at ≥ 1024 px, top bar with scrolling tabs below. Additions where the
design is silent are marked _(gap)_.

| Nav        | Route                        | Content                                                                                                                                                                                                                                                                 |
| ---------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| —          | `/login`                     | Email + password, "Запомнить меня" _(gap)_                                                                                                                                                                                                                              |
| Обзор      | `/`                          | Greeting, period (Сегодня / 7 дней / 30 дней), 4 stat cards, recent orders, orders by program                                                                                                                                                                           |
| Заказы     | `/orders`                    | Tabs Все / Новые / Отправлены / Отменены with counts, search, table with status select and WhatsApp button; row opens a detail drawer with the full message, comment, UTM and a private note _(gap)_; CSV export _(gap)_                                                |
| Заявки     | `/leads`                     | Quiz and wholesale hand-offs: answers, recommended programs, time _(gap)_                                                                                                                                                                                               |
| Программы  | `/programs`, `/programs/:id` | List with video/scheme/publish status; editor (basics, "Кому подходит", ordered products from the catalog, «Фото для главной» 5:4, video, «Схема ухода» PDF, price with savings, quiz goal and skins, publish and stock toggles) plus slug, headline and course _(gap)_ |
| Товары     | `/products`, `/products/:id` | Category management, table with stock toggle; editor (name, brand, category, volume, price, short text, description, Состав, how to use, 3 photos, stock, badge, «На главной странице» switches) plus slug, short name for steps, publish toggle and SEO _(gap)_        |
| Оптовикам  | `/wholesale`                 | Contacts, hero, about quote and stats, featured products, benefits, stock note and delivery table, brand catalog PDF, video                                                                                                                                             |
| Клиенты    | `/customers`                 | Aggregated from orders by phone: name, city, orders, total, last order, most ordered item, WhatsApp                                                                                                                                                                     |
| Отзывы     | `/reviews`                   | Upload screenshots (multi, drag and drop), order, hide/show, delete; demo screenshots hide automatically once real ones exist                                                                                                                                           |
| Тексты     | `/content/:key`              | Home texts (hero, comparison with title + text per point, «Каталог» card photo, about, reviews), delivery facts and FAQ, privacy, offer _(gap)_                                                                                                                         |
| Оформление | `/appearance`                | Theme preset, header colour, accent colour with contrast warnings, currencies with rates and toggles, live phone preview                                                                                                                                                |
| Настройки  | `/settings/:section`         | Shop contacts and legal line, notifications (Telegram, email, test), SEO and analytics, users, audit log, "Выйти на всех устройствах" _(gap)_                                                                                                                           |

TanStack Query for server state; the orders counter in the nav polls every 15 s and refetches on window focus. Every
mutation shows a toast. shadcn/ui primitives are restyled to the design (Onest, ink `#14142B` buttons, `#E4E6EB` borders,
10–16 px radii).

## 7. Key flows

### 7.1 Order → admin → WhatsApp

1. Products go into the cart («В корзину» on cards and rails, «Добавить» under a product, the product page's order
   button); the cart pill, the catalog bar or the product page opens the order sheet in cart mode: lines with steppers,
   «Добавить ещё средства», «Очистить». "Заказать программу" (program page, video end card) opens it in direct mode with
   that one program. Both modes ask for name, phone (`+996 ` prefilled), address and comment and show the total in the
   chosen currency (plus "В сомах: …" when not сом).
2. On "Отправить заказ в WhatsApp", in the same click handler (iOS blocks popups after an `await`):
   `fetch(POST /v1/orders, { keepalive: true })` with `items[]` and a browser-generated `clientRef`, then open
   `wa.me/{shop.whatsapp}?text=…` with the design's message ("Здравствуйте! Хочу заказать: …", one bullet per line).
3. A failed POST goes to a `localStorage` outbox and is retried on the next page load; `clientRef` is unique, so retries
   never duplicate.
4. The API validates, normalises the phone to E.164, merges repeated lines, recomputes every line's unit price and the
   total in сом from the DB, stores the order with its `OrderLine`s (`status = new`, number from 1001 up) and enqueues
   `notify.telegram`.
5. The sheet shows "Заказ отправлен" with the message bubble and "WhatsApp не открылся? Открыть ещё раз".
6. In the admin the order shows up in Заказы and Обзор within 15 s; Нурайым confirms in WhatsApp, then sets Отправлен or
   Отменён.

### 7.2 Quiz

Four questions (goal, skin after 2–3 hours, experience with active care, age) with auto-advance. The result («Отлично!»)
shows up to 3 programs ranked by goal and skin (`rankPrograms`: related goals score lower, combo skin also matches oily,
sensitive skin adds a bonus to calming programs; ties keep the admin order). «Спросить Нурайым в WhatsApp» first sends
`POST /v1/leads/quiz` (answers, `clientRef`); the API recomputes the recommendation for the record and the message lists
the offered programs with prices. Opening a recommended program and ordering
it marks the order `fromQuiz`. The "К результатам теста" pill returns to the result.

### 7.3 Wholesale

"Получить прайс и консультацию" opens a sheet: buyer kind (Косметолог / Клиника / Салон / Магазин косметики) and
destination (Кыргызстан / Казахстан / Узбекистан / Россия, with lead times). "Получить прайс в WhatsApp" sends
`POST /v1/leads/wholesale` and opens WhatsApp with the design's message. "Скачать каталог брендов" downloads the
PDF uploaded in the admin, or shows "Каталог появится здесь, когда Нурайым загрузит PDF". "Позвонить" uses the wholesale
phone, or shows "Номер появится после подтверждения Нурайым".

### 7.4 Admin authentication

- Login with email + password (argon2id), throttled per IP and per email, generic error.
- Session: 32 random bytes in the cookie; the DB keeps `sha256(token)` as the id. 12 h sliding, 30 days with "Запомнить меня".
  `HttpOnly; Secure; SameSite=Lax; Path=/`.
- CSRF: token = `HMAC(SESSION_SECRET, sessionId)`, returned by `/auth/login` and `/auth/me` and kept in memory by the
  admin. Mutations need it in `X-CSRF-Token` (checked against the session, no CSRF cookie) and `Origin = ADMIN_ORIGIN`.
- Login lockout: 10 failed attempts per email lock it for 15 minutes (Redis); 5 attempts per minute per IP.
- Roles: `owner` (everything), `manager` (everything except users, notifications, audit, export).

### 7.5 Media (images and PDFs)

Admin picks a file → `POST /v1/admin/media/presign` → browser uploads to `incoming/` in the **private** bucket →
`POST /v1/admin/media/:id/complete` → `media.process` job:

- images: sharp auto-rotate, strip metadata (EXIF/GPS), AVIF + WebP at 320/640/960/1280/1920 (never upscaled), 24 px
  blur data URL, dimensions, plus `p/{id}/share.jpg` (≤ 1200 px) for Open Graph cards, since next/og's renderer
  draws no WebP or AVIF; output to the public bucket as `p/{id}/{w}.{ext}` with `max-age=31536000, immutable`;
  original moved to `orig/` in the private bucket. HEIC from desktop uploads is decoded with a WASM fallback.
- PDFs (protocols, brand catalog, ≤ 20 MB): magic-byte check, copied to `d/{id}/{filename}.pdf` in the public bucket with
  `Content-Disposition: attachment`.

The presigned POST policy pins the key, the content type and `content-length-range`, so the bucket itself refuses other
files. The admin polls `GET /v1/admin/media/:id` until `ready` or `failed`; the worker processes one file at a time to
keep sharp's memory flat. Presigned uploads never completed within an hour are removed by `uploads.cleanup`.

### 7.6 Video (Bunny Stream)

1. Admin picks a file (MP4/MOV, ≤ 200 MB) → `POST /v1/admin/videos` → API creates the video in the Bunny library and
   returns a TUS endpoint with a signature (`sha256(libraryId + apiKey + expires + videoId)`, 2 h).
2. The browser uploads directly to Bunny over TUS with progress.
3. Bunny's webhook (`POST /v1/webhooks/bunny`, which only triggers a status fetch, since Bunny webhooks are unsigned) and
   a polling `video.sync` job update status, duration, dimensions, thumbnail, HLS and MP4 URLs.
4. The video is attached to a program, the home greeting or the wholesale page; the site shows it once `ready`.

Bunny library settings (M7 checklist): MP4 fallback on (720p, the `<video>` fallback where HLS is not native), webhook
URL `https://api.bom-beauty.com/v1/webhooks/bunny`. Without `BUNNY_*` keys the upload answers 503 `video.not_configured`.

### 7.7 Slug changes

Changing a product or program slug creates `Redirect(from → to)` and collapses chains. The page's not-found branch calls
`GET /v1/redirects/resolve` (tag `redirects`) and issues a permanent redirect (Next.js sends 308).

### 7.8 Notifications

New order → `notify.telegram` (bot token in env, chat id in settings): number, the lines (title × qty, line total), total, name, phone, address,
link to `https://admin.bom-beauty.com/orders/{id}`. Leads notify only if enabled. If Telegram fails after retries or is
off, `notify.email` sends the same over SMTP. Customer input is HTML-escaped. Settings has a test button that reports each
channel (sent, off, not configured, failed).

## 8. Security

### 8.1 Public endpoints

zod validation with unknown keys stripped; honeypot field; per-IP rate limits (`@nestjs/throttler`, in-memory, one API
instance); real client IP from Caddy (which trusts only Cloudflare ranges) with Express trusting only Caddy; phones
normalised to E.164; IPs stored only as salted hashes; optional Turnstile on order and lead creation (off by default,
5 s timeout, fails open so a Cloudflare outage never blocks orders). The site's server-side reads all come from one
internal address, so they send `X-Internal-Secret` (the shared web↔API secret, `REVALIDATE_SECRET`) and skip the
per-IP limit; admin calls count per session with a higher limit, since uploads come in bursts (API.md §3).

### 8.2 Admin

Sessions, CSRF and roles as in 7.4; login lockout with backoff; AuditLog for every mutation; markdown rendered without raw
HTML. Admin and auth responses carry `Cache-Control: no-store`. Screens load as separate chunks; a screen that fails to
render or load shows "Что-то пошло не так" inside the shell, with a reload button.

### 8.3 Transport and headers

Cloudflare Full (strict) with an Origin CA certificate in Caddy; Hetzner firewall allows 80/443 only from Cloudflare and
22 from allowed IPs. Caddy sets HSTS on all hosts and `frame-ancestors 'none'` / `X-Frame-Options: DENY` on the admin.

- Site: Next sends the CSP and the other headers itself (`frontend/src/security-headers.ts`, applied in
  `next.config.ts`). The CSP is pragmatic: `'unsafe-inline'` scripts for Next's streamed bootstrap, otherwise only the
  API, media, Bunny (`*.b-cdn.net`), Turnstile and Meta hosts; `frame-ancestors 'none'`, `object-src 'none'`,
  `upgrade-insecure-requests` when the site URL is https. Dev adds `'unsafe-eval'` and `ws:` for the dev server.
- Admin: a strict CSP (`script-src 'self'`, no eval) is written into `index.html` at build time from the `VITE_*` URLs
  (`admin/csp.ts`); a `<meta>` policy cannot carry `frame-ancestors`, which Caddy adds. Caddy also sends
  `Referrer-Policy: strict-origin`: origin only, never paths with order ids, because Bunny's CDN refuses thumbnail and
  video requests that carry no referrer (the admin plays videos in place).
- API: `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Cross-Origin-Resource-Policy: same-site`,
  no `X-Powered-By`.
- zod runs `jitless` in browsers (`packages/shared/src/zod.ts`): its JIT probe calls `Function('')`, which both CSPs
  block and browsers report.

### 8.4 Secrets and logs

Secrets only in env (server `infra/.env`, GitHub Actions secrets). pino redacts phone, name, address, cookies, auth
headers and signed URLs. Sentry optional (backend).

## 9. Privacy

Personal data is limited to orders (name, phone, address, comment). The order sheet shows a one-line notice under the
button linking to `/privacy` (no checkbox, to keep the design's one-tap flow). Owner can delete an order on request.
Analytics are cookie-free; the Meta Pixel is off by default and needs a privacy-text update when enabled. Legal review is
in HANDOFF.

## 10. SEO

Metadata API per page, canonical URLs, `lang="ru"`, `sitemap.ts` (programs, products, static pages; unpublished excluded),
`robots.ts`, OG images for products and programs via `next/og`, JSON-LD: `Organization`, `Product` + `Offer` (KGS,
`InStock`/`PreOrder` from the stock toggle) for products and programs, `BreadcrumbList`, `FAQPage` on `/delivery`.
IndexNow (Yandex, Bing) on publish; Google/Bing sitemap pings no longer exist.

## 11. Observability

pino JSON logs with request ids; `/health` and `/health/ready`; Sentry when a DSN is set; failed BullMQ jobs logged; Uptime
Kuma optional plus an external free monitor (a monitor on the same VPS can't report the VPS down).

## 12. Infra and delivery

Compose services (`infra/docker-compose.prod.yml`): `caddy`, `web`, `api`, `worker`, `admin`, `postgres`, `redis`
(`noeviction`, AOF), `umami` (own database on the same Postgres), `backup`, optional `uptime-kuma` (profile
`monitoring`). Images, all multi-stage from a `turbo prune`d workspace:

- `bom-api` (`backend/Dockerfile`): Node 24 Alpine, `pnpm deploy --prod` tree, user `node`, tini. One image for the API,
  the worker (`--worker`), migrations (`prisma` is a runtime dependency for `migrate deploy`), the seed
  (`dist/seed/seed.js`) and the CLI (`dist/cli.js`).
- `bom-web` (`frontend/Dockerfile`): Next standalone, user `node`; `NEXT_PUBLIC_*` as build args.
- `bom-admin` (`admin/Dockerfile`): the Vite build behind `nginx-unprivileged` on 8080; `VITE_*` as build args (they
  also shape the CSP meta tag).
- `bom-backup` (`infra/backup`): Alpine with `pg_dump` 16, rclone and cron (03:30 database, Sunday 04:00 buckets).

Third-party images are pinned: `caddy:2.10.2-alpine`, `postgres:16.10-alpine`, `redis:7.4-alpine`,
`umami:postgresql-v2.19.0`, `uptime-kuma:1.23.16`, `nginx-unprivileged:1.29-alpine`, `node:24.22.0-alpine`,
`alpine:3.22`. CI (`.github/workflows/ci.yml`): format, lint, typecheck, test (the dev compose services), build,
OpenAPI drift. Deploy (`deploy.yml`) after CI passes on `main`: GHCR images tagged with the commit SHA, rsync of the
infra files, `compose pull`, a database dump when migrations are pending, `prisma migrate deploy`, `up -d --wait`,
health checks; the old release serves until the migration has succeeded. Backups: nightly `pg_dump` (app +
umami) and a weekly mirror of both buckets (replaced or deleted files kept under `removed/<date>/`) to a backups bucket
in another Hetzner location, 30-day retention, Telegram alert on failure; Bunny keeps its own copies. Runbook:
`docs/DEPLOY.md`; restore: `infra/scripts/restore.md`. Times stored in UTC, shown in `Asia/Bishkek`.

## 13. Performance budgets

Catalog API p95 < 150 ms; mobile Lighthouse Performance ≥ 90, SEO 100, Accessibility ≥ 95; no layout shift; below-the-fold
images lazy; video loads only on tap; `libphonenumber-js` and zod only inside the order sheet chunk. The site's client
code imports runtime helpers from `@bom/shared/web` (no schemas, no phone parsing); the order sheet takes its schema from
`@bom/shared/forms` and loads about 1.5 s after `load` or at the first "Заказать" (an e2e test guards this). Measured in
`docs/lighthouse/2026-10-17-m6.md`.

## 14. Version pins and dependencies

| Area                          | Version     | Note                                          |
| ----------------------------- | ----------- | --------------------------------------------- |
| Node                          | 24 LTS      | supported until 2028-04-30                    |
| pnpm / Turborepo              | 10.x / 2.x  | `packageManager` field, corepack              |
| TypeScript                    | 5.9.x       | newest supported by `typescript-eslint`       |
| Next.js / React               | 16.x / 19.x |                                               |
| Tailwind CSS                  | 4.x         |                                               |
| NestJS / `@nestjs/swagger`    | 11.x / 11.x | `nestjs-zod` 5.5 supports Nest ≤ 11           |
| Prisma                        | 7.10.x      | stable line; npm `latest` points at an 8.0 RC |
| zod                           | 4.x         |                                               |
| Vite / Vitest                 | 8.x / 5.x   |                                               |
| React Router / TanStack Query | 7.x / 5.x   |                                               |
| PostgreSQL / Redis            | 16 / 7      |                                               |

Approved dependencies beyond the brief's stack (2026-10-17): `@nestjs/swagger`, `@nestjs/bullmq`, `nestjs-pino`,
`pino-http`, `pino-pretty` (dev), `@sentry/nestjs`, `@aws-sdk/client-s3`, `@aws-sdk/s3-presigned-post`,
`@aws-sdk/s3-request-presigner`, `@prisma/adapter-pg`, `pg`, `cookie-parser`, `nodemailer`, `heic-decode`,
`unplugin-swc` + `@swc/core` (dev), `tsx` (dev), `libphonenumber-js`, `tsup` (dev), `@hookform/resolvers`,
`react-markdown`, shadcn/ui packages (`radix-ui`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`,
`sonner`, `tw-animate-css`), `@dnd-kit/core` + `@dnd-kit/sortable`, lint tooling (`typescript-eslint`,
`eslint-config-next`, `eslint-plugin-react-hooks`, `eslint-config-prettier`, `prettier-plugin-tailwindcss`), dev
dev containers SeaweedFS (S3) and Mailpit. Since 2026-10-17 dependencies are added without asking and listed here:

- M1: `prisma` + `@prisma/client` + `@prisma/adapter-pg` + `pg` (Prisma 7 driver adapter), `@node-rs/argon2` (prebuilt
  argon2id, no native build in Docker), `@nestjs/throttler`, `ioredis`, `cookie-parser`, `@nestjs/swagger`, `nestjs-zod`,
  `openapi-typescript` (dev), `openapi-fetch` (typed client in `@bom/shared/api`), `tsx` (seed).
- M2: `react-hook-form` (order sheet field state; validation runs synchronously with the shared zod schemas so
  WhatsApp opens inside the click), `react-markdown` (delivery and legal pages, raw HTML off), `@playwright/test` (dev,
  end-to-end flows in `frontend/e2e`).
- M3: `radix-ui` (admin order drawer and delete confirmation: focus trap, Escape, ARIA), `sonner` (admin toasts),
  `@playwright/test` (dev, admin flows in `admin/e2e`). `patches/nestjs-zod@5.5.0.patch` (pnpm `patchedDependencies`):
  zod ≥ 4.4 writes simple nullable fields as `type: [T, "null"]`, which `@nestjs/swagger` read as arrays, so every
  nullable field came out as `T[]` in `openapi.json`; the patch expands them to `anyOf` before Swagger sees them. Drop
  it once nestjs-zod handles type arrays. The OpenAPI document is now 3.1, and `default` responses are promoted to
  `200` so the typed client reads them as success (`backend/src/openapi.ts`).
- M5: `bullmq` + `@nestjs/bullmq` 11.0.5 (12.x is ESM-only and does not load in the CJS Nest build), `sharp` (variants,
  blur, metadata strip), `heic-decode` (WASM HEIC fallback; sharp's prebuilt libvips has no HEVC), `@aws-sdk/client-s3`,
  `@aws-sdk/s3-presigned-post`, `@aws-sdk/s3-request-presigner`, `nodemailer` + `@types/nodemailer` (dev, email
  notifications), `tus-js-client` (admin, resumable video upload to Bunny), `vitest` + `sharp` (frontend dev: share-card
  tests that check drawn pixels).
- M6: `@axe-core/playwright` (dev, frontend and admin: WCAG 2.2 AA checks in the e2e suites).
- M8: `pdf-lib` + `@pdf-lib/fontkit` (frontend: the care scheme PDF with embedded Onest, so text stays real and
  selectable; pure JS, no headless browser).

## 15. Decisions and deviations

| #   | Decision                                                                                                                                                                                                                                                                                                                             | Why                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| D1  | The design wins wherever it shows something; the brief fills gaps (auth, users, settings, notifications, SEO, legal pages, `/delivery`, 404, anti-spam, audit, ops)                                                                                                                                                                  | Agreed 2026-10-17                                                                    |
| D2  | "Подбор ухода" is the design's quiz; answers go to WhatsApp and are recorded as leads; no skin-photo upload or storage                                                                                                                                                                                                               | Agreed 2026-10-17; removes the private-photo pipeline                                |
| D3  | Videos on Bunny Stream, uploaded from the admin over TUS, played with native `<video>` (HLS + MP4 fallback)                                                                                                                                                                                                                          | Agreed 2026-10-17; 200 MB uploads exceed Cloudflare's request limit                  |
| D4  | Seed = the design's 13 products, 5 categories, 8 programs (5 until M8), 14 demo review screenshots, wholesale content; marked as demo in HANDOFF                                                                                                                                                                                     | Agreed 2026-10-17; programs per the October revisions                                |
| D5  | Order statuses Новый / Отправлен / Отменён. Until M8 one item per order; superseded by D21                                                                                                                                                                                                                                           | Design                                                                               |
| D6  | Theme and currency are runtime settings; pages stay static (CSS variables from settings, client-side currency swap)                                                                                                                                                                                                                  | Design's "Оформление" without losing ISR                                             |
| D7  | Brief routes `/about`, `/reviews`, `/brands`, `/consult` dropped; about and reviews live on home, brands on wholesale                                                                                                                                                                                                                | Design layout                                                                        |
| D8  | Inbox kinds collapse to **orders** (with contact data) and **leads** (quiz, wholesale)                                                                                                                                                                                                                                               | Design flows                                                                         |
| D9  | Live inbox via 15 s polling and refetch on focus; no SSE                                                                                                                                                                                                                                                                             | Simpler, enough for the volume                                                       |
| D10 | Host-only `__Host-` session cookie on `api.`, CSRF token returned in the body                                                                                                                                                                                                                                                        | Same-site already; no parent-domain cookie                                           |
| D11 | Validation messages as codes in shared schemas, texts in `copy.ts`                                                                                                                                                                                                                                                                   | One schema source, one copy source                                                   |
| D12 | `keepalive` POST + `localStorage` outbox + `clientRef` idempotency before opening WhatsApp                                                                                                                                                                                                                                           | No popup blocking, no duplicates                                                     |
| D13 | `sitemap.ping` → IndexNow                                                                                                                                                                                                                                                                                                            | Google/Bing pings are gone                                                           |
| D14 | All uploads land in the private bucket; the public bucket holds processed output only                                                                                                                                                                                                                                                | No per-prefix policies; no GPS leaks from originals                                  |
| D15 | Slug redirects answer 308                                                                                                                                                                                                                                                                                                            | Next's `permanentRedirect`, treated as 301                                           |
| D16 | Order consent is a notice line under the button, not a checkbox                                                                                                                                                                                                                                                                      | Keeps the design's flow; legal check in HANDOFF                                      |
| D17 | Copy taken verbatim from the design stays verbatim (it uses dashes); copy we write never uses em-dashes                                                                                                                                                                                                                              | Brief rule 6                                                                         |
| D18 | Contrast beats the design's exact hex where they conflict: admin green `#15805a` → `#137a55` (4.5:1 on its tint), tab counters unfaded on white                                                                                                                                                                                      | WCAG 1.4.3; visually the same                                                        |
| D19 | Carousel dots stay small, as in the design, but are pointer-only shortcuts; keyboards and screen readers use the arrows or the focusable gallery, with a live status                                                                                                                                                                 | WCAG 2.5.8 equivalent-control exception; keeps the design's spacing                  |
| D20 | Home hero gets two realistic sakura branches beside the photo (not in the design), behind the content and clipped above the badge: the client's transparent PNGs, committed as AVIF/WebP (400/600/800 w) in `frontend/public/decor`. The one exception to "no media in the repo"; they keep their natural colours whatever the theme | Requested 2026-10-18; drawn SVG branches replaced by the client's photos for realism |
| D21 | Orders hold lines (`order_lines`: product or program, title and unit price snapshots, qty 1–20, up to 30 lines). The cart is products only and lives in the browser; programs are ordered directly. The API still accepts the pre-M8 `item` + `qty` body                                                                             | October 2026 revisions (cart); old clients keep working                              |
| D22 | The care scheme PDF is generated per request by a Next route handler (pdf-lib, Onest embedded, theme accent, shop WhatsApp) instead of the prototype's canvas JPEG; an uploaded PDF still wins                                                                                                                                       | README §4 production note: real, selectable text                                     |
| D23 | Home rails come from three product switches (Бестселлеры, Новинки, Выбор клиник Сеула); inside a rail, products follow the catalog order, since the admin has switches and no per-rail order                                                                                                                                         | README §9: switches only                                                             |
| D24 | The KR flag in the hero trust row is a local SVG (`frontend/public/flags/kr.svg`), not the design's external link                                                                                                                                                                                                                    | The site CSP allows only own images and media hosts; no third-party request on load  |
| D25 | The catalog cart bar's «Оформить» chip uses a dark tint (`black/10`) instead of the design's `rgba(255,255,255,.2)`                                                                                                                                                                                                                  | White on the light tint is 3.7:1; WCAG 1.4.3 needs 4.5:1                             |
| D26 | The M8 migration applies the revised demo data (renames, flags, Состав texts, comparison copy, program order) only where the values are still the original seed, so owner edits survive                                                                                                                                              | Production already has owner data                                                    |
| D27 | The M8 migration is not additive (order columns move into `order_lines`, quiz enums are rebuilt), the one exception to the forward-compatible migration rule in DEPLOY §4; the deploy dumps the database before migrating; roll back by restoring that dump                                                                          | Keeping both shapes would mean dual writes and old enum values for one release       |

## 16. Risks to verify early

| Risk                                                                     | Check                                                                               | Fallback                                |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | --------------------------------------- |
| Hetzner Object Storage: browser presigned POST with policy + bucket CORS | M5 spike passed on SeaweedFS (policy, CORS); a real Hetzner bucket is checked at M7 | presigned PUT + `HeadObject` size check |
| Prisma 7 CJS output inside a Nest 11 build                               | M1                                                                                  | Prisma 6.x classic generator            |
| Native HLS support across target browsers                                | M5 on real devices                                                                  | MP4 fallback is always present          |
| Bunny webhook reliability                                                | M5                                                                                  | `video.sync` polling until ready        |
| Cloudflare proxying `media.` to the bucket host                          | M7                                                                                  | Caddy proxy (default)                   |
| Theme colours chosen by the owner breaking contrast                      | Admin shows the design's warnings; site clamps nothing                              | Owner picks a darker accent             |
