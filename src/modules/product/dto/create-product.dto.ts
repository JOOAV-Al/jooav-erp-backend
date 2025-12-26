import {
  IsString,
  IsOptional,
  IsDecimal,
  IsDateString,
  IsArray,
  IsUrl,
  IsNotEmpty,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Decimal } from '@prisma/client/runtime/library';

export class CreateProductDto {
  @ApiProperty({
    description: 'Product description',
    example:
      'Delicious instant noodles with chicken flavor, perfect for quick meals',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    description: 'Product barcode (UPC/EAN) - Auto-generated if not provided',
    example: '8901058005042',
    required: false,
  })
  @IsOptional()
  @IsString()
  barcode?: string;

  @ApiProperty({
    description: 'NAFDAC registration number (for Nigerian products)',
    example: 'A1-1234',
  })
  @IsOptional()
  @IsString()
  nafdacNumber?: string;

  @ApiProperty({
    description: 'Brand ID that this product belongs to',
    example: '',
  })
  @IsNotEmpty()
  @Matches(/^c[a-z0-9]{24}$/, {
    message: 'brandId must be a valid ObjectId',
  })
  brandId: string;

  @ApiProperty({
    description: 'Category ID (can be a subcategory)',
    example: '',
  })
  @IsNotEmpty()
  @Matches(/^c[a-z0-9]{24}$/, {
    message: 'categoryId must be a valid ObjectId',
  })
  categoryId: string;

  @ApiProperty({
    description: 'Product variant/flavor',
    example: 'Chicken Curry',
    maxLength: 100,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  variant: string;

  @ApiProperty({
    description: 'Pack size with unit',
    example: '70g',
    maxLength: 50,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  packSize: string;

  @ApiProperty({
    description: 'Packaging type',
    example: 'Single Pack',
    maxLength: 50,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  packagingType: string;

  @ApiProperty({
    description: 'Wholesale price in Naira',
    example: 120.0,
    type: 'number',
    format: 'decimal',
  })
  @IsNotEmpty()
  @Transform(({ value }) => (value ? new Decimal(value) : undefined))
  // @IsDecimal()
  price: Decimal;

  @ApiPropertyOptional({
    description: 'Expiry date for perishable goods',
    example: '2025-12-31T23:59:59Z',
    format: 'date-time',
  })
  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @ApiPropertyOptional({
    description: 'Array of product image URLs (first one becomes primary)',
    example: [
      'https://example.com/indomie-chicken.jpg',
      'https://example.com/indomie-chicken-back.jpg',
    ],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  images?: string[];
}
