import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ADMIN_ROLES_KEY } from '../guards/admin-roles.guard';

export const AdminRoles = (...roles: UserRole[]) =>
  SetMetadata(ADMIN_ROLES_KEY, roles);
