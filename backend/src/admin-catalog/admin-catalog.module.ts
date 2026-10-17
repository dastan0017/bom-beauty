import { Module } from '@nestjs/common';
import { AdminCatalogController } from './admin-catalog.controllers';
import { AdminProductsService } from './admin-products.service';
import { AdminProgramsService } from './admin-programs.service';
import { AdminReviewsService } from './admin-reviews.service';

/** Admin catalog: categories, brands, products, programs, reviews (M4). */
@Module({
  controllers: [AdminCatalogController],
  providers: [AdminProductsService, AdminProgramsService, AdminReviewsService],
})
export class AdminCatalogModule {}
