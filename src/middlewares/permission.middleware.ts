// Olive Baby API - Permission Middleware
import { Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { AppError } from '../utils/errors/AppError';
import { AuthenticatedRequest, ROLE_PERMISSIONS, RolePermissions } from '../types';

type PermissionKey = keyof RolePermissions;

export function requirePermission(permission: PermissionKey) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Usuário não autenticado');
      }

      const userRole = req.user.role as UserRole;
      const permissions = ROLE_PERMISSIONS[userRole];

      if (!permissions || !permissions[permission]) {
        throw AppError.forbidden(`Permissão '${permission}' negada para role '${userRole}'`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireRoles(...roles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Usuário não autenticado');
      }

      const userRole = req.user.role as UserRole;

      if (!roles.includes(userRole)) {
        throw AppError.forbidden(`Role '${userRole}' não tem acesso a este recurso`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
