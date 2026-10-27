# Data model

Status: v4, 2026-10-23, aligned with the design, the October 2026 revisions (M8: order lines, quiz enums, product
rail flags, program cover) and online payment (M9: payment fields on orders, `payments`, `payment_events`, the
`payments` setting). The Prisma schema below is the M1 target; changes during implementation update this file in the
same commit.

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
enum PaymentMethod      { whatsapp finik }
enum OrderPaymentStatus { unpaid pending paid refunded }
enum PaymentStatus      { created pending succeeded failed expired }
enum PaymentPurpose     { order check }
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
| PaymentMethod         | whatsapp: WhatsApp · finik: Онлайн (Finik)                                                                                                                                                                                                                                     |
| OrderPaymentStatus    | unpaid: Не оплачен · pending: Ждёт оплаты · paid: Оплачен · refunded: Возврат                                                                                                                                                                                                  |
| PaymentStatus         | created: Создаётся · pending: Ссылка выдана · succeeded: Оплачен · failed: Ошибка · expired: Истекла                                                                                                                                                                           |
| Payment channel       | qr: QR-код · visa: Visa (a string column, from the webhook's `service.id`)                                                                                                                                                                                                     |

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
  order     Int     @default(0)                    // 0 = main photo; up to 10 (the design shows 3)
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

  // Online payment (M9): payment state sits beside the fulfilment status above.
  paymentMethod    PaymentMethod      @default(whatsapp)
  paymentStatus    OrderPaymentStatus @default(unpaid)
  paidAt           DateTime?
  unpaidNotifiedAt DateTime?                       // the "не оплачен" Telegram message went out (once)
  payToken         String             @unique @default(dbgenerated("replace(gen_random_uuid()::text, '-', '')"))
                                                    // /pay/<token>: 122 random bits, never derived from the id
  adjustmentKgs    Int                @default(0)  // owner's signed correction while unpaid; due = totalKgs + adjustmentKgs
  adjustmentNote   String?                          // "Доставка", "Скидка"
  payments         Payment[]

  @@index([status, createdAt])
  @@index([createdAt])
  @@index([phone])
  @@index([paymentStatus, createdAt])
  @@map("orders")
  // Raw SQL CHECK: total_kgs >= 0.
}

/// One attempt to collect money through Finik; `id` is sent to Finik as PaymentId.
model Payment {
  id              String         @id @default(uuid(7)) @db.Uuid
  orderId         String?        @db.Uuid           // null for the admin's check, or after the order was deleted
  order           Order?         @relation(fields: [orderId], references: [id], onDelete: SetNull)
  purpose         PaymentPurpose @default(order)    // check = the 1 сом connection test
  provider        String         @default("finik")
  environment     String                            // mock | beta | prod at creation
  status          PaymentStatus  @default(created)
  amountKgs       Int                               // what Finik was asked to charge (server total + adjustment)
  paymentUrl      String?                           // Finik's page: a bearer link, never logged
  expiresAt       DateTime                          // Finik's endDate
  error           String?                           // why Finik refused ("Finik 403: Forbidden", "timeout")
  transactionId   String?                           // from the webhook; not unique
  operationId     String?                           // webhook `id`, Finik's operation id
  receiptNumber   String?
  paidAmountTyiyn Int?                              // webhook amount × 100
  channel         String?                           // qr | visa
  paidAt          DateTime?
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
  events          PaymentEvent[]

  @@index([orderId, createdAt])
  @@index([status, expiresAt])
  @@map("payments")
  // Raw SQL CHECKs: amount_kgs > 0, paid_amount_tyiyn >= 0, environment in (mock, beta, prod), channel in (qr, visa).
}

