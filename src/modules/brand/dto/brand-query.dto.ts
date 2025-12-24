import { IsOptional, IsString, IsEnum, IsUUID, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BrandStatus } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class BrandQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: BrandStatus,
    description: 'Filter by brand status',
  })
  @IsOptional()
  @IsEnum(BrandStatus)
  status?: BrandStatus;

  @ApiPropertyOptional({ description: 'Filter by manufacturer ID' })
  @IsOptional()
  @Matches(/^c[a-z0-9]{24}$/, {
    message: 'manufacturerId must be a valid ObjectId',
  })
  manufacturerId?: string;

  @ApiPropertyOptional({
    description: 'Sort by field',
    enum: ['name', 'createdAt', 'updatedAt'],
  })
  @IsOptional()
  @IsString()
  sortBy?: 'name' | 'createdAt' | 'updatedAt';

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['asc', 'desc'],
  })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';
}
