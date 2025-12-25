import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsBoolean, Matches } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class CategoryQueryDto extends PaginationDto {
  @ApiProperty({
    description: 'Filter by parent category ID (null for major categories)',
    required: false,
    example: '',
  })
  @IsOptional()
  @Matches(/^c[a-z0-9]{24}$/, {
    message: 'ParentId must be a valid ObjectId',
  })
  parentId?: string;

  @ApiProperty({
    description: 'Filter by active status',
    required: false,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return undefined;
  })
  isActive?: boolean;

  @ApiProperty({
    description: 'Include product count in response',
    required: false,
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    if (value === undefined || value === null) return false;
    return false;
  })
  includeProductCount?: boolean = false;

  @ApiProperty({
    description: 'Include children (subcategories) in response',
    required: false,
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    if (value === undefined || value === null) return false;
    return false;
  })
  includeChildren?: boolean = false;
}