/// Every verified Finik webhook, once. Whitelisted fields only, no personal data.
model PaymentEvent {
  id        String   @id @default(uuid(7)) @db.Uuid
  paymentId String?  @db.Uuid
  payment   Payment? @relation(fields: [paymentId], references: [id], onDelete: SetNull)
  dedupeKey String   @unique                        // webhook id, else transactionId, else sha256 of the raw body
  status    String                                  // as Finik sent it ("SUCCEEDED")
  outcome   String                                  // applied · duplicate_payment · amount_mismatch · paid_cancelled ·
                                                    // paid_deleted · check_paid · foreign_account · unverified_account ·
                                                    // failed · unknown_payment · ignored
  data      Json
  createdAt DateTime @default(now())

  @@index([paymentId])
  @@map("payment_events")
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
  entity    String                                  // "product", "program", "order", "setting:appearance", "user", "session", "payment"
  entityId  String
  action    String                                  // create · update · delete · status · login · logout · revoke_sessions · export ·
                                                    // payment ({ from, to, source: finik | manual }) · adjustment ({ from, to }) · check
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

| Key             | Shape                                                                                                                                                                                                                                                                          | Public |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| `shop`          | `{ name: "Bom Beauty", whatsapp: E.164, instagramShop: "bom_beauty.kr", instagramOwner: "nurai.krsel", ownerName: "Нурайым Бекиева", legalLine: "ИП Бекиева Н.", footerNote }`                                                                                                 | yes    |
| `appearance`    | `{ theme: "rose" \| "sky" \| "indigo", headerColor: hex, accentColor: hex }`, default `{ rose, #aacdeb, #d12f63 }`                                                                                                                                                             | yes    |
| `currencies`    | `{ USD: { enabled, rate }, RUB, EUR, KZT, UZS, KRW }`; defaults from the design (87.4, 0.93, 102, 6, 140, 16)                                                                                                                                                                  | yes    |
| `notifications` | `{ telegramEnabled, telegramChatId?, emailEnabled, email?, notifyLeads }`                                                                                                                                                                                                      | no     |
| `seo`           | `{ defaultTitle, defaultDescription, ogMediaId?, googleVerification?, yandexVerification? }`                                                                                                                                                                                   | yes    |
| `analytics`     | `{ umamiWebsiteId?, metaPixelId?, metaPixelEnabled }`                                                                                                                                                                                                                          | partly |
| `antispam`      | `{ turnstileEnabled }` (keys in env)                                                                                                                                                                                                                                           | flag   |
| `payments`      | `{ finikEnabled (false), defaultMethod: "finik" \| "whatsapp", linkTtlMinutes (60, 10–1440), visa (false), notifyUnpaid (true), templates: { link, paidLocal, paidAbroad } }`; owner only. Public: `{ finik: finikEnabled && the server has Finik keys, defaultMethod, visa }` | partly |

## 4. Content block keys (`ContentBlock.data`)

| Key         | Shape                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Used on                    |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `home`      | `{ heroTitle ("Время *расцвета* и сияния вашей кожи"; `_…_` marks the accent word), heroSubtitle, heroPhotoMediaId?, greetingVideoId?, catalogImageMediaId? (the «Каталог» card, 2:1), comparison: { title, subtitle, mass: { eyebrow, title, points: [{ title, text }] }, pro: { eyebrow, title, points: [{ title, text }] } }, about: { caption, text, stats: [{ value, label } ×2], photoMediaId? }, reviewsTitle, reviewsSubtitle }`. Since M8 `heroBadge`, `quizPrompt` and `entries` are gone; plain-string points from older data read as `{ title, text: "" }` | `/`                        |
| `wholesale` | `{ phone, whatsapp?, eyebrow, title, subtitle, facts[3], quote, intro[], stats: [{ value, label }], expertise[], featuredProductIds[], benefits: [{ title, text } ×4], steps: [{ title, text } ×4], stockNote, delivery: [{ region, flags[], airDays, seaDays }], catalogMediaId?, protocolsMediaId?, portraitMediaId?, videoId? }`                                                                                                                                                                                                                                    | `/wholesale`               |
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

Payment, beside the status above (M9):

```
unpaid ──► pending ──► paid ──► refunded        pending: a Finik link is live (online order or «Оплатить» on /pay)
  ▲           │          ▲                       paid: a verified webhook, or the team by hand (AuditLog source)
  └───────────┘          │                       refunded: by hand, after a refund in Finik's cabinet
   link failed/expired   └── a late webhook still pays an expired attempt
```

- WhatsApp orders start `unpaid`, online orders `pending`. The admin can set `unpaid`, `paid` or `refunded`; `pending`
  comes only from live links.
- Attempts: `created` → `pending` (Finik answered with a link) or `failed`; `pending` → `succeeded` (webhook) or
  `expired` (`payments.expire`, 10 minutes after `expiresAt`); a late success webhook turns `expired` into `succeeded`.
- The adjustment can change only while the order is unpaid; changing the amount of a `pending` order sets it back to
  `unpaid` (its link was for the old amount).

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
- Dev only: ~20 demo orders across statuses (the design's `ORDERS0`, one of them a 3-line cart) and a few leads; the
  `payments` setting on with WhatsApp preselected (mock Finik), and two online orders (one paid, one left unpaid).
- Idempotent: upsert by slug/key.
