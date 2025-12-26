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
import { BulkCategoryOperationDto } from './dto/bulk-category-operation.dto';
import { PaginatedResponse } from '../../common/dto/paginated-response.dto';
import { BaseResponse } from '../../common/dto/base-response.dto';
import { UnifiedAuthGuard } from '../../common/guards/unified-auth.guard';
import { CurrentUserId } from '../../common/decorators/current-user.decorator';
import { AuditLog } from '../../common/decorators/audit-log.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';

@ApiTags('Categories')
@Controller('categories')
@UseGuards(UnifiedAuthGuard, RolesGuard)
@ApiBearerAuth('access-token')
@ApiBearerAuth('admin-access-token')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Post()
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
  ): Promise<CategoryResponseDto> {
    return this.categoryService.create(createCategoryDto, userId);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all FMCG categories with pagination and filters',
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
    @Query() query: CategoryQueryDto,
  ): Promise<PaginatedResponse<CategoryResponseDto>> {
    return this.categoryService.findAll(query);
  }

  @Get('tree')
  @ApiOperation({
    summary:
      'Get FMCG category tree (major categories like Food & Beverages, Personal Care with their subcategories)',
  })
  @ApiResponse({
    status: 200,
    description: 'FMCG category hierarchy retrieved successfully',
    type: [CategoryResponseDto],
  })
  async getTree(): Promise<CategoryResponseDto[]> {
    return this.categoryService.getCategoryTree();
  }

  @Get('subcategories')
  @ApiOperation({
    summary: 'Get all subcategories (categories with parent) with pagination',
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
    @Query() query: CategoryQueryDto,
  ): Promise<PaginatedResponse<CategoryResponseDto>> {
    return this.categoryService.getSubcategories(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a category by ID' })
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
  ): Promise<CategoryResponseDto> {
    return this.categoryService.findOne(id, includeChildren);
  }

  @Patch(':id')
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
  ): Promise<CategoryResponseDto> {
    return this.categoryService.update(id, updateCategoryDto, userId);
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: 'Activate a category' })
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiResponse({ status: 200, description: 'Category activated successfully' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  @AuditLog({ action: 'ACTIVATE', resource: 'CATEGORY' })
  async activate(
    @Param('id') id: string,
    @CurrentUserId() userId: string,
  ): Promise<void> {
    await this.categoryService.activate(id, userId);
  }

  @Patch(':id/deactivate')
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
  ): Promise<void> {
    await this.categoryService.deactivate(id, userId);
  }

  @Delete(':id')
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
  ): Promise<void> {
    await this.categoryService.remove(id, userId);
  }

  @Post('bulk-activate')
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
  ): Promise<{ updatedCount: number }> {
    return this.categoryService.bulkActivate(
      bulkOperationDto.categoryIds,
      userId,
    );
  }

  @Post('bulk-deactivate')
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
  ): Promise<{ updatedCount: number }> {
    return this.categoryService.bulkDeactivate(
      bulkOperationDto.categoryIds,
      userId,
    );
  }
}
