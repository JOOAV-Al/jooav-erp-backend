import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('Application')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Get application status' })
  @ApiResponse({ status: 200, description: 'Application is running' })
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('debug-sentry')
  @ApiOperation({
    summary: 'Test Sentry error tracking',
    description:
      'This endpoint intentionally throws an error to test Sentry integration',
  })
  @ApiResponse({ status: 500, description: 'Intentional error for testing' })
  getSentryError(): string {
    throw new Error('My first Sentry error!');
  }
}
