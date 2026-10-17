# API

Status: v2, 2026-10-17, aligned with the design. Once M1 lands, the generated OpenAPI document (`backend/openapi.json`,
Swagger UI at `http://localhost:4000/docs` in dev) is the source of truth; this file states intent and conventions.

## 1. Conventions

- Base URL `https://api.bombeauty.kg/v1` (dev `http://localhost:4000/v1`); Next.js server uses `http://api:4000/v1`.
- JSON, UTF-8, ISO 8601 UTC dates, money as integer сом (`…Kgs`).
- Bodies validated with zod schemas from `packages/shared`; unknown keys stripped.
- Admin lists: cursor pagination `?cursor=&limit=50` → `{ items, nextCursor }`.
- Errors:

```json
{
  "error": {
    "code": "validation_failed",
    "message": "Проверьте поля формы",
    "fields": { "phone": "phone.invalid" }
  }
}
```

| HTTP | `code`                                          | When                                                  |
| ---- | ----------------------------------------------- | ----------------------------------------------------- |
| 400  | `validation_failed`                             | zod failure; `fields` holds message codes             |
| 401  | `unauthenticated`                               | no or expired session                                 |
| 403  | `forbidden` · `csrf_failed` · `origin_mismatch` | role, CSRF or Origin check                            |
| 404  | `not_found`                                     | unknown slug/id, unpublished item on a public route   |
| 409  | `conflict`                                      | slug taken, category not empty, media or video in use |
| 413  | `too_large`                                     | upload over the limit                                 |
| 429  | `rate_limited`                                  | `Retry-After` set                                     |
| 5xx  | `internal`                                      | logged with `X-Request-Id`                            |

## 2. Auth model

| Group                                                                                                | Auth                                         | CSRF                                   | CORS                         |
| ---------------------------------------------------------------------------------------------------- | -------------------------------------------- | -------------------------------------- | ---------------------------- |
| Public (`/catalog`, `/content`, `/reviews`, `/settings/public`, `/redirects`, `/orders`, `/leads/*`) | none                                         | no                                     | `WEB_ORIGIN`, no credentials |
| `/auth/*`                                                                                            | session cookie                               | on logout                              | `ADMIN_ORIGIN`, credentials  |
| `/admin/*`                                                                                           | session + role guard                         | `X-CSRF-Token` + `Origin` on mutations | `ADMIN_ORIGIN`, credentials  |
| `/webhooks/bunny`                                                                                    | none (triggers a verified status fetch only) | no                                     | none                         |

Session cookie `__Host-bb_sid` (prod) / `bb_sid` (dev). The CSRF token is an HMAC of the session id returned in the body
of login and `/auth/me`; there is no CSRF cookie.

## 3. Rate limits (per client IP)

| Route              | Limit                                                              |
| ------------------ | ------------------------------------------------------------------ |
| `POST /orders`     | 6 / min, 30 / hour                                                 |
| `POST /leads/*`    | 10 / min, 60 / hour (each)                                         |
| `POST /auth/login` | 5 / min per IP and 10 / 15 min per email, then exponential lockout |
| Public GETs        | 120 / min                                                          |
| Admin              | 600 / min per session                                              |

## 4. Public endpoints

| Method & path                       | Query                                               | Response                                                                |
| ----------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------- |
| `GET /catalog/categories`           |                                                     | `{ slug, name, count }[]` (published products only)                     |
| `GET /catalog/products`             | `category?`                                         | `ProductCard[]` ordered by category order, product order                |
| `GET /catalog/products/:slug`       |                                                     | `ProductDetail` (gallery, programs it belongs to)                       |
| `GET /catalog/programs`             |                                                     | `ProgramCard[]` (published, by order)                                   |
| `GET /catalog/programs/:slug`       |                                                     | `ProgramDetail`                                                         |
| `GET /catalog/brands`               |                                                     | `{ slug, name }[]` with at least one published product                  |
| `GET /catalog/sitemap`              |                                                     | `{ programs, products: { slug, updatedAt }[] }`                         |
| `GET /content/:key`                 | `home \| wholesale \| delivery \| privacy \| offer` | `{ key, data, updatedAt }` with media and video refs resolved           |
| `GET /reviews`                      |                                                     | `ReviewCard[]` (visible; demo ones only when no real review is visible) |
| `GET /settings/public`              |                                                     | `PublicSettings`                                                        |
| `GET /redirects/resolve`            | `path`                                              | `{ toPath, statusCode }` or 404                                         |
| `POST /orders`                      |                                                     | `201 { id, number }`                                                    |
| `POST /leads/*`                     |                                                     | `201 { id }`                                                            |
| `POST /webhooks/bunny`              |                                                     | `204`                                                                   |
| `GET /health` · `GET /health/ready` |                                                     | liveness · db + redis                                                   |

