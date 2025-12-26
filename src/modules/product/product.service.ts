import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
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
  ) {}

  /**
   * Generate product name, SKU, and barcode
   */
  private async generateProductIdentifiers(
    brandId: string,
    variant: string,
    packSize: string,
    packagingType: string,
  ): Promise<{ name: string; sku: string; barcode: string }> {
    // Get brand name
    const brand = await this.prisma.brand.findUnique({
      where: { id: brandId },
      select: { name: true },
    });

    if (!brand) {
      throw new BadRequestException('Brand not found');
    }

    // Generate name: "Brand Variant PackSize (PackType)"
    const name = `${brand.name} ${variant} ${packSize} (${packagingType})`;

    // Generate SKU: "BRAND-VARIANT-PACKSIZE-PACKTYPE"
    const sku = StringUtils.generateSlug(
      `${brand.name}-${variant}-${packSize}-${packagingType}`,
    ).toUpperCase();

    // Generate EAN-13 barcode
    const barcode = BarcodeGenerator.generateEAN13(
      brand.name,
      variant,
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

  async create(
    createProductDto: CreateProductDto,
    userId: string,
  ): Promise<ProductResponseDto> {
    const {
      brandId,
      categoryId,
      variant,
      packSize,
      packagingType,
      barcode: providedBarcode,
      ...rest
    } = createProductDto;

    // Validate references and get manufacturerId from brand
    const validation = await this.validateReferences(brandId, categoryId);
    const manufacturerId = validation.manufacturerId;

    // Generate name, SKU, and barcode (if not provided)
    const {
      name,
      sku,
      barcode: generatedBarcode,
    } = await this.generateProductIdentifiers(
      brandId,
      variant,
      packSize,
      packagingType,
    );

    // Use provided barcode or generated one
    const finalBarcode = providedBarcode || generatedBarcode;

    // Validate barcode if provided manually
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

    // Check if barcode already exists
    const existingBarcode = await this.prisma.product.findUnique({
      where: { barcode: finalBarcode },
    });

    if (existingBarcode) {
      throw new ConflictException(
        `Product with barcode "${finalBarcode}" already exists`,
      );
    }

    try {
      const product = await this.prisma.product.create({
        data: {
          name,
          sku,
          barcode: finalBarcode,
          brandId,
          categoryId,
          manufacturerId,
          variant,
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
      ...(variant && { variant: { contains: variant, mode: 'insensitive' } }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { variant: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const include = includeRelations
      ? {
          brand: {
            select: { id: true, name: true },
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

    const {
      brandId,
      categoryId,
      variant,
      packSize,
      packagingType,
      barcode: providedBarcode,
      ...rest
    } = updateProductDto;

    let name: string | undefined;
    let sku: string | undefined;
    let barcode: string | undefined;
    let manufacturerId: string | undefined;

    // If any identifier fields are being updated, regenerate name, SKU, and barcode
    if (brandId || variant || packSize || packagingType) {
      const finalBrandId = brandId || existingProduct.brandId;
      const finalVariant = variant || existingProduct.variant;
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

      const identifiers = await this.generateProductIdentifiers(
        finalBrandId,
        finalVariant,
        finalPackSize,
        finalPackagingType,
      );

      name = identifiers.name;
      sku = identifiers.sku;
      barcode = identifiers.barcode;

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

    // Handle manually provided barcode
    if (providedBarcode && providedBarcode !== barcode) {
      // Validate the provided barcode
      if (!BarcodeGenerator.validateEAN13(providedBarcode)) {
        if (!/^\d{12,13}$/.test(providedBarcode)) {
          throw new BadRequestException(
            'Invalid barcode format. Must be 12-13 digits.',
          );
        }
      }

      // Check if provided barcode conflicts with existing products (excluding current)
      const existingBarcodeProduct = await this.prisma.product.findUnique({
        where: { barcode: providedBarcode },
      });

      if (existingBarcodeProduct && existingBarcodeProduct.id !== id) {
        throw new ConflictException(
          `Product with barcode "${providedBarcode}" already exists`,
        );
      }

      barcode = providedBarcode;
    }

    try {
      const product = await this.prisma.product.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(sku && { sku }),
          ...(barcode && { barcode }),
          ...updateProductDto,
          updatedBy: userId,
        },
        include: {
          brand: {
            select: { id: true, name: true },
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
        isActive: false, // Also deactivate
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

    return updatedProduct;
  }
}
