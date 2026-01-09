import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CacheInvalidationService } from '../cache/cache-invalidation.service';
import {
  CreateProductDto,
  UpdateProductDto,
  ProductQueryDto,
  ProductResponseDto,
} from './dto';
import { PaginatedResponse } from '../../common/dto/paginated-response.dto';
import { StringUtils } from '../../common/utils/string.utils';
import { BarcodeGenerator } from '../../common/utils/barcode.utils';

@Injectable()
export class ProductService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditService,
    private readonly cacheInvalidationService: CacheInvalidationService,
  ) {}

  /**
   * Generate product name, SKU, and barcode
   */
  private async generateProductIdentifiers(
    brandId: string,
    variantId: string,
    packSize: string,
    packagingType: string,
  ): Promise<{ name: string; sku: string; barcode: string }> {
    // Get brand and variant names
    const [brand, variant] = await Promise.all([
      this.prisma.brand.findUnique({
        where: { id: brandId },
        select: { name: true },
      }),
      this.prisma.variant.findUnique({
        where: { id: variantId },
        select: { name: true },
      }),
    ]);

    if (!brand) {
      throw new BadRequestException('Brand not found');
    }

    if (!variant) {
      throw new BadRequestException('Variant not found');
    }

    // Generate name: "Brand Variant PackSize (PackType)"
    const name = `${brand.name} ${variant.name} ${packSize} (${packagingType})`;

    // Generate SKU: "BRAND-VARIANT-PACKSIZE-PACKTYPE"
    const sku = StringUtils.generateSlug(
      `${brand.name}-${variant.name}-${packSize}-${packagingType}`,
    ).toUpperCase();

    // Generate EAN-13 barcode
    const barcode = BarcodeGenerator.generateEAN13(
      brand.name,
      variant.name,
      packSize,
      packagingType,
    );

    return { name, sku, barcode };
  }

  /**
   * Validate foreign key references and get manufacturerId from brand
   */
  private async validateReferences(
    brandId: string,
    categoryId: string,
  ): Promise<{ manufacturerId: string }> {
    const [brand, category] = await Promise.all([
      this.prisma.brand.findUnique({
        where: { id: brandId },
        select: { id: true, manufacturerId: true },
      }),
      this.prisma.category.findUnique({ where: { id: categoryId } }),
    ]);

    if (!brand) {
      throw new BadRequestException('Brand not found');
    }
    if (!category) {
      throw new BadRequestException('Category not found');
    }

    return { manufacturerId: brand.manufacturerId };
  }

  /**
   * Validate that variant exists and belongs to the specified brand
   */
  private async validateVariant(
    variantId: string,
    brandId: string,
  ): Promise<void> {
    const variant = await this.prisma.variant.findUnique({
      where: { id: variantId },
      select: { id: true, brandId: true },
    });

    if (!variant) {
      throw new BadRequestException('Variant not found');
    }

    if (variant.brandId !== brandId) {
      throw new BadRequestException(
        'Variant does not belong to the specified brand',
      );
    }
  }

  async create(
    createProductDto: CreateProductDto,
    userId: string,
  ): Promise<ProductResponseDto> {
    const {
      brandId,
      categoryId,
      variantId,
      packSize,
      packagingType,
      barcode: providedBarcode,
      ...rest
    } = createProductDto;

    // Validate references and get manufacturerId from brand
    const validation = await this.validateReferences(brandId, categoryId);
    const manufacturerId = validation.manufacturerId;

    // Validate that variant exists and belongs to the specified brand
    await this.validateVariant(variantId, brandId);

    // Generate name, SKU, and barcode (if not provided)
    const {
      name,
      sku,
      barcode: generatedBarcode,
    } = await this.generateProductIdentifiers(
      brandId,
      variantId,
      packSize,
      packagingType,
    );

    // Use provided barcode or generated one (but barcode is currently not used in schema)
    const finalBarcode = providedBarcode || generatedBarcode;

    // Validate barcode if provided manually (for future use)
    if (providedBarcode && !BarcodeGenerator.validateEAN13(providedBarcode)) {
      // If it's not a valid EAN-13, check if it might be UPC-A or other format
      if (!/^\d{12,13}$/.test(providedBarcode)) {
        throw new BadRequestException(
          'Invalid barcode format. Must be 12-13 digits.',
        );
      }
    }

    // Check if SKU already exists
    const existingProduct = await this.prisma.product.findUnique({
      where: { sku },
    });

    if (existingProduct) {
      throw new ConflictException(`Product with SKU "${sku}" already exists`);
    }

    try {
      const product = await this.prisma.product.create({
        data: {
          name,
          sku,
          // barcode field removed from schema but generation kept for future
          brandId,
          categoryId,
          manufacturerId,
          variantId,
          packSize,
          packagingType,
          ...rest,
          createdBy: userId,
          updatedBy: userId,
          images: rest.images || [],
        },
        include: {
          brand: {
            select: { id: true, name: true },
          },
          variant: {
            select: { id: true, name: true, description: true },
          },
          category: {
            select: {
              id: true,
              name: true,
              slug: true,

              parent: {
                select: { id: true, name: true, slug: true },
              },
            },
          },
          manufacturer: {
            select: { id: true, name: true },
          },
        },
      });

      // Log audit
      await this.auditLog.createAuditLog({
        action: 'CREATE',
        resource: 'product',
        resourceId: product.id,
        userId,
        metadata: {
          productName: name,
          sku,
          brand: product.brand.name,
          category: product.category.name,
        },
      });

      // Invalidate product caches
      await this.cacheInvalidationService.invalidateProducts();

      return product;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          const field = error.meta?.target as string[];
          throw new ConflictException(
            `Product with ${field?.join(', ')} already exists`,
          );
        }
      }
      throw error;
    }
  }

  async findAll(
    query: ProductQueryDto,
  ): Promise<PaginatedResponse<ProductResponseDto>> {
    const {
      page = 1,
      limit = 10,
      search,
      brandId,
      categoryId,
      variant,
      isActive,
      includeRelations = true,
    } = query;

    const skip = (page - 1) * limit;

    // Build where conditions
    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      ...(isActive !== undefined && { isActive }),
      ...(brandId && { brandId }),
      ...(categoryId && { categoryId }),
      ...(variant && {
        variant: {
          name: { contains: variant, mode: 'insensitive' as const },
        },
      }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { variant: { name: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    };

    const include = includeRelations
      ? {
          brand: {
            select: { id: true, name: true },
          },
          variant: {
            select: { id: true, name: true, description: true },
          },
          category: {
            select: {
              id: true,
              name: true,
              slug: true,

              parent: {
                select: { id: true, name: true, slug: true },
              },
            },
          },
          manufacturer: {
            select: { id: true, name: true },
          },
        }
      : undefined;

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include,
        orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return new PaginatedResponse(products, page, limit, total);
  }

  async findOne(id: string): Promise<ProductResponseDto> {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: {
        brand: {
          select: { id: true, name: true },
        },
        variant: {
          select: { id: true, name: true, description: true },
        },
        category: {
          select: {
            id: true,
            name: true,
            slug: true,

            parent: {
              select: { id: true, name: true, slug: true },
            },
          },
        },
        manufacturer: {
          select: { id: true, name: true },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    return product;
  }

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
    userId: string,
  ): Promise<ProductResponseDto> {
    // Check if product exists
    const existingProduct = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existingProduct) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    const { brandId, categoryId, variantId, packSize, packagingType, ...rest } =
      updateProductDto;

    let name: string | undefined;
    let sku: string | undefined;
    let manufacturerId: string | undefined;

    // If any identifier fields are being updated, regenerate name, SKU
    if (brandId || variantId || packSize || packagingType) {
      const finalBrandId = brandId || existingProduct.brandId;
      const finalVariantId = variantId || existingProduct.variantId;
      const finalPackSize = packSize || existingProduct.packSize;
      const finalPackagingType = packagingType || existingProduct.packagingType;

      // Validate references if changed and get manufacturerId from brand if brandId is provided
      if (brandId || categoryId) {
        const validation = await this.validateReferences(
          brandId || existingProduct.brandId,
          categoryId || existingProduct.categoryId,
        );
        if (brandId) {
          manufacturerId = validation.manufacturerId;
        }
      }

      // Validate variant if changed
      if (variantId) {
        await this.validateVariant(variantId, finalBrandId);
      }

      const identifiers = await this.generateProductIdentifiers(
        finalBrandId,
        finalVariantId,
        finalPackSize,
        finalPackagingType,
      );

      name = identifiers.name;
      sku = identifiers.sku;

      // Check if new SKU conflicts with existing products (excluding current)
      if (sku !== existingProduct.sku) {
        const existingSkuProduct = await this.prisma.product.findUnique({
          where: { sku },
        });

        if (existingSkuProduct && existingSkuProduct.id !== id) {
          throw new ConflictException(
            `Product with SKU "${sku}" already exists`,
          );
        }
      }
    }

    try {
      const product = await this.prisma.product.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(sku && { sku }),
          ...(manufacturerId && { manufacturerId }),
          ...rest,
          updatedBy: userId,
        },
        include: {
          brand: {
            select: { id: true, name: true },
          },
          variant: {
            select: { id: true, name: true, description: true },
          },
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
              parent: {
                select: { id: true, name: true, slug: true },
              },
            },
          },
          manufacturer: {
            select: { id: true, name: true },
          },
        },
      });

      // Log audit
      await this.auditLog.createAuditLog({
        action: 'UPDATE',
        resource: 'product',
        resourceId: product.id,
        userId,
        metadata: {
          productName: product.name,
          sku: product.sku,
          changes: Object.keys(updateProductDto),
        },
      });

      // Invalidate product caches
      await this.cacheInvalidationService.invalidateProduct(id);

      return product;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          const field = error.meta?.target as string[];
          throw new ConflictException(
            `Product with ${field?.join(', ')} already exists`,
          );
        }
      }
      throw error;
    }
  }

  async remove(id: string, userId: string): Promise<void> {
    // Check if product exists
    const existingProduct = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existingProduct) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    // Soft delete
    await this.prisma.product.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy: userId,
      },
    });

    // Log audit
    await this.auditLog.createAuditLog({
      action: 'DELETE',
      resource: 'product',
      resourceId: id,
      userId,
      metadata: {
        productName: existingProduct.name,
        sku: existingProduct.sku,
      },
    });

    // Invalidate product caches
    await this.cacheInvalidationService.invalidateProduct(id);
  }

  async activate(id: string, userId: string): Promise<ProductResponseDto> {
    const product = await this.findOne(id);

    const updatedProduct = await this.prisma.product.update({
      where: { id },
      data: {
        isActive: true,
        updatedBy: userId,
      },
      include: {
        brand: {
          select: { id: true, name: true },
        },
        variant: {
          select: { id: true, name: true, description: true },
        },
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            parent: {
              select: { id: true, name: true, slug: true },
            },
          },
        },
        manufacturer: {
          select: { id: true, name: true },
        },
      },
    });

    // Log audit
    await this.auditLog.createAuditLog({
      action: 'ACTIVATE',
      resource: 'product',
      resourceId: id,
      userId,
      metadata: {
        productName: product.name,
        sku: product.sku,
      },
    });

    // Invalidate product caches
    await this.cacheInvalidationService.invalidateProduct(id);

    return updatedProduct;
  }

  async deactivate(id: string, userId: string): Promise<ProductResponseDto> {
    const product = await this.findOne(id);

    const updatedProduct = await this.prisma.product.update({
      where: { id },
      data: {
        isActive: false,
        updatedBy: userId,
      },
      include: {
        brand: {
          select: { id: true, name: true },
        },
        variant: {
          select: { id: true, name: true, description: true },
        },
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            parent: {
              select: { id: true, name: true, slug: true },
            },
          },
        },
        manufacturer: {
          select: { id: true, name: true },
        },
      },
    });

    // Log audit
    await this.auditLog.createAuditLog({
      action: 'DEACTIVATE',
      resource: 'product',
      resourceId: id,
      userId,
      metadata: {
        productName: product.name,
        sku: product.sku,
      },
    });

    // Invalidate product caches
    await this.cacheInvalidationService.invalidateProduct(id);

    return updatedProduct;
  }
}
