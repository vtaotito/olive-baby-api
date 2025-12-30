// Olive Baby API - Baby Access Middleware
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { requireBabyAccess, requireBabyOwner } from '../utils/helpers/baby-permission.helper';
import { AppError } from '../utils/errors/AppError';

/**
 * Middleware para verificar se o usuário tem acesso ao bebê
 * Usa o parâmetro :babyId da rota
 */
export function requireBabyAccessMiddleware() {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const babyId = parseInt(req.params.babyId, 10);
      if (isNaN(babyId)) {
        throw AppError.badRequest('ID do bebê inválido');
      }

      await requireBabyAccess(req.user.userId, babyId);
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware para verificar se o usuário é owner do bebê
 * Usa o parâmetro :babyId da rota
 */
export function requireBabyOwnerMiddleware() {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const babyId = parseInt(req.params.babyId, 10);
      if (isNaN(babyId)) {
        throw AppError.badRequest('ID do bebê inválido');
      }

      await requireBabyOwner(req.user.userId, babyId);
      next();
    } catch (error) {
      next(error);
    }
  };
}
