import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

function normalizeOptionalString(
  value: unknown,
): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const normalized = value.trim();

  return normalized.length > 0
    ? normalized
    : undefined;
}

function parseBoolean(
  value: unknown,
): unknown {
  if (value === 'true' || value === true) {
    return true;
  }

  if (value === 'false' || value === false) {
    return false;
  }

  return value;
}

export const PRODUCT_SORT_OPTIONS = [
  'newest',
  'price_asc',
  'price_desc',
  'name_asc',
  'name_desc',
] as const;

export type ProductSort =
  (typeof PRODUCT_SORT_OPTIONS)[number];

export class ProductQueryDto {
  @IsOptional()
  @Transform(({ value }) =>
    normalizeOptionalString(value),
  )
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @Transform(({ value }) =>
    normalizeOptionalString(value),
  )
  @IsString()
  @MaxLength(140)
  category?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPriceInCents?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPriceInCents?: number;

  @IsOptional()
  @Transform(({ value }) =>
    parseBoolean(value),
  )
  @IsBoolean()
  inStock?: boolean;

  @IsOptional()
  @IsIn(PRODUCT_SORT_OPTIONS)
  sort: ProductSort = 'newest';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 12;
}
