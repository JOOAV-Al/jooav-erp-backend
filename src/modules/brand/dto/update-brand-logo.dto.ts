import { ApiProperty } from '@nestjs/swagger';

export class UpdateBrandLogoDto {
  @ApiProperty({
    description: 'Brand logo file (JPEG, PNG, GIF)',
    type: 'string',
    format: 'binary',
    example: 'nestle-logo.png',
  })
  logo: Express.Multer.File;
}
