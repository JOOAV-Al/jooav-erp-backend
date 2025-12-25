import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString, ArrayNotEmpty } from 'class-validator';

export class BulkCategoryOperationDto {
  @ApiProperty({
    description: 'Array of FMCG category IDs to perform bulk operation on',
    example: [
      'b8e6cc4d-9e52-4a3b-9c6d-1f2a3b4c5d6e', // Beverages
      'c9f7dd4d-9e52-4a3b-9c6d-1f2a3b4c5d6f', // Snacks
      'd0g8ee4d-9e52-4a3b-9c6d-1f2a3b4c5d70', // Personal Care
    ],
    type: [String],
  })
  @IsArray({ message: 'Category IDs must be an array' })
  @ArrayNotEmpty({ message: 'Category IDs array cannot be empty' })
  @IsString({ each: true, message: 'Each category ID must be a string' })
  categoryIds: string[];
}
