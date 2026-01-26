import { ApiProperty } from '@nestjs/swagger';

export class CategoryStatsDto {
  @ApiProperty({
    description: 'Total number of categories',
    example: 150,
  })
  total: number;

  @ApiProperty({
    description: 'Number of active categories',
    example: 120,
  })
  active: number;

  @ApiProperty({
    description: 'Number of parent (major) categories',
    example: 25,
  })
  parents: number;

  @ApiProperty({
    description: 'Number of subcategories',
    example: 95,
  })
  subcategories: number;

  @ApiProperty({
    description: 'Number of archived (soft deleted) categories',
    example: 30,
  })
  archived: number;

  @ApiProperty({
    description: 'Categories created this month',
    example: 5,
  })
  createdThisMonth: number;

  @ApiProperty({
    description: 'Average number of subcategories per parent category',
    example: 3.8,
  })
  avgSubcategoriesPerParent: number;

  @ApiProperty({
    description: 'Number of categories with products',
    example: 85,
  })
  categoriesWithProducts: number;
}
