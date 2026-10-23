-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('whatsapp', 'finik');

-- CreateEnum
CREATE TYPE "OrderPaymentStatus" AS ENUM ('unpaid', 'pending', 'paid', 'refunded');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('created', 'pending', 'succeeded', 'failed', 'expired');

-- CreateEnum
CREATE TYPE "PaymentPurpose" AS ENUM ('order', 'check');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "adjustment_kgs" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "adjustment_note" TEXT,
ADD COLUMN     "paid_at" TIMESTAMPTZ(3),
ADD COLUMN     "pay_token" TEXT NOT NULL DEFAULT replace((gen_random_uuid())::text, '-'::text, ''::text),
ADD COLUMN     "payment_method" "PaymentMethod" NOT NULL DEFAULT 'whatsapp',
ADD COLUMN     "payment_status" "OrderPaymentStatus" NOT NULL DEFAULT 'unpaid',
ADD COLUMN     "unpaid_notified_at" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "order_id" UUID,
    "purpose" "PaymentPurpose" NOT NULL DEFAULT 'order',
    "provider" TEXT NOT NULL DEFAULT 'finik',
    "environment" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'created',
    "amount_kgs" INTEGER NOT NULL,
    "payment_url" TEXT,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "error" TEXT,
    "transaction_id" TEXT,
    "operation_id" TEXT,
    "receipt_number" TEXT,
    "paid_amount_tyiyn" INTEGER,
    "channel" TEXT,
    "paid_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_events" (
    "id" UUID NOT NULL,
    "payment_id" UUID,
    "dedupe_key" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payments_order_id_created_at_idx" ON "payments"("order_id", "created_at");

-- CreateIndex
CREATE INDEX "payments_status_expires_at_idx" ON "payments"("status", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "payment_events_dedupe_key_key" ON "payment_events"("dedupe_key");

-- CreateIndex
CREATE INDEX "payment_events_payment_id_idx" ON "payment_events"("payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_pay_token_key" ON "orders"("pay_token");

-- CreateIndex
CREATE INDEX "orders_payment_status_created_at_idx" ON "orders"("payment_status", "created_at");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Raw CHECKs (docs/DATA-MODEL.md §2, online payment)
ALTER TABLE "payments" ADD CONSTRAINT "payments_amount_kgs_check" CHECK ("amount_kgs" > 0);
ALTER TABLE "payments" ADD CONSTRAINT "payments_paid_amount_tyiyn_check" CHECK ("paid_amount_tyiyn" IS NULL OR "paid_amount_tyiyn" >= 0);
ALTER TABLE "payments" ADD CONSTRAINT "payments_environment_check" CHECK ("environment" IN ('mock', 'beta', 'prod'));
ALTER TABLE "payments" ADD CONSTRAINT "payments_channel_check" CHECK ("channel" IS NULL OR "channel" IN ('qr', 'visa'));
