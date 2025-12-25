import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryQueryDto } from './dto/category-query.dto';
import { CategoryResponseDto } from './dto/category-response.dto';
import { PaginatedResponse } from '../../common/dto/paginated-response.dto';
import { StringUtils } from '../../common/utils/string.utils';

@Injectable()
export class CategoryService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a new category
   */
  async create(
    createCategoryDto: CreateCategoryDto,
    userId: string,
  ): Promise<CategoryResponseDto> {
    const { name, parentId, description, sortOrder = 0 } = createCategoryDto;

    // Generate slug from name
    const slug = StringUtils.generateSlug(name);

    // Check if category with same name already exists at the same level
    await this.validateUniqueNameAtLevel(name, parentId || null);

    // If parentId provided, validate parent exists and is a major category
    if (parentId) {
      await this.validateParentCategory(parentId);
    }

    try {
      const category = await this.prisma.category.create({
        data: {
          name: StringUtils.toTitleCase(name),
          slug,
          description,
          parentId,
          sortOrder,
          createdBy: userId,
          updatedBy: userId,
        },
        include: {
          parent: true,
        },
      });

      return this.transformToResponseDto(category);
    } catch (error) {
      if (error.code === 'P2002') {
        if (error.meta?.target?.includes('slug')) {
          throw new ConflictException('Category with this slug already exists');
        }
      }
      throw error;
    }
  }

  /**
   * Get all categories with pagination and filters
   */
  async findAll(
    query: CategoryQueryDto,
  ): Promise<PaginatedResponse<CategoryResponseDto>> {
    const {
      page = 1,
      limit = 10,
      search,
      parentId,
      isActive,
      includeProductCount = false,
      includeChildren = false,
    } = query;

    console.log(
      'includeChildren value:',
      includeChildren,
      'type:',
      typeof includeChildren,
    ); // Debug log

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        {
          name: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          description: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ];
    }

    if (parentId !== undefined) {
      where.parentId = parentId;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    // Build include clause
    const include: any = {
      parent: true,
    };

    console.log('About to check includeChildren:', includeChildren); // Debug log
    if (includeChildren) {
      console.log('Adding children to include clause'); // Debug log
      include.children = {
        where: { deletedAt: null },
        orderBy: { sortOrder: 'asc' },
      };
    }

    const [categories, totalItems] = await Promise.all([
      this.prisma.category.findMany({
        where,
        include,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.category.count({ where }),
    ]);

    const transformedCategories = categories.map((category) =>
      this.transformToResponseDto(category),
    );

    return new PaginatedResponse(
      transformedCategories,
      page,
      limit,
      totalItems,
    );
  }

  /**
   * Get category by ID
   */
  async findOne(
    id: string,
    includeChildren = false,
  ): Promise<CategoryResponseDto> {
    const include: any = {
      parent: true,
    };

    if (includeChildren) {
      include.children = {
        where: { deletedAt: null },
        orderBy: { sortOrder: 'asc' },
      };
    }

    const category = await this.prisma.category.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include,
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return this.transformToResponseDto(category);
  }

  /**
   * Get category tree (all major categories with their subcategories)
   */
  async getCategoryTree(): Promise<CategoryResponseDto[]> {
    const majorCategories = await this.prisma.category.findMany({
      where: {
        parentId: null,
        deletedAt: null,
        isActive: true,
      },
      include: {
        children: {
          where: {
            deletedAt: null,
            isActive: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    return majorCategories.map((category) =>
      this.transformToResponseDto(category),
    );
  }

  /**
   * Update category
   */
  async update(
    id: string,
    updateCategoryDto: UpdateCategoryDto,
    userId: string,
  ): Promise<CategoryResponseDto> {
    const { name, parentId, description, sortOrder, isActive } =
      updateCategoryDto;

    // Check if category exists
    const existingCategory = await this.findOne(id);

    // Generate new slug if name changed
    let slug: string | undefined;
    if (name && name !== existingCategory.name) {
      slug = StringUtils.generateSlug(name);
      await this.validateUniqueNameAtLevel(
        name,
        parentId ?? existingCategory.parentId,
        id,
      );
    }

    // If parentId is being changed, validate new parent
    if (parentId !== undefined && parentId !== existingCategory.parentId) {
      await this.validateParentCategory(parentId);

      // Prevent circular references
      if (parentId === id) {
        throw new BadRequestException('Category cannot be its own parent');
      }

      // Prevent making a category child of its own descendant
      await this.validateNoCircularReference(id, parentId);
    }

    try {
      const updatedCategory = await this.prisma.category.update({
        where: { id },
        data: {
          ...(name && { name: StringUtils.toTitleCase(name) }),
          ...(slug && { slug }),
          ...(description !== undefined && { description }),
          ...(parentId !== undefined && { parentId }),
          ...(sortOrder !== undefined && { sortOrder }),
          ...(isActive !== undefined && { isActive }),
          updatedBy: userId,
        },
        include: {
          parent: true,
        },
      });

      return this.transformToResponseDto(updatedCategory);
    } catch (error) {
      if (error.code === 'P2002') {
        if (error.meta?.target?.includes('slug')) {
          throw new ConflictException('Category with this slug already exists');
        }
      }
      throw error;
    }
  }

  /**
   * Soft delete category
   */
  async remove(id: string, userId: string): Promise<void> {
    const category = await this.findOne(id, true);

    // Check if category has active children
    if (category.children && category.children.length > 0) {
      throw new BadRequestException(
        'Cannot delete category with active subcategories. Please delete or move subcategories first.',
      );
    }

    // Check if category has products
    // TODO: Replace with actual product count when products relation is added
    const productCount = 0; // Temporary: category.productCount;
    if (productCount && productCount > 0) {
      throw new BadRequestException(
        'Cannot delete category with products. Please move or delete products first.',
      );
    }

    await this.prisma.category.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy: userId,
        isActive: false,
      },
    });
  }

  /**
   * Activate a category
   */
  async activate(id: string, userId: string): Promise<void> {
    const category = await this.prisma.category.findFirst({
      where: { id, deletedAt: null },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    if (category.isActive) {
      throw new ConflictException('Category is already active');
    }

    await this.prisma.category.update({
      where: { id },
      data: {
        isActive: true,
        updatedBy: userId,
      },
    });
  }

  /**
   * Deactivate a category
   */
  async deactivate(id: string, userId: string): Promise<void> {
    const category = await this.prisma.category.findFirst({
      where: { id, deletedAt: null },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    if (!category.isActive) {
      throw new ConflictException('Category is already inactive');
    }

    await this.prisma.category.update({
      where: { id },
      data: {
        isActive: false,
        updatedBy: userId,
      },
    });
  }

  /**
   * Bulk activate categories
   */
  async bulkActivate(
    categoryIds: string[],
    userId: string,
  ): Promise<{ updatedCount: number }> {
    const result = await this.prisma.category.updateMany({
      where: {
        id: { in: categoryIds },
        deletedAt: null,
      },
      data: {
        isActive: true,
        updatedBy: userId,
      },
    });

    return { updatedCount: result.count };
  }

  /**
   * Bulk deactivate categories
   */
  async bulkDeactivate(
    categoryIds: string[],
    userId: string,
  ): Promise<{ updatedCount: number }> {
    const result = await this.prisma.category.updateMany({
      where: {
        id: { in: categoryIds },
        deletedAt: null,
      },
      data: {
        isActive: false,
        updatedBy: userId,
      },
    });

    return { updatedCount: result.count };
  }

  /**
   * Private helper methods
   */
  private async validateUniqueNameAtLevel(
    name: string,
    parentId: string | null,
    excludeId?: string,
  ): Promise<void> {
    const normalizedName = StringUtils.toTitleCase(name);

    const where: any = {
      name: {
        equals: normalizedName,
        mode: 'insensitive',
      },
      parentId,
      deletedAt: null,
    };

    if (excludeId) {
      where.id = { not: excludeId };
    }

    const existingCategory = await this.prisma.category.findFirst({ where });

    if (existingCategory) {
      const level = parentId ? 'subcategory' : 'major category';
      throw new ConflictException(`A ${level} with this name already exists`);
    }
  }

  private async validateParentCategory(parentId: string): Promise<void> {
    const parentCategory = await this.prisma.category.findFirst({
      where: {
        id: parentId,
        deletedAt: null,
      },
    });

    if (!parentCategory) {
      throw new NotFoundException('Parent category not found');
    }

    // Ensure parent is a major category (no parent of its own)
    if (parentCategory.parentId) {
      throw new BadRequestException(
        'Parent must be a major category (cannot have subcategory as parent)',
      );
    }
  }

  private async validateNoCircularReference(
    categoryId: string,
    newParentId: string,
  ): Promise<void> {
    // Get all descendants of the category
    const descendants = await this.getDescendants(categoryId);
    const descendantIds = descendants.map((d) => d.id);

    if (descendantIds.includes(newParentId)) {
      throw new BadRequestException(
        'Cannot make category a child of its own descendant',
      );
    }
  }

  private async getDescendants(categoryId: string): Promise<any[]> {
    const children = await this.prisma.category.findMany({
      where: {
        parentId: categoryId,
        deletedAt: null,
      },
    });

    let allDescendants = [...children];

    for (const child of children) {
      const grandChildren = await this.getDescendants(child.id);
      allDescendants = allDescendants.concat(grandChildren);
    }

    return allDescendants;
  }

  private transformToResponseDto(category: any): CategoryResponseDto {
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      parentId: category.parentId,
      isActive: category.isActive,
      sortOrder: category.sortOrder,
      createdBy: category.createdBy,
      updatedBy: category.updatedBy,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
      productCount: 0, // TODO: Will be updated when products relation is added
      children: category.children?.map((child: any) =>
        this.transformToResponseDto(child),
      ),
      parent: category.parent
        ? {
            id: category.parent.id,
            name: category.parent.name,
            slug: category.parent.slug,
            description: category.parent.description,
            parentId: category.parent.parentId,
            isActive: category.parent.isActive,
            sortOrder: category.parent.sortOrder,
            createdBy: category.parent.createdBy,
            updatedBy: category.parent.updatedBy,
            createdAt: category.parent.createdAt,
            updatedAt: category.parent.updatedAt,
          }
        : undefined,
    };
  }
}
