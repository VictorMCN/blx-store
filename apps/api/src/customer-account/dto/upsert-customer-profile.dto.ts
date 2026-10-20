import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { AccountType } from '../../generated/prisma/enums.js';

function trimString(
  value: unknown,
): unknown {
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

  const normalized =
    value.trim();

  return normalized.length > 0
    ? normalized
    : undefined;
}

function keepDigitsOnly(
  value: unknown,
): unknown {
  return typeof value === 'string'
    ? value.replace(/\D/g, '')
    : value;
}

export class UpsertCustomerProfileDto {
  @IsEnum(AccountType)
  accountType!: AccountType;

  /*
   * Kept for backwards compatibility with
   * older clients. Individual profile names
   * are sourced from User.fullName by the
   * server and this value is not trusted.
   */
  @IsOptional()
  @Transform(({ value }) =>
    normalizeOptionalString(
      value,
    ),
  )
  @IsString()
  @MaxLength(150)
  fullName?: string;

  @IsOptional()
  @Transform(({ value }) =>
    trimString(value),
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  legalName?: string;

  @IsOptional()
  @Transform(({ value }) =>
    trimString(value),
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  tradeName?: string;

  @Transform(({ value }) =>
    keepDigitsOnly(value),
  )
  @IsString()
  @Matches(
    /^(?:\d{11}|\d{14})$/,
    {
      message:
        'taxId must contain 11 or 14 digits.',
    },
  )
  taxId!: string;

  @IsOptional()
  @Transform(({ value }) =>
    keepDigitsOnly(value),
  )
  @IsString()
  @Matches(/^\d{10,15}$/, {
    message:
      'phone must contain between 10 and 15 digits.',
  })
  phone?: string;
}
