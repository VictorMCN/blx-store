import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { SaveAddressDto } from './dto/save-address.dto.js';

const ADDRESS_SELECT = {
  id: true,
  label: true,
  recipientName: true,
  street: true,
  number: true,
  complement: true,
  neighborhood: true,
  city: true,
  state: true,
  postalCode: true,
  country: true,
  isDefault: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class CustomerAddressService {
  constructor(private readonly prisma: PrismaService) {}

  async listAddresses(userId: string) {
    const addresses = await this.prisma.address.findMany({
      where: {
        customer: {
          userId,
        },
      },
      select: ADDRESS_SELECT,
      orderBy: [
        {
          isDefault: 'desc',
        },
        {
          createdAt: 'asc',
        },
      ],
    });

    return {
      addresses,
    };
  }

  async createAddress(
    userId: string,
    dto: SaveAddressDto,
  ) {
    const customer =
      await this.prisma.customerProfile.findUnique({
        where: {
          userId,
        },
        select: {
          id: true,
          _count: {
            select: {
              addresses: true,
            },
          },
        },
      });

    if (!customer) {
      throw new BadRequestException(
        'Create a customer profile before adding addresses.',
      );
    }

    const shouldBeDefault =
      customer._count.addresses === 0 ||
      dto.isDefault === true;

    const address = await this.prisma.$transaction(
      async (transaction) => {
        if (shouldBeDefault) {
          await transaction.address.updateMany({
            where: {
              customerId: customer.id,
            },
            data: {
              isDefault: false,
            },
          });
        }

        return transaction.address.create({
          data: {
            customerId: customer.id,
            label: dto.label ?? null,
            recipientName: dto.recipientName,
            street: dto.street,
            number: dto.number,
            complement: dto.complement ?? null,
            neighborhood:
              dto.neighborhood ?? null,
            city: dto.city,
            state: dto.state,
            postalCode: dto.postalCode,
            country: dto.country,
            isDefault: shouldBeDefault,
          },
          select: ADDRESS_SELECT,
        });
      },
    );

    return {
      address,
    };
  }

  async updateAddress(
    userId: string,
    addressId: string,
    dto: SaveAddressDto,
  ) {
    const existingAddress =
      await this.prisma.address.findFirst({
        where: {
          id: addressId,
          customer: {
            userId,
          },
        },
        select: {
          id: true,
          customerId: true,
          isDefault: true,
        },
      });

    if (!existingAddress) {
      throw new NotFoundException(
        'Address not found.',
      );
    }

    const isDefault =
      existingAddress.isDefault ||
      dto.isDefault === true;

    const address = await this.prisma.$transaction(
      async (transaction) => {
        if (isDefault) {
          await transaction.address.updateMany({
            where: {
              customerId:
                existingAddress.customerId,
              id: {
                not: existingAddress.id,
              },
            },
            data: {
              isDefault: false,
            },
          });
        }

        return transaction.address.update({
          where: {
            id: existingAddress.id,
          },
          data: {
            label: dto.label ?? null,
            recipientName: dto.recipientName,
            street: dto.street,
            number: dto.number,
            complement: dto.complement ?? null,
            neighborhood:
              dto.neighborhood ?? null,
            city: dto.city,
            state: dto.state,
            postalCode: dto.postalCode,
            country: dto.country,
            isDefault,
          },
          select: ADDRESS_SELECT,
        });
      },
    );

    return {
      address,
    };
  }

  async deleteAddress(
    userId: string,
    addressId: string,
  ): Promise<void> {
    const existingAddress =
      await this.prisma.address.findFirst({
        where: {
          id: addressId,
          customer: {
            userId,
          },
        },
        select: {
          id: true,
          customerId: true,
          isDefault: true,
        },
      });

    if (!existingAddress) {
      throw new NotFoundException(
        'Address not found.',
      );
    }

    await this.prisma.$transaction(
      async (transaction) => {
        await transaction.address.delete({
          where: {
            id: existingAddress.id,
          },
        });

        if (!existingAddress.isDefault) {
          return;
        }

        const replacement =
          await transaction.address.findFirst({
            where: {
              customerId:
                existingAddress.customerId,
            },
            orderBy: {
              createdAt: 'asc',
            },
            select: {
              id: true,
            },
          });

        if (replacement) {
          await transaction.address.update({
            where: {
              id: replacement.id,
            },
            data: {
              isDefault: true,
            },
          });
        }
      },
    );
  }
}
