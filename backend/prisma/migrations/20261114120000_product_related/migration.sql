-- CreateTable
CREATE TABLE "product_related" (
    "product_id" UUID NOT NULL,
    "related_id" UUID NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "product_related_pkey" PRIMARY KEY ("product_id","related_id")
);

-- CreateIndex
CREATE INDEX "product_related_related_id_idx" ON "product_related"("related_id");

-- AddForeignKey
ALTER TABLE "product_related" ADD CONSTRAINT "product_related_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_related" ADD CONSTRAINT "product_related_related_id_fkey" FOREIGN KEY ("related_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Raw CHECK (docs/DATA-MODEL.md §2): a product never lists itself.
ALTER TABLE "product_related" ADD CONSTRAINT "product_related_not_self" CHECK ("product_id" <> "related_id");
