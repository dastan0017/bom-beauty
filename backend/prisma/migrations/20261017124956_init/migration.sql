-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('owner', 'manager');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('new', 'sent', 'cancelled');

-- CreateEnum
CREATE TYPE "OrderItemType" AS ENUM ('product', 'program');

-- CreateEnum
CREATE TYPE "LeadKind" AS ENUM ('quiz', 'wholesale');

-- CreateEnum
CREATE TYPE "MediaBucket" AS ENUM ('public', 'private');

-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('image', 'pdf');

-- CreateEnum
CREATE TYPE "MediaStatus" AS ENUM ('pending', 'processing', 'ready', 'failed');

-- CreateEnum
CREATE TYPE "VideoStatus" AS ENUM ('created', 'uploading', 'processing', 'ready', 'failed');

-- CreateEnum
CREATE TYPE "RoutinePeriod" AS ENUM ('am', 'pm');

-- CreateEnum
CREATE TYPE "QuizGoal" AS ENUM ('age', 'pigment', 'acne', 'barrier');

-- CreateEnum
CREATE TYPE "SkinType" AS ENUM ('dry', 'oily', 'normal', 'sens');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'manager',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "remember_me" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_agent" TEXT,
    "ip" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brands" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "short_name" TEXT,
    "brand_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "volume" TEXT NOT NULL DEFAULT '',
    "price_kgs" INTEGER NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "how_to_use" TEXT NOT NULL DEFAULT '',
    "inci" TEXT,
    "badge" TEXT,
    "in_stock" BOOLEAN NOT NULL DEFAULT true,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "seo_title" TEXT,
    "seo_description" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_images" (
    "product_id" UUID NOT NULL,
    "media_id" UUID NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "alt" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("product_id","media_id")
);

-- CreateTable
CREATE TABLE "programs" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "headline" TEXT,
    "symptom" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "course" TEXT NOT NULL DEFAULT '',
    "fit" TEXT[],
    "price_kgs" INTEGER NOT NULL,
    "badge" TEXT,
    "quiz_goal" "QuizGoal",
    "quiz_skins" "SkinType"[],
    "published" BOOLEAN NOT NULL DEFAULT false,
    "in_stock" BOOLEAN NOT NULL DEFAULT true,
    "video_id" UUID,
    "protocol_media_id" UUID,
    "order" INTEGER NOT NULL DEFAULT 0,
    "seo_title" TEXT,
    "seo_description" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "program_items" (
    "program_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "program_items_pkey" PRIMARY KEY ("program_id","product_id")
);

