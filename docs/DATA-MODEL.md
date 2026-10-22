# Data model

Status: v3, 2026-10-22, aligned with the design and the October 2026 revisions (M8: order lines, quiz enums, product
rail flags, program cover). The Prisma schema below is the M1 target; changes during implementation
update this file in the same commit.

Conventions:

- IDs are UUIDv7 (`@default(uuid(7)) @db.Uuid`).
- Money is an integer number of сом. Other currencies are display-only, computed from rates in settings.
- Timestamps are UTC (`timestamptz`); the UI shows `Asia/Bishkek`.
- Tables snake_case plural via `@@map`, columns snake_case via `@map` (omitted below for readability).
- Enums are mirrored in `packages/shared/src/enums.ts`; a test keeps them equal.
- JSON columns are validated with zod schemas from `packages/shared` on write and read.

## 1. Enums and labels

```prisma
enum UserRole      { owner manager }
enum OrderStatus   { new sent cancelled }
enum OrderItemType { product program }
enum LeadKind      { quiz wholesale }
enum MediaBucket   { public private }
enum MediaKind     { image pdf }
enum MediaStatus   { pending processing ready failed }
enum VideoStatus   { created uploading processing ready failed }
enum RoutinePeriod { am pm }
enum QuizGoal      { acne pigment age calm glow }
enum SkinType      { oily combo dry sens normal }
```

