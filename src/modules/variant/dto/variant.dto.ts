import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateVariantDto {
  @ApiProperty({
    description: 'Variant name',
    example: 'Chicken',
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    description: 'Variant description',
    example: 'Delicious chicken flavored variant',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    description: 'Brand ID that this variant belongs to',
    example: 'cmj123456789',
  })
  @IsString()
  @IsNotEmpty()
  brandId: string;
}

export class UpdateVariantDto {
  @ApiPropertyOptional({
    description: 'Variant name',
    example: 'Chicken',
    minLength: 2,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description: 'Variant description',
    example: 'Delicious chicken flavored variant',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: 'Brand ID that this variant belongs to',
    example: 'cmj123456789',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  brandId?: string;
}
