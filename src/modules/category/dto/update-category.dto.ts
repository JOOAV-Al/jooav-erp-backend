import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsString,
  IsOptional,
  MaxLength,
  MinLength,
  IsUUID,
  IsBoolean,
  Matches,
} from 'class-validator';

export class UpdateCategoryDto {
  @ApiProperty({
    description: 'Category name',
    example: 'Electronics',
    minLength: 2,
    maxLength: 100,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  name?: string;

  @ApiProperty({
    description: 'Category description',
    example: 'Electronic devices and accessories',
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
  })
  @IsOptional()
  @Transform(({ value }) =>
    value !== undefined ? parseInt(value, 10) : undefined,
  )
  sortOrder?: number;

  @ApiProperty({
    description: 'Whether the category is active',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
