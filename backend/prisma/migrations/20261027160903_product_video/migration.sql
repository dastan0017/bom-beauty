-- AlterTable
ALTER TABLE "products" ADD COLUMN     "video_id" UUID;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