Public GETs send `Cache-Control: public, max-age=60, stale-while-revalidate=300` for browser use; Next.js relies on its
own tagged cache instead.

Response shapes (`packages/shared/src/schemas/catalog.ts`):

```ts
type ImageRef = {
  id: string;
  width: number;
  height: number;
  alt: string;
  blurDataUrl: string;
  widths: number[];
};
type VideoRef = {
  id: string;
  durationSec: number;
  width: number;
  height: number;
  poster: string;
  hls: string;
  mp4: string;
};
type FileRef = { url: string; name: string; bytes: number };

type ProductCard = {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  brand: string;
  category: { slug: string; name: string };
  volume: string;
  purpose: string;
  priceKgs: number;
  badge: string | null;
  inStock: boolean;
  image: ImageRef | null;
};
type ProductDetail = ProductCard & {
  description: string;
  howToUse: string;
  inci: string | null;
  images: ImageRef[];
  programs: { slug: string; title: string }[];
  seo: { title: string | null; description: string | null };
};
type ProgramCard = {
  id: string;
  slug: string;
  title: string;
  symptom: string;
  badge: string | null;
  priceKgs: number;
  inStock: boolean;
  itemCount: number;
  thumbs: ImageRef[];
  video: Pick<VideoRef, 'durationSec' | 'poster'> | null;
  quiz: { goal: QuizGoal | null; skins: SkinType[] }; // the site ranks quiz results locally
};
type ProgramDetail = ProgramCard & {
  headline: string | null;
  course: string;
  fit: string[];
  description: string;
  items: (ProductCard & { order: number })[];
  sumKgs: number; // sum of item prices, for "По отдельности"
  steps: { am: RoutineStep[]; pm: RoutineStep[] }; // RoutineStep = { productSlug, title, text }
  video: VideoRef | null;
  protocol: FileRef | null;
  seo: { title: string | null; description: string | null };
};
type ReviewCard = { id: string; image: ImageRef };
type PublicSettings = {
  shop: {
    name: string;
    whatsapp: string;
    instagramShop: string;
    instagramOwner: string;
    ownerName: string;
    legalLine: string;
    footerNote: string;
  };
  appearance: { theme: ThemeKey; headerColor: string; accentColor: string };
  currencies: { code: CurrencyCode; rate: number }[]; // enabled ones; KGS always first
  seo: {
    defaultTitle: string;
    defaultDescription: string;
    ogImage: ImageRef | null;
    googleVerification: string | null;
    yandexVerification: string | null;
  };
  analytics: { umamiWebsiteId: string | null; metaPixelId: string | null };
  turnstileSiteKey: string | null;
};
```

### POST /orders

```ts
{
  clientRef: uuid,
  item: { type: 'product', slug } | { type: 'program', slug },
  qty: 1..9,
  name: string (2..80), phone: string, address: string (4..300), comment?: string (..500),
  displayCurrency: CurrencyCode, displayRate?: number,
  message: string (..2000),            // the exact WhatsApp text
  fromQuiz?: boolean,
  pageUrl: url, referrer?: string, utm?: { source?, medium?, campaign?, content?, term? },
  website: '' ,                        // honeypot; non-empty → fake 201, nothing stored
  turnstileToken?: string              // required when Turnstile is enabled
}
```

