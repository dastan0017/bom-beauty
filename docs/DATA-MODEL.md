# Data model

Status: v2, 2026-10-17, aligned with the design. The Prisma schema below is the M1 target; changes during implementation
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
enum QuizGoal      { age pigment acne barrier }
enum SkinType      { dry oily normal sens }
```

| Value set             | Labels (in `packages/shared/src/labels.ts`)                                                                                               |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| OrderStatus           | new: Новый · sent: Отправлен · cancelled: Отменён                                                                                         |
| OrderItemType         | product: Товар · program: Программа                                                                                                       |
| QuizGoal              | age: Возрастные изменения / лифтинг · pigment: Пигментация / тусклый цвет · acne: Высыпания / акне · barrier: Восстановление и увлажнение |
| SkinType              | dry: Сухая · oily: Комбинированная / жирная · normal: Нормальная · sens: Чувствительная                                                   |
| Badges (string list)  | Выбор Нурайым · Хит продаж · Хит эксперта · Новинка · Для зрелой кожи                                                                     |
| Wholesale buyer kinds | cosmo: Косметолог · clinic: Клиника · salon: Салон · shop: Магазин косметики                                                              |
| Wholesale countries   | kg: Кыргызстан · kz: Казахстан · uz: Узбекистан · ru: Россия                                                                              |
| Quiz experience       | pro: Да, постоянно · mass: Нет, в основном масс-маркет или аптечные марки · new: Только начинаю знакомство с корейским уходом             |
| Quiz format           | set: Готовый набор средств · wa: Персональная консультация в WhatsApp                                                                     |

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
  inci           String?                           // optional "Состав" section
  badge          String?                           // one of the badge labels
  inStock        Boolean        @default(true)
  published      Boolean        @default(true)
  order          Int            @default(0)
  seoTitle       String?
  seoDescription String?
  images         ProductImage[]
  programItems   ProgramItem[]
  routineSteps   ProgramStep[]
  orders         Order[]
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
  title           String                           // "Акне и проблемная кожа"
  headline        String?                          // accent part of "Уход при …": "акне и проблемной коже"
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
  protocol        Media?        @relation("ProgramProtocol", fields: [protocolMediaId], references: [id], onDelete: SetNull)
  order           Int           @default(0)
  seoTitle        String?
  seoDescription  String?
  items           ProgramItem[]
  steps           ProgramStep[]
  orders          Order[]
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
  itemType        OrderItemType
  productId       String?       @db.Uuid
  product         Product?      @relation(fields: [productId], references: [id], onDelete: SetNull)
  programId       String?       @db.Uuid
  program         Program?      @relation(fields: [programId], references: [id], onDelete: SetNull)
  itemTitle       String                           // snapshot: product name or program title
  unitPriceKgs    Int                              // computed on the server
  qty             Int                              // 1–9
  totalKgs        Int
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
  @@index([programId, createdAt])
  @@index([productId, createdAt])
  @@map("orders")
  // The service sets exactly one of productId/programId at creation; either may become null later when the item is
  // deleted (itemTitle and prices keep the history). Raw SQL CHECK: qty BETWEEN 1 AND 9.
}

model Lead {
  id          String   @id @default(uuid(7)) @db.Uuid
  kind        LeadKind
  answers     Json                                 // quiz: { skin, goal, exp, fmt } · wholesale: { buyer, country }
  recommended String[]                             // quiz: program slugs in ranked order
  choose      Boolean  @default(false)             // quiz: "Помогите выбрать" variant
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
`itemTitle`).

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

| Key         | Shape                                                                                                                                                                                                                                                                                                                                                                                                                            | Used on                    |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `home`      | `{ heroBadge, heroTitle ("Время *расцвета* и сияния вашей кожи"; `_…_` marks the accent word), heroSubtitle, quizPrompt, heroPhotoMediaId?, greetingVideoId?, entries: [{ key, title, text, imageMediaId? } ×3], comparison: { title, subtitle, mass: { eyebrow, title, points[] }, pro: { eyebrow, title, points[] } }, about: { caption, text, stats: [{ value, label } ×2], photoMediaId? }, reviewsTitle, reviewsSubtitle }` | `/`                        |
| `wholesale` | `{ phone, whatsapp?, eyebrow, title, subtitle, facts[3], quote, intro[], stats: [{ value, label }], expertise[], featuredProductIds[], benefits: [{ title, text } ×4], steps: [{ title, text } ×4], stockNote, delivery: [{ region, flags[], airDays, seaDays }], catalogMediaId?, portraitMediaId?, videoId? }`                                                                                                                 | `/wholesale`               |
| `delivery`  | `{ programFacts: [{ label, value }] ("Доставка по Бишкеку" · "в день оплаты", …), markdown, faq: [{ q, a }] }`                                                                                                                                                                                                                                                                                                                   | program pages, `/delivery` |
| `privacy`   | `{ markdown }`                                                                                                                                                                                                                                                                                                                                                                                                                   | `/privacy`                 |
| `offer`     | `{ markdown }`                                                                                                                                                                                                                                                                                                                                                                                                                   | `/offer`                   |

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

| Bucket  | Key                               | Notes                                                       |
| ------- | --------------------------------- | ----------------------------------------------------------- |
| private | `incoming/{mediaId}`              | presigned POST target; removed after processing             |
| private | `orig/{mediaId}.{ext}`            | original image, never linked                                |
| public  | `p/{mediaId}/{width}.{avif,webp}` | immutable, `max-age=31536000, immutable`                    |
| public  | `d/{mediaId}/{filename}.pdf`      | protocols, brand catalog; `Content-Disposition: attachment` |

## 7. Seed (M1)

- Owner from `SEED_OWNER_EMAIL` / `SEED_OWNER_PASSWORD` / `SEED_OWNER_NAME`; dev-only manager.
- Categories: Очищение, Тонеры, Сыворотки, Кремы, SPF.
- Brands: Dr. SGN, Dr. SGNBIO, Merikit, TUPS Laboratories, Ronas.
- 13 products and 5 programs (with items, morning/evening steps, fit lists, quiz matching, courses, headlines) exactly as in
  `design/Bom Beauty Prototype.dc.html` (`P`, `PROGRAMS`) and `design/BomAdmin.dc.html` (`P0`, `PROGRAMS0`); badges
  "Хит продаж" (cica) and "Выбор Нурайым" (pdrn).
- No media: photos, videos, protocol PDFs and review screenshots are uploaded by the owner through the admin after
  deploy; the site shows placeholders until then.
- Settings: shop (WhatsApp `+996706304803`), appearance defaults, currencies with the design's rates, notifications off.
- Content: home, wholesale (`WS0`), delivery, placeholder privacy and offer texts marked `[...]`.
- Dev only: ~20 demo orders across statuses (the design's `ORDERS0`) and a few leads.
- Idempotent: upsert by slug/key.
