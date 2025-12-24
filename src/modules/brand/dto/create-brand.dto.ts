import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { BrandStatus } from '@prisma/client';

export class CreateBrandDto {
  @ApiProperty({ example: 'Maggi', description: 'Brand name' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    example: 'Quality seasoning brand',
    description: 'Brand description',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    example: 'b8e6cc4d-9e52-4a3b-9c6d-1f2a3b4c5d6e',
    description: 'Manufacturer ID this brand belongs to',
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^c[a-z0-9]{24}$/, {
    message: 'manufacturerId must be a valid ObjectId',
  })
  manufacturerId: string;

  @ApiProperty({
    enum: BrandStatus,
    default: BrandStatus.ACTIVE,
    description: 'Brand status',
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toUpperCase();
    }
    return value;
  })
  @IsEnum(BrandStatus)
  status?: BrandStatus;
}
