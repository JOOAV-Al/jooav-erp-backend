import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ManufacturerStatus } from '@prisma/client';

export class UserInfoDto {
  @ApiProperty({
    description: 'User ID',
    example: 'clp12345678',
  })
  id: string;

  @ApiProperty({
    description: 'User email',
    example: 'admin@jooav.com',
  })
  email: string;

  @ApiProperty({
    description: 'User full name',
    example: 'John Doe',
  })
  name: string;
}

export class ManufacturerProductDto {
  @ApiProperty({
    description: 'Product ID',
    example: 'clp98765432',
  })
  id: string;

  @ApiProperty({
    description: 'Product name',
    example: 'Nestle WH-1000XM5 Headphones',
  })
  name: string;

  @ApiProperty({
    description: 'Product SKU',
    example: 'Nestle-WH1000XM5-BLK',
  })
  sku: string;

  @ApiProperty({
    description: 'Product status',
    example: 'ACTIVE',
  })
  status: string;

  @ApiProperty({
    description: 'Product price',
    example: 399.99,
  })
  price: number;
}

export class ManufacturerResponseDto {
  @ApiProperty({
    description: 'Manufacturer ID',
    example: 'clp12345678',
  })
  id: string;

  @ApiProperty({
    description: 'Manufacturer name',
    example: 'Nestle',
  })
  name: string;

  @ApiPropertyOptional({
    description: 'Manufacturer description',
    example: 'Leading manufacturer of beverages',
  })
  description?: string;

  @ApiProperty({
    description: 'Contact email address',
    example: 'contact@nestle.com',
  })
  email: string;

  @ApiProperty({
    description: 'Contact phone number',
    example: '+1-555-123-4567',
  })
  phone: string;

  @ApiPropertyOptional({
    description: 'Company website URL',
    example: 'https://www.nestle.com',
  })
  website?: string;

  @ApiProperty({
    description: 'Street address',
    example: '1-7-1 Konan, Minato-ku',
  })
  address: string;

  @ApiProperty({
    description: 'City',
    example: 'Lagos',
  })
  city: string;

  @ApiProperty({
    description: 'State or province',
    example: 'Lagos',
  })
  state: string;

  @ApiProperty({
    description: 'Country',
    example: 'Nigeria',
  })
  country: string;

  @ApiPropertyOptional({
    description: 'Postal/ZIP code',
    example: '108-0075',
  })
  postalCode?: string;

  @ApiPropertyOptional({
    description: 'Business registration number',
    example: 'TK-123456789',
  })
  registrationNumber?: string;

  @ApiProperty({
    description: 'Manufacturer status',
    enum: ManufacturerStatus,
    example: ManufacturerStatus.ACTIVE,
  })
  status: ManufacturerStatus;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2024-01-15T10:30:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2024-01-15T10:30:00Z',
  })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'User who created this manufacturer',
    type: UserInfoDto,
  })
  createdBy?: UserInfoDto;

  @ApiPropertyOptional({
    description: 'User who last updated this manufacturer',
    type: UserInfoDto,
  })
  updatedBy?: UserInfoDto;

  @ApiProperty({
    description: 'Number of products by this manufacturer',
    example: 25,
  })
  productsCount: number;

  @ApiProperty({
    description: 'Number of orders for this manufacturer',
    example: 150,
  })
  ordersCount: number;

  @ApiPropertyOptional({
    description: 'Recent products (limited to 10)',
    type: [ManufacturerProductDto],
  })
  products?: ManufacturerProductDto[];
}

export class ManufacturerStatsDto {
  @ApiProperty({
    description: 'Total number of manufacturers',
    example: 45,
  })
  total: number;

  @ApiProperty({
    description: 'Number of active manufacturers',
    example: 40,
  })
  active: number;

  @ApiProperty({
    description: 'Number of inactive manufacturers',
    example: 3,
  })
  inactive: number;

  @ApiProperty({
    description: 'Number of suspended manufacturers',
    example: 2,
  })
  suspended: number;

  @ApiProperty({
    description: 'Number of manufacturers created this month',
    example: 5,
  })
  createdThisMonth: number;

  @ApiProperty({
    description: 'Top countries by manufacturer count',
    example: [
      { country: 'Nigeria', count: 15 },
      { country: 'USA', count: 12 },
      { country: 'Germany', count: 8 },
    ],
  })
  topCountries: Array<{ country: string; count: number }>;
}
