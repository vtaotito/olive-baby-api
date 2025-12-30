// Olive Baby API - Entitlements Middleware
import { Response, NextFunction } from 'express';
import { EntitlementsService, AuditService, FeatureKey, ResourceKey } from '../core/entitlements';
import { AuthenticatedRequest } from '../types';
import { AppError } from '../utils/errors/AppError';

/**
 * Middleware to check if user has access to a feature
 */
export function requireFeature(feature: FeatureKey) {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user?.userId) {
        throw AppError.unauthorized('Não autenticado');
      }

      await EntitlementsService.assertCan(req.user.userId, feature);
      next();
    } catch (error: any) {
      // Log paywall hit if it's a plan upgrade required error
      if (error?.extra?.errorCode === 'PLAN_UPGRADE_REQUIRED') {
        await AuditService.logPaywallHit(
          req.user?.userId || 0,
          feature,
          { attemptedAt: new Date().toISOString() },
          req
        );
      }
      next(error);
    }
  };
}

/**
 * Middleware to check if user is within a resource limit
 * Requires a function to get the current count
 */
export function requireWithinLimit(
  resource: ResourceKey,
  getCount: (req: AuthenticatedRequest) => Promise<number>
) {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user?.userId) {
        throw AppError.unauthorized('Não autenticado');
      }

      const currentCount = await getCount(req);
      await EntitlementsService.assertWithinLimit(
        req.user.userId,
        resource,
        currentCount
      );
      next();
    } catch (error: any) {
      // Log paywall hit if it's a limit exceeded error
      if (error?.extra?.errorCode === 'LIMIT_EXCEEDED') {
        await AuditService.logPaywallHit(
          req.user?.userId || 0,
          resource,
          { attemptedAt: new Date().toISOString() },
          req
        );
      }
      next(error);
    }
  };
}

/**
 * Middleware to attach entitlements to request
 */
export async function attachEntitlements(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (req.user?.userId) {
      const entitlements = await EntitlementsService.getUserEntitlements(req.user.userId);
      (req as any).entitlements = entitlements;
    }
    next();
  } catch (error) {
    // Don't fail if we can't get entitlements, just continue
    next();
  }
}

/**
 * Middleware to check baby creation limit
 */
export function requireBabyCreationAllowed() {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user?.userId) {
        throw AppError.unauthorized('Não autenticado');
      }

      const checkResult = await EntitlementsService.checkUpgradeNeeded(
        req.user.userId,
        'create_baby'
      );

      if (checkResult.needed) {
        await AuditService.logPaywallHit(
          req.user.userId,
          'create_baby',
          { message: checkResult.message },
          req
        );

        throw AppError.forbidden(checkResult.message || 'Limite atingido', {
          success: false,
          errorCode: 'PLAN_UPGRADE_REQUIRED',
          resource: checkResult.resource,
          requiredPlan: 'PREMIUM',
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware to check professional invitation limit
 */
export function requireProfessionalInviteAllowed() {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user?.userId) {
        throw AppError.unauthorized('Não autenticado');
      }

      const checkResult = await EntitlementsService.checkUpgradeNeeded(
        req.user.userId,
        'invite_professional'
      );

      if (checkResult.needed) {
        await AuditService.logPaywallHit(
          req.user.userId,
          'invite_professional',
          { message: checkResult.message },
          req
        );

        throw AppError.forbidden(checkResult.message || 'Limite atingido', {
          success: false,
          errorCode: 'PLAN_UPGRADE_REQUIRED',
          resource: checkResult.resource,
          requiredPlan: 'PREMIUM',
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware to check export permission
 */
export function requireExportAllowed() {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user?.userId) {
        throw AppError.unauthorized('Não autenticado');
      }

      const checkResult = await EntitlementsService.checkUpgradeNeeded(
        req.user.userId,
        'export'
      );

      if (checkResult.needed) {
        await AuditService.logPaywallHit(
          req.user.userId,
          'export',
          { message: checkResult.message },
          req
        );

        throw AppError.forbidden(checkResult.message || 'Recurso indisponível', {
          success: false,
          errorCode: 'PLAN_UPGRADE_REQUIRED',
          feature: checkResult.feature,
          requiredPlan: 'PREMIUM',
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

