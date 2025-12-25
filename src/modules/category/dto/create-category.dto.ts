import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({
    description: 'Category name',
    example: 'Beverages',
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  name: string;

  @ApiProperty({
    description: 'Category description',
    example: 'Soft drinks, juices, energy drinks and water',
    required: false,
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => value?.trim())
  description?: string;

  @ApiProperty({
    description: 'Parent category ID for subcategories',
    example: 'b8e6cc4d-9e52-4a3b-9c6d-1f2a3b4c5d6e',
    required: false,
  })
  @IsOptional()
  @Matches(/^c[a-z0-9]{24}$/, {
    message: 'ParentId must be a valid ObjectId',
  })
  parentId?: string;

  @ApiProperty({
    description: 'Sort order for display',
    example: 1,
    required: false,
    default: 0,
  })
  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? parseInt(value, 10) : 0))
  sortOrder?: number = 0;
}
