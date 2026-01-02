import {
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
  IsNotEmpty,
  MaxLength,
  MinLength,
  Matches,
  IsBoolean,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ManufacturerStatus } from '@prisma/client';

export class CreateManufacturerDto {
  @ApiProperty({
    description: 'Manufacturer name',
    example: 'Nestle',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({
    description: 'Manufacturer description',
    example: 'Leading manufacturer of beverages',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({
    description: 'Contact email address',
    example: 'contact@nestle.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'Contact phone number',
    example: '2341-555-123-4567',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(20)
  phone: string;

  @ApiPropertyOptional({
    description: 'Company website URL',
    example: 'https://www.nestle.com',
  })
  @IsOptional()
  @IsString()
  @Matches(/^https?:\/\/.+/, { message: 'Website must be a valid URL' })
  website?: string;

  @ApiProperty({
    description: 'Street address',
    example: '1-7-1 Konan, Minato-ku',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  address: string;

  @ApiProperty({
    description: 'City',
    example: 'Lagos',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city: string;

  @ApiProperty({
    description: 'State',
    example: 'Lagos',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  state: string;

  @ApiProperty({
    description: 'Country',
    example: 'NIgeria',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  country: string;

  @ApiPropertyOptional({
    description: 'Postal/ZIP code',
    example: '108-0075',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @ApiPropertyOptional({
    description: 'Business registration number',
    example: 'TK-123456789',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  registrationNumber?: string;

  @ApiPropertyOptional({
    description: 'Manufacturer status',
    enum: ManufacturerStatus,
    default: ManufacturerStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(ManufacturerStatus)
  status?: ManufacturerStatus;
}

export class UpdateManufacturerDto {
  @ApiPropertyOptional({
    description: 'Manufacturer name',
    example: 'Nestle',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({
    description: 'Manufacturer description',
    example: 'Leading manufacturer of beverages',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({
    description: 'Contact email address',
    example: 'contact@nestle.com',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: 'Contact phone number',
    example: '+234-555-123-4567',
  })
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({
    description: 'Company website URL',
    example: 'https://www.nestle.com',
  })
  @IsOptional()
  @IsString()
  @Matches(/^https?:\/\/.+/, { message: 'Website must be a valid URL' })
  website?: string;

  @ApiPropertyOptional({
    description: 'Street address',
    example: '1-7-1 Konan, Minato-ku',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @ApiPropertyOptional({
    description: 'City',
    example: 'Lagos',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({
    description: 'State',
    example: 'Lagos',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @ApiPropertyOptional({
    description: 'Country',
    example: 'Nigeria',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @ApiPropertyOptional({
    description: 'Postal/ZIP code',
    example: '108-0075',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @ApiPropertyOptional({
    description: 'Business registration number',
    example: 'TK-123456789',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  registrationNumber?: string;
}

export class UpdateManufacturerStatusDto {
  @ApiProperty({
    description: 'New manufacturer status',
    enum: ManufacturerStatus,
    example: ManufacturerStatus.ACTIVE,
  })
  @IsEnum(ManufacturerStatus)
  status: ManufacturerStatus;
}

export class ManufacturerFiltersDto {
  @ApiPropertyOptional({
    description: 'Search term for name, email, or description',
    example: '',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: ManufacturerStatus,
    example: ManufacturerStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(ManufacturerStatus)
  status?: ManufacturerStatus;

  @ApiPropertyOptional({
    description: 'Filter by country',
    example: '',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;
}

export class ManufacturerQueryDto {
  @ApiPropertyOptional({
    description: 'Page number (default: 1)',
    example: 1,
    minimum: 1,
  })
  @IsOptional()
  @IsString()
  page?: string;

  @ApiPropertyOptional({
    description: 'Items per page (default: 10, max: 100)',
    example: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsString()
  limit?: string;

  @ApiPropertyOptional({
    description: 'Search term for name, email, or description',
    example: '',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: ManufacturerStatus,
    example: ManufacturerStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(ManufacturerStatus)
  status?: ManufacturerStatus;

  @ApiPropertyOptional({
    description: 'Filter by country',
    example: '',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @ApiPropertyOptional({
    description: 'Filter by state',
    example: '',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @ApiPropertyOptional({
    description: 'Include brands in response',
    example: true,
    type: Boolean,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return Boolean(value);
  })
  @IsBoolean()
  includeBrands?: boolean;

  @ApiPropertyOptional({
    description: 'Include products in response',
    example: true,
    type: Boolean,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return Boolean(value);
  })
  @IsBoolean()
  includeProducts?: boolean;

  @ApiPropertyOptional({
    description: 'Include user audit information (createdBy, updatedBy, etc.)',
    example: false,
    type: Boolean,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return Boolean(value);
  })
  @IsBoolean()
  includeAuditInfo?: boolean;
}
