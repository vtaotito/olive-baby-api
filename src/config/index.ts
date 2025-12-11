// Olive Baby API - Config Index
export * from './env';
export * from './database';
export * from './jwt';

import { env } from './env';

// Consolidated config object
export const config = {
  server: {
    port: env.PORT,
    prefix: env.API_PREFIX,
    nodeEnv: env.NODE_ENV
  },
  database: {
    url: env.DATABASE_URL
  },
  redis: {
    url: env.REDIS_URL
  },
  jwt: {
    accessSecret: env.JWT_ACCESS_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    accessExpiresIn: env.JWT_ACCESS_EXPIRES_IN,
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN
  },
  smtp: {
    host: env.SMTP_HOST || 'smtp.gmail.com',
    port: env.SMTP_PORT || 587,
    secure: env.SMTP_SECURE || false,
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
    from: env.SMTP_FROM
  },
  frontendUrl: env.FRONTEND_URL,
  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX
  }
};
