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
});