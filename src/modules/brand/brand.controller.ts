import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Put,
  Param,
  Delete,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseEnumPipe,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiParam,
  ApiBody,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { BrandStatus } from '@prisma/client';
import { BrandService } from './brand.service';
import {
  CreateBrandDto,
  UpdateBrandDto,
  UpdateBrandStatusDto,
  UpdateBrandLogoDto,
  BrandQueryDto,
  BrandResponseDto,
  BrandStatsDto,
} from './dto';
import { UnifiedAuthGuard } from '../../common/guards/unified-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser,
  CurrentUserId,
} from '../../common/decorators/current-user.decorator';
import { ResponseInterceptor } from '../../common/interceptors/response.interceptor';
import { AuditLog } from '../../common/decorators/audit-log.decorator';
import { PaginatedResponse } from '../../common/dto/paginated-response.dto';
import { BaseResponse } from '../../common/dto/base-response.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../../common/enums';

@ApiTags('Brands')
@Controller('brands')
@UseGuards(UnifiedAuthGuard, RolesGuard)
@ApiBearerAuth('access-token')
@ApiBearerAuth('admin-access-token')
export class BrandController {
  constructor(private readonly brandService: BrandService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new FMCG brand under a manufacturer' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Admin or Super Admin role required' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Brand creation data with optional logo upload',
    schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Brand name',
          example: 'Maggi',
        },
        description: {
          type: 'string',
          description: 'Brand description',
          example: 'Quality seasoning brand',
        },
        manufacturerId: {
          type: 'string',
          description: 'Manufacturer ID this brand belongs to',
          example: 'b8e6cc4d-9e52-4a3b-9c6d-1f2a3b4c5d6e',
        },
        status: {
          type: 'string',
          enum: ['ACTIVE', 'INACTIVE'],
          description: 'Brand status',
          example: 'ACTIVE',
          default: 'ACTIVE',
        },
        logo: {
          type: 'string',
          format: 'binary',
          description: 'Brand logo file (JPEG, PNG, GIF)',
        },
      },
      required: ['name', 'manufacturerId'],
    },
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Brand created successfully',
    type: BrandResponseDto,
  })
  @UseInterceptors(FileInterceptor('logo'))
  @AuditLog({ action: 'CREATE', resource: 'Brand' })
  async create(
    @Body() createBrandDto: CreateBrandDto,
    @CurrentUserId() userId: string,
    @UploadedFile() logoFile?: Express.Multer.File,
  ) {
    return this.brandService.create(createBrandDto, userId, logoFile);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all FMCG brands with pagination and filtering',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Brands retrieved successfully',
    type: PaginatedResponse<BrandResponseDto>,
  })
  async findAll(
    @Query() query: BrandQueryDto,
  ): Promise<PaginatedResponse<BrandResponseDto>> {
    const includesDto = {
      includeManufacturer: query.includeManufacturer,
      includeProducts: query.includeProducts,
      includeAuditInfo: query.includeAuditInfo,
    };

    return this.brandService.findAll(query, includesDto);
  }

  @Get('stats')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get FMCG brand statistics and analytics' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Admin or Super Admin role required' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Brand statistics retrieved successfully',
    type: BrandStatsDto,
  })
  async getStats(): Promise<BrandStatsDto> {
    return this.brandService.getStats();
  }

  @Get('deleted')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get deleted FMCG brands (Admin only)' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Admin or Super Admin role required' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Deleted brands retrieved successfully',
  })
  async getDeletedBrands(@Query() query: BrandQueryDto): Promise<
    PaginatedResponse<
      BrandResponseDto & {
        deletedAt: Date;
        deletedBy: { id: string; email: string; name: string };
      }
    >
  > {
    return this.brandService.getDeletedBrands(query);
  }

  @Get('manufacturer/:manufacturerId')
  @ApiOperation({ summary: 'Get brands by manufacturer' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiParam({ name: 'manufacturerId', description: 'Manufacturer ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Manufacturer brands retrieved successfully',
    type: PaginatedResponse<BrandResponseDto>,
  })
  async getByManufacturer(
    @Param('manufacturerId') manufacturerId: string,
    @Query() query: BrandQueryDto,
  ): Promise<PaginatedResponse<BrandResponseDto>> {
    return this.brandService.getByManufacturer(manufacturerId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get brand by ID' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiParam({ name: 'id', description: 'Brand ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Brand retrieved successfully',
    type: BrandResponseDto,
  })
  async findOne(
    @Param('id') id: string,
    @Query('includeManufacturer') includeManufacturer?: boolean,
    @Query('includeProducts') includeProducts?: boolean,
    @Query('includeAuditInfo') includeAuditInfo?: boolean,
  ): Promise<BrandResponseDto> {
    const includesDto = {
      includeManufacturer,
      includeProducts,
      includeAuditInfo,
    };

    return this.brandService.findOne(id, includesDto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update brand' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Admin or Super Admin role required' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'id', description: 'Brand ID' })
  @ApiBody({
    description: 'Brand update data with optional logo upload',
    schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Brand name',
          example: 'Maggi Premium',
        },
        description: {
          type: 'string',
          description: 'Brand description',
          example: 'Premium seasoning brand',
        },
        manufacturerId: {
          type: 'string',
          description: 'Manufacturer ID this brand belongs to',
          example: 'b8e6cc4d-9e52-4a3b-9c6d-1f2a3b4c5d6e',
        },
        status: {
          type: 'string',
          enum: ['ACTIVE', 'INACTIVE'],
          description: 'Brand status',
          example: 'ACTIVE',
        },
        logo: {
          type: 'string',
          format: 'binary',
          description:
            'Brand logo file (JPEG, PNG, GIF) - optional replacement',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Brand updated successfully',
    type: BrandResponseDto,
  })
  @UseInterceptors(FileInterceptor('logo'))
  @AuditLog({ action: 'UPDATE', resource: 'Brand' })
  async update(
    @Param('id') id: string,
    @Body() updateBrandDto: UpdateBrandDto,
    @CurrentUserId() userId: string,
    @UploadedFile() logoFile?: Express.Multer.File,
  ): Promise<BrandResponseDto> {
    return this.brandService.update(id, updateBrandDto, userId, logoFile);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update brand status' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Admin or Super Admin role required' })
  @ApiParam({ name: 'id', description: 'Brand ID' })
  @ApiBody({
    description: 'Brand status update data',
    type: UpdateBrandStatusDto,
    examples: {
      activate: {
        summary: 'Activate brand',
        description: 'Set brand status to active',
        value: {
          status: 'ACTIVE',
        },
      },
      deactivate: {
        summary: 'Deactivate brand',
        description: 'Set brand status to inactive',
        value: {
          status: 'INACTIVE',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Brand status updated successfully',
    type: BrandResponseDto,
  })
  @AuditLog({ action: 'STATUS_UPDATE', resource: 'Brand' })
  async updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateBrandStatusDto,
    @CurrentUserId() userId: string,
  ): Promise<BrandResponseDto> {
    return this.brandService.updateStatus(id, updateStatusDto.status, userId);
  }

  @Put(':id/logo')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update or upload brand logo' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Admin or Super Admin role required' })
  @ApiParam({ name: 'id', description: 'Brand ID' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Brand logo file',
    type: UpdateBrandLogoDto,
    schema: {
      type: 'object',
      properties: {
        logo: {
          type: 'string',
          format: 'binary',
          description: 'Brand logo file (JPEG, PNG, GIF)',
        },
      },
      required: ['logo'],
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Brand logo updated successfully',
    type: BrandResponseDto,
  })
  @UseInterceptors(FileInterceptor('logo'))
  @AuditLog({ action: 'LOGO_UPDATE', resource: 'Brand' })
  async updateLogo(
    @Param('id') id: string,
    @UploadedFile() logoFile: Express.Multer.File,
    @CurrentUserId() userId: string,
  ): Promise<BrandResponseDto> {
    if (!logoFile) {
      throw new BadRequestException('Logo file is required');
    }
    return this.brandService.updateLogo(id, logoFile, userId);
  }

  @Delete(':id/logo')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete brand logo' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Admin or Super Admin role required' })
  @ApiParam({ name: 'id', description: 'Brand ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Brand logo deleted successfully',
    type: BrandResponseDto,
  })
  @AuditLog({ action: 'LOGO_DELETE', resource: 'Brand' })
  async deleteLogo(
    @Param('id') id: string,
    @CurrentUserId() userId: string,
  ): Promise<BrandResponseDto> {
    return this.brandService.deleteLogo(id, userId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete brand (soft delete)' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Admin or Super Admin role required' })
  @ApiParam({ name: 'id', description: 'Brand ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Brand deleted successfully',
    type: BaseResponse,
  })
  @AuditLog({ action: 'DELETE', resource: 'Brand' })
  async remove(
    @Param('id') id: string,
    @CurrentUserId() userId: string,
  ): Promise<{ message: string }> {
    return this.brandService.remove(id, userId);
  }
}
