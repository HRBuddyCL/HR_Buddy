import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  PORT: Joi.number().default(3001),
  DATABASE_URL: Joi.string().required(),
  CORS_ORIGINS: Joi.string().default('http://localhost:3000'),
  OTP_HASH_SECRET: Joi.string()
    .min(16)
    .default('dev-only-change-this-otp-hash-secret'),
  MESSENGER_MAGIC_LINK_SECRET: Joi.string()
    .min(16)
    .default('dev-only-change-this-messenger-magic-link-secret'),
  MESSENGER_MAGIC_LINK_TTL_HOURS: Joi.number().integer().min(1).default(72),
  MESSENGER_MAGIC_LINK_BASE_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .default('http://localhost:3000/messenger'),
  ADMIN_USERNAME: Joi.string().min(3).default('admin'),
  ADMIN_PASSWORD: Joi.string().min(8).default('admin12345'),
  ADMIN_SESSION_SECRET: Joi.string()
    .min(16)
    .default('dev-only-change-this-admin-session-secret'),
  ADMIN_SESSION_TTL_MINUTES: Joi.number().integer().min(30).default(480),
});
