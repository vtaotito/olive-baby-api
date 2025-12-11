// Olive Baby API - Auth Middleware
import { Response, NextFunction } from 'express';
import { JwtService } from '../services/jwt.service';
import { AppError } from '../utils/errors/AppError';
import { AuthenticatedRequest } from '../types';

export function authMiddleware(
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

    if (parts.length !== 2) {
      throw AppError.unauthorized('Token mal formatado');
    }

    const [scheme, token] = parts;

    if (!/^Bearer$/i.test(scheme)) {
      throw AppError.unauthorized('Token mal formatado');
    }

    const payload = JwtService.verifyAccessToken(token);

    if (!payload) {
      throw AppError.unauthorized('Token inválido ou expirado');
    }

    req.user = payload;
    next();
  } catch (error) {
    next(error);
  }
}

// Alias for authMiddleware
export const authenticate = authMiddleware;

// Require caregiver role (PARENT or CAREGIVER)
export function requireCaregiver(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    return next(AppError.unauthorized('Não autenticado'));
  }

  const caregiverRoles = ['PARENT', 'CAREGIVER'];
  if (!caregiverRoles.includes(req.user.role)) {
    return next(AppError.forbidden('Acesso restrito a cuidadores'));
  }

  next();
}

// Require professional role (PEDIATRICIAN or SPECIALIST)
export function requireProfessional(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    return next(AppError.unauthorized('Não autenticado'));
  }

  const professionalRoles = ['PEDIATRICIAN', 'SPECIALIST'];
  if (!professionalRoles.includes(req.user.role)) {
    return next(AppError.forbidden('Acesso restrito a profissionais de saúde'));
  }

  next();
}

// Require admin role
export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    return next(AppError.unauthorized('Não autenticado'));
  }

  if (req.user.role !== 'ADMIN') {
    return next(AppError.forbidden('Acesso restrito a administradores'));
  }

  next();
}
