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
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { UserRole, ManufacturerStatus } from '@prisma/client';

import { ManufacturerService } from './manufacturer.service';
import { UnifiedAuthGuard } from '../../common/guards/unified-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser,
  CurrentUserId,
} from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PaginatedResponse } from '../../common/dto/paginated-response.dto';
import {
  CreateManufacturerDto,
  UpdateManufacturerDto,
  UpdateManufacturerStatusDto,
  ManufacturerQueryDto,
} from './dto/manufacturer.dto';
import {
  ManufacturerResponseDto,
  ManufacturerStatsDto,
} from './dto/manufacturer-response.dto';

@ApiTags('Manufacturers')
@Controller('manufacturers')
@UseGuards(UnifiedAuthGuard, RolesGuard)
@ApiBearerAuth('admin-access-token')
export class ManufacturerController {
  constructor(private readonly manufacturerService: ManufacturerService) {}

  // ================================
  // MANUFACTURER CRUD OPERATIONS (ADMIN ONLY)
  // ================================

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new manufacturer (Admin only)',
    description:
      'Create a new manufacturer with business details and contact information',
  })
  @ApiBody({ type: CreateManufacturerDto })
  @ApiResponse({
    status: 201,
    description: 'Manufacturer successfully created',
    type: ManufacturerResponseDto,
  })
  @ApiResponse({
    status: 409,
    description:
      'Manufacturer with this name or registration number already exists',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async create(
    @Body() createManufacturerDto: CreateManufacturerDto,
    @CurrentUserId() adminId: string,
    @Request() req: any,
  ): Promise<ManufacturerResponseDto> {
    return this.manufacturerService.create(createManufacturerDto, adminId, req);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get all manufacturers with pagination and filters (Admin only)',
    description:
      'Retrieve a paginated list of manufacturers with optional filtering',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 10, max: 100)',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search in name, email, or description',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ManufacturerStatus,
    description: 'Filter by status',
  })
  @ApiQuery({
    name: 'country',
    required: false,
    type: String,
    description: 'Filter by country',
  })
  @ApiQuery({
    name: 'state',
    required: false,
    type: String,
    description: 'Filter by state',
  })
  @ApiQuery({
    name: 'includeBrands',
    required: false,
    type: Boolean,
    description: 'Include brands in response',
  })
  @ApiQuery({
    name: 'includeProducts',
    required: false,
    type: Boolean,
    description: 'Include products in response',
  })
  @ApiQuery({
    name: 'includeAuditInfo',
    required: false,
    type: Boolean,
    description: 'Include audit information (createdBy, updatedBy, etc.)',
  })
  @ApiResponse({
    status: 200,
    description: 'List of manufacturers retrieved successfully',
    type: PaginatedResponse<ManufacturerResponseDto>,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async findAll(
    @Query() queryDto: ManufacturerQueryDto,
  ): Promise<PaginatedResponse<ManufacturerResponseDto>> {
    // Create proper pagination DTO
    const paginationDto = new PaginationDto();
    paginationDto.page = queryDto.page ? parseInt(queryDto.page, 10) : 1;
    paginationDto.limit = queryDto.limit ? parseInt(queryDto.limit, 10) : 10;
    paginationDto.search = queryDto.search;

    const filtersDto = {
      search: queryDto.search,
      status: queryDto.status,
      country: queryDto.country,
      state: queryDto.state,
    };

    const includesDto = {
      includeBrands: queryDto.includeBrands,
      includeProducts: queryDto.includeProducts,
      includeAuditInfo: queryDto.includeAuditInfo,
    };
    console.log('Include parameters received:', includesDto);
    return this.manufacturerService.findAll(
      paginationDto,
      filtersDto,
      includesDto,
    );
  }

  @Get('stats')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get manufacturer statistics (Admin only)',
    description:
      'Retrieve aggregate statistics about manufacturers for dashboard',
  })
  @ApiResponse({
    status: 200,
    description: 'Manufacturer statistics retrieved successfully',
    type: ManufacturerStatsDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async getStats(): Promise<ManufacturerStatsDto> {
    return this.manufacturerService.getStats();
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get manufacturer by ID (Admin only)',
    description: 'Retrieve detailed information about a specific manufacturer',
  })
  @ApiParam({ name: 'id', description: 'Manufacturer ID' })
  @ApiQuery({
    name: 'includeBrands',
    required: false,
    type: Boolean,
    description: 'Include brands in response (default: true)',
  })
  @ApiQuery({
    name: 'includeProducts',
    required: false,
    type: Boolean,
    description: 'Include products in response (default: true)',
  })
  @ApiQuery({
    name: 'includeAuditInfo',
    required: false,
    type: Boolean,
    description: 'Include audit information (default: true)',
  })
  @ApiResponse({
    status: 200,
    description: 'Manufacturer details retrieved successfully',
    type: ManufacturerResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Manufacturer not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async findOne(
    @Param('id') id: string,
    @Query('includeBrands') includeBrands?: boolean,
    @Query('includeProducts') includeProducts?: boolean,
    @Query('includeAuditInfo') includeAuditInfo?: boolean,
  ): Promise<ManufacturerResponseDto> {
    const includesDto = {
      includeBrands,
      includeProducts,
      includeAuditInfo,
    };

    return this.manufacturerService.findOne(id, includesDto);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Update manufacturer (Admin only)',
    description: 'Update manufacturer information with audit logging',
  })
  @ApiParam({ name: 'id', description: 'Manufacturer ID' })
  @ApiBody({ type: UpdateManufacturerDto })
  @ApiResponse({
    status: 200,
    description: 'Manufacturer updated successfully',
    type: ManufacturerResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Manufacturer not found',
  })
  @ApiResponse({
    status: 409,
    description:
      'Manufacturer with this name or registration number already exists',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async update(
    @Param('id') id: string,
    @Body() updateManufacturerDto: UpdateManufacturerDto,
    @CurrentUserId() adminId: string,
    @Request() req: any,
  ): Promise<ManufacturerResponseDto> {
    return this.manufacturerService.update(
      id,
      updateManufacturerDto,
      adminId,
      req,
    );
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Soft delete manufacturer (Admin only)',
    description: 'Soft delete manufacturer by setting status to SUSPENDED',
  })
  @ApiParam({ name: 'id', description: 'Manufacturer ID' })
  @ApiResponse({
    status: 200,
    description: 'Manufacturer deleted successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Manufacturer successfully deleted',
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Manufacturer not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete manufacturer with active products',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async remove(
    @Param('id') id: string,
    @CurrentUserId() adminId: string,
    @Request() req: any,
  ): Promise<{ message: string }> {
    return this.manufacturerService.remove(id, adminId, req);
  }

  // ================================
  // STATUS MANAGEMENT
  // ================================

  @Patch(':id/status')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Update manufacturer status (Admin only)',
    description: 'Activate, deactivate, or suspend a manufacturer',
  })
  @ApiParam({ name: 'id', description: 'Manufacturer ID' })
  @ApiBody({ type: UpdateManufacturerStatusDto })
  @ApiResponse({
    status: 200,
    description: 'Manufacturer status updated successfully',
    type: ManufacturerResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Manufacturer not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async updateStatus(
    @Param('id') id: string,
    @Body() statusDto: UpdateManufacturerStatusDto,
    @CurrentUserId() adminId: string,
    @Request() req: any,
  ): Promise<ManufacturerResponseDto> {
    return this.manufacturerService.updateStatus(
      id,
      statusDto.status,
      adminId,
      req,
    );
  }

  @Post(':id/activate')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Activate manufacturer (Admin only)',
    description: 'Set manufacturer status to ACTIVE',
  })
  @ApiParam({ name: 'id', description: 'Manufacturer ID' })
  @ApiResponse({
    status: 200,
    description: 'Manufacturer activated successfully',
    type: ManufacturerResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Manufacturer not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async activate(
    @Param('id') id: string,
    @CurrentUserId() adminId: string,
    @Request() req: any,
  ): Promise<ManufacturerResponseDto> {
    return this.manufacturerService.updateStatus(
      id,
      ManufacturerStatus.ACTIVE,
      adminId,
      req,
    );
  }

  @Post(':id/suspend')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Suspend manufacturer (Admin only)',
    description: 'Set manufacturer status to SUSPENDED',
  })
  @ApiParam({ name: 'id', description: 'Manufacturer ID' })
  @ApiResponse({
    status: 200,
    description: 'Manufacturer suspended successfully',
    type: ManufacturerResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Manufacturer not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async suspend(
    @Param('id') id: string,
    @CurrentUserId() adminId: string,
    @Request() req: any,
  ): Promise<ManufacturerResponseDto> {
    return this.manufacturerService.updateStatus(
      id,
      ManufacturerStatus.SUSPENDED,
      adminId,
      req,
    );
  }

  // ================================
  // MANUFACTURER PRODUCTS & ORDERS
  // ================================

  @Get(':id/products')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get manufacturer products (Admin only)',
    description: 'Retrieve all products by a specific manufacturer',
  })
  @ApiParam({ name: 'id', description: 'Manufacturer ID' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 10)',
  })
  @ApiResponse({
    status: 200,
    description: 'Manufacturer products retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Manufacturer not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async getManufacturerProducts(
    @Param('id') id: string,
    @Query() paginationDto: PaginationDto,
  ): Promise<any> {
    return this.manufacturerService.getManufacturerProducts(id, paginationDto);
  }

  @Get(':id/orders')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get manufacturer orders (Admin only)',
    description: 'Retrieve all orders for a specific manufacturer',
  })
  @ApiParam({ name: 'id', description: 'Manufacturer ID' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 10)',
  })
  @ApiResponse({
    status: 200,
    description: 'Manufacturer orders retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Manufacturer not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async getManufacturerOrders(
    @Param('id') id: string,
    @Query() paginationDto: PaginationDto,
  ): Promise<any> {
    return this.manufacturerService.getManufacturerOrders(id, paginationDto);
  }

  // ================================
  // ADMIN-ONLY DELETED MANUFACTURERS
  // ================================

  @Get('deleted/list')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get all deleted manufacturers (Admin only)',
    description:
      'Retrieve a paginated list of manufacturers that have been soft deleted for audit purposes',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 10, max: 100)',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search in name, email, or description',
  })
  @ApiQuery({
    name: 'country',
    required: false,
    type: String,
    description: 'Filter by country',
  })
  @ApiQuery({
    name: 'state',
    required: false,
    type: String,
    description: 'Filter by state',
  })
  @ApiResponse({
    status: 200,
    description: 'List of deleted manufacturers retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            allOf: [
              { $ref: '#/components/schemas/ManufacturerResponseDto' },
              {
                type: 'object',
                properties: {
                  deletedBy: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', example: 'admin123' },
                      email: {
                        type: 'string',
                        example: 'admin@jooav.com',
                      },
                      name: { type: 'string', example: 'John Admin' },
                    },
                  },
                },
              },
            ],
          },
        },
        pagination: { $ref: '#/components/schemas/PaginationMeta' },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async getDeletedManufacturers(
    @Query() queryDto: ManufacturerQueryDto,
  ): Promise<
    PaginatedResponse<
      ManufacturerResponseDto & {
        deletedBy: { id: string; email: string; name: string };
      }
    >
  > {
    const paginationDto = new PaginationDto();
    paginationDto.page = queryDto.page ? parseInt(queryDto.page, 10) : 1;
    paginationDto.limit = queryDto.limit ? parseInt(queryDto.limit, 10) : 10;

    const filtersDto = {
      search: queryDto.search,
      country: queryDto.country,
      state: queryDto.state,
    };

    return this.manufacturerService.getDeletedManufacturers(
      paginationDto,
      filtersDto,
    );
  }
}
