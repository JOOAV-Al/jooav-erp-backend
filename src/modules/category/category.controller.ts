import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryQueryDto } from './dto/category-query.dto';
import { CategoryResponseDto } from './dto/category-response.dto';
import { CategoryStatsDto } from './dto/category-stats.dto';
import { BulkCategoryOperationDto } from './dto/bulk-category-operation.dto';
import { PaginatedResponse } from '../../common/dto/paginated-response.dto';
import { BaseResponse } from '../../common/dto/base-response.dto';
import { SuccessResponse } from '../../common/dto/api-response.dto';
import { ResponseMessages } from '../../common/utils/response-messages.util';
import { UnifiedAuthGuard } from '../../common/guards/unified-auth.guard';
import { CurrentUserId } from '../../common/decorators/current-user.decorator';
import { AuditLog } from '../../common/decorators/audit-log.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Cache } from '../../common/decorators/cache.decorator';
import { CacheInterceptor } from '../../common/interceptors/cache.interceptor';
import { UserRole } from '../../common/enums';

@ApiTags('Categories')
@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Post()
  @UseGuards(UnifiedAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiBearerAuth('admin-access-token')
  @ApiOperation({ summary: 'Create a new FMCG product category' })
  @ApiResponse({
    status: 201,
    description: 'Category created successfully',
    type: CategoryResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 409, description: 'Category name already exists' })
  @AuditLog({ action: 'CREATE', resource: 'CATEGORY' })
  async create(
    @Body() createCategoryDto: CreateCategoryDto,
    @CurrentUserId() userId: string,
  ): Promise<SuccessResponse<CategoryResponseDto>> {
    const category = await this.categoryService.create(
      createCategoryDto,
      userId,
    );
    return new SuccessResponse(
      ResponseMessages.created('Category', category.name),
      category,
    );
  }

  @Get()
  @UseInterceptors(CacheInterceptor)
  @Cache({
    key: 'categories',
    ttl: 900, // 15 minutes - categories don't change frequently
    includeParams: true,
  })
  @ApiOperation({
    summary: 'Get all FMCG categories (Accessible to everyone)',
  })
  @ApiResponse({
    status: 200,
    description: 'Categories retrieved successfully',
    type: PaginatedResponse<CategoryResponseDto>,
  })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search by category name (e.g., "Beverages", "Snacks")',
  })
  @ApiQuery({
    name: 'parentId',
    required: false,
    description:
      'Filter by parent category (e.g., get subcategories under "Food & Beverages")',
  })
  @ApiQuery({
    name: 'isActive',
    required: false,
    description: 'Filter by active status',
  })
  @ApiQuery({
    name: 'includeProductCount',
    required: false,
    description: 'Include FMCG product count per category',
  })
  @ApiQuery({
    name: 'includeChildren',
    required: false,
    description: 'Include subcategories (e.g., Soft Drinks under Beverages)',
  })
  async findAll(
    @Query() queryDto: CategoryQueryDto,
  ): Promise<SuccessResponse<PaginatedResponse<CategoryResponseDto>>> {
    const result = await this.categoryService.findAll(queryDto);
    return new SuccessResponse(
      ResponseMessages.foundItems(
        result.data.length,
        'category',
        result.meta.totalItems,
      ),
      result,
    );
  }

  @Get('tree')
  @UseInterceptors(CacheInterceptor)
  @Cache({
    key: 'categories_tree',
    ttl: 1800, // 30 minutes - tree structure changes even less frequently
  })
  @ApiOperation({
    summary:
      'Get FMCG category tree (major categories like Food & Beverages, Personal Care with their subcategories) - (Accessible to everyone)',
  })
  @ApiResponse({
    status: 200,
    description: 'FMCG category hierarchy retrieved successfully',
    type: [CategoryResponseDto],
  })
  async getTree(): Promise<SuccessResponse<CategoryResponseDto[]>> {
    const tree = await this.categoryService.getCategoryTree();
    return new SuccessResponse('Category tree retrieved successfully', tree);
  }

  @Get('stats')
  @UseGuards(UnifiedAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiBearerAuth('admin-access-token')
  @UseInterceptors(CacheInterceptor)
  @Cache({
    key: 'categories_stats',
    ttl: 600, // 10 minutes - stats can be cached for moderate time
  })
  @ApiOperation({
    summary: 'Get category statistics and analytics',
  })
  @ApiResponse({
    status: 200,
    description: 'Category statistics retrieved successfully',
    type: CategoryStatsDto,
  })
  async getStats(): Promise<SuccessResponse<CategoryStatsDto>> {
    const stats = await this.categoryService.getStats();
    return new SuccessResponse('Category statistics retrieved successfully', stats);
  }

  @Get('subcategories')
  @UseInterceptors(CacheInterceptor)
  @Cache({
    key: 'categories_subcategories',
    ttl: 900, // 15 minutes
    includeParams: true,
  })
  @ApiOperation({
    summary:
      'Get all subcategories (categories with parent) - (Accessible to everyone)',
  })
  @ApiResponse({
    status: 200,
    description: 'Subcategories retrieved successfully',
    type: PaginatedResponse<CategoryResponseDto>,
  })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search by subcategory name',
  })
  @ApiQuery({
    name: 'isActive',
    required: false,
    description: 'Filter by active status',
  })
  @ApiQuery({
    name: 'includeProductCount',
    required: false,
    description: 'Include product count per subcategory',
  })
  async getSubcategories(
    @Query() queryDto: CategoryQueryDto,
  ): Promise<SuccessResponse<PaginatedResponse<CategoryResponseDto>>> {
    const result = await this.categoryService.getSubcategories(queryDto);
    return new SuccessResponse(
      ResponseMessages.foundItems(
        result.data.length,
        'subcategory',
        result.meta.totalItems,
      ),
      result,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a category by ID (Accessible to everyone)' })
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiResponse({
    status: 200,
    description: 'Category retrieved successfully',
    type: CategoryResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Category not found' })
  @ApiQuery({
    name: 'includeChildren',
    required: false,
    description: 'Include subcategories',
  })
  async findOne(
    @Param('id') id: string,
    @Query('includeChildren') includeChildren?: boolean,
  ): Promise<SuccessResponse<CategoryResponseDto>> {
    const category = await this.categoryService.findOne(id, includeChildren);
    return new SuccessResponse(
      ResponseMessages.retrieved('Category', category.name),
      category,
    );
  }

  @Patch(':id')
  @UseGuards(UnifiedAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiBearerAuth('admin-access-token')
  @ApiOperation({ summary: 'Update a category' })
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiResponse({
    status: 200,
    description: 'Category updated successfully',
    type: CategoryResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Category not found' })
  @ApiResponse({ status: 409, description: 'Category name already exists' })
  @AuditLog({ action: 'UPDATE', resource: 'CATEGORY' })
  async update(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
    @CurrentUserId() userId: string,
  ): Promise<SuccessResponse<CategoryResponseDto>> {
    const category = await this.categoryService.update(
      id,
      updateCategoryDto,
      userId,
    );
    return new SuccessResponse(
      ResponseMessages.updated('Category', category.name),
      category,
    );
  }

  @Patch(':id/activate')
  @UseGuards(UnifiedAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiBearerAuth('admin-access-token')
  @ApiOperation({ summary: 'Activate a category' })
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiResponse({ status: 200, description: 'Category activated successfully' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  @AuditLog({ action: 'ACTIVATE', resource: 'CATEGORY' })
  async activate(
    @Param('id') id: string,
    @CurrentUserId() userId: string,
  ): Promise<SuccessResponse<CategoryResponseDto>> {
    const category = await this.categoryService.activate(id, userId);
    return new SuccessResponse(
      ResponseMessages.activated('Category', category.name),
      category,
    );
  }

  @Patch(':id/deactivate')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @UseGuards(UnifiedAuthGuard, RolesGuard)
  @ApiBearerAuth('admin-access-token')
  @ApiOperation({ summary: 'Deactivate a category' })
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiResponse({
    status: 200,
    description: 'Category deactivated successfully',
  })
  @ApiResponse({ status: 404, description: 'Category not found' })
  @AuditLog({ action: 'DEACTIVATE', resource: 'CATEGORY' })
  async deactivate(
    @Param('id') id: string,
    @CurrentUserId() userId: string,
  ): Promise<SuccessResponse<CategoryResponseDto>> {
    const category = await this.categoryService.deactivate(id, userId);
    return new SuccessResponse(
      ResponseMessages.deactivated('Category', category.name),
      category,
    );
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @UseGuards(UnifiedAuthGuard, RolesGuard)
  @ApiBearerAuth('admin-access-token')
  @ApiOperation({ summary: 'Delete a category (soft delete)' })
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiResponse({ status: 200, description: 'Category deleted successfully' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete category with subcategories',
  })
  @AuditLog({ action: 'DELETE', resource: 'CATEGORY' })
  async remove(
    @Param('id') id: string,
    @CurrentUserId() userId: string,
  ): Promise<SuccessResponse<null>> {
    const result = await this.categoryService.remove(id, userId);
    return new SuccessResponse(
      ResponseMessages.deleted('Category', result.categoryName),
      null,
    );
  }

  @Post('bulk-activate')
  @UseGuards(UnifiedAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiBearerAuth('admin-access-token')
  @ApiOperation({
    summary:
      'Bulk activate FMCG categories (e.g., activate seasonal categories)',
  })
  @ApiBody({ type: BulkCategoryOperationDto })
  @ApiResponse({
    status: 200,
    description: 'FMCG categories activated successfully',
    schema: {
      type: 'object',
      properties: {
        updatedCount: { type: 'number', example: 3 },
      },
    },
  })
  @AuditLog({ action: 'BULK_ACTIVATE', resource: 'CATEGORY' })
  async bulkActivate(
    @Body() bulkOperationDto: BulkCategoryOperationDto,
    @CurrentUserId() userId: string,
  ): Promise<SuccessResponse<{ updatedCount: number }>> {
    const result = await this.categoryService.bulkActivate(
      bulkOperationDto.categoryIds,
      userId,
    );
    return new SuccessResponse(
      ResponseMessages.bulkOperation(
        'activated',
        result.updatedCount,
        'category',
        'categories',
      ),
      result,
    );
  }

  @Post('bulk-deactivate')
  @UseGuards(UnifiedAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiBearerAuth('admin-access-token')
  @ApiOperation({
    summary:
      'Bulk deactivate FMCG categories (e.g., disable discontinued product categories)',
  })
  @ApiBody({ type: BulkCategoryOperationDto })
  @ApiResponse({
    status: 200,
    description: 'FMCG categories deactivated successfully',
    schema: {
      type: 'object',
      properties: {
        updatedCount: { type: 'number', example: 3 },
      },
    },
  })
  @AuditLog({ action: 'BULK_DEACTIVATE', resource: 'CATEGORY' })
  async bulkDeactivate(
    @Body() bulkOperationDto: BulkCategoryOperationDto,
    @CurrentUserId() userId: string,
  ): Promise<SuccessResponse<{ updatedCount: number }>> {
    const result = await this.categoryService.bulkDeactivate(
      bulkOperationDto.categoryIds,
      userId,
    );
    return new SuccessResponse(
      ResponseMessages.bulkOperation(
        'deactivated',
        result.updatedCount,
        'category',
        'categories',
      ),
      result,
    );
  }
}
