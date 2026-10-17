import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  brandSchema,
  categorySchema,
  productCardSchema,
  productDetailSchema,
  programCardSchema,
  programDetailSchema,
  sitemapSchema,
  slugSchema,
} from '@bom/shared';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { z } from 'zod';
import { PublicCache } from '../common/public-cache';
import { CatalogService } from './catalog.service';

class CategoryDto extends createZodDto(categorySchema) {}
class ProductCardDto extends createZodDto(productCardSchema) {}
class ProductDetailDto extends createZodDto(productDetailSchema) {}
class ProgramCardDto extends createZodDto(programCardSchema) {}
class ProgramDetailDto extends createZodDto(programDetailSchema) {}
class BrandDto extends createZodDto(brandSchema) {}
class SitemapDto extends createZodDto(sitemapSchema) {}
class SlugParamsDto extends createZodDto(z.object({ slug: slugSchema })) {}
class ProductsQueryDto extends createZodDto(z.object({ category: slugSchema.optional() })) {}

@ApiTags('public')
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('categories')
  @PublicCache()
  @ZodResponse({ type: [CategoryDto] })
  categories() {
    return this.catalog.categories();
  }

  @Get('products')
  @PublicCache()
  @ZodResponse({ type: [ProductCardDto] })
  products(@Query() query: ProductsQueryDto) {
    return this.catalog.products(query.category);
  }

  @Get('products/:slug')
  @PublicCache()
  @ZodResponse({ type: ProductDetailDto })
  product(@Param() params: SlugParamsDto) {
    return this.catalog.product(params.slug);
  }

  @Get('programs')
  @PublicCache()
  @ZodResponse({ type: [ProgramCardDto] })
  programs() {
    return this.catalog.programs();
  }

  @Get('programs/:slug')
  @PublicCache()
  @ZodResponse({ type: ProgramDetailDto })
  program(@Param() params: SlugParamsDto) {
    return this.catalog.program(params.slug);
  }

  @Get('brands')
  @PublicCache()
  @ZodResponse({ type: [BrandDto] })
  brands() {
    return this.catalog.brands();
  }

  @Get('sitemap')
  @ZodResponse({ type: SitemapDto })
  sitemap() {
    return this.catalog.sitemap();
  }
}
