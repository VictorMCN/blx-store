import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

function normalizeName(
  value: unknown,
): unknown {
  return typeof value === 'string'
    ? value
        .trim()
        .replace(/\s+/g, ' ')
    : value;
}

export class RegisterDto {
  @Transform(({ value }) =>
    normalizeName(value),
  )
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  fullName!: string;

  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;
}
