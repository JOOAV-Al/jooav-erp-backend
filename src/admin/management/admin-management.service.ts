import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../modules/prisma/prisma.service';
import { AuditService } from '../../modules/audit/audit.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PaginatedResponse } from '../../common/dto/paginated-response.dto';
import {
  CreateAdminUserDto,
  UpdateAdminPermissionsDto,
  UpdateAdminStatusDto,
  AdminUserListDto,
  AdminUserDetailDto,
} from './dto/admin-management.dto';
import { UserRole, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';

@Injectable()
export class AdminManagementService {
  private readonly argon2Options = {
    memoryCost: 65536, // 64MB
    timeCost: 3,
    parallelism: 1,
    type: argon2.argon2id,
  };

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  /**
   * Get all admin users with pagination and filtering
   */
  async getAllAdminUsers(
    paginationDto: PaginationDto,
    filters?: { status?: string; search?: string },
  ): Promise<PaginatedResponse<AdminUserListDto>> {
    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      role: { in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] },
    };

    if (filters?.status) {
      where.status = filters.status as UserStatus;
    }

    if (filters?.search) {
      where.OR = [
        { email: { contains: filters.search, mode: 'insensitive' } },
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [admins, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        include: {
          superAdminProfile: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    const adminList: AdminUserListDto[] = admins.map((admin) => ({
      id: admin.id,
      email: admin.email,
      fullName: `${admin.firstName} ${admin.lastName}`,
      role: admin.role,
      status: admin.status,
      lastLogin: admin.lastLogin || undefined,
      createdAt: admin.createdAt,
      assignedRegions: admin.superAdminProfile?.assignedRegions || [],
    }));

    return {
      data: adminList,
      meta: {
        page,
        limit,
        totalItems: total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * Get admin user by ID with detailed information
   */
  async getAdminUserById(adminId: string): Promise<AdminUserDetailDto> {
    const admin = await this.prisma.user.findUnique({
      where: {
        id: adminId,
        role: { in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] },
      },
      include: {
        superAdminProfile: true,
      },
    });

    if (!admin) {
      throw new NotFoundException('Admin user not found');
    }

    return {
      id: admin.id,
      email: admin.email,
      firstName: admin.firstName || '',
      lastName: admin.lastName || '',
      role: admin.role,
      status: admin.status,
      emailVerified: admin.emailVerified,
      lastLogin: admin.lastLogin || undefined,
      assignedRegions: admin.superAdminProfile?.assignedRegions || [],
      permissions: {
        canManageManufacturers:
          admin.superAdminProfile?.canManageManufacturers ?? false,
        canApproveSMEs: admin.superAdminProfile?.canApproveSMEs ?? false,
        canManageSubAdmins:
          admin.superAdminProfile?.canManageSubAdmins ?? false,
        canAccessAnalytics:
          admin.superAdminProfile?.canAccessAnalytics ?? false,
        canModifySystemConfig:
          admin.superAdminProfile?.canModifySystemConfig ?? false,
      },
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt,
    };
  }

  /**
   * Create new admin user
   */
  async createAdminUser(
    createAdminDto: CreateAdminUserDto,
    createdBy: string,
  ): Promise<AdminUserDetailDto> {
    // Check if email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: createAdminDto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // Hash password
    const hashedPassword = await argon2.hash(
      createAdminDto.password,
      this.argon2Options,
    );

    // Create admin user
    const admin = await this.prisma.user.create({
      data: {
        email: createAdminDto.email,
        firstName: createAdminDto.firstName,
        lastName: createAdminDto.lastName,
        password: hashedPassword,
        role: createAdminDto.role,
        status: UserStatus.ACTIVE,
        emailVerified: true, // Admins are pre-verified
        superAdminProfile: {
          create: {
            assignedRegions: createAdminDto.assignedRegions || [],
            canManageManufacturers:
              createAdminDto.permissions?.canManageManufacturers ?? false,
            canApproveSMEs: createAdminDto.permissions?.canApproveSMEs ?? false,
            canManageSubAdmins:
              createAdminDto.permissions?.canManageSubAdmins ?? false,
            canAccessAnalytics:
              createAdminDto.permissions?.canAccessAnalytics ?? false,
            canModifySystemConfig:
              createAdminDto.permissions?.canModifySystemConfig ?? false,
          },
        },
      },
      include: {
        superAdminProfile: true,
      },
    });

    // Log the creation
    await this.auditService.createAuditLog({
      userId: createdBy,
      action: 'CREATE_ADMIN_USER',
      resource: 'ADMIN',
      resourceId: admin.id,
      newData: {
        adminEmail: admin.email,
        adminRole: admin.role,
      },
      metadata: {
        newAdminEmail: admin.email,
        newAdminRole: admin.role,
      },
    });

    return this.transformToAdminDetail(admin);
  }

  /**
   * Update admin permissions
   */
  async updateAdminPermissions(
    adminId: string,
    updateDto: UpdateAdminPermissionsDto,
    updatedBy: string,
  ): Promise<AdminUserDetailDto> {
    // Get current admin
    const admin = await this.prisma.user.findUnique({
      where: {
        id: adminId,
        role: { in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] },
      },
      include: { superAdminProfile: true },
    });

    if (!admin) {
      throw new NotFoundException('Admin user not found');
    }

    // Don't allow modifying super admin permissions if they have canModifySystemConfig
    if (
      admin.role === UserRole.SUPER_ADMIN &&
      admin.superAdminProfile?.canModifySystemConfig
    ) {
      throw new ForbiddenException(
        'Cannot modify system super admin permissions',
      );
    }

    // Update admin permissions
    const updatedAdmin = await this.prisma.user.update({
      where: { id: adminId },
      data: {
        superAdminProfile: {
          update: {
            assignedRegions:
              updateDto.assignedRegions ??
              admin.superAdminProfile?.assignedRegions,
            canManageManufacturers:
              updateDto.permissions.canManageManufacturers ??
              admin.superAdminProfile?.canManageManufacturers,
            canApproveSMEs:
              updateDto.permissions.canApproveSMEs ??
              admin.superAdminProfile?.canApproveSMEs,
            canManageSubAdmins:
              updateDto.permissions.canManageSubAdmins ??
              admin.superAdminProfile?.canManageSubAdmins,
            canAccessAnalytics:
              updateDto.permissions.canAccessAnalytics ??
              admin.superAdminProfile?.canAccessAnalytics,
            canModifySystemConfig:
              updateDto.permissions.canModifySystemConfig ??
              admin.superAdminProfile?.canModifySystemConfig,
          },
        },
      },
      include: {
        superAdminProfile: true,
      },
    });

    // Log the permission update
    await this.auditService.createAuditLog({
      userId: updatedBy,
      action: 'UPDATE_ADMIN_PERMISSIONS',
      resource: 'ADMIN',
      resourceId: adminId,
      oldData: admin.superAdminProfile,
      newData: updateDto.permissions,
      metadata: {
        targetAdminEmail: admin.email,
        updatedPermissions: updateDto.permissions,
      },
    });

    return this.transformToAdminDetail(updatedAdmin);
  }

  /**
   * Update admin status
   */
  async updateAdminStatus(
    adminId: string,
    updateDto: UpdateAdminStatusDto,
    updatedBy: string,
  ): Promise<AdminUserDetailDto> {
    const admin = await this.prisma.user.findUnique({
      where: {
        id: adminId,
        role: { in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] },
      },
      include: { superAdminProfile: true },
    });

    if (!admin) {
      throw new NotFoundException('Admin user not found');
    }

    // Don't allow suspending system super admin
    if (
      admin.role === UserRole.SUPER_ADMIN &&
      admin.superAdminProfile?.canModifySystemConfig
    ) {
      throw new ForbiddenException('Cannot modify system super admin status');
    }

    // Update status
    const updatedAdmin = await this.prisma.user.update({
      where: { id: adminId },
      data: { status: updateDto.status },
      include: { superAdminProfile: true },
    });

    // Log the status update
    await this.auditService.createAuditLog({
      userId: updatedBy,
      action: 'UPDATE_ADMIN_STATUS',
      resource: 'ADMIN',
      resourceId: adminId,
      oldData: { status: admin.status },
      newData: { status: updateDto.status },
      metadata: {
        targetAdminEmail: admin.email,
        reason: updateDto.reason,
      },
    });

    return this.transformToAdminDetail(updatedAdmin);
  }

  /**
   * Promote admin to super admin
   */
  async promoteToSuperAdmin(
    adminId: string,
    promotedBy: string,
  ): Promise<AdminUserDetailDto> {
    const admin = await this.prisma.user.findUnique({
      where: { id: adminId, role: UserRole.ADMIN },
      include: { superAdminProfile: true },
    });

    if (!admin) {
      throw new NotFoundException(
        'Admin user not found or already a Super Admin',
      );
    }

    // Promote to super admin with elevated permissions
    const updatedAdmin = await this.prisma.user.update({
      where: { id: adminId },
      data: {
        role: UserRole.SUPER_ADMIN,
        superAdminProfile: {
          update: {
            canManageManufacturers: true,
            canApproveSMEs: true,
            canManageSubAdmins: true,
            canAccessAnalytics: true,
            // Keep canModifySystemConfig as false for promoted admins
          },
        },
      },
      include: { superAdminProfile: true },
    });

    // Log the promotion
    await this.auditService.createAuditLog({
      userId: promotedBy,
      action: 'PROMOTE_TO_SUPER_ADMIN',
      resource: 'ADMIN',
      resourceId: adminId,
      oldData: { role: UserRole.ADMIN },
      newData: { role: UserRole.SUPER_ADMIN },
      metadata: {
        promotedAdminEmail: admin.email,
      },
    });

    return this.transformToAdminDetail(updatedAdmin);
  }

  /**
   * Delete admin user (soft delete)
   */
  async deleteAdminUser(adminId: string, deletedBy: string): Promise<void> {
    const admin = await this.prisma.user.findUnique({
      where: {
        id: adminId,
        role: { in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] },
      },
      include: { superAdminProfile: true },
    });

    if (!admin) {
      throw new NotFoundException('Admin user not found');
    }

    // Don't allow deleting system super admin
    if (
      admin.role === UserRole.SUPER_ADMIN &&
      admin.superAdminProfile?.canModifySystemConfig
    ) {
      throw new ForbiddenException('Cannot delete system super admin');
    }

    // Soft delete by setting status to DELETED
    await this.prisma.user.update({
      where: { id: adminId },
      data: {
        status: UserStatus.DEACTIVATED, // Soft delete by deactivating
        email: `${admin.email}_deleted_${Date.now()}`, // Avoid email conflicts
      },
    });

    // Log the deletion
    await this.auditService.createAuditLog({
      userId: deletedBy,
      action: 'DELETE_ADMIN_USER',
      resource: 'ADMIN',
      resourceId: adminId,
      oldData: {
        email: admin.email,
        role: admin.role,
        status: admin.status,
      },
      metadata: {
        deletedAdminEmail: admin.email,
      },
    });
  }

  /**
   * Get admin activity log
   */
  async getAdminActivity(adminId: string, paginationDto: PaginationDto) {
    // Verify admin exists
    const admin = await this.prisma.user.findUnique({
      where: {
        id: adminId,
        role: { in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] },
      },
    });

    if (!admin) {
      throw new NotFoundException('Admin user not found');
    }

    // Get audit logs for this admin
    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { userId: adminId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where: { userId: adminId } }),
    ]);

    return {
      data: logs,
      meta: {
        page,
        limit,
        totalItems: total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * Transform admin to detailed DTO
   */
  private transformToAdminDetail(admin: any): AdminUserDetailDto {
    return {
      id: admin.id,
      email: admin.email,
      firstName: admin.firstName || '',
      lastName: admin.lastName || '',
      role: admin.role,
      status: admin.status,
      emailVerified: admin.emailVerified,
      lastLogin: admin.lastLogin || undefined,
      assignedRegions: admin.superAdminProfile?.assignedRegions || [],
      permissions: {
        canManageManufacturers:
          admin.superAdminProfile?.canManageManufacturers ?? false,
        canApproveSMEs: admin.superAdminProfile?.canApproveSMEs ?? false,
        canManageSubAdmins:
          admin.superAdminProfile?.canManageSubAdmins ?? false,
        canAccessAnalytics:
          admin.superAdminProfile?.canAccessAnalytics ?? false,
        canModifySystemConfig:
          admin.superAdminProfile?.canModifySystemConfig ?? false,
      },
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt,
    };
  }
}
