import { Module } from '@nestjs/common';
import { AdminManagementController } from './admin-management.controller';
import { AdminManagementService } from './admin-management.service';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogService } from '../../common/services/audit-log.service';

@Module({
  controllers: [AdminManagementController],
  providers: [AdminManagementService, PrismaService, AuditLogService],
  exports: [AdminManagementService],
})
export class AdminManagementModule {}
