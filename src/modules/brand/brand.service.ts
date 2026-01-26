import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma, BrandStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CloudinaryService } from '../storage/cloudinary.service';
import { CacheInvalidationService } from '../cache/cache-invalidation.service';
import { StringUtils } from '../../common/utils/helpers.utils';
import {
  CreateBrandDto,
  UpdateBrandDto,
  BrandQueryDto,
  BrandResponseDto,
  BrandStatsDto,
} from './dto';
import {
  PaginatedResponse,
  PaginationMeta,
} from '../../common/dto/paginated-response.dto';

@Injectable()
export class BrandService {
  constructor(
    private prisma: PrismaService,
    private cloudinaryService: CloudinaryService,
    private auditService: AuditService,
    private cacheInvalidationService: CacheInvalidationService,
  ) {}

  /**
   * Normalizes brand name for case-insensitive comparison
   * Trims whitespace and converts to lowercase
   */
  private normalizeBrandName(name: string): string {
    return name.trim().toLowerCase();
  }

  /**
   * Sanitizes brand name for storage
   * Converts to proper title case and trims whitespace
   */
  private sanitizeBrandName(name: string): string {
    return StringUtils.titleCase(name.trim());
  }

  async create(
    createBrandDto: CreateBrandDto,
    userId: string,
    logoFile?: Express.Multer.File,
  ): Promise<BrandResponseDto> {
    // Check if manufacturer exists and is active
    const manufacturer = await this.prisma.manufacturer.findUnique({
      where: { id: createBrandDto.manufacturerId, deletedAt: null },
    });

    if (!manufacturer) {
      throw new NotFoundException('Manufacturer not found');
    }

    if (manufacturer.status === 'INACTIVE') {
      throw new BadRequestException(
        'Cannot create brand for inactive manufacturer',
      );
    }

    // Sanitize brand name
    const sanitizedName = this.sanitizeBrandName(createBrandDto.name);
    const normalizedName = this.normalizeBrandName(sanitizedName);

    // Check for duplicate brand name under same manufacturer (case-insensitive)
    const existingBrands = await this.prisma.brand.findMany({
      where: {
        manufacturerId: createBrandDto.manufacturerId,
        deletedAt: null,
      },
      select: {
        name: true,
      },
    });

    const duplicateExists = existingBrands.some(
      (brand) => this.normalizeBrandName(brand.name) === normalizedName,
    );

    if (duplicateExists) {
      throw new ConflictException(
        'Brand with this name already exists for this manufacturer',
      );
    }

    let logoUrl: string | null = null;

    // Upload logo if provided
    if (logoFile) {
      try {
        const uploadResult = await this.cloudinaryService.uploadFile(
          logoFile.buffer,
          {
            folder: `jooav-erp/brands/${sanitizedName.toLowerCase().replace(/\s+/g, '-')}`,
            publicId: `logo-${Date.now()}`,
          },
        );
        logoUrl = uploadResult.secureUrl;
      } catch (error) {
        throw new BadRequestException('Failed to upload brand logo');
      }
    }

    try {
      const brand = await this.prisma.brand.create({
        data: {
          ...createBrandDto,
          name: sanitizedName,
          logo: logoUrl,
          createdBy: userId,
          updatedBy: userId,
          status: createBrandDto.status || BrandStatus.ACTIVE,
        },
        include: {
          manufacturer: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
        },
      });

      // Log audit trail
      await this.auditService.createAuditLog({
        action: 'CREATE',
        resource: 'Brand',
        resourceId: brand.id,
        userId,
        metadata: {
          brandName: brand.name,
          manufacturerId: brand.manufacturerId,
        },
      });

      // Invalidate brand-related caches
      await this.cacheInvalidationService.invalidateBrand(brand.id);

      return brand;
    } catch (error) {
      // Handle Prisma unique constraint error
      if (error.code === 'P2002') {
        throw new ConflictException(
          'Brand with this name already exists for this manufacturer',
        );
      }
      // Re-throw other errors
      throw error;
    }
  }

