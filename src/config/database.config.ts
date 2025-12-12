import { registerAs } from '@nestjs/config';
import * as Joi from 'joi';

export const databaseConfig = registerAs('database', () => ({
  url: process.env.DATABASE_URL,
  schema: process.env.DATABASE_SCHEMA || 'public',
}));

export const databaseConfigSchema = {
  DATABASE_URL: Joi.string().required(),
  DATABASE_SCHEMA: Joi.string().default('public'),
};

export interface DatabaseConfig {
  url: string;
  schema: string;
}
