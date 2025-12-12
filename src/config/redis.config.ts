import { registerAs } from '@nestjs/config';
import * as Joi from 'joi';

export const redisConfig = registerAs('redis', () => ({
  url: process.env.REDIS_URL,
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
  retryAttempts: parseInt(process.env.REDIS_RETRY_ATTEMPTS || '3', 10),
  retryDelay: parseInt(process.env.REDIS_RETRY_DELAY || '1000', 10),
}));

export const redisConfigSchema = {
  REDIS_URL: Joi.string().optional(),
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().port().default(6379),
  REDIS_PASSWORD: Joi.string().optional(),
  REDIS_RETRY_ATTEMPTS: Joi.number().min(1).default(3),
  REDIS_RETRY_DELAY: Joi.number().min(100).default(1000),
};

export interface RedisConfig {
  url?: string;
  host: string;
  port: number;
  password?: string;
  retryAttempts: number;
  retryDelay: number;
}
