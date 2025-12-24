import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { BrandStatus } from '@prisma/client';

export class UpdateBrandStatusDto {
  @ApiProperty({
    description: 'Brand status',
    enum: BrandStatus,
    example: BrandStatus.ACTIVE,
    enumName: 'BrandStatus',
  })
  @IsNotEmpty()
  @IsEnum(BrandStatus, {
    message: 'Status must be either ACTIVE or INACTIVE',
  })
  status: BrandStatus;
}
