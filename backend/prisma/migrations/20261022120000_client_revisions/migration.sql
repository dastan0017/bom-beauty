-- Client revisions, October 2026 (design/updates-2026-10/README.md): home rails, program covers, new quiz values,
-- orders with several lines (cart). Data updates touch only rows that still hold the previous demo values, so
-- nothing the owner changed in the admin is overwritten.

-- ───────────── Quiz values ─────────────

-- Goals: the old "barrier" becomes "calm" for sensitive skin, otherwise "glow" (README §9 "Migration").
ALTER TYPE "QuizGoal" RENAME TO "QuizGoal_old";
CREATE TYPE "QuizGoal" AS ENUM ('acne', 'pigment', 'age', 'calm', 'glow');
ALTER TABLE "programs" ALTER COLUMN "quiz_goal" TYPE "QuizGoal" USING (
  CASE
    WHEN "quiz_goal"::text = 'barrier' THEN
      CASE WHEN 'sens' = ANY ("quiz_skins"::text[]) THEN 'calm' ELSE 'glow' END
    ELSE "quiz_goal"::text
  END
)::"QuizGoal";
DROP TYPE "QuizGoal_old";

-- Skin types gain "combo" (a combo answer also matches programs tagged "oily").
ALTER TYPE "SkinType" RENAME TO "SkinType_old";
CREATE TYPE "SkinType" AS ENUM ('oily', 'combo', 'dry', 'sens', 'normal');
ALTER TABLE "programs" ALTER COLUMN "quiz_skins" TYPE "SkinType"[] USING "quiz_skins"::text[]::"SkinType"[];
DROP TYPE "SkinType_old";

-- ───────────── Products: home rails ─────────────

ALTER TABLE "products" ADD COLUMN "bestseller" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "is_new" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "seoul_choice" BOOLEAN NOT NULL DEFAULT false;

-- Demo defaults from the design (README §1.5).
UPDATE "products" SET "bestseller" = true WHERE "slug" IN (
  'dr-sgn-cica-serum', 'dr-sgn-pdrn-perfect-ampoule', 'dr-sgn-centella-cleansing-foam', 'merikit-hydrating-toner',
  'dr-sgnbio-sun-fluid-spf50', 'merikit-moisture-cream-gel'
);
UPDATE "products" SET "is_new" = true WHERE "slug" IN (
  'ronas-stem-cell-z-serum', 'dr-sgnbio-skin-barrier-therapy-serum', 'merikit-cleansing-oil',
  'dr-sgn-white-snow-return-toner'
);
UPDATE "products" SET "seoul_choice" = true WHERE "slug" IN (
  'ronas-stem-cell-z-serum', 'dr-sgn-white-snow-return-serum', 'dr-sgnbio-skin-barrier-therapy-serum',
  'tups-bha-toner', 'dr-sgn-white-snow-return-toner', 'dr-sgnbio-ceramide-cream'
);

-- «Состав» texts from the design, only where the field is still empty.
UPDATE "products" p SET "inci" = v.inci
FROM (VALUES
  ('dr-sgn-centella-cleansing-foam', 'Экстракт центеллы азиатской, мягкие ПАВ на основе аминокислот, пантенол, аллантоин, глицерин'),
  ('merikit-cleansing-oil', 'Масло семян подсолнечника, масло жожоба, масло виноградной косточки, эмульгатор, токоферол'),
  ('tups-bha-toner', 'Салициловая кислота (BHA), экстракт чайного дерева, ниацинамид, пантенол, бетаин'),
  ('merikit-hydrating-toner', 'Гиалуроновая кислота, бета-глюкан, пантенол, экстракт алоэ вера, аллантоин'),
  ('dr-sgn-white-snow-return-toner', 'Ниацинамид, арбутин, экстракт солодки, аденозин, гиалуроновая кислота'),
  ('dr-sgn-cica-serum', 'Экстракт центеллы азиатской, мадекассосид, пантенол, аллантоин, бета-глюкан'),
  ('dr-sgn-white-snow-return-serum', 'Ниацинамид, транексамовая кислота, арбутин, глутатион, аденозин'),
  ('dr-sgn-pdrn-perfect-ampoule', 'PDRN (полидезоксирибонуклеотид), пептиды, аденозин, гиалуроновая кислота, пантенол'),
  ('ronas-stem-cell-z-serum', 'Экстракт стволовых клеток растений, пептиды, EGF, ниацинамид, аденозин'),
  ('dr-sgnbio-skin-barrier-therapy-serum', 'Керамиды, холестерин, жирные кислоты, пантенол, сквалан'),
  ('merikit-moisture-cream-gel', 'Гиалуроновая кислота, экстракт зелёного чая, ниацинамид, бетаин, аллантоин'),
  ('dr-sgnbio-ceramide-cream', 'Керамиды, масло ши, сквалан, пантенол, гиалуроновая кислота'),
  ('dr-sgnbio-sun-fluid-spf50', 'UV-фильтры нового поколения, ниацинамид, экстракт центеллы, гиалуроновая кислота. SPF 50+ PA++++')
) AS v(slug, inci)
WHERE p."slug" = v.slug AND (p."inci" IS NULL OR p."inci" = '');

