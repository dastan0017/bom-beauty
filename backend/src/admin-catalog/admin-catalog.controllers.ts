import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  adminCategorySchema,
  adminProductQuerySchema,
  adminProductRowSchema,
  adminProductSchema,
  adminProgramRowSchema,
  adminProgramSchema,
  adminReviewSchema,
  brandInputSchema,
  brandOptionSchema,
  brandQuerySchema,
  categoryInputSchema,
  createReviewsSchema,
  mergeInputSchema,
  productInputSchema,
  productPatchSchema,
  programInputSchema,
  programPatchSchema,
  reviewOrderSchema,
  reviewPatchSchema,
} from '@bom/shared';
import type { Request } from 'express';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { z } from 'zod';
import { AdminAuth, CurrentSession } from '../auth/auth.guards';
import type { ActiveSession } from '../auth/session.service';
import { clientIp } from '../common/client-ip';
import { AdminProductsService, type Actor } from './admin-products.service';
import { AdminProgramsService } from './admin-programs.service';
import { AdminReviewsService } from './admin-reviews.service';

class IdParamsDto extends createZodDto(z.object({ id: z.uuid() })) {}
class CategoryDto extends createZodDto(adminCategorySchema) {}
class CategoryInputDto extends createZodDto(categoryInputSchema) {}
class BrandDto extends createZodDto(brandOptionSchema) {}
class BrandInputDto extends createZodDto(brandInputSchema) {}
class MergeInputDto extends createZodDto(mergeInputSchema) {}
class BrandQueryDto extends createZodDto(brandQuerySchema) {}
class ProductQueryDto extends createZodDto(adminProductQuerySchema) {}
class ProductRowDto extends createZodDto(adminProductRowSchema) {}
class ProductDto extends createZodDto(adminProductSchema) {}
class ProductInputDto extends createZodDto(productInputSchema) {}
class ProductPatchDto extends createZodDto(productPatchSchema) {}
class ProgramRowDto extends createZodDto(adminProgramRowSchema) {}
class ProgramDto extends createZodDto(adminProgramSchema) {}
class ProgramInputDto extends createZodDto(programInputSchema) {}
class ProgramPatchDto extends createZodDto(programPatchSchema) {}
class ReviewDto extends createZodDto(adminReviewSchema) {}
class CreateReviewsDto extends createZodDto(createReviewsSchema) {}
class ReviewPatchDto extends createZodDto(reviewPatchSchema) {}
class ReviewOrderDto extends createZodDto(reviewOrderSchema) {}

const actor = (session: ActiveSession, request: Request): Actor => ({
  userId: session.user.id,
  ip: clientIp(request),
});

@ApiTags('admin')
@AdminAuth()
@Controller('admin')
export class AdminCatalogController {
  constructor(
    private readonly products: AdminProductsService,
    private readonly programs: AdminProgramsService,
    private readonly reviews: AdminReviewsService,
  ) {}

  @Get('categories')
  @ZodResponse({ type: [CategoryDto] })
  categories() {
    return this.products.categories();
  }

  @Post('categories')
  @ZodResponse({ status: 201, type: CategoryDto })
  createCategory(@Body() body: CategoryInputDto, @CurrentSession() s: ActiveSession, @Req() r: Request) {
    return this.products.createCategory(body, actor(s, r));
  }

  @Put('categories/:id')
  @ZodResponse({ type: CategoryDto })
  renameCategory(
    @Param() params: IdParamsDto,
    @Body() body: CategoryInputDto,
    @CurrentSession() s: ActiveSession,
    @Req() r: Request,
  ) {
    return this.products.renameCategory(params.id, body, actor(s, r));
  }

  @Delete('categories/:id')
  @HttpCode(204)
  async deleteCategory(@Param() params: IdParamsDto, @CurrentSession() s: ActiveSession, @Req() r: Request) {
    await this.products.deleteCategory(params.id, actor(s, r));
  }

  @Post('categories/:id/merge')
  @HttpCode(200)
  @ZodResponse({ type: CategoryDto })
  mergeCategory(
    @Param() params: IdParamsDto,
    @Body() body: MergeInputDto,
    @CurrentSession() s: ActiveSession,
    @Req() r: Request,
  ) {
    return this.products.mergeCategory(params.id, body.intoId, actor(s, r));
  }

  @Get('brands')
  @ZodResponse({ type: [BrandDto] })
  brands(@Query() query: BrandQueryDto) {
    return this.products.brands(query.q);
  }

  @Put('brands/:id')
  @ZodResponse({ type: BrandDto })
  renameBrand(
    @Param() params: IdParamsDto,
    @Body() body: BrandInputDto,
    @CurrentSession() s: ActiveSession,
    @Req() r: Request,
  ) {
    return this.products.renameBrand(params.id, body, actor(s, r));
  }

