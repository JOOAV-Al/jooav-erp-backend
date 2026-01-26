import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheInvalidationService } from '../cache/cache-invalidation.service';
import { Prisma } from '@prisma/client';
import {
  CreateVariantDto,
  UpdateVariantDto,
  VariantQueryDto,
  VariantResponseDto,
  VariantStatsDto,
} from './dto';
import { PaginatedResponse } from '../../common/dto/paginated-response.dto';
import { AuditLog } from '../../common/decorators/audit-log.decorator';

@Injectable()
export class VariantService {
  constructor(
    private prisma: PrismaService,
    private cacheInvalidationService: CacheInvalidationService,
  ) {}

  @AuditLog({
    action: 'CREATE',
    resource: 'VARIANT',
  })
  async create(
    createVariantDto: CreateVariantDto,
    userId: string,
  ): Promise<VariantResponseDto> {
    const { name, description, brandId } = createVariantDto;

    // Check if brand exists
    const brand = await this.prisma.brand.findUnique({
      where: { id: brandId, deletedAt: null },
    });

    if (!brand) {
      throw new BadRequestException('Brand not found');
    }

    // Check if variant name already exists for this brand among active records
    const existingVariant = await this.prisma.variant.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        brandId,
        deletedAt: null, // Only check active variants
      },
    });

    if (existingVariant) {
      throw new ConflictException(
        `Variant with name "${name}" already exists for this brand`,
      );
    }

    const variant = await this.prisma.variant.create({
      data: {
        name,
        description,
        brandId,
        createdBy: userId,
        updatedBy: userId,
      },
      include: {
        brand: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    // Invalidate variant-related caches
    await this.cacheInvalidationService.invalidateVariant(variant.id);

    return variant as VariantResponseDto;
  }

  async findAll(
    query: VariantQueryDto,
    includes?: {
      includeBrand?: boolean;
      includeProductsCount?: boolean;
      includeAuditInfo?: boolean;
    },
  ): Promise<PaginatedResponse<VariantResponseDto>> {
    const {
      page = 1,
      limit = 10,
      search,
      brandId,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    // Convert string params to numbers
    const pageNum = typeof page === 'string' ? parseInt(page, 10) : page;
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit;
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.VariantWhereInput = {
      deletedAt: null,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { brand: { name: { contains: search, mode: 'insensitive' } } },
        ],
      }),
      ...(brandId && { brandId }),
    };

    const orderBy: Prisma.VariantOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    // Build dynamic include object
    const includeObject: any = {};

    // Include brand if requested
    if (includes?.includeBrand === true) {
      includeObject.brand = {
        select: {
          id: true,
          name: true,
        },
      };
    }

    // Include products count if requested
    if (includes?.includeProductsCount === true) {
      includeObject._count = {
        select: {
          products: true,
        },
      };
    }

    // Include audit info if requested
    if (includes?.includeAuditInfo === true) {
      includeObject.createdByUser = {
        select: { id: true, email: true, firstName: true, lastName: true },
      };
      includeObject.updatedByUser = {
        select: { id: true, email: true, firstName: true, lastName: true },
      };
      includeObject.deletedByUser = {
        select: { id: true, email: true, firstName: true, lastName: true },
      };
    }

    const [variants, totalCount] = await Promise.all([
      this.prisma.variant.findMany({
        where,
        skip,
        take: limitNum,
        orderBy,
        include: includeObject,
      }),
      this.prisma.variant.count({ where }),
    ]);

    const totalPages = Math.ceil(totalCount / limitNum);

    return {
      data: variants as VariantResponseDto[],
      meta: {
        page: pageNum,
        limit: limitNum,
        totalItems: totalCount,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPreviousPage: pageNum > 1,
      },
    };
  }

  async findOne(
    id: string,
    includes?: {
      includeBrand?: boolean;
      includeProductsCount?: boolean;
      includeAuditInfo?: boolean;
    },
  ): Promise<VariantResponseDto> {
    // Build dynamic include object
    const includeObject: any = {};

    // Include brand if requested
    if (includes?.includeBrand === true) {
      includeObject.brand = {
        select: {
          id: true,
          name: true,
        },
      };
    }

    // Include products count if requested
    if (includes?.includeProductsCount === true) {
      includeObject._count = {
        select: {
          products: true,
        },
      };
    }

    // Include audit info if requested
    if (includes?.includeAuditInfo === true) {
      includeObject.createdByUser = {
        select: { id: true, email: true, firstName: true, lastName: true },
      };
      includeObject.updatedByUser = {
        select: { id: true, email: true, firstName: true, lastName: true },
      };
      includeObject.deletedByUser = {
        select: { id: true, email: true, firstName: true, lastName: true },
      };
    }

    const variant = await this.prisma.variant.findFirst({
      where: { id, deletedAt: null },
      include: includeObject,
    });

    if (!variant) {
      throw new NotFoundException('Variant not found');
    }

    return variant as VariantResponseDto;
  }

  @AuditLog({
    action: 'UPDATE',
    resource: 'VARIANT',
  })
  async update(
    id: string,
    updateVariantDto: UpdateVariantDto,
    userId: string,
  ): Promise<VariantResponseDto> {
    const { name, description, brandId } = updateVariantDto;

    // Check if variant exists
    const existingVariant = await this.prisma.variant.findFirst({
      where: { id, deletedAt: null },
      include: {
        brand: {
          select: { id: true, name: true },
        },
      },
    });

    if (!existingVariant) {
      throw new NotFoundException('Variant not found');
    }

    // If name is being updated, check for duplicates among active records
    if (name && name !== existingVariant.name) {
      const duplicateVariant = await this.prisma.variant.findFirst({
        where: {
          name: { equals: name, mode: 'insensitive' },
          brandId: brandId || existingVariant.brandId,
          deletedAt: null, // Only check active variants
          id: { not: id },
        },
      });

      if (duplicateVariant) {
        throw new ConflictException(
          `Variant with name "${name}" already exists for this brand`,
        );
      }
    }

    // If brandId is being updated, check if brand exists and get brand info
    let newBrand: { id: string; name: string } | null = null;
    if (brandId && brandId !== existingVariant.brandId) {
      newBrand = await this.prisma.brand.findUnique({
        where: { id: brandId, deletedAt: null },
        select: { id: true, name: true },
      });

      if (!newBrand) {
        throw new BadRequestException('Brand not found');
      }
    }

    // Check if this update will affect product names/SKUs
    const willAffectProducts =
      (name && name !== existingVariant.name) ||
      (brandId && brandId !== existingVariant.brandId);

    // Use transaction to ensure consistency
    const result = await this.prisma.$transaction(async (tx) => {
      // Update the variant first
      const updatedVariant = await tx.variant.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(description !== undefined && { description }),
          ...(brandId && { brandId }),
          updatedBy: userId,
        },
        include: {
          brand: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              products: true,
            },
          },
        },
      });

      // If changes affect product names/SKUs, update all linked products
      if (willAffectProducts) {
        // Get all products linked to this variant
        const linkedProducts = await tx.product.findMany({
          where: {
            variantId: id,
            deletedAt: null,
          },
          select: {
            id: true,
            packSize: true,
            packagingType: true,
            brand: { select: { name: true } },
            brandId: true,
            manufacturerId: true,
          },
        });

        // Check for products that would have identical specifications after update
        const effectiveBrandName = newBrand
          ? newBrand.name
          : existingVariant.brand.name;
        const effectiveVariantName = name || existingVariant.name;

        const specMap = new Map<string, string[]>();
        for (const product of linkedProducts) {
          const specKey =
            `${effectiveBrandName}-${effectiveVariantName}-${product.packSize}-${product.packagingType}`.toLowerCase();
          if (!specMap.has(specKey)) {
            specMap.set(specKey, []);
          }
          specMap.get(specKey)!.push(product.id);
        }

        // Find duplicates
        const duplicateSpecs = Array.from(specMap.entries()).filter(
          ([_, productIds]) => productIds.length > 1,
        );

        if (duplicateSpecs.length > 0) {
          const duplicateInfo = duplicateSpecs
            .map(
              ([spec, productIds]) =>
                `${productIds.length} products with specs: ${spec} (IDs: ${productIds.join(', ')})`,
            )
            .join('\n');

          throw new ConflictException(
            `Cannot update variant because it would create products with identical specifications:\n${duplicateInfo}\n\nPlease ensure all products have unique combinations of brand, variant, pack size, and packaging type.`,
          );
        }

        // Update each product's name and SKU
        for (const product of linkedProducts) {
          // Determine the effective brand (use new brand if brandId is being updated)
          const effectiveBrandName = newBrand
            ? newBrand.name
            : product.brand.name;
          const effectiveVariantName = name || existingVariant.name;

          // Generate new name and SKU
          const newName = `${effectiveBrandName} ${effectiveVariantName} ${product.packSize} (${product.packagingType})`;
          const newSku = `${effectiveBrandName.toUpperCase().replace(/[^A-Z0-9]/g, '-')}-${effectiveVariantName.toUpperCase().replace(/[^A-Z0-9]/g, '-')}-${product.packSize.toUpperCase().replace(/[^A-Z0-9]/g, '-')}-${product.packagingType.toUpperCase().replace(/[^A-Z0-9]/g, '-')}`;

          // Update the product
          await tx.product.update({
            where: { id: product.id },
            data: {
              name: newName,
              sku: newSku,
              ...(brandId && { brandId }), // Update brandId if variant's brand changed
              updatedBy: userId,
            },
          });
        }
      }

      return updatedVariant;
    });

    // Invalidate variant and product caches (since products may have been updated)
    await this.cacheInvalidationService.invalidateVariant(id);
    if (willAffectProducts) {
      await this.cacheInvalidationService.invalidateProducts();
    }

    return result as VariantResponseDto;
  }

  @AuditLog({
    action: 'DELETE',
    resource: 'VARIANT',
  })
  async remove(id: string, userId: string): Promise<{ message: string }> {
    // Check if variant exists
    const existingVariant = await this.prisma.variant.findFirst({
      where: { id, deletedAt: null },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    if (!existingVariant) {
      throw new NotFoundException('Variant not found');
    }

    // Check if variant has associated products
    if (existingVariant._count.products > 0) {
      throw new BadRequestException(
        'Cannot delete variant with associated products. Please remove or reassign all products first.',
      );
    }

    // Soft delete
    await this.prisma.variant.update({
      where: { id },
      data: {
        deletedBy: userId,
        deletedAt: new Date(),
      },
    });

    // Invalidate variant-related caches
    await this.cacheInvalidationService.invalidateVariant(id);

    return { message: 'Variant deleted successfully' };
  }

  async getStats(): Promise<VariantStatsDto> {
    // Get total variants count
    const totalVariants = await this.prisma.variant.count({
      where: { deletedAt: null },
    });

    // Get variants by brand
    const variantsByBrandData = await this.prisma.variant.groupBy({
      by: ['brandId'],
      where: { deletedAt: null },
      _count: true,
    });

    // Transform to brand name: count format
    const variantsByBrand: Record<string, number> = {};
    for (const item of variantsByBrandData) {
      // Note: We'll need to fetch brand names separately since groupBy doesn't support include
      const brand = await this.prisma.brand.findUnique({
        where: { id: item.brandId },
        select: { name: true },
      });
      if (brand) {
        variantsByBrand[brand.name] = item._count;
      }
    }

    // Get most popular variants by product count
    const popularVariantsData = await this.prisma.variant.findMany({
      where: { deletedAt: null },
      select: {
        name: true,
        _count: {
          select: {
            products: true,
          },
        },
      },
      orderBy: {
        products: {
          _count: 'desc',
        },
      },
      take: 10,
    });

    const popularVariants = popularVariantsData.map((variant) => ({
      name: variant.name,
      productCount: variant._count.products,
    }));

    return {
      totalVariants,
      variantsByBrand,
      popularVariants,
    };
  }
}
