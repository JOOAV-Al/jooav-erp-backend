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
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { VariantService } from './variant.service';
import {
  CreateVariantDto,
  UpdateVariantDto,
  VariantQueryDto,
  VariantResponseDto,
  VariantStatsDto,
} from './dto';
import { UnifiedAuthGuard } from '../../common/guards/unified-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUserId } from '../../common/decorators/current-user.decorator';
import { ResponseInterceptor } from '../../common/interceptors/response.interceptor';
import { AuditLog } from '../../common/decorators/audit-log.decorator';
import { PaginatedResponse } from '../../common/dto/paginated-response.dto';
import { BaseResponse } from '../../common/dto/base-response.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../../common/enums';

@ApiTags('Variants')
@Controller('variants')
@UseGuards(UnifiedAuthGuard, RolesGuard)
@ApiBearerAuth('access-token')
@ApiBearerAuth('admin-access-token')
export class VariantController {
  constructor(private readonly variantService: VariantService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new product variant' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Admin or Super Admin role required' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Variant created successfully',
    type: VariantResponseDto,
  })
  @AuditLog({
    action: 'CREATE',
    resource: 'VARIANT',
  })
  async create(
    @Body() createVariantDto: CreateVariantDto,
    @CurrentUserId() userId: string,
  ): Promise<VariantResponseDto> {
    return this.variantService.create(createVariantDto, userId);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all product variants with pagination and filtering',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Variants retrieved successfully',
    type: PaginatedResponse<VariantResponseDto>,
  })
  async findAll(
    @Query() query: VariantQueryDto,
  ): Promise<PaginatedResponse<VariantResponseDto>> {
    const includesDto = {
      includeBrand:
        query.includeBrand !== undefined ? query.includeBrand : true, // Default to true
      includeProductsCount: query.includeProductsCount,
      includeAuditInfo: query.includeAuditInfo,
    };

    return this.variantService.findAll(query, includesDto);
  }

  @Get('stats')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get variant statistics and analytics' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Admin or Super Admin role required' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Variant statistics retrieved successfully',
    type: VariantStatsDto,
  })
  async getStats(): Promise<VariantStatsDto> {
    return this.variantService.getStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific variant by ID' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Variant retrieved successfully',
    type: VariantResponseDto,
  })
  async findOne(
    @Param('id') id: string,
    @Query('includeBrand') includeBrand?: boolean,
    @Query('includeProductsCount') includeProductsCount?: boolean,
    @Query('includeAuditInfo') includeAuditInfo?: boolean,
  ): Promise<VariantResponseDto> {
    const includesDto = {
      includeBrand: includeBrand !== undefined ? includeBrand : true, // Default to true
      includeProductsCount,
      includeAuditInfo,
    };

    return this.variantService.findOne(id, includesDto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update variant' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Admin or Super Admin role required' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Variant updated successfully',
    type: VariantResponseDto,
  })
  @AuditLog({
    action: 'UPDATE',
    resource: 'VARIANT',
  })
  async update(
    @Param('id') id: string,
    @Body() updateVariantDto: UpdateVariantDto,
    @CurrentUserId() userId: string,
  ): Promise<VariantResponseDto> {
    return this.variantService.update(id, updateVariantDto, userId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete variant' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Admin or Super Admin role required' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Variant deleted successfully',
    type: BaseResponse,
  })
  @AuditLog({
    action: 'DELETE',
    resource: 'VARIANT',
  })
  async remove(
    @Param('id') id: string,
    @CurrentUserId() userId: string,
  ): Promise<{ message: string }> {
    return this.variantService.remove(id, userId);
  }
}
