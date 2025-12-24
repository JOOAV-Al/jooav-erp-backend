import { Module } from '@nestjs/common';
import { BrandService } from './brand.service';
import { BrandController } from './brand.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { CloudinaryService } from '../storage/cloudinary.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [BrandController],
  providers: [BrandService, CloudinaryService],
  exports: [BrandService],
})
export class BrandModule {}
