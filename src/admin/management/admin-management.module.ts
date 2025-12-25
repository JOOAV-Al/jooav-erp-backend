import { Module } from '@nestjs/common';
import { AdminManagementController } from './admin-management.controller';
import { AdminManagementService } from './admin-management.service';
import { PrismaService } from '../../modules/prisma/prisma.service';
import { AuditService } from '../../modules/audit/audit.service';

@Module({
  controllers: [AdminManagementController],
  providers: [AdminManagementService, PrismaService, AuditService],
  exports: [AdminManagementService],
})
export class AdminManagementModule {}
