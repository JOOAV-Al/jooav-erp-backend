import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { AdminJwtAuthGuard } from '../auth/guards/admin-jwt-auth.guard';
import { AdminRolesGuard } from '../auth/guards/admin-roles.guard';
import { AdminRoles } from '../auth/decorators/admin-roles.decorator';
import { CurrentAdminId } from '../auth/decorators/current-admin.decorator';
import { AdminManagementService } from './admin-management.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import {
  CreateAdminUserDto,
  UpdateAdminPermissionsDto,
  UpdateAdminStatusDto,
  AdminUserListDto,
  AdminUserDetailDto,
  AdminUserQueryDto,
} from './dto/admin-management.dto';
import { UserRole } from '@prisma/client';
import { AuditLog } from '../../common/decorators/audit-log.decorator';

@ApiTags('Admin User Management')
@Controller('admin/users')
@UseGuards(AdminJwtAuthGuard, AdminRolesGuard)
@ApiBearerAuth('admin-access-token')
export class AdminManagementController {
  constructor(
    private readonly adminManagementService: AdminManagementService,
  ) {}

  @Get()
  @AdminRoles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get all admin users',
    description:
      'Retrieve paginated list of all admin users (Super Admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Admin users retrieved successfully',
    type: [AdminUserListDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Super Admin only' })
  async getAllAdminUsers(@Query() queryDto: AdminUserQueryDto) {
    return this.adminManagementService.getAllAdminUsers(queryDto, {
      status: queryDto.status,
      search: queryDto.search,
    });
  }

  @Get(':id')
  @AdminRoles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get admin user details',
    description: 'Get detailed information about a specific admin user',
  })
  @ApiParam({ name: 'id', description: 'Admin user ID' })
  @ApiResponse({
    status: 200,
    description: 'Admin user details retrieved successfully',
    type: AdminUserDetailDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Super Admin only' })
  @ApiResponse({ status: 404, description: 'Admin user not found' })
  async getAdminUser(@Param('id') id: string) {
    return this.adminManagementService.getAdminUserById(id);
  }

  @Post()
  @AdminRoles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Create new admin user',
    description: 'Create a new admin or super admin user (Super Admin only)',
  })
  @ApiBody({ type: CreateAdminUserDto })
  @ApiResponse({
    status: 201,
    description: 'Admin user created successfully',
    type: AdminUserDetailDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid admin data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Super Admin only' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  @AuditLog({
    action: 'CREATE_ADMIN_USER',
    resource: 'ADMIN',
    includeRequestBody: true,
  })
  async createAdminUser(
    @Body() createAdminDto: CreateAdminUserDto,
    @CurrentAdminId() createdBy: string,
  ) {
    return this.adminManagementService.createAdminUser(
      createAdminDto,
      createdBy,
    );
  }

  @Patch(':id/permissions')
  @AdminRoles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Update admin permissions',
    description: 'Update permissions for an admin user (Super Admin only)',
  })
  @ApiParam({ name: 'id', description: 'Admin user ID' })
  @ApiBody({ type: UpdateAdminPermissionsDto })
  @ApiResponse({
    status: 200,
    description: 'Admin permissions updated successfully',
    type: AdminUserDetailDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid permission data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Super Admin only' })
  @ApiResponse({ status: 404, description: 'Admin user not found' })
  @AuditLog({
    action: 'UPDATE_ADMIN_PERMISSIONS',
    resource: 'ADMIN',
    includeRequestBody: true,
  })
  async updateAdminPermissions(
    @Param('id') adminId: string,
    @Body() updatePermissionsDto: UpdateAdminPermissionsDto,
    @CurrentAdminId() updatedBy: string,
  ) {
    return this.adminManagementService.updateAdminPermissions(
      adminId,
      updatePermissionsDto,
      updatedBy,
    );
  }

  @Patch(':id/status')
  @AdminRoles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Update admin status',
    description: 'Enable, disable, or suspend an admin user (Super Admin only)',
  })
  @ApiParam({ name: 'id', description: 'Admin user ID' })
  @ApiBody({ type: UpdateAdminStatusDto })
  @ApiResponse({
    status: 200,
    description: 'Admin status updated successfully',
    type: AdminUserDetailDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid status data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Super Admin only' })
  @ApiResponse({ status: 404, description: 'Admin user not found' })
  @AuditLog({
    action: 'UPDATE_ADMIN_STATUS',
    resource: 'ADMIN',
    includeRequestBody: true,
  })
  async updateAdminStatus(
    @Param('id') adminId: string,
    @Body() updateStatusDto: UpdateAdminStatusDto,
    @CurrentAdminId() updatedBy: string,
  ) {
    return this.adminManagementService.updateAdminStatus(
      adminId,
      updateStatusDto,
      updatedBy,
    );
  }

  @Patch(':id/promote')
  @AdminRoles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Promote admin to super admin',
    description:
      'Promote an admin user to super admin status (Super Admin only)',
  })
  @ApiParam({ name: 'id', description: 'Admin user ID' })
  @ApiResponse({
    status: 200,
    description: 'Admin promoted to Super Admin successfully',
    type: AdminUserDetailDto,
  })
  @ApiResponse({ status: 400, description: 'Cannot promote user' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Super Admin only' })
  @ApiResponse({ status: 404, description: 'Admin user not found' })
  @AuditLog({
    action: 'PROMOTE_TO_SUPER_ADMIN',
    resource: 'ADMIN',
  })
  async promoteToSuperAdmin(
    @Param('id') adminId: string,
    @CurrentAdminId() promotedBy: string,
  ) {
    return this.adminManagementService.promoteToSuperAdmin(adminId, promotedBy);
  }

  @Delete(':id')
  @AdminRoles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Delete admin user',
    description: 'Soft delete an admin user (Super Admin only)',
  })
  @ApiParam({ name: 'id', description: 'Admin user ID' })
  @ApiResponse({
    status: 200,
    description: 'Admin user deleted successfully',
  })
  @ApiResponse({ status: 400, description: 'Cannot delete user' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Super Admin only' })
  @ApiResponse({ status: 404, description: 'Admin user not found' })
  @AuditLog({
    action: 'DELETE_ADMIN_USER',
    resource: 'ADMIN',
  })
  async deleteAdminUser(
    @Param('id') adminId: string,
    @CurrentAdminId() deletedBy: string,
  ) {
    await this.adminManagementService.deleteAdminUser(adminId, deletedBy);
    return {
      message: 'Admin user deleted successfully',
      statusCode: HttpStatus.OK,
    };
  }

  @Get(':id/activity')
  @AdminRoles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get admin activity log',
    description: 'Get activity history for a specific admin user',
  })
  @ApiParam({ name: 'id', description: 'Admin user ID' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page',
  })
  @ApiResponse({
    status: 200,
    description: 'Admin activity log retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Super Admin only' })
  @ApiResponse({ status: 404, description: 'Admin user not found' })
  async getAdminActivity(
    @Param('id') adminId: string,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.adminManagementService.getAdminActivity(adminId, paginationDto);
  }
}
