import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { AccountType } from '../generated/prisma/enums.js';
import { UpsertCustomerProfileDto } from './dto/upsert-customer-profile.dto.js';

interface StoredCustomerProfile {
  id: string;
  accountType: AccountType;
  fullName: string | null;
  legalName: string | null;
  tradeName: string | null;
  taxId: string;
  phone: string | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class CustomerAccountService {
  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  async getProfile(
    userId: string,
  ) {
    const profile =
      await this.prisma.customerProfile.findUnique({
        where: {
          userId,
        },

        select: {
          id: true,
          accountType: true,
          fullName: true,
          legalName: true,
          tradeName: true,
          taxId: true,
          phone: true,
          createdAt: true,
          updatedAt: true,
        },
      });

    return {
      profile: profile
        ? this.toProfileResponse(
            profile,
          )
        : null,
    };
  }

  async upsertProfile(
    userId: string,
    dto: UpsertCustomerProfileDto,
  ) {
    this.validateProfile(
      dto,
    );

    const isIndividual =
      dto.accountType ===
      AccountType.INDIVIDUAL;

    let accountFullName:
      | string
      | null = null;

    if (isIndividual) {
      const user =
        await this.prisma.user.findUnique({
          where: {
            id: userId,
          },

          select: {
            fullName: true,
          },
        });

      accountFullName =
        user?.fullName?.trim() ??
        null;

      if (!accountFullName) {
        throw new BadRequestException(
          'Full name is missing from this account.',
        );
      }
    }

    const data = {
      accountType:
        dto.accountType,

      /*
       * User.fullName is the authoritative
       * account-owner name. CustomerProfile
       * keeps a synchronized copy because
       * checkout/order logic already uses it.
       */
      fullName:
        isIndividual
          ? accountFullName
          : null,

      legalName:
        isIndividual
          ? null
          : dto.legalName ??
            null,

      tradeName:
        isIndividual
          ? null
          : dto.tradeName ??
            null,

      taxId:
        dto.taxId,

      phone:
        dto.phone ??
        null,
    };

    try {
      const profile =
        await this.prisma.customerProfile.upsert({
          where: {
            userId,
          },

          create: {
            userId,
            ...data,
          },

          update:
            data,

          select: {
            id: true,
            accountType: true,
            fullName: true,
            legalName: true,
            tradeName: true,
            taxId: true,
            phone: true,
            createdAt: true,
            updatedAt: true,
          },
        });

      return {
        profile:
          this.toProfileResponse(
            profile,
          ),
      };
    } catch (error: unknown) {
      if (
        this.isUniqueConstraintError(
          error,
        )
      ) {
        throw new ConflictException(
          'This tax ID is already in use.',
        );
      }

      throw error;
    }
  }

  private validateProfile(
    dto: UpsertCustomerProfileDto,
  ): void {
    if (
      dto.accountType ===
      AccountType.INDIVIDUAL
    ) {
      if (
        !this.isValidCpf(
          dto.taxId,
        )
      ) {
        throw new BadRequestException(
          'A valid CPF is required for individual accounts.',
        );
      }

      return;
    }

    if (!dto.legalName) {
      throw new BadRequestException(
        'Legal name is required for business accounts.',
      );
    }

    if (
      !this.isValidCnpj(
        dto.taxId,
      )
    ) {
      throw new BadRequestException(
        'A valid CNPJ is required for business accounts.',
      );
    }
  }

  private isValidCpf(
    value: string,
  ): boolean {
    if (
      !/^\d{11}$/.test(
        value,
      ) ||
      /^(\d)\1{10}$/.test(
        value,
      )
    ) {
      return false;
    }

    const digits =
      value
        .split('')
        .map(Number);

    const calculateDigit = (
      length: number,
    ): number => {
      let sum = 0;

      for (
        let index = 0;
        index < length;
        index += 1
      ) {
        sum +=
          digits[index] *
          (length +
            1 -
            index);
      }

      const remainder =
        (sum * 10) %
        11;

      return remainder ===
        10
        ? 0
        : remainder;
    };

    return (
      calculateDigit(9) ===
        digits[9] &&
      calculateDigit(10) ===
        digits[10]
    );
  }

  private isValidCnpj(
    value: string,
  ): boolean {
    if (
      !/^\d{14}$/.test(
        value,
      ) ||
      /^(\d)\1{13}$/.test(
        value,
      )
    ) {
      return false;
    }

    const digits =
      value
        .split('')
        .map(Number);

    const calculateDigit = (
      weights: number[],
    ): number => {
      const sum =
        weights.reduce(
          (
            total,
            weight,
            index,
          ) =>
            total +
            digits[index] *
              weight,
          0,
        );

      const remainder =
        sum % 11;

      return remainder < 2
        ? 0
        : 11 -
            remainder;
    };

    const firstDigit =
      calculateDigit([
        5, 4, 3, 2, 9, 8,
        7, 6, 5, 4, 3, 2,
      ]);

    if (
      firstDigit !==
      digits[12]
    ) {
      return false;
    }

    const secondDigit =
      calculateDigit([
        6, 5, 4, 3, 2, 9,
        8, 7, 6, 5, 4, 3,
        2,
      ]);

    return (
      secondDigit ===
      digits[13]
    );
  }

  private toProfileResponse(
    profile:
      StoredCustomerProfile,
  ) {
    return {
      id:
        profile.id,

      accountType:
        profile.accountType,

      fullName:
        profile.fullName,

      legalName:
        profile.legalName,

      tradeName:
        profile.tradeName,

      taxIdMasked:
        this.maskTaxId(
          profile.taxId,
        ),

      phone:
        profile.phone,

      createdAt:
        profile.createdAt,

      updatedAt:
        profile.updatedAt,
    };
  }

  private maskTaxId(
    taxId: string,
  ): string {
    const visibleDigits =
      4;

    return `${'*'.repeat(
      taxId.length -
        visibleDigits,
    )}${taxId.slice(
      -visibleDigits,
    )}`;
  }

  private isUniqueConstraintError(
    error: unknown,
  ): boolean {
    return (
      typeof error ===
        'object' &&
      error !== null &&
      'code' in error &&
      error.code ===
        'P2002'
    );
  }
}
