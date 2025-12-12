import { SetMetadata } from '@nestjs/common';

export const AUDIT_LOG_KEY = 'audit_log';

export interface AuditLogOptions {
  action: string;
  resource: string;
  includeRequestBody?: boolean;
  includeResponseBody?: boolean;
}

/**
 * Decorator to automatically create audit logs for controller methods
 *
 * @param options Configuration for the audit log
 *
 * @example
 * @AuditLog({ action: 'CREATE', resource: 'USER' })
 * @Post()
 * createUser(@Body() createUserDto: CreateUserDto) {
 *   // Implementation
 * }
 */
export const AuditLog = (options: AuditLogOptions) =>
  SetMetadata(AUDIT_LOG_KEY, options);
