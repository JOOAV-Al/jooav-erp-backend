import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  MinLength,
  IsArray,
  ValidateNested,
  IsNotEmpty,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { UserRole, UserStatus } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class AdminUserQueryDto extends PaginationDto {
  @ApiProperty({
    description: 'Filter by admin status',
    enum: UserStatus,
    required: false,
    example: UserStatus.ACTIVE,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === '' || value === null || value === undefined) {
      return undefined;
    }
    return value;
  })
  @IsEnum(UserStatus, { message: 'Status must be a valid UserStatus value' })
  status?: UserStatus;
}

export class AdminPermissionsInput {
  @ApiProperty({
    description: 'Can manage manufacturers',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  canManageManufacturers?: boolean;

  @ApiProperty({
    description: 'Can approve SME users',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  canApproveSMEs?: boolean;

  @ApiProperty({
    description: 'Can manage sub-admins',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  canManageSubAdmins?: boolean;

  @ApiProperty({
    description: 'Can access analytics',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  canAccessAnalytics?: boolean;

  @ApiProperty({
    description: 'Can modify system configuration',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  canModifySystemConfig?: boolean;
}

export class CreateAdminUserDto {
  @ApiProperty({
    description: 'Email address',
    example: 'newadmin@jooav.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'First name',
    example: 'John',
  })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({
    description: 'Last name',
    example: 'Doe',
  })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({
    description: 'Password (minimum 8 characters)',
    example: 'securePassword123',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({
    description: 'Admin role',
    enum: [UserRole.ADMIN, UserRole.SUPER_ADMIN],
    example: UserRole.ADMIN,
  })
  @IsEnum([UserRole.ADMIN, UserRole.SUPER_ADMIN])
  role: UserRole;

  @ApiProperty({
    description: 'Assigned regions for management',
    example: ['NG-LA', 'NG-AB'],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  assignedRegions?: string[];

  @ApiProperty({
    description: 'Initial admin permissions',
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => AdminPermissionsInput)
  permissions?: AdminPermissionsInput;
}

export class UpdateAdminPermissionsDto {
  @ApiProperty({
    description: 'Updated admin permissions',
  })
  @ValidateNested()
  @Type(() => AdminPermissionsInput)
  permissions: AdminPermissionsInput;

  @ApiProperty({
    description: 'Assigned regions for management',
    example: ['NG-LA', 'NG-AB', 'NG-KC'],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  assignedRegions?: string[];
}

export class UpdateAdminStatusDto {
  @ApiProperty({
    description: 'New admin status',
    enum: UserStatus,
    example: UserStatus.ACTIVE,
  })
  @IsEnum(UserStatus)
  status: UserStatus;

  @ApiProperty({
    description: 'Reason for status change',
    example: 'Reactivating after suspension period',
    required: false,
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class AdminUserListDto {
  @ApiProperty({
    description: 'Admin user ID',
    example: 'cuid123',
  })
  id: string;

  @ApiProperty({
    description: 'Email address',
    example: 'admin@jooav.com',
  })
  email: string;

  @ApiProperty({
    description: 'Full name',
    example: 'John Doe',
  })
  fullName: string;

  @ApiProperty({
    description: 'Admin role',
    enum: UserRole,
    example: UserRole.ADMIN,
  })
  role: UserRole;

  @ApiProperty({
    description: 'Account status',
    enum: UserStatus,
    example: UserStatus.ACTIVE,
  })
  status: UserStatus;

  @ApiProperty({
    description: 'Last login timestamp',
    example: '2023-12-15T10:30:00Z',
  })
  lastLogin?: Date;

  @ApiProperty({
    description: 'Account creation timestamp',
    example: '2023-11-01T08:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Assigned regions',
    example: ['NG-LA', 'NG-AB'],
  })
  assignedRegions: string[];
}

export class AdminUserDetailDto {
  @ApiProperty({
    description: 'Admin user ID',
    example: 'cuid123',
  })
  id: string;

  @ApiProperty({
    description: 'Email address',
    example: 'admin@jooav.com',
  })
  email: string;

  @ApiProperty({
    description: 'First name',
    example: 'John',
  })
  firstName: string;

  @ApiProperty({
    description: 'Last name',
    example: 'Doe',
  })
  lastName: string;

  @ApiProperty({
    description: 'Admin role',
    enum: UserRole,
    example: UserRole.ADMIN,
  })
  role: UserRole;

  @ApiProperty({
    description: 'Account status',
    enum: UserStatus,
    example: UserStatus.ACTIVE,
  })
  status: UserStatus;

  @ApiProperty({
    description: 'Email verification status',
    example: true,
  })
  emailVerified: boolean;

  @ApiProperty({
    description: 'Last login timestamp',
    example: '2023-12-15T10:30:00Z',
  })
  lastLogin?: Date;

  @ApiProperty({
    description: 'Assigned regions for management',
    example: ['NG-LA', 'NG-AB'],
  })
  assignedRegions: string[];

  @ApiProperty({
    description: 'Admin permissions',
    example: {
      canManageManufacturers: true,
      canApproveSMEs: true,
      canManageSubAdmins: false,
      canAccessAnalytics: true,
      canModifySystemConfig: false,
    },
  })
  permissions: {
    canManageManufacturers: boolean;
    canApproveSMEs: boolean;
    canManageSubAdmins: boolean;
    canAccessAnalytics: boolean;
    canModifySystemConfig: boolean;
  };

  @ApiProperty({
    description: 'Account creation timestamp',
    example: '2023-11-01T08:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2023-12-15T10:30:00Z',
  })
  updatedAt: Date;
}
