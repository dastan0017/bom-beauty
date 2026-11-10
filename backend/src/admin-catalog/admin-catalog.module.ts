import { Module } from '@nestjs/common';
import { AdminCatalogController } from './admin-catalog.controllers';
import { AdminProductsService } from './admin-products.service';
import { AdminProgramsService } from './admin-programs.service';
import { AdminQuizService } from './admin-quiz.service';
import { AdminReviewsService } from './admin-reviews.service';

/** Admin catalog: categories, brands, products, programs, the quiz lists (D47), reviews (M4). */
@Module({
  controllers: [AdminCatalogController],
  providers: [AdminProductsService, AdminProgramsService, AdminQuizService, AdminReviewsService],
})
export class AdminCatalogModule {}
