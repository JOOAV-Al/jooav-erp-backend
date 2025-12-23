import { Module } from '@nestjs/common';
import { AdminAuthModule } from './auth/admin-auth.module';
import { AdminManagementModule } from './management/admin-management.module';

@Module({
  imports: [AdminAuthModule, AdminManagementModule],
  exports: [AdminAuthModule, AdminManagementModule],
})
export class AdminModule {}
