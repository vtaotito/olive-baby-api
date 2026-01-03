// Olive Baby API - Admin Controller
import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AdminService } from '../services/admin.service';
import { AdminAnalyticsService } from '../services/adminAnalytics.service';
import { ApiEventsService } from '../services/apiEvents.service';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { PlanType, UserStatus } from '@prisma/client';

// ==========================================
// Validation Schemas
// ==========================================

export const metricsQuerySchema = z.object({
  range: z.enum(['7d', '30d']).optional().default('7d'),
});

export const usersQuerySchema = z.object({
  query: z.string().optional(),
  plan: z.enum(['FREE', 'PREMIUM']).optional(),
  role: z.enum(['PARENT', 'CAREGIVER', 'PEDIATRICIAN', 'SPECIALIST', 'ADMIN']).optional(),
  status: z.enum(['ACTIVE', 'BLOCKED', 'PENDING_VERIFICATION']).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const babiesQuerySchema = z.object({
  query: z.string().optional(),
  state: z.string().length(2).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const changePlanSchema = z.object({
  planType: z.enum(['FREE', 'PREMIUM']),
});

export const changeStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'BLOCKED']),
  reason: z.string().max(500).optional(),
});

export const changeRoleSchema = z.object({
  role: z.enum(['PARENT', 'CAREGIVER', 'PEDIATRICIAN', 'SPECIALIST', 'ADMIN']),
});

export const usageQuerySchema = z.object({
  range: z.enum(['7d', '30d', '90d']).optional().default('30d'),
});

export const funnelQuerySchema = z.object({
  range: z.enum(['7d', '30d']).optional().default('30d'),
});

export const cohortsQuerySchema = z.object({
  unit: z.enum(['week']).optional().default('week'),
  lookback: z.coerce.number().int().min(1).max(24).optional().default(12),
});

export const paywallQuerySchema = z.object({
  range: z.enum(['7d', '30d']).optional().default('30d'),
});

export const upgradeCandidatesQuerySchema = z.object({
  range: z.enum(['30d']).optional().default('30d'),
});

export const dataQualityQuerySchema = z.object({
  range: z.enum(['30d']).optional().default('30d'),
});

export const errorsQuerySchema = z.object({
  range: z.enum(['7d', '30d']).optional().default('7d'),
});

// ==========================================
// Controller
// ==========================================

export class AdminController {
  /**
   * GET /admin/metrics
   * Get admin dashboard metrics
   */
  static async getMetrics(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { range } = metricsQuerySchema.parse(req.query);
      const metrics = await AdminService.getMetrics(range as '7d' | '30d');

      res.json({
        success: true,
        data: metrics,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /admin/users
   * List users with filters and pagination
   */
  static async listUsers(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const filters = usersQuerySchema.parse(req.query);
      const result = await AdminService.listUsers(filters);

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /admin/users/:id
   * Get user details
   */
  static async getUserDetails(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = parseInt(req.params.id, 10);
      const user = await AdminService.getUserDetails(userId);

      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /admin/babies
   * List babies with filters and pagination
   */
  static async listBabies(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const filters = babiesQuerySchema.parse(req.query);
      const result = await AdminService.listBabies(filters);

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /admin/users/:id/plan
   * Change user plan
   */
  static async changeUserPlan(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const targetUserId = parseInt(req.params.id, 10);
      const { planType } = changePlanSchema.parse(req.body);
      
      const result = await AdminService.changeUserPlan(
        req.user!.userId,
        targetUserId,
        planType as PlanType,
        req
      );

      res.json({
        success: true,
        message: `Plano alterado para ${planType}`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /admin/users/:id/status
   * Change user status (block/unblock)
   */
  static async changeUserStatus(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const targetUserId = parseInt(req.params.id, 10);
      const { status, reason } = changeStatusSchema.parse(req.body);
      
      const result = await AdminService.changeUserStatus(
        req.user!.userId,
        targetUserId,
        status as UserStatus,
        reason,
        req
      );

      res.json({
        success: true,
        message: status === 'BLOCKED' ? 'Usuário bloqueado' : 'Usuário desbloqueado',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /admin/users/:id/role
   * Change user role
   */
  static async changeUserRole(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const targetUserId = parseInt(req.params.id, 10);
      const { role } = changeRoleSchema.parse(req.body);
      
      const result = await AdminService.changeUserRole(
        req.user!.userId,
        targetUserId,
        role as any,
        req
      );

      res.json({
        success: true,
        message: `Role alterada para ${role}`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /admin/usage
   * Get usage analytics
   */
  static async getUsageAnalytics(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { range } = usageQuerySchema.parse(req.query);
      const analytics = await AdminService.getUsageAnalytics(range as '7d' | '30d' | '90d');

      res.json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /admin/users/:id/impersonate
   * Impersonate user for support (optional feature)
   */
  static async impersonateUser(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const targetUserId = parseInt(req.params.id, 10);
      
      const result = await AdminService.impersonateUser(
        req.user!.userId,
        targetUserId,
        req
      );

      res.json({
        success: true,
        message: 'Token de impersonação gerado (expira em 15 minutos)',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /admin/plans
   * Get available plans
   */
  static async getPlans(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { EntitlementsService } = await import('../core/entitlements');
      const plans = await EntitlementsService.getAvailablePlans();

      res.json({
        success: true,
        data: plans,
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // NEW ANALYTICS ENDPOINTS
  // ==========================================

  /**
   * GET /admin/funnel
   * Get activation funnel metrics
   */
  static async getActivationFunnel(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { range } = funnelQuerySchema.parse(req.query);
      const funnel = await AdminAnalyticsService.getActivationFunnel(range as '7d' | '30d');

      res.json({
        success: true,
        data: funnel,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /admin/cohorts
   * Get cohort retention analysis
   */
  static async getCohorts(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { unit, lookback } = cohortsQuerySchema.parse(req.query);
      const cohorts = await AdminAnalyticsService.getCohorts(unit as 'week', lookback);

      res.json({
        success: true,
        data: cohorts,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /admin/paywall
   * Get paywall analytics
   */
  static async getPaywallAnalytics(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { range } = paywallQuerySchema.parse(req.query);
      const analytics = await AdminAnalyticsService.getPaywallAnalytics(range as '7d' | '30d');

      res.json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /admin/upgrade-candidates
   * Get upgrade candidates with lead scoring
   */
  static async getUpgradeCandidates(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const candidates = await AdminAnalyticsService.getUpgradeCandidates('30d');

      res.json({
        success: true,
        data: candidates,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /admin/data-quality
   * Get data quality report
   */
  static async getDataQuality(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const report = await AdminAnalyticsService.getDataQuality('30d');

      res.json({
        success: true,
        data: report,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /admin/errors
   * Get error analytics
   */
  static async getErrorsAnalytics(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { range } = errorsQuerySchema.parse(req.query);
      const analytics = await ApiEventsService.getErrorsAnalytics(range as '7d' | '30d');

      res.json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      next(error);
    }
  }
}

