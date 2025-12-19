import { registerAs } from '@nestjs/config';
import * as Joi from 'joi';

export const securityConfig = registerAs('security', () => ({
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  throttleTtl: parseInt(process.env.THROTTLE_TTL || '60000', 10) || 60000,
  throttleLimit: parseInt(process.env.THROTTLE_LIMIT || '10', 10) || 10,
}));

export const securityConfigSchema = {
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('1d'),
  THROTTLE_TTL: Joi.number().positive().default(60000),
  THROTTLE_LIMIT: Joi.number().positive().default(10),
};

export interface SecurityConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  throttleTtl: number;
  throttleLimit: number;
}
