import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

function trimString(value: unknown): unknown {
  return typeof value === 'string'
    ? value.trim()
    : value;
}

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

function normalizeCountry(value: unknown): unknown {
  return typeof value === 'string'
    ? value.trim().toUpperCase()
    : value;
}

export class SaveAddressDto {
  @IsOptional()
  @Transform(({ value }) =>
    normalizeOptionalString(value),
  )
  @IsString()
  @MaxLength(80)
  label?: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  recipientName!: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  street!: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  number!: string;

  @IsOptional()
  @Transform(({ value }) =>
    normalizeOptionalString(value),
  )
  @IsString()
  @MaxLength(120)
  complement?: string;

  @IsOptional()
  @Transform(({ value }) =>
    normalizeOptionalString(value),
  )
  @IsString()
  @MaxLength(120)
  neighborhood?: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  city!: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  state!: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  postalCode!: string;

  @Transform(({ value }) => normalizeCountry(value))
  @IsString()
  @Matches(/^[A-Z]{2}$/, {
    message:
      'country must be a two-letter country code.',
  })
  country!: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