| Value set             | Labels (in `packages/shared/src/labels.ts`)                                                                                                                                                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| OrderStatus           | new: Новый · sent: Отправлен · cancelled: Отменён                                                                                                                                                                                                                              |
| OrderItemType         | product: Товар · program: Программа                                                                                                                                                                                                                                            |
| QuizGoal              | acne: Высыпания, чёрные точки, комедоны · pigment: Пигментация, постакне, неровный тон · age: Упругость, морщины, овал лица · calm: Краснота, шелушения, чувствительность · glow: Тусклая кожа: сияние и увлажнение (admin labels; the quiz shows the design's longer answers) |
| SkinType              | oily: Жирная · combo: Комбинированная · dry: Сухая · sens: Чувствительная · normal: Нормальная                                                                                                                                                                                 |
| Badges (string list)  | Выбор Нурайым · Хит продаж · Хит эксперта · Новинка · Для зрелой кожи                                                                                                                                                                                                          |
| Wholesale buyer kinds | cosmo: Косметолог · clinic: Клиника · salon: Салон · shop: Магазин косметики                                                                                                                                                                                                   |
| Wholesale countries   | kg: Кыргызстан · kz: Казахстан · uz: Узбекистан · ru: Россия                                                                                                                                                                                                                   |
| Quiz experience       | pro · some · new (labels in `quiz.ts`, verbatim from the design)                                                                                                                                                                                                               |
| Quiz age              | u25: До 25 лет · 25: 25–35 лет · 35: 35–45 лет · 45: 45+ лет                                                                                                                                                                                                                   |

M8 migration: `barrier` goals became `calm` when the program targets sensitive skin, otherwise `glow`. Leads saved before
M8 keep their old answers (`skin, goal, exp, fmt`); `quizLeadAnswers` labels both versions.

## 2. Schema

```prisma
generator client {
  provider     = "prisma-client"
  output       = "../src/generated/prisma"
  moduleFormat = "cjs"
}

datasource db {
  provider = "postgresql"   // url in prisma.config.ts (DATABASE_URL)
}

// ───────────── Users and auth ─────────────

model User {
  id           String    @id @default(uuid(7)) @db.Uuid
  email        String    @unique                   // lowercased
  passwordHash String                              // argon2id
  name         String
  role         UserRole  @default(manager)
  isActive     Boolean   @default(true)
  lastLoginAt  DateTime?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  sessions     Session[]
}

model Session {
  id         String   @id                          // sha256(cookie token), hex
  userId     String   @db.Uuid
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  rememberMe Boolean  @default(false)
  expiresAt  DateTime
  lastSeenAt DateTime @default(now())
  userAgent  String?
  ip         String?
  createdAt  DateTime @default(now())

  @@index([userId])
  @@index([expiresAt])
}

// ───────────── Catalog ─────────────

model Category {
  id       String    @id @default(uuid(7)) @db.Uuid
  slug     String    @unique
  name     String                                  // "Очищение"
  order    Int       @default(0)
  products Product[]
}

model Brand {
  id       String    @id @default(uuid(7)) @db.Uuid
  slug     String    @unique
  name     String    @unique                       // created on the fly from the product form
  products Product[]
}

model Product {
  id             String         @id @default(uuid(7)) @db.Uuid
  slug           String         @unique
  name           String                            // "Успокаивающая cica-сыворотка"
  shortName      String?                           // "Cica-сыворотка", used in routine steps; falls back to name
  brandId        String         @db.Uuid
  brand          Brand          @relation(fields: [brandId], references: [id], onDelete: Restrict)
  categoryId     String         @db.Uuid
  category       Category       @relation(fields: [categoryId], references: [id], onDelete: Restrict)
  volume         String         @default("")       // "50 мл"
  priceKgs       Int
  purpose        String         @default("")       // "Коротко, для карточки"
  description    String         @default("")
  howToUse       String         @default("")
  inci           String?                           // "Состав" section (admin field «Состав»); hidden when empty
  badge          String?                           // one of the badge labels; «Новинка» wins while isNew is on
  bestseller     Boolean        @default(false)    // home rail «Бестселлеры BOM BEAUTY»
  seoulChoice    Boolean        @default(false)    // home rail «Выбор клиник Сеула»
  isNew          Boolean        @default(false)    // home rail «Новинки» + the «Новинка» label everywhere
  inStock        Boolean        @default(true)
  published      Boolean        @default(true)
  order          Int            @default(0)
  seoTitle       String?
  seoDescription String?
  images         ProductImage[]
  programItems   ProgramItem[]
  routineSteps   ProgramStep[]
  orderLines     OrderLine[]
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt

  @@index([categoryId, published])
  @@index([brandId])
}

model ProductImage {
  productId String  @db.Uuid
  mediaId   String  @db.Uuid
  product   Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  media     Media   @relation(fields: [mediaId], references: [id], onDelete: Restrict)
  order     Int     @default(0)                    // 0 = main photo; the design shows 3
  alt       String  @default("")

  @@id([productId, mediaId])
  @@index([productId, order])
}

model Program {
  id              String        @id @default(uuid(7)) @db.Uuid
  slug            String        @unique
  title           String                           // "Акне и постакне"
  headline        String?                          // accent part of "Уход при …": "акне и постакне"
  symptom         String        @default("")       // card subtitle
  description     String        @default("")       // meta description, OG
  course          String        @default("")       // "Утро и вечер, курс на 6–8 недель"
  fit             String[]                         // "Кому подходит"
  priceKgs        Int
  badge           String?
  quizGoal        QuizGoal?                        // null = not in quiz results
  quizSkins       SkinType[]                       // empty = any skin
  published       Boolean       @default(false)
  inStock         Boolean       @default(true)     // false = "Под заказ из Кореи"
  videoId         String?       @db.Uuid
  video           Video?        @relation("ProgramVideo", fields: [videoId], references: [id], onDelete: SetNull)
  protocolMediaId String?       @db.Uuid
  protocol        Media?        @relation("ProgramProtocol", fields: [protocolMediaId], references: [id], onDelete: SetNull)  // «Схема ухода» PDF; generated when null
  coverMediaId    String?       @db.Uuid
  cover           Media?        @relation("ProgramCover", fields: [coverMediaId], references: [id], onDelete: SetNull)  // 5:4 home card photo
  order           Int           @default(0)
  seoTitle        String?
  seoDescription  String?
  items           ProgramItem[]
  steps           ProgramStep[]                    // no longer shown on the page; feed the care scheme PDF
  orderLines      OrderLine[]
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@index([published, order])
}

model ProgramItem {
  programId String  @db.Uuid
  productId String  @db.Uuid
  program   Program @relation(fields: [programId], references: [id], onDelete: Cascade)
  product   Product @relation(fields: [productId], references: [id], onDelete: Restrict)
  order     Int     @default(0)                    // "Порядок здесь = порядок на сайте"

  @@id([programId, productId])
  @@index([programId, order])
}

model ProgramStep {
  id        String        @id @default(uuid(7)) @db.Uuid
  programId String        @db.Uuid
  program   Program       @relation(fields: [programId], references: [id], onDelete: Cascade)
  period    RoutinePeriod
  order     Int           @default(0)
  productId String        @db.Uuid                 // must be one of the program's items (checked in the service)
  product   Product       @relation(fields: [productId], references: [id], onDelete: Cascade)
  text      String                                 // "Мягко очищает и не стягивает кожу"

  @@index([programId, period, order])
}

model Review {
  id        String   @id @default(uuid(7)) @db.Uuid
  mediaId   String   @unique @db.Uuid              // chat screenshot
  media     Media    @relation(fields: [mediaId], references: [id], onDelete: Restrict)
  order     Int      @default(0)
  isHidden  Boolean  @default(false)
  isDemo    Boolean  @default(false)               // seeded examples; hidden on the site once a real review is visible
  createdAt DateTime @default(now())

  @@index([isHidden, order])
}

// ───────────── Media and video ─────────────

model Media {
  id           String      @id @default(uuid(7)) @db.Uuid
  bucket       MediaBucket                         // where the current object lives
  kind         MediaKind
  status       MediaStatus @default(pending)
  key          String?                             // current object key
  mime         String?
  originalName String?
  width        Int?
  height       Int?
  bytes        Int?
  blurDataUrl  String?                             // 24 px WebP data URL
  variants     Json?                               // { widths: number[], formats: ["avif","webp"] }
  error        String?
  uploadedById String?     @db.Uuid
  expiresAt    DateTime?                           // pending uploads are removed after this
  createdAt    DateTime    @default(now())
  processedAt  DateTime?

  productImages ProductImage[]
  protocolOf    Program[]    @relation("ProgramProtocol")
  coverOf       Program[]    @relation("ProgramCover")
  review        Review?

  @@index([status, expiresAt])
}

model Video {
  id           String      @id @default(uuid(7)) @db.Uuid
  provider     String      @default("bunny")
  libraryId    String
  externalId   String      @unique                 // Bunny video GUID
  status       VideoStatus @default(created)
  title        String
  originalName String?
  bytes        Int?
  durationSec  Int?
  width        Int?
  height       Int?
  thumbnailUrl String?
  hlsUrl       String?
  mp4Url       String?                             // 720p fallback
  error        String?
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt
  programs     Program[]   @relation("ProgramVideo")

  @@index([status])
}
// Home greeting and wholesale videos are referenced by id from ContentBlock JSON; deletion checks those references.

// ───────────── Content and settings ─────────────

model ContentBlock {
  key         String   @id                         // section 4
  data        Json
  updatedAt   DateTime @updatedAt
  updatedById String?  @db.Uuid
}

model Setting {
  key         String   @id                         // section 3
  value       Json
  updatedAt   DateTime @updatedAt
  updatedById String?  @db.Uuid
}

model Redirect {
  id         String   @id @default(uuid(7)) @db.Uuid
  fromPath   String   @unique                      // "/programs/old-slug"
  toPath     String
  statusCode Int      @default(308)
  hits       Int      @default(0)
  createdAt  DateTime @default(now())

  @@index([toPath])
}

// ───────────── Orders and leads ─────────────

model Order {
  id              String        @id @default(uuid(7)) @db.Uuid
  number          Int           @unique @default(autoincrement())   // sequence starts at 1001 (migration)
  status          OrderStatus   @default(new)
  lines           OrderLine[]                      // 1–30, in the order the client saw them
  totalKgs        Int                              // sum of the lines, computed on the server
  name            String
  phone           String                           // E.164
  address         String                           // "Город, улица, дом, квартира"
  comment         String?
  displayCurrency String        @default("KGS")    // what the client saw
  displayRate     Float?                           // rate used for the display price
  message         String                           // exact WhatsApp text
  fromQuiz        Boolean       @default(false)
  note            String        @default("")       // owner's private note
  pageUrl         String?
  referrer        String?
  utm             Json?
  clientRef       String        @unique            // browser idempotency key
  ipHash          String?
  userAgent       String?
  statusChangedAt DateTime      @default(now())
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@index([status, createdAt])
  @@index([createdAt])
  @@index([phone])
  @@map("orders")
  // Raw SQL CHECK: total_kgs >= 0.
}

model OrderLine {
  id           String        @id @default(uuid(7)) @db.Uuid
  orderId      String        @db.Uuid
  order        Order         @relation(fields: [orderId], references: [id], onDelete: Cascade)
  position     Int           @default(0)
  type         OrderItemType
  productId    String?       @db.Uuid
  product      Product?      @relation(fields: [productId], references: [id], onDelete: SetNull)
  programId    String?       @db.Uuid
  program      Program?      @relation(fields: [programId], references: [id], onDelete: SetNull)
  title        String                              // snapshot: product name or program title
  unitPriceKgs Int                                 // computed on the server
  qty          Int                                 // 1–20
  totalKgs     Int

  @@index([orderId, position])
  @@index([programId])
  @@index([productId])
  @@map("order_lines")
  // The service sets the id that matches `type` at creation; it may become null later when the item is deleted (title
  // and prices keep the history). Raw SQL CHECKs: qty BETWEEN 1 AND 20, unit_price_kgs and total_kgs >= 0. The M8
  // migration turned every older order into one line.
}

model Lead {
  id          String   @id @default(uuid(7)) @db.Uuid
  kind        LeadKind
  answers     Json                                 // quiz: { goal, skin, exp, age } (before M8: { skin, goal, exp, fmt }) · wholesale: { buyer, country }
  recommended String[]                             // quiz: program slugs in ranked order
  choose      Boolean  @default(false)             // quiz: "Помогите выбрать" (every quiz lead since M8)
  message     String                               // exact WhatsApp text
  pageUrl     String?
  referrer    String?
  utm         Json?
  clientRef   String   @unique
  ipHash      String?
  createdAt   DateTime @default(now())

  @@index([kind, createdAt])
}

model AuditLog {
  id        String   @id @default(uuid(7)) @db.Uuid
  userId    String?  @db.Uuid
  entity    String                                  // "product", "program", "order", "setting:appearance", "user", "session"
  entityId  String
  action    String                                  // create · update · delete · status · login · logout · revoke_sessions · export
  diff      Json     @default("{}")                 // { field: [before, after] }; long texts as { changed: true }
  ip        String?
  createdAt DateTime @default(now())

  @@index([entity, entityId])
  @@index([createdAt])
}
```

Customers are not a table: `GET /admin/customers` groups orders by `phone` (name and address from the latest order; city
is the first comma-separated part of the address; total excludes cancelled orders; "Чаще заказывает" is the most frequent
line `title`).

## 3. Settings keys (`Setting.value`)

| Key             | Shape                                                                                                                                                                          | Public |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| `shop`          | `{ name: "Bom Beauty", whatsapp: E.164, instagramShop: "bom_beauty.kr", instagramOwner: "nurai.krsel", ownerName: "Нурайым Бекиева", legalLine: "ИП Бекиева Н.", footerNote }` | yes    |
| `appearance`    | `{ theme: "rose" \| "sky" \| "indigo", headerColor: hex, accentColor: hex }`, default `{ rose, #aacdeb, #d12f63 }`                                                             | yes    |
| `currencies`    | `{ USD: { enabled, rate }, RUB, EUR, KZT, UZS, KRW }`; defaults from the design (87.4, 0.93, 102, 6, 140, 16)                                                                  | yes    |
| `notifications` | `{ telegramEnabled, telegramChatId?, emailEnabled, email?, notifyLeads }`                                                                                                      | no     |
| `seo`           | `{ defaultTitle, defaultDescription, ogMediaId?, googleVerification?, yandexVerification? }`                                                                                   | yes    |
| `analytics`     | `{ umamiWebsiteId?, metaPixelId?, metaPixelEnabled }`                                                                                                                          | partly |
| `antispam`      | `{ turnstileEnabled }` (keys in env)                                                                                                                                           | flag   |

## 4. Content block keys (`ContentBlock.data`)

| Key         | Shape                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Used on                    |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `home`      | `{ heroTitle ("Время *расцвета* и сияния вашей кожи"; `_…_` marks the accent word), heroSubtitle, heroPhotoMediaId?, greetingVideoId?, catalogImageMediaId? (the «Каталог» card, 2:1), comparison: { title, subtitle, mass: { eyebrow, title, points: [{ title, text }] }, pro: { eyebrow, title, points: [{ title, text }] } }, about: { caption, text, stats: [{ value, label } ×2], photoMediaId? }, reviewsTitle, reviewsSubtitle }`. Since M8 `heroBadge`, `quizPrompt` and `entries` are gone; plain-string points from older data read as `{ title, text: "" }` | `/`                        |
| `wholesale` | `{ phone, whatsapp?, eyebrow, title, subtitle, facts[3], quote, intro[], stats: [{ value, label }], expertise[], featuredProductIds[], benefits: [{ title, text } ×4], steps: [{ title, text } ×4], stockNote, delivery: [{ region, flags[], airDays, seaDays }], catalogMediaId?, portraitMediaId?, videoId? }`                                                                                                                                                                                                                                                       | `/wholesale`               |
| `delivery`  | `{ programFacts: [{ label, value }] ("Доставка по Бишкеку" · "в день оплаты", …), markdown, faq: [{ q, a }] }`                                                                                                                                                                                                                                                                                                                                                                                                                                                         | program pages, `/delivery` |
| `privacy`   | `{ markdown }`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `/privacy`                 |
| `offer`     | `{ markdown }`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `/offer`                   |

Static UI strings (buttons, section titles that the design treats as fixed, validation texts) live in `copy.ts`.

## 5. Order lifecycle

```
new ──► sent
 │
 └────► cancelled          any status can be set back; every change is logged (AuditLog, action "status")
```

`statusChangedAt` updates on every change. Dashboard "Сумма заказов" and "Средний чек" exclude cancelled orders;
"Ждут подтверждения" counts `new`.

## 6. Object keys

| Bucket  | Key                               | Notes                                                          |
| ------- | --------------------------------- | -------------------------------------------------------------- |
| private | `incoming/{mediaId}`              | presigned POST target; removed after processing                |
| private | `orig/{mediaId}.{ext}`            | original image, never linked                                   |
| public  | `p/{mediaId}/{width}.{avif,webp}` | immutable, `max-age=31536000, immutable`                       |
| public  | `p/{mediaId}/share.jpg`           | JPEG ≤ 1200 px for share cards (next/og draws no WebP)         |
| public  | `d/{mediaId}/{filename}.pdf`      | care schemes, brand catalog; `Content-Disposition: attachment` |

## 7. Seed (M1)

- Owner from `SEED_OWNER_EMAIL` / `SEED_OWNER_PASSWORD` / `SEED_OWNER_NAME`; dev-only manager.
- Categories: Очищение, Тонеры, Сыворотки, Кремы, SPF.
- Brands: Dr. SGN, Dr. SGNBIO, Merikit, TUPS Laboratories, Ronas.
- 13 products and 8 programs (with items, morning/evening steps, fit lists, quiz matching, courses, headlines) exactly as
  in `design/Bom Beauty Prototype.dc.html` (`P`, `PROGRAMS`, `P_ORDER`) and `design/BomAdmin.dc.html`; badges "Хит
  продаж" (cica) and "Выбор Нурайым" (pdrn); Состав texts and the home rail flags from the October 2026 README (§1.5).
- No media: photos, videos, care scheme PDFs, program covers and review screenshots are uploaded by the owner through
  the admin after deploy; the site shows placeholders until then.
- Settings: shop (WhatsApp `+996706304803`), appearance defaults, currencies with the design's rates, notifications off.
- Content: home, wholesale (`WS0`), delivery, placeholder privacy and offer texts marked `[...]`.
- Dev only: ~20 demo orders across statuses (the design's `ORDERS0`, one of them a 3-line cart) and a few leads.
- Idempotent: upsert by slug/key.
