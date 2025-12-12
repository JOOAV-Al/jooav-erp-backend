import { registerAs } from '@nestjs/config';
import * as Joi from 'joi';

export const loggingConfig = registerAs('logging', () => ({
  level: process.env.LOG_LEVEL || 'info',
  format: process.env.LOG_FORMAT || 'json',
  filename: process.env.LOG_FILENAME || 'logs/app.log',
  errorFilename: process.env.LOG_ERROR_FILENAME || 'logs/error.log',
  maxSize: process.env.LOG_MAX_SIZE || '20m',
  maxFiles: parseInt(process.env.LOG_MAX_FILES || '14', 10) || 14,
  datePattern: process.env.LOG_DATE_PATTERN || 'YYYY-MM-DD',
}));

export const loggingConfigSchema = {
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly')
    .default('info'),
  LOG_FORMAT: Joi.string().valid('json', 'simple', 'combined').default('json'),
  LOG_FILENAME: Joi.string().default('logs/app.log'),
  LOG_ERROR_FILENAME: Joi.string().default('logs/error.log'),
  LOG_MAX_SIZE: Joi.string().default('20m'),
  LOG_MAX_FILES: Joi.number().default(14),
  LOG_DATE_PATTERN: Joi.string().default('YYYY-MM-DD'),
};

export interface LoggingConfig {
  level: string;
  format: string;
  filename: string;
  errorFilename: string;
  maxSize: string;
  maxFiles: number;
  datePattern: string;
}
