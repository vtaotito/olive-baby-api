// Olive Baby API - n8n Auth Middleware
// Accepts either a static N8N_API_TOKEN (for n8n cron workflows) or a regular
// admin JWT (for the admin panel calling the same endpoints). Without this
// dual path, n8n cron jobs break every hour when the access token expires.
import { Response, NextFunction } from 'express';
import { JwtService } from '../services/jwt.service';
import { AppError } from '../utils/errors/AppError';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { AuthenticatedRequest } from '../types';

const N8N_SYSTEM_USER_ID = 0;
const N8N_SYSTEM_EMAIL = 'n8n-system@oliecare.cloud';

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export function n8nAuthMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw AppError.unauthorized('Token não fornecido');
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || !/^Bearer$/i.test(parts[0])) {
      throw AppError.unauthorized('Token mal formatado');
    }
    const token = parts[1];

    if (env.N8N_API_TOKEN && safeEqual(token, env.N8N_API_TOKEN)) {
      req.user = {
        userId: N8N_SYSTEM_USER_ID,
        email: N8N_SYSTEM_EMAIL,
        role: 'ADMIN',
      };
      return next();
    }

    const payload = JwtService.verifyAccessToken(token);
    if (!payload) {
      throw AppError.unauthorized('Token inválido ou expirado');
    }
    if (payload.role !== 'ADMIN') {
      throw AppError.forbidden('Acesso restrito a administradores');
    }

    req.user = payload;
    next();
  } catch (error) {
    if (!env.N8N_API_TOKEN) {
      logger.warn('[n8n-auth] N8N_API_TOKEN not configured; n8n cron workflows will fail.');
    }
    next(error);
  }
}
