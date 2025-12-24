import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

/**
 * Unified Authentication Guard
 *
 * Accepts both regular user tokens and admin tokens.
 * Tries user JWT strategy first, then admin JWT strategy.
 *
 * Usage:
 * @UseGuards(UnifiedAuthGuard)
 * @Roles('USER', 'ADMIN', 'SUPER_ADMIN')
 */
@Injectable()
export class UnifiedAuthGuard extends AuthGuard(['jwt', 'admin-jwt']) {
  constructor() {
    super();
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    // If we have a valid user from either strategy, return it
    if (user) {
      return user;
    }

    // If no user and there's an error, handle it
    if (err || !user) {
      const request = context.switchToHttp().getRequest();
      const authHeader = request.headers?.authorization;

      if (!authHeader) {
        throw new UnauthorizedException('Access token required');
      }

      if (info?.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Token has expired');
      }

      if (info?.name === 'JsonWebTokenError') {
        throw new UnauthorizedException('Invalid token');
      }

      throw new UnauthorizedException('Authentication failed');
    }

    return user;
  }
}