-- CreateTable
CREATE TABLE "program_steps" (
    "id" UUID NOT NULL,
    "program_id" UUID NOT NULL,
    "period" "RoutinePeriod" NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "product_id" UUID NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "program_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "media_id" UUID NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media" (
    "id" UUID NOT NULL,
    "bucket" "MediaBucket" NOT NULL,
    "kind" "MediaKind" NOT NULL,
    "status" "MediaStatus" NOT NULL DEFAULT 'pending',
    "key" TEXT,
    "mime" TEXT,
    "original_name" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "bytes" INTEGER,
    "blur_data_url" TEXT,
    "variants" JSONB,
    "error" TEXT,
    "uploaded_by_id" UUID,
    "expires_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(3),

    CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "videos" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'bunny',
    "library_id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "status" "VideoStatus" NOT NULL DEFAULT 'created',
    "title" TEXT NOT NULL,
    "original_name" TEXT,
    "bytes" INTEGER,
    "duration_sec" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "thumbnail_url" TEXT,
    "hls_url" TEXT,
    "mp4_url" TEXT,
    "error" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_blocks" (
    "key" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" UUID,

    CONSTRAINT "content_blocks_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" UUID,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "redirects" (
    "id" UUID NOT NULL,
    "from_path" TEXT NOT NULL,
    "to_path" TEXT NOT NULL,
    "status_code" INTEGER NOT NULL DEFAULT 308,
    "hits" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "redirects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "number" SERIAL NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'new',
    "item_type" "OrderItemType" NOT NULL,
    "product_id" UUID,
    "program_id" UUID,
    "item_title" TEXT NOT NULL,
    "unit_price_kgs" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL,
    "total_kgs" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "comment" TEXT,
    "display_currency" TEXT NOT NULL DEFAULT 'KGS',
    "display_rate" DOUBLE PRECISION,
    "message" TEXT NOT NULL,
    "from_quiz" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT NOT NULL DEFAULT '',
    "page_url" TEXT,
    "referrer" TEXT,
    "utm" JSONB,
    "client_ref" TEXT NOT NULL,
    "ip_hash" TEXT,
    "user_agent" TEXT,
    "status_changed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" UUID NOT NULL,
    "kind" "LeadKind" NOT NULL,
    "answers" JSONB NOT NULL,
    "recommended" TEXT[],
    "choose" BOOLEAN NOT NULL DEFAULT false,
    "message" TEXT NOT NULL,
    "page_url" TEXT,
    "referrer" TEXT,
    "utm" JSONB,
    "client_ref" TEXT NOT NULL,
    "ip_hash" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "diff" JSONB NOT NULL DEFAULT '{}',
    "ip" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "brands_slug_key" ON "brands"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "brands_name_key" ON "brands"("name");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE INDEX "products_category_id_published_idx" ON "products"("category_id", "published");

-- CreateIndex
CREATE INDEX "products_brand_id_idx" ON "products"("brand_id");

-- CreateIndex
CREATE INDEX "product_images_product_id_order_idx" ON "product_images"("product_id", "order");

-- CreateIndex
CREATE UNIQUE INDEX "programs_slug_key" ON "programs"("slug");

-- CreateIndex
CREATE INDEX "programs_published_order_idx" ON "programs"("published", "order");

-- CreateIndex
CREATE INDEX "program_items_program_id_order_idx" ON "program_items"("program_id", "order");

-- CreateIndex
CREATE INDEX "program_steps_program_id_period_order_idx" ON "program_steps"("program_id", "period", "order");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_media_id_key" ON "reviews"("media_id");

-- CreateIndex
CREATE INDEX "reviews_is_hidden_order_idx" ON "reviews"("is_hidden", "order");

-- CreateIndex
CREATE INDEX "media_status_expires_at_idx" ON "media"("status", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "videos_external_id_key" ON "videos"("external_id");

-- CreateIndex
CREATE INDEX "videos_status_idx" ON "videos"("status");

-- CreateIndex
CREATE UNIQUE INDEX "redirects_from_path_key" ON "redirects"("from_path");

-- CreateIndex
CREATE INDEX "redirects_to_path_idx" ON "redirects"("to_path");

-- CreateIndex
CREATE UNIQUE INDEX "orders_number_key" ON "orders"("number");

-- CreateIndex
CREATE UNIQUE INDEX "orders_client_ref_key" ON "orders"("client_ref");

-- CreateIndex
CREATE INDEX "orders_status_created_at_idx" ON "orders"("status", "created_at");

-- CreateIndex
CREATE INDEX "orders_created_at_idx" ON "orders"("created_at");

-- CreateIndex
CREATE INDEX "orders_phone_idx" ON "orders"("phone");

-- CreateIndex
CREATE INDEX "orders_program_id_created_at_idx" ON "orders"("program_id", "created_at");

-- CreateIndex
CREATE INDEX "orders_product_id_created_at_idx" ON "orders"("product_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "leads_client_ref_key" ON "leads"("client_ref");

-- CreateIndex
CREATE INDEX "leads_kind_created_at_idx" ON "leads"("kind", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entity_id_idx" ON "audit_logs"("entity", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programs" ADD CONSTRAINT "programs_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programs" ADD CONSTRAINT "programs_protocol_media_id_fkey" FOREIGN KEY ("protocol_media_id") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_items" ADD CONSTRAINT "program_items_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_items" ADD CONSTRAINT "program_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_steps" ADD CONSTRAINT "program_steps_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_steps" ADD CONSTRAINT "program_steps_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ───────────── Hand-written additions (docs/DATA-MODEL.md) ─────────────

-- Order numbers shown to the owner start at 1001.
ALTER SEQUENCE "orders_number_seq" RESTART WITH 1001;

-- One item per order, quantity 1 to 9 (the order sheet's stepper).
ALTER TABLE "orders" ADD CONSTRAINT "orders_qty_range" CHECK ("qty" BETWEEN 1 AND 9);
ALTER TABLE "orders" ADD CONSTRAINT "orders_totals_positive" CHECK ("unit_price_kgs" >= 0 AND "total_kgs" >= 0);

-- Prices are whole сом and never negative.
ALTER TABLE "products" ADD CONSTRAINT "products_price_positive" CHECK ("price_kgs" >= 0);
ALTER TABLE "programs" ADD CONSTRAINT "programs_price_positive" CHECK ("price_kgs" >= 0);