  async findAll(
    query: BrandQueryDto,
    includes?: {
      includeManufacturer?: boolean;
      includeProducts?: boolean;
      includeAuditInfo?: boolean;
    },
  ): Promise<PaginatedResponse<BrandResponseDto>> {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      manufacturerId,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.BrandWhereInput = {
      deletedAt: null,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { manufacturer: { name: { contains: search, mode: 'insensitive' } } },
        ],
      }),
      ...(status && { status }),
      ...(manufacturerId && { manufacturerId }),
    };

    const orderBy: Prisma.BrandOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    // Build dynamic include object
    const includeObject: any = {
      _count: {
        select: {
          products: true,
        },
      },
    };

    // Include manufacturer if requested
    if (includes?.includeManufacturer === true) {
      includeObject.manufacturer = {
        select: {
          id: true,
          name: true,
          status: true,
        },
      };
    }

    // Include products if requested
    if (includes?.includeProducts === true) {
      includeObject.products = {
        select: {
          id: true,
          name: true,
          sku: true,
          isActive: true,
          price: true,
        },
        take: 10, // Limit to first 10 products
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

    const [brands, total] = await Promise.all([
      this.prisma.brand.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: includeObject,
      }),
      this.prisma.brand.count({ where }),
    ]);

    return {
      data: brands,
      meta: new PaginationMeta(page, limit, total),
    };
  }

  async findOne(
    id: string,
    includes?: {
      includeManufacturer?: boolean;
      includeProducts?: boolean;
      includeAuditInfo?: boolean;
    },
  ): Promise<BrandResponseDto> {
    // Build dynamic include object
    const includeObject: any = {
      _count: {
        select: {
          products: true,
        },
      },
    };

    // Include manufacturer if requested (default to true for backward compatibility)
    if (includes?.includeManufacturer !== false) {
      includeObject.manufacturer = {
        select: {
          id: true,
          name: true,
          status: true,
        },
      };
    }

    // Include products if requested (default to false)
    if (includes?.includeProducts === true) {
      includeObject.products = {
        select: {
          id: true,
          name: true,
          sku: true,
          isActive: true,
          price: true,
        },
        take: 10, // Limit to first 10 products
      };
    }

    // Include audit info if requested (default to false)
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

    const brand = await this.prisma.brand.findFirst({
      where: { id, deletedAt: null },
      include: includeObject,
    });

    if (!brand) {
      throw new NotFoundException('Brand not found');
    }

    return brand;
  }

  async update(
    id: string,
    updateBrandDto: UpdateBrandDto,
    userId: string,
    logoFile?: Express.Multer.File,
  ): Promise<BrandResponseDto> {
    const existingBrand = await this.findOne(id);

    // If manufacturerId is being updated, validate the new manufacturer
    if (
      updateBrandDto.manufacturerId &&
      updateBrandDto.manufacturerId !== existingBrand.manufacturerId
    ) {
      const manufacturer = await this.prisma.manufacturer.findUnique({
        where: { id: updateBrandDto.manufacturerId, deletedAt: null },
      });

      if (!manufacturer) {
        throw new NotFoundException('Manufacturer not found');
      }

      if (manufacturer.status === 'INACTIVE') {
        throw new BadRequestException(
          'Cannot move brand to inactive manufacturer',
        );
      }

      // Check for duplicate name under new manufacturer
      if (updateBrandDto.name || existingBrand.name) {
        const brandName = updateBrandDto.name || existingBrand.name;
        const sanitizedName = this.sanitizeBrandName(brandName);
        const normalizedName = this.normalizeBrandName(sanitizedName);

        const existingBrands = await this.prisma.brand.findMany({
          where: {
            manufacturerId: updateBrandDto.manufacturerId,
            deletedAt: null,
            id: { not: id },
          },
          select: {
            name: true,
          },
        });

        const duplicateExists = existingBrands.some(
          (brand) => this.normalizeBrandName(brand.name) === normalizedName,
        );

        if (duplicateExists) {
          throw new ConflictException(
            'Brand with this name already exists for the target manufacturer',
          );
        }
      }
    }

    // Check for duplicate name under same manufacturer (if name is being updated)
    if (updateBrandDto.name && updateBrandDto.name !== existingBrand.name) {
      const sanitizedName = this.sanitizeBrandName(updateBrandDto.name);
      const normalizedName = this.normalizeBrandName(sanitizedName);
      const manufacturerIdToCheck =
        updateBrandDto.manufacturerId || existingBrand.manufacturerId;

      const existingBrands = await this.prisma.brand.findMany({
        where: {
          manufacturerId: manufacturerIdToCheck,
          deletedAt: null,
          id: { not: id },
        },
        select: {
          name: true,
        },
      });

      const duplicateExists = existingBrands.some(
        (brand) => this.normalizeBrandName(brand.name) === normalizedName,
      );

      if (duplicateExists) {
        throw new ConflictException(
          'Brand with this name already exists for this manufacturer',
        );
      }
    }

    let logoUrl = existingBrand.logo;

    // Handle logo upload
    if (logoFile) {
      try {
        // Delete old logo if exists
        if (existingBrand.logo) {
          await this.cloudinaryService.deleteFile(existingBrand.logo);
        }

        // Upload new logo
        const uploadResult = await this.cloudinaryService.uploadFile(
          logoFile.buffer,
          {
            folder: `jooav-erp/brands/${(updateBrandDto.name || existingBrand.name).toLowerCase().replace(/\s+/g, '-')}`,
          },
        );
        logoUrl = uploadResult.secureUrl;
      } catch (error) {
        throw new BadRequestException('Failed to upload brand logo');
      }
    }

    // Prepare update data with sanitized name if provided
    const updateData: any = {
      ...updateBrandDto,
      ...(logoFile && { logo: logoUrl }),
      updatedBy: userId,
    };

    // Sanitize name if it's being updated
    if (updateBrandDto.name) {
      updateData.name = this.sanitizeBrandName(updateBrandDto.name);
    }

    try {
      const brand = await this.prisma.brand.update({
        where: { id },
        data: updateData,
        include: {
          manufacturer: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
        },
      });

      // Log audit trail
      await this.auditService.createAuditLog({
        action: 'UPDATE',
        resource: 'Brand',
        resourceId: brand.id,
        userId,
        metadata: {
          brandName: brand.name,
          changes: Object.keys(updateBrandDto),
        },
      });

      // Invalidate brand-related caches
      await this.cacheInvalidationService.invalidateBrand(id);

      return brand;
    } catch (error) {
      // Handle Prisma unique constraint error
      if (error.code === 'P2002') {
        throw new ConflictException(
          'Brand with this name already exists for this manufacturer',
        );
      }
      // Re-throw other errors
      throw error;
    }
  }

  async updateStatus(
    id: string,
    status: BrandStatus,
    userId: string,
  ): Promise<BrandResponseDto> {
    const existingBrand = await this.findOne(id);

    const brand = await this.prisma.brand.update({
      where: { id },
      data: {
        status,
        updatedBy: userId,
      },
      include: {
        manufacturer: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
    });

    // Log audit trail
    await this.auditService.createAuditLog({
      action: 'STATUS_UPDATE',
      resource: 'Brand',
      resourceId: brand.id,
      userId,
      metadata: {
        brandName: brand.name,
        oldStatus: existingBrand.status,
        newStatus: status,
      },
    });

    return brand;
  }

  async remove(
    id: string,
    userId: string,
  ): Promise<{ message: string; brandName: string }> {
    const existingBrand = await this.findOne(id);

    // Soft delete the brand
    await this.prisma.brand.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy: userId,
      },
    });

    // Log audit trail
    await this.auditService.createAuditLog({
      action: 'DELETE',
      resource: 'Brand',
      resourceId: id,
      userId,
      metadata: { brandName: existingBrand.name },
    });

    // Invalidate brand-related caches
    await this.cacheInvalidationService.invalidateBrand(id);

    return {
      message: 'Brand deleted successfully',
      brandName: existingBrand.name,
    };
  }

  /**
   * Bulk soft delete brands
   */
  async bulkDelete(
    brandIds: string[],
    userId: string,
  ): Promise<{
    deletedCount: number;
    deletedBrands: Array<{ brandName: string; manufacturerName: string }>;
    failedDeletions: Array<{ name: string; reason: string }>;
  }> {
    const brands = await this.prisma.brand.findMany({
      where: {
        id: { in: brandIds },
        deletedAt: null,
      },
      include: {
        manufacturer: {
          select: {
            name: true,
          },
        },
      },
    });

    const deletedBrands: Array<{
      brandName: string;
      manufacturerName: string;
    }> = [];
    const failedDeletions: Array<{ name: string; reason: string }> = [];

    // Process each brand
    for (const brand of brands) {
      try {
        // Soft delete the brand
        await this.prisma.brand.update({
          where: { id: brand.id },
          data: {
            deletedAt: new Date(),
            deletedBy: userId,
          },
        });

        // Log audit trail for each deletion
        await this.auditService.createAuditLog({
          action: 'DELETE',
          resource: 'Brand',
          resourceId: brand.id,
          userId,
          metadata: {
            brandName: brand.name,
            bulkOperation: true,
          },
        });

        // Invalidate brand cache
        await this.cacheInvalidationService.invalidateBrand(brand.id);

        deletedBrands.push({
          brandName: brand.name,
          manufacturerName: brand.manufacturer.name,
        });
      } catch (error) {
        failedDeletions.push({
          name: brand.name,
          reason: `Failed to delete brand: ${error.message}`,
        });
      }
    }

    // Handle case where some IDs don't exist
    const foundIds = brands.map((b) => b.id);
    const notFoundIds = brandIds.filter((id) => !foundIds.includes(id));

    for (const id of notFoundIds) {
      failedDeletions.push({
        name: `Brand ID: ${id}`,
        reason: 'Brand not found or already deleted',
      });
    }

    return {
      deletedCount: deletedBrands.length,
      deletedBrands,
      failedDeletions,
    };
  }

  async deleteLogo(id: string, userId: string): Promise<BrandResponseDto> {
    const existingBrand = await this.findOne(id);

    if (!existingBrand.logo) {
      throw new BadRequestException('Brand has no logo to delete');
    }

    try {
      // Delete from Cloudinary
      await this.cloudinaryService.deleteFile(existingBrand.logo);
    } catch (error) {
      // Continue even if Cloudinary deletion fails
      console.warn('Failed to delete logo from Cloudinary:', error.message);
    }

    const brand = await this.prisma.brand.update({
      where: { id },
      data: {
        logo: null,
        updatedBy: userId,
      },
      include: {
        manufacturer: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
    });

    // Log audit trail
    await this.auditService.createAuditLog({
      action: 'LOGO_DELETE',
      resource: 'Brand',
      resourceId: id,
      userId,
      metadata: { brandName: existingBrand.name },
    });

    return brand;
  }

  async updateLogo(
    id: string,
    logoFile: Express.Multer.File,
    userId: string,
  ): Promise<BrandResponseDto> {
    const existingBrand = await this.findOne(id);

    try {
      // Delete old logo if exists
      if (existingBrand.logo) {
        await this.cloudinaryService.deleteFile(existingBrand.logo);
      }

      // Upload new logo
      const uploadResult = await this.cloudinaryService.uploadFile(
        logoFile.buffer,
        {
          folder: `jooav-erp/brands/${existingBrand.name.toLowerCase().replace(/\s+/g, '-')}`,
          publicId: `logo-${Date.now()}`,
        },
      );

      const logoUrl = uploadResult.secureUrl;

      const brand = await this.prisma.brand.update({
        where: { id },
        data: {
          logo: logoUrl,
          updatedBy: userId,
        },
        include: {
          manufacturer: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
        },
      });

      // Log audit trail
      await this.auditService.createAuditLog({
        action: 'LOGO_UPDATE',
        resource: 'Brand',
        resourceId: id,
        userId,
        metadata: {
          brandName: existingBrand.name,
          logoUrl: logoUrl,
          previousLogoUrl: existingBrand.logo,
        },
      });

      return brand;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException('Failed to update brand logo');
    }
  }

  async getStats(): Promise<BrandStatsDto> {
    const [total, active, inactive, recentlyAdded, totalManufacturers] =
      await Promise.all([
        this.prisma.brand.count({ where: { deletedAt: null } }),
        this.prisma.brand.count({
          where: { status: BrandStatus.ACTIVE, deletedAt: null },
        }),
        this.prisma.brand.count({
          where: { status: BrandStatus.INACTIVE, deletedAt: null },
        }),
        this.prisma.brand.count({
          where: {
            deletedAt: null,
            createdAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
            },
          },
        }),
        this.prisma.manufacturer.count({ where: { deletedAt: null } }),
      ]);

    return {
      total,
      active,
      inactive,
      recentlyAdded,
      totalManufacturers,
    };
  }

  async getByManufacturer(
    manufacturerId: string,
    query: BrandQueryDto,
  ): Promise<PaginatedResponse<BrandResponseDto>> {
    const queryDto = new BrandQueryDto();
    Object.assign(queryDto, query, { manufacturerId });
    return this.findAll(queryDto);
  }

  async getDeletedBrands(query: BrandQueryDto): Promise<
    PaginatedResponse<
      BrandResponseDto & {
        deletedAt: Date;
        deletedBy: { id: string; email: string; name: string };
      }
    >
  > {
    const {
      page = 1,
      limit = 10,
      search,
      manufacturerId,
      sortBy = 'deletedAt',
      sortOrder = 'desc',
    } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.BrandWhereInput = {
      deletedAt: { not: null }, // Only get deleted brands
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { manufacturer: { name: { contains: search, mode: 'insensitive' } } },
        ],
      }),
      ...(manufacturerId && { manufacturerId }),
    };

    const orderBy: Prisma.BrandOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    const [brands, total] = await Promise.all([
      this.prisma.brand.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          manufacturer: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
          deletedByUser: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      this.prisma.brand.count({ where }),
    ]);

    const brandsWithDeletedInfo = brands.map((brand) => ({
      ...brand,
      deletedBy: {
        id: brand.deletedByUser!.id,
        email: brand.deletedByUser!.email,
        name: `${brand.deletedByUser!.firstName || ''} ${brand.deletedByUser!.lastName || ''}`.trim(),
      },
    }));

    return {
      data: brandsWithDeletedInfo as any,
      meta: new PaginationMeta(page, limit, total),
    };
  }
}
