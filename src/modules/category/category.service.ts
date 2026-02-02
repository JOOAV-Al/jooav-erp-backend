import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { CategoryStatus, SubcategoryStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CacheInvalidationService } from '../cache/cache-invalidation.service';
import { StringUtils } from '../../common/utils/helpers.utils';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  CategoryQueryDto,
  CategoryResponseDto,
  CategoryStatsDto,
} from './dto';
import {
  PaginatedResponse,
  PaginationMeta,
} from '../../common/dto/paginated-response.dto';

@Injectable()
export class CategoryService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private cacheInvalidationService: CacheInvalidationService,
  ) {}

  /**
   * Generates URL-friendly slug from category name
   */
  private generateSlug(name: string): string {
    return StringUtils.slugify(name.trim());
  }

  /**
   * Sanitizes category name for storage
   */
  private sanitizeCategoryName(name: string): string {
    return StringUtils.titleCase(name.trim());
  }

  async create(
    createCategoryDto: CreateCategoryDto,
    userId: string,
  ): Promise<CategoryResponseDto> {
    const { name, description, subcategories = [] } = createCategoryDto;

    // Sanitize and validate
    const sanitizedName = this.sanitizeCategoryName(name);
    const slug = this.generateSlug(sanitizedName);

    // Check for name conflicts with existing active categories
    const existingCategory = await this.prisma.category.findFirst({
      where: {
        OR: [
          { name: { equals: sanitizedName, mode: 'insensitive' } },
          { slug },
        ],
        deletedAt: null,
      },
    });

    if (existingCategory) {
      throw new ConflictException(
        `Category with name \"${sanitizedName}\" already exists`,
      );
    }

    // Validate subcategory names for duplicates within the input
    if (subcategories.length > 0) {
      const subcategoryNames = subcategories.map((sub) =>
        sub.name.trim().toLowerCase(),
      );
      const duplicateNames = subcategoryNames.filter(
        (name, index) => subcategoryNames.indexOf(name) !== index,
      );

      if (duplicateNames.length > 0) {
        throw new BadRequestException(
          `Duplicate subcategory names found: ${duplicateNames.join(', ')}`,
        );
      }

      // Check for conflicts with existing subcategories
      const existingSubcategories = await this.prisma.subcategory.findMany({
        where: {
          name: {
            in: subcategoryNames,
            mode: 'insensitive',
          },
          deletedAt: null,
        },
        select: { name: true },
      });

      if (existingSubcategories.length > 0) {
        throw new ConflictException(
          `Subcategory names already exist: ${existingSubcategories.map((s) => s.name).join(', ')}`,
        );
      }
    }

    // Use transaction to create category and subcategories atomically
    const result = await this.prisma.$transaction(async (tx) => {
      // Create the category first
      const category = await tx.category.create({
        data: {
          name: sanitizedName,
          slug,
          description: description?.trim(),
          createdBy: userId,
          updatedBy: userId,
        },
      });

      // Create subcategories if provided
      const createdSubcategories: any[] = [];
      if (subcategories.length > 0) {
        for (const subcat of subcategories) {
          const subcategorySlug = StringUtils.slugify(subcat.name);
          const createdSubcategory = await tx.subcategory.create({
            data: {
              name: StringUtils.titleCase(subcat.name.trim()),
              slug: subcategorySlug,
              description: subcat.description?.trim(),
              categoryId: category.id,
              createdBy: userId,
              updatedBy: userId,
            },
            include: {
              _count: {
                select: { products: { where: { deletedAt: null } } },
              },
            },
          });
          createdSubcategories.push(createdSubcategory);
        }
      }

      // Return the category with its subcategories
      return {
        ...category,
        subcategories: createdSubcategories,
        _count: { subcategories: createdSubcategories.length },
      };
    });

    // Log audit trail for category creation
    await this.auditService.createAuditLog({
      action: 'CREATE',
      resource: 'Category',
      resourceId: result.id,
      userId,
      metadata: {
        categoryName: result.name,
        subcategoriesCreated: subcategories.length,
        subcategoryNames: subcategories.map((sub) => sub.name),
      },
    });

    // Invalidate category cache
    await this.cacheInvalidationService.invalidateCategory(result.id);

    return {
      id: result.id,
      name: result.name,
      description: result.description,
      slug: result.slug,
      status: result.status,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
      createdBy: result.createdBy,
      updatedBy: result.updatedBy,
      subcategories: result.subcategories.map((sub) => ({
        id: sub.id,
        name: sub.name,
        slug: sub.slug,
        description: sub.description,
        productCount: sub._count.products,
        createdAt: sub.createdAt,
        updatedAt: sub.updatedAt,
      })),
      subcategoryCount: result._count.subcategories,
      totalProductCount: result.subcategories.reduce(
        (total, sub) => total + sub._count.products,
        0,
      ),
    };
  }

  async findAll(
    query: CategoryQueryDto,
  ): Promise<PaginatedResponse<CategoryResponseDto>> {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      includeSubcategories = true,
    } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.CategoryWhereInput = {
      deletedAt: null,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(status && { status }),
    };

    const orderBy: Prisma.CategoryOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    // Build dynamic include object
    const include: Prisma.CategoryInclude = {
      _count: {
        select: { subcategories: { where: { deletedAt: null } } },
      },
    };

    if (includeSubcategories) {
      include.subcategories = {
        where: { deletedAt: null }, // Ensure we don't include deleted subcategories
        include: {
          _count: {
            select: { products: { where: { deletedAt: null } } },
          },
        },
      };
    }

    const [categories, total] = await Promise.all([
      this.prisma.category.findMany({
        where,
        include,
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.category.count({ where }),
    ]);

    const data = categories.map((category) => ({
      id: category.id,
      name: category.name,
      description: category.description,
      slug: category.slug,
      status: category.status,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
      createdBy: category.createdBy,
      updatedBy: category.updatedBy,
      ...(includeSubcategories && {
        subcategories: (category.subcategories || []).map((sub: any) => ({
          id: sub.id,
          name: sub.name,
          slug: sub.slug,
          description: sub.description,
          productCount: sub._count.products,
          createdAt: sub.createdAt,
          updatedAt: sub.updatedAt,
        })),
      }),
      subcategoryCount: category._count.subcategories,
      ...(includeSubcategories && {
        totalProductCount: (category.subcategories || []).reduce(
          (total, sub: any) => total + sub._count.products,
          0,
        ),
      }),
    }));

    return {
      data,
      meta: new PaginationMeta(page, limit, total),
    };
  }

  async findOne(id: string): Promise<CategoryResponseDto> {
    const category = await this.prisma.category.findFirst({
      where: { id, deletedAt: null },
      include: {
        subcategories: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            createdAt: true,
            updatedAt: true,
            _count: {
              select: { products: { where: { deletedAt: null } } },
            },
          },
        },
        _count: {
          select: { subcategories: { where: { deletedAt: null } } },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    return {
      id: category.id,
      name: category.name,
      description: category.description,
      slug: category.slug,
      status: category.status,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
      createdBy: category.createdBy,
      updatedBy: category.updatedBy,
      subcategories: category.subcategories.map((sub) => ({
        id: sub.id,
        name: sub.name,
        slug: sub.slug,
        description: sub.description,
        productCount: sub._count.products,
        createdAt: sub.createdAt,
        updatedAt: sub.updatedAt,
      })),
      subcategoryCount: category._count.subcategories,
      totalProductCount: category.subcategories.reduce(
        (total, sub) => total + sub._count.products,
        0,
      ),
    };
  }

  async update(
    id: string,
    updateCategoryDto: UpdateCategoryDto,
    userId: string,
  ): Promise<CategoryResponseDto> {
    const { name, description, status } = updateCategoryDto;

    // Check if category exists
    const existingCategory = await this.findOne(id);

    // Prepare update data
    const updateData: any = {
      updatedBy: userId,
    };

    // Handle name update
    if (name && name !== existingCategory.name) {
      const sanitizedName = this.sanitizeCategoryName(name);
      const slug = this.generateSlug(sanitizedName);

      // Check for conflicts
      const conflictCategory = await this.prisma.category.findFirst({
        where: {
          OR: [
            { name: { equals: sanitizedName, mode: 'insensitive' } },
            { slug },
          ],
          deletedAt: null,
          NOT: { id },
        },
      });

      if (conflictCategory) {
        throw new ConflictException(
          `Category with name "${sanitizedName}" already exists`,
        );
      }

      updateData.name = sanitizedName;
      updateData.slug = slug;
    }

    if (description !== undefined) {
      updateData.description = description?.trim() || null;
    }

    if (status !== undefined) {
      updateData.status = status;
    }

    const updatedCategory = await this.prisma.category.update({
      where: { id },
      data: updateData,
      include: {
        subcategories: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            createdAt: true,
            updatedAt: true,
            _count: {
              select: { products: { where: { deletedAt: null } } },
            },
          },
        },
        _count: {
          select: { subcategories: { where: { deletedAt: null } } },
        },
      },
    });

    // Invalidate category cache
    await this.cacheInvalidationService.invalidateCategory(id);

    return {
      id: updatedCategory.id,
      name: updatedCategory.name,
      description: updatedCategory.description,
      slug: updatedCategory.slug,
      status: updatedCategory.status,
      createdAt: updatedCategory.createdAt,
      updatedAt: updatedCategory.updatedAt,
      createdBy: updatedCategory.createdBy,
      updatedBy: updatedCategory.updatedBy,
      subcategories: updatedCategory.subcategories.map((sub) => ({
        id: sub.id,
        name: sub.name,
        slug: sub.slug,
        description: sub.description,
        productCount: sub._count.products,
        createdAt: sub.createdAt,
        updatedAt: sub.updatedAt,
      })),
      subcategoryCount: updatedCategory._count.subcategories,
      totalProductCount: updatedCategory.subcategories.reduce(
        (total, sub) => total + sub._count.products,
        0,
      ),
    };
  }

  async remove(id: string, userId: string): Promise<{ message: string }> {
    // Check if category exists (using findFirst to get basic validation)
    const category = await this.prisma.category.findFirst({
      where: { id, deletedAt: null },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // Check for active subcategories (including both active and inactive, but not deleted)
    const activeSubcategoriesCount = await this.prisma.subcategory.count({
      where: {
        categoryId: id,
        deletedAt: null, // Only count non-deleted subcategories
      },
    });

    if (activeSubcategoriesCount > 0) {
      throw new BadRequestException(
        `Cannot delete category '${category.name}' because it has ${activeSubcategoriesCount} subcategory(ies). Please delete all subcategories first.`,
      );
    }

    // Check for products in subcategories of this category
    // Check for products in subcategories of this category
    const subcategoryProductsCount = await this.prisma.product.count({
      where: {
        subcategoryId: {
          in: await this.prisma.subcategory
            .findMany({
              where: {
                categoryId: id,
                deletedAt: null,
              },
              select: { id: true },
            })
            .then((subs) => subs.map((sub) => sub.id)),
        },
        deletedAt: null,
      },
    });

    if (subcategoryProductsCount > 0) {
      throw new BadRequestException(
        `Cannot delete category '${category.name}' because it has ${subcategoryProductsCount} product(s) in its subcategories. Please move or delete all products first.`,
      );
    }

    // Soft delete the category with status update
    await this.prisma.category.update({
      where: { id },
      data: {
        status: CategoryStatus.INACTIVE,
        deletedAt: new Date(),
        deletedBy: userId,
      },
    });

    // Log audit trail
    await this.auditService.createAuditLog({
      action: 'DELETE',
      resource: 'Category',
      resourceId: id,
      userId,
      metadata: {
        categoryName: category.name,
        subcategoryCount: activeSubcategoriesCount,
        subcategoryProductCount: subcategoryProductsCount,
      },
    });

    // Invalidate category cache
    await this.cacheInvalidationService.invalidateCategory(id);

    return { message: 'Category deleted successfully' };
  }

  /**
   * Cascade delete category with all its subcategories (only if no products exist)
   */
  async removeCascade(
    id: string,
    userId: string,
  ): Promise<{ message: string; deletedSubcategories: number }> {
    // Check if category exists
    const category = await this.prisma.category.findFirst({
      where: { id, deletedAt: null },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // Get all subcategories
    const subcategories = await this.prisma.subcategory.findMany({
      where: {
        categoryId: id,
        deletedAt: null,
      },
      select: { id: true, name: true },
    });

    // Check for products in any subcategory
    const subcategoryProductsCount = await this.prisma.product.count({
      where: {
        subcategoryId: {
          in: subcategories.map((sub) => sub.id),
        },
        deletedAt: null,
      },
    });

    if (subcategoryProductsCount > 0) {
      throw new BadRequestException(
        `Cannot delete category with ${subcategoryProductsCount} product(s) in subcategories. Please move or delete products first.`,
      );
    }

    // Use transaction to delete category and all subcategories
    await this.prisma.$transaction(async (tx) => {
      // Delete all subcategories first
      if (subcategories.length > 0) {
        await tx.subcategory.updateMany({
          where: {
            categoryId: id,
            deletedAt: null,
          },
          data: {
            status: SubcategoryStatus.INACTIVE,
            deletedAt: new Date(),
            deletedBy: userId,
          },
        });
      }

      // Delete the category
      await tx.category.update({
        where: { id },
        data: {
          status: CategoryStatus.INACTIVE,
          deletedAt: new Date(),
          deletedBy: userId,
        },
      });
    });

    // Log audit trail
    await this.auditService.createAuditLog({
      action: 'CASCADE_DELETE',
      resource: 'Category',
      resourceId: id,
      userId,
      metadata: {
        categoryName: category.name,
        deletedSubcategories: subcategories.length,
        subcategoryNames: subcategories.map((sub) => sub.name),
      },
    });

    // Invalidate category cache
    await this.cacheInvalidationService.invalidateCategory(id);

    return {
      message: 'Category and all subcategories deleted successfully',
      deletedSubcategories: subcategories.length,
    };
  }

  async activate(id: string, userId: string): Promise<CategoryResponseDto> {
    // Check if category exists in deleted state
    const deletedCategory = await this.prisma.category.findFirst({
      where: { id, deletedAt: { not: null } },
    });

    if (!deletedCategory) {
      throw new NotFoundException(
        'Category not found or is not in deleted state',
      );
    }

    // Check for name conflicts with active categories
    const conflictCategory = await this.prisma.category.findFirst({
      where: {
        OR: [
          { name: { equals: deletedCategory.name, mode: 'insensitive' } },
          { slug: deletedCategory.slug },
        ],
        deletedAt: null,
        NOT: { id },
      },
    });

    if (conflictCategory) {
      throw new ConflictException(
        `A category with name \"${deletedCategory.name}\" already exists`,
      );
    }

    // Reactivate the category
    const reactivatedCategory = await this.prisma.category.update({
      where: { id },
      data: {
        deletedAt: null,
        status: CategoryStatus.ACTIVE,
        updatedBy: userId,
      },
      include: {
        subcategories: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            createdAt: true,
            updatedAt: true,
            _count: {
              select: { products: { where: { deletedAt: null } } },
            },
          },
        },
        _count: {
          select: { subcategories: { where: { deletedAt: null } } },
        },
      },
    });

    // Invalidate category cache
    await this.cacheInvalidationService.invalidateCategory(id);

    // Log audit trail
    await this.auditService.createAuditLog({
      action: 'ACTIVATE',
      resource: 'Category',
      resourceId: id,
      userId,
      metadata: {
        categoryName: reactivatedCategory.name,
        subcategoryCount: reactivatedCategory._count.subcategories,
      },
    });

    return {
      id: reactivatedCategory.id,
      name: reactivatedCategory.name,
      description: reactivatedCategory.description,
      slug: reactivatedCategory.slug,
      status: reactivatedCategory.status,
      createdAt: reactivatedCategory.createdAt,
      updatedAt: reactivatedCategory.updatedAt,
      createdBy: reactivatedCategory.createdBy,
      updatedBy: reactivatedCategory.updatedBy,
      subcategories: reactivatedCategory.subcategories.map((sub) => ({
        id: sub.id,
        name: sub.name,
        slug: sub.slug,
        description: sub.description,
        productCount: sub._count.products,
        createdAt: sub.createdAt,
        updatedAt: sub.updatedAt,
      })),
      subcategoryCount: reactivatedCategory._count.subcategories,
      totalProductCount: reactivatedCategory.subcategories.reduce(
        (total, sub) => total + sub._count.products,
        0,
      ),
    };
  }

  async getStats(): Promise<CategoryStatsDto> {
    const [
      totalCategories,
      activeCategories,
      inactiveCategories,
      totalSubcategories,
      categoriesWithSubcategoryCounts,
      categoriesWithProductCounts,
    ] = await Promise.all([
      this.prisma.category.count({ where: { deletedAt: null } }),
      this.prisma.category.count({
        where: { deletedAt: null, status: CategoryStatus.ACTIVE },
      }),
      this.prisma.category.count({
        where: { deletedAt: null, status: CategoryStatus.INACTIVE },
      }),
      this.prisma.subcategory.count({ where: { deletedAt: null } }),
      this.prisma.category.findMany({
        where: { deletedAt: null },
        select: {
          name: true,
          _count: {
            select: { subcategories: { where: { deletedAt: null } } },
          },
        },
        orderBy: {
          subcategories: {
            _count: 'desc',
          },
        },
        take: 5,
      }),
      this.prisma.category.findMany({
        where: { deletedAt: null },
        select: {
          name: true,
          subcategories: {
            where: { deletedAt: null },
            select: {
              _count: {
                select: { products: { where: { deletedAt: null } } },
              },
            },
          },
        },
        take: 10,
      }),
    ]);

    // Calculate product counts per category
    const categoriesWithProducts = categoriesWithProductCounts
      .map((category) => ({
        name: category.name,
        productCount: category.subcategories.reduce(
          (total, sub) => total + sub._count.products,
          0,
        ),
      }))
      .sort((a, b) => b.productCount - a.productCount)
      .slice(0, 5);

    return {
      totalCategories,
      activeCategories,
      inactiveCategories,
      totalSubcategories,
      topCategoriesBySubcategories: categoriesWithSubcategoryCounts.map(
        (cat) => ({
          name: cat.name,
          subcategoryCount: cat._count.subcategories,
        }),
      ),
      topCategoriesByProducts: categoriesWithProducts,
    };
  }
}