-- ───────────── Programs: cover photo, renames ─────────────

ALTER TABLE "programs" ADD COLUMN "cover_media_id" UUID;
ALTER TABLE "programs" ADD CONSTRAINT "programs_cover_media_id_fkey" FOREIGN KEY ("cover_media_id") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "programs" SET "title" = 'Акне и постакне' WHERE "slug" = 'acne' AND "title" = 'Акне и проблемная кожа';
UPDATE "programs" SET "headline" = 'акне и постакне' WHERE "slug" = 'acne' AND "headline" = 'акне и проблемной коже';
UPDATE "programs" SET "symptom" = 'Воспаления, высыпания и следы постакне'
  WHERE "slug" = 'acne' AND "symptom" = 'Воспаления, чёрные точки, жирный блеск';
UPDATE "programs" SET "quiz_skins" = ARRAY['combo', 'normal', 'dry']::"SkinType"[]
  WHERE "slug" = 'acne' AND "quiz_skins" = ARRAY['oily', 'normal']::"SkinType"[];
UPDATE "programs" SET "title" = 'Анти-эйдж и лифтинг' WHERE "slug" = 'lifting' AND "title" = 'Лифтинг и сияние с PDRN';
UPDATE "programs" SET "quiz_skins" = ARRAY['dry', 'normal', 'combo']::"SkinType"[]
  WHERE "slug" = 'lifting' AND "quiz_skins" = ARRAY['dry', 'normal']::"SkinType"[];
UPDATE "programs" SET "quiz_skins" = ARRAY['dry', 'oily', 'combo', 'normal']::"SkinType"[]
  WHERE "slug" = 'pigmentation' AND "quiz_skins" = ARRAY['dry', 'oily', 'normal']::"SkinType"[];

-- The design's admin order, leaving gaps for the three new programs the seed adds (pores 1, glow 4, recovery 7).
-- Only when the list is still the five demo programs in their original order.
UPDATE "programs" p SET "order" = v.ord
FROM (VALUES ('acne', 0), ('pigmentation', 2), ('lifting', 3), ('dry-skin', 5), ('sensitive-skin', 6)) AS v(slug, ord)
WHERE p."slug" = v.slug
  AND (SELECT array_agg("slug" ORDER BY "order", "title") FROM "programs")
    = ARRAY['acne', 'dry-skin', 'pigmentation', 'sensitive-skin', 'lifting'];

-- ───────────── Home texts ─────────────

-- The catalog card keeps the photo of the old "Каталог" entry tile.
UPDATE "content_blocks"
SET "data" = "data" || jsonb_build_object('catalogImageMediaId', (
  SELECT e -> 'imageMediaId' FROM jsonb_array_elements(COALESCE("data" -> 'entries', '[]'::jsonb)) AS e
  WHERE e ->> 'key' = 'catalog' LIMIT 1
))
WHERE "key" = 'home' AND NOT ("data" ? 'catalogImageMediaId');

