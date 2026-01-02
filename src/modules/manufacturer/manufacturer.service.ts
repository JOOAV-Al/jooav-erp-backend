import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { ManufacturerStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { StringUtils } from '../../common/utils/helpers.utils';
import {
  CreateManufacturerDto,
  UpdateManufacturerDto,
} from './dto/manufacturer.dto';
import { ManufacturerResponseDto } from './dto/manufacturer-response.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PaginatedResponse } from '../../common/dto/paginated-response.dto';

@Injectable()
export class ManufacturerService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  /**
   * Normalizes manufacturer name for case-insensitive comparison
   * Trims whitespace and converts to lowercase
   */
  private normalizeManufacturerName(name: string): string {
    return name.trim().toLowerCase();
  }

  /**
   * Sanitizes manufacturer name for storage
   * Converts to proper title case and trims whitespace
   */
  private sanitizeManufacturerName(name: string): string {
    return StringUtils.titleCase(name.trim());
  }

  /**
   * Create a new manufacturer
   */
  async create(
    createDto: CreateManufacturerDto,
    adminId: string,
    request: any,
  ): Promise<ManufacturerResponseDto> {
    // Sanitize manufacturer name
    const sanitizedName = this.sanitizeManufacturerName(createDto.name);
    const normalizedName = this.normalizeManufacturerName(sanitizedName);

    // Check if manufacturer with same name already exists (case-insensitive)
    const existingManufacturers = await this.prisma.manufacturer.findMany({
      where: { deletedAt: null },
      select: { name: true },
    });

    const duplicateExists = existingManufacturers.some(
      (manufacturer) =>
        this.normalizeManufacturerName(manufacturer.name) === normalizedName,
    );

    if (duplicateExists) {
      throw new ConflictException('Manufacturer with this name already exists');
    }

    // Check registration number uniqueness if provided
    if (createDto.registrationNumber) {
      const existingByRegNumber = await this.prisma.manufacturer.findUnique({
        where: { registrationNumber: createDto.registrationNumber },
      });

      if (existingByRegNumber) {
        throw new ConflictException(
          'Manufacturer with this registration number already exists',
        );
      }
    }

    const manufacturer = await this.prisma.manufacturer.create({
      data: {
        ...createDto,
        name: sanitizedName,
        createdBy: adminId,
        updatedBy: adminId,
      },
      include: {
        createdByUser: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        updatedByUser: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });

    // Log audit event
    await this.auditService.createAuditLog({
      userId: adminId,
      action: 'CREATE_MANUFACTURER',
      resource: 'MANUFACTURER',
      resourceId: manufacturer.id,
      newData: manufacturer,
      ipAddress: request?.ip,
      userAgent: request?.get('user-agent'),
      metadata: { manufacturerName: manufacturer.name },
    });

    return this.transformToResponseDto(manufacturer);
  }

  /**
   * Get all manufacturers with pagination and filters
   */
  async findAll(
    paginationDto: PaginationDto,
    filters?: {
      search?: string;
      status?: ManufacturerStatus;
      country?: string;
      state?: string;
    },
    includes?: {
      includeBrands?: boolean;
      includeProducts?: boolean;
      includeAuditInfo?: boolean;
    },
  ): Promise<PaginatedResponse<ManufacturerResponseDto>> {
    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: null, // Only get non-deleted manufacturers
    };

    // Apply filters
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.country) {
      where.country = filters.country;
    }

    if (filters?.state) {
      where.state = filters.state;
    }

    // Build dynamic include object
    const includeObject: any = {
      _count: {
        select: {
          products: true,
          orders: true,
        },
      },
    };

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

    // Include brands if requested
    if (includes?.includeBrands === true) {
      includeObject.brands = true;
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

    const [manufacturers, total] = await Promise.all([
      this.prisma.manufacturer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: includeObject,
      }),
      this.prisma.manufacturer.count({ where }),
    ]);

    const items = manufacturers.map((manufacturer) =>
      this.transformToResponseDto(manufacturer),
    );

    return {
      data: items,
      meta: {
        page,
        limit,
        totalItems: total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * Get manufacturer by ID
   */
  async findOne(
    id: string,
    includes?: {
      includeBrands?: boolean;
      includeProducts?: boolean;
      includeAuditInfo?: boolean;
    },
  ): Promise<ManufacturerResponseDto> {
    // Build dynamic include object
    const includeObject: any = {
      _count: {
        select: {
          products: true,
          orders: true,
        },
      },
    };

    // Include audit info if requested (default to true for backward compatibility)
    if (includes?.includeAuditInfo !== false) {
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

    // Include brands if requested (default to true for backward compatibility)
    if (includes?.includeBrands !== false) {
      includeObject.brands = true;
    }

    // Include products if requested (default to true for backward compatibility)
    if (includes?.includeProducts !== false) {
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

    const manufacturer = await this.prisma.manufacturer.findFirst({
      where: { id, deletedAt: null },
      include: includeObject,
    });

    if (!manufacturer) {
      throw new NotFoundException('Manufacturer not found');
    }

    return this.transformToResponseDto(manufacturer);
  }

  /**
   * Update manufacturer
   */
  async update(
    id: string,
    updateDto: UpdateManufacturerDto,
    adminId: string,
    request: any,
  ): Promise<ManufacturerResponseDto> {
    const existingManufacturer = await this.prisma.manufacturer.findUnique({
      where: { id },
    });

    if (!existingManufacturer) {
      throw new NotFoundException('Manufacturer not found');
    }

    // Check name uniqueness if being updated
    if (updateDto.name && updateDto.name !== existingManufacturer.name) {
      const sanitizedName = this.sanitizeManufacturerName(updateDto.name);
      const normalizedName = this.normalizeManufacturerName(sanitizedName);

      const existingManufacturers = await this.prisma.manufacturer.findMany({
        where: {
          deletedAt: null,
          id: { not: id },
        },
        select: { name: true },
      });

      const duplicateExists = existingManufacturers.some(
        (manufacturer) =>
          this.normalizeManufacturerName(manufacturer.name) === normalizedName,
      );

      if (duplicateExists) {
        throw new ConflictException(
          'Manufacturer with this name already exists',
        );
      }
    }

    // Check registration number uniqueness if being updated
    if (
      updateDto.registrationNumber &&
      updateDto.registrationNumber !== existingManufacturer.registrationNumber
    ) {
      const duplicateRegNumber = await this.prisma.manufacturer.findFirst({
        where: {
          registrationNumber: updateDto.registrationNumber,
          id: { not: id },
        },
      });

      if (duplicateRegNumber) {
        throw new ConflictException(
          'Manufacturer with this registration number already exists',
        );
      }
    }

    // Prepare update data with sanitized name if provided
    const updateData: any = {
      ...updateDto,
      updatedBy: adminId,
    };

    // Sanitize name if it's being updated
    if (updateDto.name) {
      updateData.name = this.sanitizeManufacturerName(updateDto.name);
    }

    const updatedManufacturer = await this.prisma.manufacturer.update({
      where: { id },
      data: updateData,
      include: {
        createdByUser: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        updatedByUser: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });

    // Log audit event
    await this.auditService.createAuditLog({
      userId: adminId,
      action: 'UPDATE_MANUFACTURER',
      resource: 'MANUFACTURER',
      resourceId: id,
      oldData: existingManufacturer,
      newData: updatedManufacturer,
      ipAddress: request?.ip,
      userAgent: request?.get('user-agent'),
      metadata: { manufacturerName: updatedManufacturer.name },
    });

    return this.transformToResponseDto(updatedManufacturer);
  }

  /**
   * Update manufacturer status
   */
  async updateStatus(
    id: string,
    status: ManufacturerStatus,
    adminId: string,
    request: any,
  ): Promise<ManufacturerResponseDto> {
    const manufacturer = await this.prisma.manufacturer.findUnique({
      where: { id },
    });

    if (!manufacturer) {
      throw new NotFoundException('Manufacturer not found');
    }

    const updatedManufacturer = await this.prisma.manufacturer.update({
      where: { id },
      data: {
        status,
        updatedBy: adminId,
      },
      include: {
        createdByUser: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        updatedByUser: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });

    // Log audit event
    await this.auditService.createAuditLog({
      userId: adminId,
      action: 'UPDATE_MANUFACTURER_STATUS',
      resource: 'MANUFACTURER',
      resourceId: id,
      oldData: { status: manufacturer.status },
      newData: { status },
      ipAddress: request?.ip,
      userAgent: request?.get('user-agent'),
      metadata: {
        manufacturerName: manufacturer.name,
        previousStatus: manufacturer.status,
        newStatus: status,
      },
    });

    return this.transformToResponseDto(updatedManufacturer);
  }

  /**
   * Soft delete manufacturer (set status to SUSPENDED)
   */
  async remove(
    id: string,
    adminId: string,
    request: any,
  ): Promise<{ message: string }> {
    const manufacturer = await this.prisma.manufacturer.findUnique({
      where: { id },
      include: {
        products: true,
      },
    });

    if (!manufacturer) {
      throw new NotFoundException('Manufacturer not found');
    }

    // Check if manufacturer has active products
    const activeProducts = manufacturer.products.filter(
      (p) => p.isActive === true,
    );
    if (activeProducts.length > 0) {
      throw new BadRequestException(
        `Cannot delete manufacturer with ${activeProducts.length} active product(s). Please deactivate all products first.`,
      );
    }

    // Soft delete by setting status to SUSPENDED and recording deletion audit
    await this.prisma.manufacturer.update({
      where: { id },
      data: {
        status: ManufacturerStatus.SUSPENDED,
        updatedBy: adminId,
        deletedBy: adminId,
        deletedAt: new Date(),
      },
    });

    // Log audit event
    await this.auditService.createAuditLog({
      userId: adminId,
      action: 'DELETE_MANUFACTURER',
      resource: 'MANUFACTURER',
      resourceId: id,
      oldData: manufacturer,
      ipAddress: request?.ip,
      userAgent: request?.get('user-agent'),
      metadata: { manufacturerName: manufacturer.name },
    });

    return { message: 'Manufacturer successfully deleted' };
  }

  /**
   * Get manufacturer statistics
   */
  async getStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    suspended: number;
    totalProducts: number;
    totalOrders: number;
    createdThisMonth: number;
    topCountries: Array<{ country: string; count: number }>;
  }> {
    // Calculate date for this month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalManufacturers,
      activeManufacturers,
      inactiveManufacturers,
      suspendedManufacturers,
      totalProducts,
      totalOrders,
      createdThisMonth,
      countryStats,
    ] = await Promise.all([
      this.prisma.manufacturer.count(),
      this.prisma.manufacturer.count({
        where: { status: ManufacturerStatus.ACTIVE },
      }),
      this.prisma.manufacturer.count({
        where: { status: ManufacturerStatus.INACTIVE },
      }),
      this.prisma.manufacturer.count({
        where: { status: ManufacturerStatus.SUSPENDED },
      }),
      this.prisma.product.count(),
      this.prisma.order.count(),
      this.prisma.manufacturer.count({
        where: {
          createdAt: {
            gte: startOfMonth,
          },
        },
      }),
      this.prisma.manufacturer.groupBy({
        by: ['country'],
        _count: {
          country: true,
        },
        orderBy: {
          _count: {
            country: 'desc',
          },
        },
        take: 5, // Top 5 countries
      }),
    ]);

    const topCountries = countryStats
      .filter((stat) => stat.country !== null)
      .map((stat) => ({
        country: stat.country as string,
        count: stat._count.country,
      }));

    return {
      total: totalManufacturers,
      active: activeManufacturers,
      inactive: inactiveManufacturers,
      suspended: suspendedManufacturers,
      totalProducts,
      totalOrders,
      createdThisMonth,
      topCountries,
    };
  }

  /**
   * Get manufacturer products with pagination
   */
  async getManufacturerProducts(
    manufacturerId: string,
    paginationDto: PaginationDto,
  ): Promise<PaginatedResponse<any>> {
    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;

    // Check if manufacturer exists
    const manufacturer = await this.prisma.manufacturer.findUnique({
      where: { id: manufacturerId },
    });

    if (!manufacturer) {
      throw new NotFoundException('Manufacturer not found');
    }

    const [products, totalCount] = await Promise.all([
      this.prisma.product.findMany({
        where: { manufacturerId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          brand: true,
        },
      }),
      this.prisma.product.count({ where: { manufacturerId } }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return {
      data: products,
      meta: {
        page,
        limit,
        totalItems: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNextPage: page < Math.ceil(totalCount / limit),
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * Get manufacturer orders with pagination
   */
  async getManufacturerOrders(
    manufacturerId: string,
    paginationDto: PaginationDto,
  ): Promise<PaginatedResponse<any>> {
    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;

    // Check if manufacturer exists
    const manufacturer = await this.prisma.manufacturer.findUnique({
      where: { id: manufacturerId },
    });

    if (!manufacturer) {
      throw new NotFoundException('Manufacturer not found');
    }

    const [orders, totalCount] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          items: {
            some: {
              product: {
                manufacturerId,
              },
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: true,
          items: {
            include: {
              product: true,
            },
          },
        },
      }),
      this.prisma.order.count({
        where: {
          items: {
            some: {
              product: {
                manufacturerId,
              },
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return {
      data: orders,
      meta: {
        page,
        limit,
        totalItems: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNextPage: page < Math.ceil(totalCount / limit),
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * Transform Prisma manufacturer to response DTO
   */
  private transformToResponseDto(manufacturer: any): ManufacturerResponseDto {
    return {
      id: manufacturer.id,
      name: manufacturer.name,
      description: manufacturer.description,
      email: manufacturer.email,
      phone: manufacturer.phone,
      website: manufacturer.website,
      address: manufacturer.address,
      city: manufacturer.city,
      state: manufacturer.state,
      country: manufacturer.country,
      registrationNumber: manufacturer.registrationNumber,
      status: manufacturer.status,
      createdAt: manufacturer.createdAt,
      updatedAt: manufacturer.updatedAt,
      deletedAt: manufacturer.deletedAt,
      createdBy: manufacturer.createdByUser
        ? {
            id: manufacturer.createdByUser.id,
            email: manufacturer.createdByUser.email,
            name: `${manufacturer.createdByUser.firstName || ''} ${manufacturer.createdByUser.lastName || ''}`.trim(),
          }
        : undefined,
      updatedBy: manufacturer.updatedByUser
        ? {
            id: manufacturer.updatedByUser.id,
            email: manufacturer.updatedByUser.email,
            name: `${manufacturer.updatedByUser.firstName || ''} ${manufacturer.updatedByUser.lastName || ''}`.trim(),
          }
        : undefined,
      deletedBy: manufacturer.deletedByUser
        ? {
            id: manufacturer.deletedByUser.id,
            email: manufacturer.deletedByUser.email,
            name: `${manufacturer.deletedByUser.firstName || ''} ${manufacturer.deletedByUser.lastName || ''}`.trim(),
          }
        : undefined,
      productsCount: manufacturer._count?.products || 0,
      ordersCount: manufacturer._count?.orders || 0,
      brands:
        manufacturer.brands?.map((brand: any) => ({
          id: brand.id,
          name: brand.name,
          description: brand.description,
          logo: brand.logo,
          isActive: brand.status === 'ACTIVE',
        })) || [],
      products: manufacturer.products || [],
    };
  }

  async getDeletedManufacturers(
    paginationDto: PaginationDto,
    filters?: {
      search?: string;
      country?: string;
      state?: string;
    },
  ): Promise<
    PaginatedResponse<
      ManufacturerResponseDto & {
        deletedBy: { id: string; email: string; name: string };
      }
    >
  > {
    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: { not: null }, // Only get deleted manufacturers
    };

    // Apply filters
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters?.country) {
      where.country = filters.country;
    }

    if (filters?.state) {
      where.state = filters.state;
    }

    const [manufacturers, total] = await Promise.all([
      this.prisma.manufacturer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { deletedAt: 'desc' },
        include: {
          createdByUser: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
          updatedByUser: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
          deletedByUser: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
          _count: {
            select: {
              brands: true,
              products: true,
            },
          },
        },
      }),
      this.prisma.manufacturer.count({ where }),
    ]);

    const manufacturersWithDeletedInfo = manufacturers.map((manufacturer) => ({
      ...this.transformToResponseDto(manufacturer),
      deletedBy: {
        id: manufacturer.deletedByUser!.id,
        email: manufacturer.deletedByUser!.email,
        name: `${
          manufacturer.deletedByUser!.firstName || ''
        } ${manufacturer.deletedByUser!.lastName || ''}`.trim(),
      },
    }));

    return {
      data: manufacturersWithDeletedInfo as any,
      meta: {
        page,
        limit,
        totalItems: total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPreviousPage: page > 1,
      },
    };
  }
}
