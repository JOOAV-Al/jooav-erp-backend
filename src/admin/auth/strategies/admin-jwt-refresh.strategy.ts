import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserRole } from '@prisma/client';
import { AdminAuthService } from '../admin-auth.service';

@Injectable()
export class AdminJwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'admin-jwt-refresh',
) {
  constructor(
    private configService: ConfigService,
    private adminAuthService: AdminAuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      ignoreExpiration: false,
      secretOrKey: configService.get('security.jwtSecret') || 'your-secret-key',
    });
  }

  async validate(payload: any) {
    // Ensure this is an admin refresh token
    if (payload.type !== 'admin-refresh') {
      throw new UnauthorizedException('Invalid admin refresh token');
    }

    // Validate that the admin user still exists and is active
    const admin = await this.adminAuthService.validateAdminById(payload.sub);
    if (!admin) {
      throw new UnauthorizedException('Admin account not found or inactive');
    }

    // Ensure the user still has admin privileges (SUPER_ADMIN or ADMIN)
    if (admin.role !== UserRole.SUPER_ADMIN && admin.role !== UserRole.ADMIN) {
      throw new UnauthorizedException('Admin privileges required');
    }

    return admin;
  }
}