-- Mass-market vs pro rewritten as titled points (README §1.4), only if it is still the previous demo copy.
UPDATE "content_blocks"
SET "data" = jsonb_set("data", '{comparison}', '{
  "title": "Профессиональный уход vs масс-маркет",
  "subtitle": "Корейская косметика бывает разного уровня",
  "mass": {
    "eyebrow": "Обычная косметика",
    "title": "Масс-маркет",
    "points": [
      {"title": "Низкая концентрация (3–5%)", "text": "В составе преобладают вода, базы и отдушки."},
      {"title": "Поверхностный эффект", "text": "Крупные молекулы не проникают в глубокие слои кожи."},
      {"title": "Формулы «для всех»", "text": "Не способны решить конкретные проблемы (акне, пигмент, морщины)."},
      {"title": "Временный результат", "text": "Работает, только пока нанесён на кожу."}
    ]
  },
  "pro": {
    "eyebrow": "BOM BEAUTY",
    "title": "Профессиональная косметика",
    "points": [
      {"title": "Высокая концентрация (до 30–50%)", "text": "Терапевтические дозы PDRN, пептидов, экзосом и др."},
      {"title": "Глубокое действие", "text": "Часто используют запатентованные комплексы доставки веществ вглубь кожи."},
      {"title": "Работа с проблемой", "text": "Направленный уход против высыпаний, пигментации, старения и др."},
      {"title": "Накопительный результат", "text": "Восстанавливает и обновляет кожу на клеточном уровне."}
    ]
  }
}'::jsonb)
WHERE "key" = 'home' AND "data" -> 'comparison' = '{
  "title": "Профессиональный уход vs масс-маркет",
  "subtitle": "Корейская косметика бывает разного уровня",
  "mass": {
    "eyebrow": "Обычный",
    "title": "Масс-маркет",
    "points": ["Низкая концентрация активов", "Поверхностное увлажнение", "Временный эффект"]
  },
  "pro": {
    "eyebrow": "Bom Beauty",
    "title": "Проф. космецевтика",
    "points": ["Высокая концентрация активов", "Работает в глубоких слоях кожи", "Накопительный, видимый результат"]
  }
}'::jsonb;

-- ───────────── Orders: several lines per order ─────────────

CREATE TABLE "order_lines" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "type" "OrderItemType" NOT NULL,
    "product_id" UUID,
    "program_id" UUID,
    "title" TEXT NOT NULL,
    "unit_price_kgs" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL,
    "total_kgs" INTEGER NOT NULL,

    CONSTRAINT "order_lines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "order_lines_order_id_position_idx" ON "order_lines"("order_id", "position");
CREATE INDEX "order_lines_program_id_idx" ON "order_lines"("program_id");
CREATE INDEX "order_lines_product_id_idx" ON "order_lines"("product_id");

ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Raw SQL checks (not expressible in Prisma).
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_qty_range" CHECK ("qty" BETWEEN 1 AND 20);
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_totals_positive" CHECK ("unit_price_kgs" >= 0 AND "total_kgs" >= 0);

-- Every existing order becomes a one-line order.
INSERT INTO "order_lines" ("id", "order_id", "position", "type", "product_id", "program_id", "title", "unit_price_kgs", "qty", "total_kgs")
SELECT gen_random_uuid(), "id", 0, "item_type", "product_id", "program_id", "item_title", "unit_price_kgs", "qty", "total_kgs"
FROM "orders";

ALTER TABLE "orders" DROP CONSTRAINT "orders_product_id_fkey";
ALTER TABLE "orders" DROP CONSTRAINT "orders_program_id_fkey";
ALTER TABLE "orders" DROP CONSTRAINT "orders_qty_range";
ALTER TABLE "orders" DROP CONSTRAINT "orders_totals_positive";
DROP INDEX "orders_program_id_created_at_idx";
DROP INDEX "orders_product_id_created_at_idx";
ALTER TABLE "orders" DROP COLUMN "item_title",
DROP COLUMN "item_type",
DROP COLUMN "product_id",
DROP COLUMN "program_id",
DROP COLUMN "qty",
DROP COLUMN "unit_price_kgs";
ALTER TABLE "orders" ADD CONSTRAINT "orders_total_positive" CHECK ("total_kgs" >= 0);