Server: item must be published; unit price and total from the DB; phone normalised to E.164 (KG default, international
accepted); a repeated `clientRef` returns the original `201` body.

### POST /leads/quiz and POST /leads/wholesale

```ts
// POST /leads/quiz
{ clientRef, answers: { skin, goal, exp, fmt }, choose?: boolean, message, pageUrl, referrer?, utm?, website, turnstileToken? }
// POST /leads/wholesale
{ clientRef, answers: { buyer?, country? }, message, pageUrl, referrer?, utm?, website, turnstileToken? }
```

Server recomputes `recommended` for quiz leads with `rankPrograms` over published programs.

## 5. Auth endpoints

| Method & path       | Body                            | Response                                          |
| ------------------- | ------------------------------- | ------------------------------------------------- |
| `POST /auth/login`  | `{ email, password, remember }` | `200 { user, csrfToken }` + cookie; generic `401` |
| `POST /auth/logout` |                                 | `204`                                             |
| `GET /auth/me`      |                                 | `{ user: { id, email, name, role }, csrfToken }`  |

## 6. Admin endpoints

**O** = owner only, **M** = owner and manager.

### Orders, leads, customers, dashboard

| Method & path                  | Role | Notes                                                                                                                                                                                                   |
| ------------------------------ | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /admin/orders`            | M    | `status?`, `q?` (name, phone, item, number), `from?`, `to?`, cursor → rows `{ id, number, name, phone, itemTitle, itemType, qty, address, city, totalKgs, status, createdAt }`                          |
| `GET /admin/orders/counters`   | M    | `{ all, new, sent, cancelled }` (polled every 15 s)                                                                                                                                                     |
| `GET /admin/orders/:id`        | M    | all fields incl. message, comment, UTM, note, status history from AuditLog                                                                                                                              |
| `PATCH /admin/orders/:id`      | M    | `{ status?, note? }`                                                                                                                                                                                    |
| `GET /admin/orders/export.csv` | O    | same filters; UTF-8 BOM, `;` separator, Asia/Bishkek times                                                                                                                                              |
| `DELETE /admin/orders/:id`     | O    | personal-data deletion on request                                                                                                                                                                       |
| `GET /admin/leads`             | M    | `kind?`, cursor                                                                                                                                                                                         |
| `GET /admin/customers`         | M    | `q?`, sort by total → `{ name, phone, city, count, totalKgs, lastOrderAt, favorite }[]`                                                                                                                 |
| `GET /admin/dashboard`         | M    | `period=today\|week\|month` → `{ cards: { orders, ordersDelta, awaiting, sumKgs, avgKgs, cancelled, cancelledWeek }, recent: OrderRow[6], byProgram: { title, count }[] (7 days), programOrdersTotal }` |

### Catalog

| Resource   | Endpoints                                                                                                                              | Notes                                                                                                                                                        |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Categories | `GET`, `POST`, `PUT /:id`, `DELETE /:id` (409 unless empty)                                                                            |                                                                                                                                                              |
| Brands     | `GET ?q=`                                                                                                                              | autocomplete; created implicitly by product saves                                                                                                            |
| Products   | `GET ?category=&q=`, `POST`, `GET /:id`, `PUT /:id`, `PATCH /:id` (`{ inStock?, published? }`), `DELETE /:id` (409 while in a program) | `PUT` takes the full object incl. `brandName`, `imageIds[]` (≤ 3, ordered)                                                                                   |
| Programs   | `GET`, `POST`, `GET /:id`, `PUT /:id`, `PATCH /:id` (`{ published?, inStock? }`), `DELETE /:id`                                        | `PUT` takes `itemSlugs[]` ordered, `steps: { am: [{ productId, text }], pm: [...] }`, `videoId?`, `protocolMediaId?`; response includes `sumKgs` and savings |
| Reviews    | `GET`, `POST` (`{ mediaIds[] }`), `PATCH /:id` (`{ isHidden }`), `PUT /admin/reviews/order` (`{ ids }`), `DELETE /:id`                 |                                                                                                                                                              |

Every catalog mutation writes AuditLog and enqueues `web.revalidate` with affected tags (product changes also revalidate
`programs`).

### Content, appearance, settings, media, video, users

| Method & path                                                   | Role                                                     | Notes                                                                                                                                                                           |
| --------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /admin/content/:key` · `PUT /admin/content/:key`           | M                                                        | validated per key                                                                                                                                                               |
| `GET /admin/settings` · `PUT /admin/settings/:key`              | M for `appearance`, `currencies`, `shop`; O for the rest | validated per key                                                                                                                                                               |
| `POST /admin/settings/notifications/test`                       | O                                                        | Telegram + email test, per-channel result                                                                                                                                       |
| `POST /admin/media/presign`                                     | M                                                        | `{ purpose: product\|review\|content\|protocol\|catalog\|seo, contentType, size, fileName }` → `{ mediaId, upload: { url, fields }, expiresAt }` (images ≤ 15 MB, PDFs ≤ 20 MB) |
| `POST /admin/media/:id/complete`                                | M                                                        | verifies the object, enqueues `media.process`                                                                                                                                   |
| `GET /admin/media/:id`                                          | M                                                        | status + refs (polled until `ready`)                                                                                                                                            |
| `POST /admin/videos`                                            | M                                                        | `{ title, fileName, size }` (≤ 200 MB) → `{ id, tus: { endpoint, headers: { AuthorizationSignature, AuthorizationExpire, VideoId, LibraryId } } }`                              |
| `GET /admin/videos/:id` · `DELETE /admin/videos/:id`            | M                                                        | status; delete 409 while referenced                                                                                                                                             |
| `GET /admin/users` · `POST` · `PUT /:id` · `POST /:id/password` | O                                                        | password change revokes that user's sessions                                                                                                                                    |
| `POST /admin/sessions/revoke-all`                               | O                                                        | "Выйти на всех устройствах"                                                                                                                                                     |
| `GET /admin/audit`                                              | O                                                        | `entity?`, `userId?`, `from?`, `to?`, cursor                                                                                                                                    |
| `GET /admin/export.json`                                        | O                                                        | all data except password hashes and sessions                                                                                                                                    |

