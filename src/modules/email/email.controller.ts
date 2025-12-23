import { Controller, Post, Body, Get, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { EmailService } from '../../common/services/email.service';
import { AdminJwtAuthGuard } from '../../admin/auth/guards/admin-jwt-auth.guard';

export class SendEmailDto {
  to: string;
  subject: string;
  templateName?: string;
  variables?: Record<string, any>;
  html?: string;
  text?: string;
}

@ApiTags('Email')
@Controller('email')
@UseGuards(AdminJwtAuthGuard)
@ApiBearerAuth('admin-access-token')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Get('status')
  @ApiOperation({ summary: 'Get email service status' })
  @ApiResponse({ status: 200, description: 'Email service status' })
  getStatus() {
    return {
      status: 'success',
      data: this.emailService.getStatus(),
    };
  }

  @Post('send')
  @ApiOperation({ summary: 'Send a custom email' })
  @ApiBody({ type: SendEmailDto })
  @ApiResponse({ status: 200, description: 'Email sent successfully' })
  @ApiResponse({ status: 400, description: 'Invalid email data' })
  async sendEmail(@Body() emailData: SendEmailDto) {
    let success = false;

    if (emailData.templateName) {
      // Send templated email
      success = await this.emailService.sendTemplatedEmail(
        emailData.to,
        emailData.templateName,
        emailData.variables || {},
      );
    } else if (emailData.html || emailData.text) {
      // Send custom email
      success = await this.emailService.sendEmail({
        to: emailData.to,
        subject: emailData.subject,
        html: emailData.html || '',
        text: emailData.text,
      });
    } else {
      return {
        status: 'error',
        message: 'Either templateName or html/text content is required',
      };
    }

    return {
      status: success ? 'success' : 'error',
      message: success ? 'Email sent successfully' : 'Failed to send email',
    };
  }

  @Post('test/welcome')
  @ApiOperation({ summary: 'Send test welcome email' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        to: { type: 'string', format: 'email' },
        name: { type: 'string' },
      },
      required: ['to'],
    },
  })
  async sendTestWelcome(@Body() data: { to: string; name?: string }) {
    const success = await this.emailService.sendTemplatedEmail(
      data.to,
      'welcome',
      { name: data.name || 'Test User' },
    );

    return {
      status: success ? 'success' : 'error',
      message: success ? 'Welcome email sent' : 'Failed to send welcome email',
    };
  }

  @Post('test/login-notification')
  @ApiOperation({ summary: 'Send test login notification' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        to: { type: 'string', format: 'email' },
        name: { type: 'string' },
        ipAddress: { type: 'string' },
        userAgent: { type: 'string' },
      },
      required: ['to'],
    },
  })
  async sendTestLoginNotification(
    @Body()
    data: {
      to: string;
      name?: string;
      ipAddress?: string;
      userAgent?: string;
    },
  ) {
    const success = await this.emailService.sendTemplatedEmail(
      data.to,
      'loginNotification',
      {
        name: data.name || 'Test User',
        loginTime: new Date().toLocaleString(),
        ipAddress: data.ipAddress || '192.168.1.1',
        userAgent: data.userAgent || 'Test Browser',
      },
    );

    return {
      status: success ? 'success' : 'error',
      message: success
        ? 'Login notification sent'
        : 'Failed to send notification',
    };
  }

  @Post('test/password-reset')
  @ApiOperation({ summary: 'Send test password reset email' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        to: { type: 'string', format: 'email' },
        name: { type: 'string' },
        resetUrl: { type: 'string' },
        expiresIn: { type: 'string' },
      },
      required: ['to'],
    },
  })
  async sendTestPasswordReset(
    @Body()
    data: {
      to: string;
      name?: string;
      resetUrl?: string;
      expiresIn?: string;
    },
  ) {
    const success = await this.emailService.sendTemplatedEmail(
      data.to,
      'passwordReset',
      {
        name: data.name || 'Test User',
        resetUrl: data.resetUrl || 'https://example.com/reset',
        expiresIn: data.expiresIn || '1 hour',
      },
    );

    return {
      status: success ? 'success' : 'error',
      message: success
        ? 'Password reset email sent'
        : 'Failed to send reset email',
    };
  }

  @Post('test/password-changed')
  @ApiOperation({ summary: 'Send test password changed confirmation' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        to: { type: 'string', format: 'email' },
        name: { type: 'string' },
        ipAddress: { type: 'string' },
        userAgent: { type: 'string' },
      },
      required: ['to'],
    },
  })
  async sendTestPasswordChanged(
    @Body()
    data: {
      to: string;
      name?: string;
      ipAddress?: string;
      userAgent?: string;
    },
  ) {
    const success = await this.emailService.sendTemplatedEmail(
      data.to,
      'passwordChanged',
      {
        name: data.name || 'Test User',
        changeTime: new Date().toLocaleString(),
        ipAddress: data.ipAddress || '192.168.1.1',
        userAgent: data.userAgent || 'Test Browser',
      },
    );

    return {
      status: success ? 'success' : 'error',
      message: success
        ? 'Password changed confirmation sent'
        : 'Failed to send confirmation',
    };
  }

  @Post('test/password-reset-success')
  @ApiOperation({ summary: 'Send test password reset success confirmation' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        to: { type: 'string', format: 'email' },
        name: { type: 'string' },
        ipAddress: { type: 'string' },
        userAgent: { type: 'string' },
      },
      required: ['to'],
    },
  })
  async sendTestPasswordResetSuccess(
    @Body()
    data: {
      to: string;
      name?: string;
      ipAddress?: string;
      userAgent?: string;
    },
  ) {
    const success = await this.emailService.sendTemplatedEmail(
      data.to,
      'passwordResetSuccess',
      {
        name: data.name || 'Test User',
        resetTime: new Date().toLocaleString(),
        ipAddress: data.ipAddress || '192.168.1.1',
        userAgent: data.userAgent || 'Test Browser',
      },
    );

    return {
      status: success ? 'success' : 'error',
      message: success
        ? 'Password reset success confirmation sent'
        : 'Failed to send confirmation',
    };
  }
}
