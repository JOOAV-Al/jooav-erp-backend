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

  @IsOptional()
  @IsString()
  barcode?: string;

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
    description: 'Variant ID that this product belongs to',
    example: 'cmj123456789',
  })
  @IsNotEmpty()
  @Matches(/^c[a-z0-9]{24}$/, {
    message: 'variantId must be a valid ObjectId',
  })
  variantId: string;

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

  @ApiPropertyOptional({
    description: 'Wholesale price in Naira',
    example: 120.0,
    type: 'number',
    format: 'decimal',
  })
  @IsOptional()
  @Transform(({ value }) =>
    value !== null && value !== undefined && value !== ''
      ? new Decimal(value)
      : undefined,
  )
  // @IsDecimal()
  price?: Decimal;

  @ApiPropertyOptional({
    description: 'Discount percentage (0-100)',
    example: 15.5,
    type: 'number',
    format: 'decimal',
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @Transform(({ value }) =>
    value !== null && value !== undefined && value !== ''
      ? new Decimal(value)
      : undefined,
  )
  discount?: Decimal;

  @ApiPropertyOptional({
    description: 'Primary thumbnail image URL',
    example: 'https://example.com/indomie-chicken-thumb.jpg',
  })
  @IsOptional()
  @IsUrl()
  thumbnail?: string;

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
