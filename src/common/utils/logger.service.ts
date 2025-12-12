import {
  utilities as nestWinstonModuleUtilities,
  WinstonModule,
} from 'nest-winston';
import * as winston from 'winston';
import 'winston-daily-rotate-file';
import { ConfigService } from '@nestjs/config';

export class LoggerService {
  static createWinstonLogger(configService: ConfigService): winston.Logger {
    const logLevel = configService.get('logging.level', 'info');
    const logFormat = configService.get('logging.format', 'json');
    const nodeEnv = configService.get('app.nodeEnv', 'development');

    // Define log format based on environment
    const loggerFormat = winston.format.combine(
      winston.format.timestamp(),
      winston.format.ms(),
      winston.format.errors({ stack: true }),
      nodeEnv === 'development'
        ? winston.format.combine(
            winston.format.colorize({ all: true }),
            winston.format.printf(
              ({ timestamp, level, message, context, trace, ...meta }) => {
                return `${timestamp} [${context || 'Application'}] ${level}: ${message}${
                  trace ? `\n${trace}` : ''
                }${Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : ''}`;
              },
            ),
          )
        : winston.format.combine(
            winston.format.json(),
            winston.format.printf(
              ({ timestamp, level, message, context, trace, ...meta }) => {
                return JSON.stringify({
                  timestamp,
                  level: level.replace(/\u001b\[.*?m/g, ''), // Remove ANSI colors
                  context: context || 'Application',
                  message,
                  ...(trace ? { trace } : {}),
                  ...meta,
                });
              },
            ),
          ),
    );

    const transports: winston.transport[] = [
      // Console transport
      new winston.transports.Console({
        level: logLevel,
        format: loggerFormat,
      }),
    ];

    // File transports for production
    if (nodeEnv === 'production') {
      // General application logs
      transports.push(
        new winston.transports.DailyRotateFile({
          filename: configService.get(
            'logging.filename',
            'logs/app-%DATE%.log',
          ),
          datePattern: configService.get('logging.datePattern', 'YYYY-MM-DD'),
          maxSize: configService.get('logging.maxSize', '20m'),
          maxFiles: configService.get('logging.maxFiles', 14),
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
          ),
        }),
      );

      // Error logs
      transports.push(
        new winston.transports.DailyRotateFile({
          filename: configService.get(
            'logging.errorFilename',
            'logs/error-%DATE%.log',
          ),
          datePattern: configService.get('logging.datePattern', 'YYYY-MM-DD'),
          level: 'error',
          maxSize: configService.get('logging.maxSize', '20m'),
          maxFiles: configService.get('logging.maxFiles', 14),
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
          ),
        }),
      );
    }

    return winston.createLogger({
      level: logLevel,
      format: loggerFormat,
      transports,
      // Don't exit on handled exceptions
      exitOnError: false,
      // Handle uncaught exceptions
      exceptionHandlers: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.json(),
          ),
        }),
      ],
      // Handle unhandled promise rejections
      rejectionHandlers: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.json(),
          ),
        }),
      ],
    });
  }

  static createNestWinstonLogger(configService: ConfigService) {
    return WinstonModule.createLogger({
      instance: LoggerService.createWinstonLogger(configService),
    });
  }
}

// Custom logger for specific use cases
export class AppLogger {
  private static instance: winston.Logger;

  static getInstance(configService?: ConfigService): winston.Logger {
    if (!AppLogger.instance && configService) {
      AppLogger.instance = LoggerService.createWinstonLogger(configService);
    }
    return AppLogger.instance;
  }

  static log(level: string, message: string, context?: string, meta?: any) {
    if (AppLogger.instance) {
      AppLogger.instance.log(level, message, { context, ...meta });
    }
  }

  static error(message: string, trace?: string, context?: string, meta?: any) {
    if (AppLogger.instance) {
      AppLogger.instance.error(message, { context, trace, ...meta });
    }
  }

  static warn(message: string, context?: string, meta?: any) {
    if (AppLogger.instance) {
      AppLogger.instance.warn(message, { context, ...meta });
    }
  }

  static info(message: string, context?: string, meta?: any) {
    if (AppLogger.instance) {
      AppLogger.instance.info(message, { context, ...meta });
    }
  }

  static debug(message: string, context?: string, meta?: any) {
    if (AppLogger.instance) {
      AppLogger.instance.debug(message, { context, ...meta });
    }
  }

  static verbose(message: string, context?: string, meta?: any) {
    if (AppLogger.instance) {
      AppLogger.instance.verbose(message, { context, ...meta });
    }
  }
}
