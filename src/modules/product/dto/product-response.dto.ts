import { ApiProperty } from '@nestjs/swagger';
import { Decimal } from '@prisma/client/runtime/library';
import { JsonValue } from '@prisma/client/runtime/library';

export class ProductResponseDto {
  @ApiProperty({
    description: 'Product ID',
    example: 'cm123jkl-1234-5678-90ab-123456789jkl',
  })
  id: string;

  @ApiProperty({
    description: 'Product name (auto-generated)',
    example: 'Indomie Chicken Curry 70g (Single Pack)',
  })
  name: string;

  @ApiProperty({
    description: 'Product description',
    example:
      'Delicious instant noodles with chicken flavor, perfect for quick meals',
    required: false,
  })
  description: string | null;

  @ApiProperty({
    description: 'Product SKU (auto-generated)',
    example: 'INDOMIE-CHICKEN-CURRY-70G-SINGLE-PACK',
  })
  sku: string;

  // Barcode field removed but barcode generation function kept for future use
  // @ApiProperty({
  //   description: 'Product barcode',
  //   example: '8901058005042',
  //   required: false,
  // })
  // barcode: string | null;

  @ApiProperty({
    description: 'NAFDAC registration number',
    example: 'A1-1234',
    required: false,
  })
  nafdacNumber: string | null;

  @ApiProperty({
    description: 'Brand ID',
    example: 'cm123def-1234-5678-90ab-123456789def',
  })
  brandId: string;

  @ApiProperty({
    description: 'Category ID',
    example: 'cm123def-1234-5678-90ab-123456789def',
  })
  categoryId: string;

  @ApiProperty({
    description: 'Manufacturer ID',
    example: 'cm123ghi-1234-5678-90ab-123456789ghi',
  })
  manufacturerId: string;

  @ApiProperty({
    description: 'Variant ID',
    example: 'cm123var-1234-5678-90ab-123456789var',
  })
  variantId: string;

  @ApiProperty({
    description: 'Pack size',
    example: '70g',
  })
  packSize: string;

  @ApiProperty({
    description: 'Packaging type',
    example: 'Single Pack',
  })
  packagingType: string;

  @ApiProperty({
    description: 'Wholesale price in Naira',
    example: 120.0,
    type: 'number',
  })
  price: Decimal;

  @ApiProperty({
    description: 'Discount percentage (0-100)',
    example: 15.5,
    type: 'number',
    required: false,
  })
  discount: Decimal | null;

  @ApiProperty({
    description: 'Primary thumbnail image URL',
    example: 'https://example.com/indomie-chicken-thumb.jpg',
    required: false,
  })
  thumbnail: string | null;

  @ApiProperty({
    description: 'Product images',
    example: ['https://example.com/indomie-chicken.jpg'],
    type: [String],
  })
  images: JsonValue[];

  @ApiProperty({
    description: 'Is product active',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Created by user ID',
    example: 'cm123xyz-1234-5678-90ab-123456789xyz',
  })
  createdBy: string;

  @ApiProperty({
    description: 'Updated by user ID',
    example: 'cm123xyz-1234-5678-90ab-123456789xyz',
  })
  updatedBy: string;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2024-12-25T10:30:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2024-12-25T12:45:00Z',
  })
  updatedAt: Date;

  @ApiProperty({
    description: 'Brand information',
    required: false,
  })
  brand?: {
    id: string;
    name: string;
  };

  @ApiProperty({
    description: 'Variant information',
    required: false,
  })
  variant?: {
    id: string;
    name: string;
    description?: string | null;
  };

  @ApiProperty({
    description: 'Category information',
    required: false,
  })
  category?: {
    id: string;
    name: string;
    slug: string;
    parent?: {
      id: string;
      name: string;
      slug: string;
    } | null;
  };

  @ApiProperty({
    description: 'Manufacturer information',
    required: false,
  })
  manufacturer?: {
    id: string;
    name: string;
  };
}
