import { Module } from '@nestjs/common';

import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { CloudinaryModule } from '../../common/services/cloudinary.module';
import { AuditLogModule } from '../../common/services/audit-log.module';

@Module({
  imports: [PrismaModule, CloudinaryModule, AuditLogModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
