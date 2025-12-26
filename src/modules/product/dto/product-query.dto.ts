import {
  IsOptional,
  IsString,
  IsBoolean,
  IsUUID,
  Matches,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ProductQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by brand ID',
    example: '',
  })
  @IsOptional()
  @Matches(/^c[a-z0-9]{24}$/, {
    message: 'brandId must be a valid ObjectId',
  })
  brandId?: string;

  @ApiPropertyOptional({
    description: 'Filter by category ID',
    example: '',
  })
  @IsOptional()
  @Matches(/^c[a-z0-9]{24}$/, {
    message: 'categoryId must be a valid ObjectId',
  })
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Filter by product variant',
    example: '',
  })
  @IsOptional()
  @IsString()
  variant?: string;

  @ApiPropertyOptional({
    description: 'Filter by active status',
    example: true,
    type: 'boolean',
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return value;
  })
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Include related data (brand, category, manufacturer)',
    example: true,
    type: 'boolean',
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return value;
  })
  includeRelations?: boolean;
}
