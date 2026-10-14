import {
  Controller,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import { CatalogService } from './catalog.service.js';
import { ProductQueryDto } from './dto/product-query.dto.js';

@Controller('catalog')
export class CatalogController {
  constructor(
    private readonly catalogService:
      CatalogService,
  ) {}

  @Get('categories')
  listCategories() {
    return this.catalogService.listCategories();
  }

  @Get('products')
  listProducts(
    @Query() query: ProductQueryDto,
  ) {
    return this.catalogService.listProducts(query);
  }

  @Get('products/:slug')
  getProduct(
    @Param('slug') slug: string,
  ) {
    return this.catalogService.getProductBySlug(
      slug,
    );
  }
}
