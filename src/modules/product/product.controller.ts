import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ProductService } from './product.service';
import {
  CreateProductDto,
  UpdateProductDto,
  ProductQueryDto,
  ProductResponseDto,
} from './dto';
import { PaginatedResponse } from '../../common/dto/paginated-response.dto';
import { CurrentUserId } from '../../common/decorators/current-user.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditLog } from '../../common/decorators/audit-log.decorator';
import { UserRole } from '../../common/enums/';
import { UnifiedAuthGuard } from '../../common/guards/unified-auth.guard';

@ApiTags('Products')
@Controller('api/v1/products')
@UseGuards(UnifiedAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
@ApiBearerAuth('access-token')
@ApiBearerAuth('admin-access-token')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new product',
    description: 'Create a new FMCG product with auto-generated SKU and name',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Product created successfully',
    type: ProductResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid input data or reference not found',
  })
  @ApiConflictResponse({
    description: 'Product with this SKU already exists',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Admin access required' })
  @AuditLog({ action: 'CREATE', resource: 'product' })
  async create(
    @Body() createProductDto: CreateProductDto,
    @CurrentUserId() userId: string,
  ): Promise<ProductResponseDto> {
    return await this.productService.create(createProductDto, userId);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all products',
    description:
      'Retrieve paginated list of products with filtering and search',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Products retrieved successfully',
    type: PaginatedResponse,
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiQuery({ name: 'search', required: false, example: 'Indomie' })
  @ApiQuery({ name: 'brandId', required: false })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'variant', required: false, example: 'Chicken' })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'includeRelations', required: false, type: Boolean })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Admin access required' })
  async findAll(
    @Query() query: ProductQueryDto,
  ): Promise<PaginatedResponse<ProductResponseDto>> {
    return await this.productService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get product by ID',
    description: 'Retrieve a specific product with all related information',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Product retrieved successfully',
    type: ProductResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Product not found' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Admin access required' })
  async findOne(@Param('id') id: string): Promise<ProductResponseDto> {
    return await this.productService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update product',
    description:
      'Update product information. SKU and name are auto-regenerated if identifier fields change.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Product updated successfully',
    type: ProductResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid input data or reference not found',
  })
  @ApiNotFoundResponse({ description: 'Product not found' })
  @ApiConflictResponse({
    description: 'Product with this SKU already exists',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Admin access required' })
  @AuditLog({ action: 'UPDATE', resource: 'product' })
  async update(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
    @CurrentUserId() userId: string,
  ): Promise<ProductResponseDto> {
    return await this.productService.update(id, updateProductDto, userId);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete product',
    description:
      'Soft delete a product (sets deletedAt timestamp and deactivates)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Product deleted successfully',
  })
  @ApiNotFoundResponse({ description: 'Product not found' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Admin access required' })
  @AuditLog({ action: 'DELETE', resource: 'product' })
  async remove(
    @Param('id') id: string,
    @CurrentUserId() userId: string,
  ): Promise<void> {
    await this.productService.remove(id, userId);
  }

  @Post(':id/activate')
  @ApiOperation({
    summary: 'Activate product',
    description: 'Activate a deactivated product',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Product activated successfully',
    type: ProductResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Product not found' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Admin access required' })
  @AuditLog({ action: 'ACTIVATE', resource: 'product' })
  async activate(
    @Param('id') id: string,
    @CurrentUserId() userId: string,
  ): Promise<ProductResponseDto> {
    return await this.productService.activate(id, userId);
  }

  @Post(':id/deactivate')
  @ApiOperation({
    summary: 'Deactivate product',
    description: 'Deactivate an active product',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Product deactivated successfully',
    type: ProductResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Product not found' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Admin access required' })
  @AuditLog({ action: 'DEACTIVATE', resource: 'product' })
  async deactivate(
    @Param('id') id: string,
    @CurrentUserId() userId: string,
  ): Promise<ProductResponseDto> {
    return await this.productService.deactivate(id, userId);
  }
}