  @Delete('brands/:id')
  @HttpCode(204)
  async deleteBrand(@Param() params: IdParamsDto, @CurrentSession() s: ActiveSession, @Req() r: Request) {
    await this.products.deleteBrand(params.id, actor(s, r));
  }

  @Post('brands/:id/merge')
  @HttpCode(200)
  @ZodResponse({ type: BrandDto })
  mergeBrand(
    @Param() params: IdParamsDto,
    @Body() body: MergeInputDto,
    @CurrentSession() s: ActiveSession,
    @Req() r: Request,
  ) {
    return this.products.mergeBrand(params.id, body.intoId, actor(s, r));
  }

  @Get('products')
  @ZodResponse({ type: [ProductRowDto] })
  productList(@Query() query: ProductQueryDto) {
    return this.products.list(query);
  }

  @Post('products')
  @ZodResponse({ status: 201, type: ProductDto })
  createProduct(@Body() body: ProductInputDto, @CurrentSession() s: ActiveSession, @Req() r: Request) {
    return this.products.create(body, actor(s, r));
  }

  @Get('products/:id')
  @ZodResponse({ type: ProductDto })
  product(@Param() params: IdParamsDto) {
    return this.products.detail(params.id);
  }

  @Put('products/:id')
  @ZodResponse({ type: ProductDto })
  updateProduct(
    @Param() params: IdParamsDto,
    @Body() body: ProductInputDto,
    @CurrentSession() s: ActiveSession,
    @Req() r: Request,
  ) {
    return this.products.update(params.id, body, actor(s, r));
  }

  @Patch('products/:id')
  @ZodResponse({ type: ProductDto })
  patchProduct(
    @Param() params: IdParamsDto,
    @Body() body: ProductPatchDto,
    @CurrentSession() s: ActiveSession,
    @Req() r: Request,
  ) {
    return this.products.patch(params.id, body, actor(s, r));
  }

  @Delete('products/:id')
  @HttpCode(204)
  async deleteProduct(@Param() params: IdParamsDto, @CurrentSession() s: ActiveSession, @Req() r: Request) {
    await this.products.remove(params.id, actor(s, r));
  }

  @Get('programs')
  @ZodResponse({ type: [ProgramRowDto] })
  programList() {
    return this.programs.list();
  }

  @Post('programs')
  @ZodResponse({ status: 201, type: ProgramDto })
  createProgram(@Body() body: ProgramInputDto, @CurrentSession() s: ActiveSession, @Req() r: Request) {
    return this.programs.create(body, actor(s, r));
  }

  @Get('programs/:id')
  @ZodResponse({ type: ProgramDto })
  program(@Param() params: IdParamsDto) {
    return this.programs.detail(params.id);
  }

  @Put('programs/:id')
  @ZodResponse({ type: ProgramDto })
  updateProgram(
    @Param() params: IdParamsDto,
    @Body() body: ProgramInputDto,
    @CurrentSession() s: ActiveSession,
    @Req() r: Request,
  ) {
    return this.programs.update(params.id, body, actor(s, r));
  }

  @Patch('programs/:id')
  @ZodResponse({ type: ProgramDto })
  patchProgram(
    @Param() params: IdParamsDto,
    @Body() body: ProgramPatchDto,
    @CurrentSession() s: ActiveSession,
    @Req() r: Request,
  ) {
    return this.programs.patch(params.id, body, actor(s, r));
  }

  @Delete('programs/:id')
  @HttpCode(204)
  async deleteProgram(@Param() params: IdParamsDto, @CurrentSession() s: ActiveSession, @Req() r: Request) {
    await this.programs.remove(params.id, actor(s, r));
  }

  @Get('reviews')
  @ZodResponse({ type: [ReviewDto] })
  reviewList() {
    return this.reviews.list();
  }

  @Post('reviews')
  @ZodResponse({ status: 201, type: [ReviewDto] })
  createReviews(@Body() body: CreateReviewsDto, @CurrentSession() s: ActiveSession, @Req() r: Request) {
    return this.reviews.create(body.mediaIds, actor(s, r));
  }

  @Put('reviews/order')
  @ZodResponse({ type: [ReviewDto] })
  reorderReviews(@Body() body: ReviewOrderDto, @CurrentSession() s: ActiveSession, @Req() r: Request) {
    return this.reviews.reorder(body.ids, actor(s, r));
  }

  @Patch('reviews/:id')
  @ZodResponse({ type: [ReviewDto] })
  patchReview(
    @Param() params: IdParamsDto,
    @Body() body: ReviewPatchDto,
    @CurrentSession() s: ActiveSession,
    @Req() r: Request,
  ) {
    return this.reviews.patch(params.id, body.isHidden, actor(s, r));
  }

  @Delete('reviews/:id')
  @ZodResponse({ type: [ReviewDto] })
  deleteReview(@Param() params: IdParamsDto, @CurrentSession() s: ActiveSession, @Req() r: Request) {
    return this.reviews.remove(params.id, actor(s, r));
  }
}
