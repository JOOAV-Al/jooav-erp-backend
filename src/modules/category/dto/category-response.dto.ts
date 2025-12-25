import { ApiProperty } from '@nestjs/swagger';

export class CategoryResponseDto {
  @ApiProperty({ example: 'b8e6cc4d-9e52-4a3b-9c6d-1f2a3b4c5d6e' })
  id: string;

  @ApiProperty({ example: 'Beverages' })
  name: string;

  @ApiProperty({ example: 'beverages' })
  slug: string;

  @ApiProperty({
    example: 'Soft drinks, juices, energy drinks and water',
    nullable: true,
  })
  description: string | null;

  @ApiProperty({
    example: 'a8e6cc4d-9e52-4a3b-9c6d-1f2a3b4c5d6f',
    nullable: true,
  })
  parentId: string | null;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: 1 })
  sortOrder: number;

  @ApiProperty({ example: 'c9f7cc4d-9e52-4a3b-9c6d-1f2a3b4c5d6e' })
  createdBy: string;

  @ApiProperty({ example: 'c9f7cc4d-9e52-4a3b-9c6d-1f2a3b4c5d6e' })
  updatedBy: string;

  @ApiProperty({ example: '2023-12-08T10:30:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2023-12-08T10:30:00.000Z' })
  updatedAt: Date;

  @ApiProperty({
    description: 'Product count in this category',
    example: 25,
  })
  productCount?: number;

  @ApiProperty({
    description: 'Child categories (subcategories)',
    type: [CategoryResponseDto],
    required: false,
  })
  children?: CategoryResponseDto[];

  @ApiProperty({
    description: 'Parent category information',
    type: CategoryResponseDto,
    required: false,
  })
  parent?: CategoryResponseDto;
}
