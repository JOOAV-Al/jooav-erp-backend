import { registerAs } from '@nestjs/config';
import * as Joi from 'joi';

export const swaggerConfig = registerAs('swagger', () => ({
  title: process.env.SWAGGER_TITLE || 'JOOAV ERP API',
  description:
    process.env.SWAGGER_DESCRIPTION ||
    'Enterprise Resource Planning System API',
  version: process.env.SWAGGER_VERSION || '1.0',
  tag: process.env.SWAGGER_TAG || 'api',
}));

export const swaggerConfigSchema = {
  SWAGGER_TITLE: Joi.string().default('JOOAV ERP API'),
  SWAGGER_DESCRIPTION: Joi.string().default(
    'Enterprise Resource Planning System API',
  ),
  SWAGGER_VERSION: Joi.string().default('1.0'),
  SWAGGER_TAG: Joi.string().default('api'),
};

export interface SwaggerConfig {
  title: string;
  description: string;
  version: string;
  tag: string;
}
