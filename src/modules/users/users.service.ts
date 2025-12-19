import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { UserRole, UserStatus, User } from '@prisma/client';
import * as argon2 from 'argon2';

import { PrismaService } from '../../database/prisma.service';
import { AuditLogService } from '../../common/services/audit-log.service';
import { PaginationDto, PaginatedResponse } from '../../common/dto';
import {
  CreateUserDto,
  UpdateUserDto,
  UpdateUserStatusDto,
  UpdateUserRoleDto,
  UpdateUserProfileDto,
} from './dto/user.dto';
import { UserProfileDto } from '../auth/dto/auth-response.dto';

@Injectable()
export class UsersService {
  private readonly argon2Options = {
    memoryCost: 65536, // 64MB
    timeCost: 3,
    parallelism: 1,
    type: argon2.argon2id,
  };

  constructor(
    private prisma: PrismaService,
    private auditLogService: AuditLogService,
  ) {}

  // ================================
  // USER CRUD OPERATIONS
  // ================================

  /**
   * Get all users with pagination and filtering
   */
  async findAll(
    paginationDto: PaginationDto,
    filters?: {
      role?: UserRole;
      status?: UserStatus;
      search?: string;
    },
  ): Promise<PaginatedResponse<UserProfileDto>> {
    const { page, limit, search } = paginationDto;
    const { role, status } = filters || {};

    const where: any = {};

    // Apply filters
    if (role) where.role = role;
    if (status) where.status = status;

    // Apply search
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          phone: true,
          avatar: true,
          role: true,
          status: true,
          emailVerified: true,
          lastLogin: true,
          createdAt: true,
          updatedAt: true,
          profile: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: ((page || 1) - 1) * (limit || 10),
        take: limit || 10,
      }),
      this.prisma.user.count({ where }),
    ]);

    return new PaginatedResponse(
      users as UserProfileDto[],
      page || 1,
      limit || 10,
      total,
    );
  }

  /**
   * Get user by ID
   */
  async findOne(id: string): Promise<UserProfileDto> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatar: true,
        role: true,
        status: true,
        emailVerified: true,
        lastLogin: true,
        passwordChangedAt: true,
        createdAt: true,
        updatedAt: true,
        profile: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user as UserProfileDto;
  }

  /**
   * Create new user (Admin only)
   */
  async create(
    createUserDto: CreateUserDto,
    createdBy: string,
    request?: any,
  ): Promise<UserProfileDto> {
    // Check if user already exists
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: createUserDto.email.toLowerCase() },
          ...(createUserDto.username
            ? [{ username: createUserDto.username.toLowerCase() }]
            : []),
        ],
      },
    });

    if (existingUser) {
      const field =
        existingUser.email === createUserDto.email.toLowerCase()
          ? 'email'
          : 'username';
      throw new ConflictException(`User with this ${field} already exists`);
    }

    // Generate a temporary password
    const temporaryPassword = this.generateTemporaryPassword();
    const hashedPassword = await argon2.hash(
      temporaryPassword,
      this.argon2Options,
    );

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: createUserDto.email.toLowerCase(),
        username: createUserDto.username?.toLowerCase(),
        password: hashedPassword,
        firstName: createUserDto.firstName,
        lastName: createUserDto.lastName,
        phone: createUserDto.phone,
        role: createUserDto.role,
        status: createUserDto.status || UserStatus.ACTIVE,
        profile: {
          create: {
            // Initialize empty profile
          },
        },
      },
      include: { profile: true },
    });

    // Log user creation
    await this.auditLogService.logUserAction(
      createdBy,
      'CREATE_USER',
      'USER',
      user.id,
      {
        email: user.email,
        role: user.role,
        temporaryPassword, // In production, send this via secure channel
      },
      request,
    );

    const { password, ...userWithoutPassword } = user;
    return {
      ...userWithoutPassword,
      // Include temporary password in response for admin
      temporaryPassword,
    } as UserProfileDto & { temporaryPassword: string };
  }

  /**
   * Update user information
   */
  async update(
    id: string,
    updateUserDto: UpdateUserDto,
    updatedBy: string,
    request?: any,
  ): Promise<UserProfileDto> {
    const existingUser = await this.findOne(id);

    // Check for conflicts if username is being updated
    if (updateUserDto.username) {
      const conflictUser = await this.prisma.user.findFirst({
        where: {
          username: updateUserDto.username.toLowerCase(),
          id: { not: id },
        },
      });

      if (conflictUser) {
        throw new ConflictException('Username already taken');
      }
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        ...updateUserDto,
        username: updateUserDto.username?.toLowerCase(),
        updatedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatar: true,
        role: true,
        status: true,
        emailVerified: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
        profile: true,
      },
    });

    // Log user update
    await this.auditLogService.logDataChange(
      updatedBy,
      'UPDATE_USER',
      'USER',
      id,
      existingUser,
      updatedUser,
      request,
    );

    return updatedUser as UserProfileDto;
  }

  /**
   * Update user status
   */
  async updateStatus(
    id: string,
    updateStatusDto: UpdateUserStatusDto,
    updatedBy: string,
    request?: any,
  ): Promise<UserProfileDto> {
    const existingUser = await this.findOne(id);

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        status: updateStatusDto.status,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatar: true,
        role: true,
        status: true,
        emailVerified: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
        profile: true,
      },
    });

    // If user is being deactivated, invalidate all sessions
    if (updateStatusDto.status !== UserStatus.ACTIVE) {
      await this.prisma.userSession.deleteMany({
        where: { userId: id },
      });
    }

    // Log status change
    await this.auditLogService.logDataChange(
      updatedBy,
      'UPDATE_USER_STATUS',
      'USER',
      id,
      { status: existingUser.status },
      { status: updatedUser.status },
      request,
    );

    return updatedUser as UserProfileDto;
  }

  /**
   * Update user role
   */
  async updateRole(
    id: string,
    updateRoleDto: UpdateUserRoleDto,
    updatedBy: string,
    request?: any,
  ): Promise<UserProfileDto> {
    const existingUser = await this.findOne(id);

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        role: updateRoleDto.role,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatar: true,
        role: true,
        status: true,
        emailVerified: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
        profile: true,
      },
    });

    // Log role change
    await this.auditLogService.logDataChange(
      updatedBy,
      'UPDATE_USER_ROLE',
      'USER',
      id,
      { role: existingUser.role },
      { role: updatedUser.role },
      request,
    );

    return updatedUser as UserProfileDto;
  }

  /**
   * Update user profile
   */
  async updateProfile(
    id: string,
    updateProfileDto: UpdateUserProfileDto,
    updatedBy: string,
    request?: any,
  ): Promise<UserProfileDto> {
    const user = await this.findOne(id);

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        profile: {
          upsert: {
            create: {
              ...updateProfileDto,
              dateOfBirth: updateProfileDto.dateOfBirth
                ? new Date(updateProfileDto.dateOfBirth)
                : undefined,
            },
            update: {
              ...updateProfileDto,
              dateOfBirth: updateProfileDto.dateOfBirth
                ? new Date(updateProfileDto.dateOfBirth)
                : undefined,
            },
          },
        },
        updatedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatar: true,
        role: true,
        status: true,
        emailVerified: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
        profile: true,
      },
    });

    // Log profile update
    await this.auditLogService.logUserAction(
      updatedBy,
      'UPDATE_PROFILE',
      'USER',
      id,
      updateProfileDto,
      request,
    );

    return updatedUser as UserProfileDto;
  }

  /**
   * Soft delete user (set status to deactivated)
   */
  async remove(id: string, deletedBy: string, request?: any): Promise<void> {
    const user = await this.findOne(id);

    // Soft delete by setting status to deactivated
    await this.prisma.user.update({
      where: { id },
      data: {
        status: UserStatus.DEACTIVATED,
        updatedAt: new Date(),
      },
    });

    // Invalidate all user sessions
    await this.prisma.userSession.deleteMany({
      where: { userId: id },
    });

    // Log user deletion
    await this.auditLogService.logUserAction(
      deletedBy,
      'DELETE_USER',
      'USER',
      id,
      { email: user.email },
      request,
    );
  }

  // ================================
  // UTILITY METHODS
  // ================================

  /**
   * Get user statistics
   */
  async getUserStats() {
    const [totalUsers, activeUsers, deactivatedUsers, adminUsers] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.user.count({ where: { status: UserStatus.ACTIVE } }),
        this.prisma.user.count({ where: { status: UserStatus.DEACTIVATED } }),
        this.prisma.user.count({
          where: {
            role: { in: [UserRole.SUPER_ADMIN, UserRole.ADMIN] },
          },
        }),
      ]);

    return {
      totalUsers,
      activeUsers,
      deactivatedUsers,
      adminUsers,
      usersByRole: await this.getUsersByRole(),
      recentRegistrations: await this.getRecentRegistrations(),
    };
  }

  /**
   * Get users grouped by role
   */
  private async getUsersByRole() {
    const roles = await this.prisma.user.groupBy({
      by: ['role'],
      _count: { id: true },
    });

    return roles.map((role) => ({
      role: role.role,
      count: role._count.id,
    }));
  }

  /**
   * Get recent registrations (last 30 days)
   */
  private async getRecentRegistrations() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return this.prisma.user.count({
      where: {
        createdAt: {
          gte: thirtyDaysAgo,
        },
      },
    });
  }

  /**
   * Generate temporary password for new users
   */
  private generateTemporaryPassword(): string {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let result = '';

    // Ensure password meets complexity requirements
    result += 'A'; // Uppercase
    result += 'a'; // Lowercase
    result += '1'; // Number
    result += '!'; // Special char

    // Add 8 more random characters
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return result;
  }
}
