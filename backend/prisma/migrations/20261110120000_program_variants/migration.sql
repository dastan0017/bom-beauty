-- CreateEnum
CREATE TYPE "ProgramVariant" AS ENUM ('mini', 'standard', 'max');

-- DropIndex
DROP INDEX "program_items_program_id_order_idx";

-- AlterTable
ALTER TABLE "order_lines" ADD COLUMN     "variant" "ProgramVariant";

-- AlterTable
ALTER TABLE "program_items" DROP CONSTRAINT "program_items_pkey",
ADD COLUMN     "variant" "ProgramVariant" NOT NULL DEFAULT 'standard',
ADD CONSTRAINT "program_items_pkey" PRIMARY KEY ("program_id", "variant", "product_id");

-- AlterTable
ALTER TABLE "programs" ADD COLUMN     "max_price_kgs" INTEGER,
ADD COLUMN     "mini_price_kgs" INTEGER;

-- CreateIndex
CREATE INDEX "program_items_program_id_variant_order_idx" ON "program_items"("program_id", "variant", "order");


-- Raw CHECKs (docs/DATA-MODEL.md §2): a variant price is positive when set; only program lines name a variant.
ALTER TABLE "programs" ADD CONSTRAINT "programs_variant_prices_positive" CHECK (("mini_price_kgs" IS NULL OR "mini_price_kgs" > 0) AND ("max_price_kgs" IS NULL OR "max_price_kgs" > 0));
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_variant_program_only" CHECK ("variant" IS NULL OR "type" = 'program');