## 7. Web (Next.js) endpoints

| Method & path          | Auth                  | Purpose                                                      |
| ---------------------- | --------------------- | ------------------------------------------------------------ |
| `POST /api/revalidate` | `X-Revalidate-Secret` | `{ tags: string[] }` → `revalidateTag`; called by the worker |
| `GET /health`          | none                  | liveness                                                     |

## 8. Background jobs (BullMQ)

| Job                | Trigger                                                | Payload          | Retries         | Notes                                                                             |
| ------------------ | ------------------------------------------------------ | ---------------- | --------------- | --------------------------------------------------------------------------------- |
| `media.process`    | media complete                                         | `{ mediaId }`    | 3, exp. backoff | images: variants, blur, metadata strip, HEIC fallback; PDFs: validate and publish |
| `video.sync`       | video created, webhook, then every 30 s until terminal | `{ videoId }`    | up to 1 h       | reads Bunny status, duration, dimensions, URLs                                    |
| `notify.telegram`  | order created (leads if enabled)                       | `{ entity, id }` | 5, exp. backoff | falls back to `notify.email`                                                      |
| `notify.email`     | Telegram failure or email enabled                      | `{ entity, id }` | 5               | SMTP (Mailpit in dev)                                                             |
| `uploads.cleanup`  | hourly                                                 |                  | 1               | removes expired pending media                                                     |
| `sessions.cleanup` | daily                                                  |                  | 1               | removes expired sessions                                                          |
| `web.revalidate`   | catalog/content/settings mutation                      | `{ tags }`       | 8, exp. backoff | deduplicated per tag set within 2 s                                               |
| `indexnow.submit`  | program/product publish or slug change                 | `{ urls }`       | 3               |                                                                                   |
