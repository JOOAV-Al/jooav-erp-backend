import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Decorator to set required roles for accessing a route
 *
 * @param roles Array of UserRole enum values
 *
 * @example
 * @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
 * @Get('admin-only')
 * adminOnlyEndpoint() {
 *   // This endpoint requires ADMIN or SUPER_ADMIN role
 * }
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
