import { ApiProperty } from '@nestjs/swagger';
import { BrandStatus } from '@prisma/client';

export class BrandResponseDto {
  @ApiProperty({ example: 'b8e6cc4d-9e52-4a3b-9c6d-1f2a3b4c5d6e' })
  id: string;

  @ApiProperty({ example: 'KitKat' })
  name: string;

  @ApiProperty({
    example:
      'https://res.cloudinary.com/jooav/image/upload/v1234567890/brands/kitkat-logo.png',
    nullable: true,
  })
  logo: string | null;

  @ApiProperty({
    example: 'Premium chocolate wafer bar for break moments',
    nullable: true,
  })
  description: string | null;

  @ApiProperty({ enum: BrandStatus })
  status: BrandStatus;

  @ApiProperty({ example: 'c9f7cc4d-9e52-4a3b-9c6d-1f2a3b4c5d6e' })
  manufacturerId: string;

  @ApiProperty({ example: '2023-01-01T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2023-01-01T00:00:00.000Z' })
  updatedAt: Date;

  @ApiProperty({ example: 'b8e6cc4d-9e52-4a3b-9c6d-1f2a3b4c5d6e' })
  createdBy: string;

  @ApiProperty({
    example: 'b8e6cc4d-9e52-4a3b-9c6d-1f2a3b4c5d6e',
    nullable: true,
  })
  updatedBy: string | null;

  manufacturer?: {
    id: string;
    name: string; // e.g., "Nestlé Nigeria PLC"
    status: string;
  };
}

export class BrandStatsDto {
  @ApiProperty({ example: 85, description: 'Total number of brands' })
  total: number;

  @ApiProperty({ example: 78, description: 'Number of active brands' })
  active: number;

  @ApiProperty({ example: 7, description: 'Number of inactive brands' })
  inactive: number;

  @ApiProperty({ example: 3, description: 'Brands added in last 7 days' })
  recentlyAdded: number;
}
