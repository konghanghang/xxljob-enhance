import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  // Database
  DATABASE_URL: Joi.string().required(),

  // JWT
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_TOKEN_EXPIRATION: Joi.string().default('1h'),
  JWT_REFRESH_TOKEN_EXPIRATION: Joi.string().default('7d'),

  // xxl-job
  XXL_JOB_ADMIN_URL: Joi.string().uri().required(),
  XXL_JOB_USERNAME: Joi.string().required(),
  XXL_JOB_PASSWORD: Joi.string().required(),

  // Server
  PORT: Joi.number().default(3000),
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
});
