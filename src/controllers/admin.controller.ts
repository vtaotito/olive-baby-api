// Olive Baby API - Admin Controller
import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { AdminService } from '../services/admin.service';
import { AdminAnalyticsService } from '../services/adminAnalytics.service';
import { AdminSummaryService } from '../services/adminSummary.service';
import { ApiEventsService } from '../services/apiEvents.service';
import {
  sendWelcomeEmail,
  sendAlert,
  sendPasswordResetEmail,
  sendPaymentConfirmation,
  sendSubscriptionCancelled,
  sendProfessionalInvite,
  sendBabyInvite,
  sendPatientInviteEmail,
  getTemplatePreview,
  getAllTemplatePreviews,
} from '../services/email.service';
import { PushNotificationService, PUSH_TRIGGERS } from '../services/push-notification.service';
import { DeviceTokenService } from '../services/device-token.service';
import { JourneyService } from '../services/journey.service';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { PlanType, UserStatus, JourneyStatus } from '@prisma/client';

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

const summaryWindowQuerySchema = z
  .object({
    window: z.string().regex(/^\d{1,3}h$/).optional().default('24h'),
  })
  .refine(
    data => {
      const hours = Number(data.window?.replace('h', ''));
      return Number.isInteger(hours) && hours >= 1 && hours <= 168;
    },
    {
      path: ['window'],
      message: 'window deve ser entre 1h e 168h',
    }
  );

export const dailySummaryQuerySchema = summaryWindowQuerySchema;

export const weeklySummaryQuerySchema = z.object({
  weeks: z.coerce.number().int().min(1).max(12).optional().default(1),
});

export const opsSummaryQuerySchema = summaryWindowQuerySchema;

export const testEmailSchema = z.object({
  email: z.string().email(),
  type: z.enum([
    'welcome', 'alert', 'password_reset', 'payment_confirmation',
    'subscription_cancelled', 'professional_invite', 'baby_invite', 'patient_invite',
  ]).default('welcome'),
});

export const templatePreviewSchema = z.object({
  type: z.string(),
});

export const pushBroadcastSchema = z.object({
  segment: z.enum(['all', 'b2c', 'b2b', 'premium', 'free']),
  title: z.string().min(1).max(100),
  body: z.string().min(1).max(300),
  clickAction: z.string().optional(),
  priority: z.enum(['default', 'high']).optional(),
});

export const pushTriggerUpdateSchema = z.object({
  enabled: z.boolean(),
  config: z.record(z.unknown()).optional(),
});

export const journeyCreateSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  category: z.enum(['engagement', 'onboarding', 'premium', 'invites', 'retention']),
  audience: z.enum(['all', 'b2c', 'b2b', 'premium', 'free']),
  priority: z.number().int().optional(),
  tags: z.array(z.string()).optional(),
  steps: z.array(z.object({
    type: z.enum(['email', 'push', 'delay', 'condition']),
    name: z.string().min(1).max(120),
    stepOrder: z.number().int().min(0),
    config: z.record(z.unknown()),
    variables: z.array(z.record(z.unknown())).optional(),
  })).optional(),
});

export const journeyUpdateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional(),
  category: z.enum(['engagement', 'onboarding', 'premium', 'invites', 'retention']).optional(),
  audience: z.enum(['all', 'b2c', 'b2b', 'premium', 'free']).optional(),
  priority: z.number().int().optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED']).optional(),
});

export const journeyStepsReplaceSchema = z.object({
  steps: z.array(z.object({
    type: z.enum(['email', 'push', 'delay', 'condition']),
    name: z.string().min(1).max(120),
    stepOrder: z.number().int().min(0),
    config: z.record(z.unknown()),
    variables: z.array(z.record(z.unknown())).optional(),
  })),
});

export const journeyListSchema = z.object({
  category: z.enum(['engagement', 'onboarding', 'premium', 'invites', 'retention']).optional(),
  audience: z.enum(['all', 'b2c', 'b2b', 'premium', 'free']).optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED']).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

export const communicationsQuerySchema = z.object({
  templateType: z.string().optional(),
  channel: z.enum(['B2C', 'B2B', 'INTERNAL']).optional(),
  from: z.string().optional(), // ISO date or datetime
  to: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

export const communicationsVolumeQuerySchema = z.object({
  range: z.enum(['7d', '30d', '90d']).optional().default('30d'),
  groupBy: z.enum(['day', 'template', 'channel']).optional().default('day'),
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
   * GET /admin/babies/:id
   * Get baby details with full permission tree
   */
  static async getBabyDetails(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const babyId = parseInt(req.params.id, 10);
      if (isNaN(babyId)) {
        res.status(400).json({ success: false, message: 'ID inválido' });
        return;
      }
      const result = await AdminService.getBabyDetails(babyId);
      res.json({ success: true, data: result });
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
   * DELETE /admin/users/:id
   */
  static async deleteUser(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const targetUserId = parseInt(req.params.id, 10);

      const result = await AdminService.deleteUser(
        req.user!.userId,
        targetUserId,
        req
      );

      res.json({
        success: true,
        message: `Usuário ${result.deletedEmail} excluído com sucesso`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /admin/users/:id/audit
   */
  static async getUserAuditTrail(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const targetUserId = parseInt(req.params.id, 10);
      const limit = parseInt(req.query.limit as string, 10) || 30;

      const events = await AdminService.getUserAuditTrail(targetUserId, limit);

      res.json({
        success: true,
        data: events,
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

  // ==========================================
  // Summary Endpoints (n8n)
  // ==========================================

  /**
   * GET /admin/summary/daily
   * Summary for last X hours
   */
  static async getDailySummary(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { window } = dailySummaryQuerySchema.parse(req.query);
      const summary = await AdminSummaryService.getDailySummary(window);

      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /admin/summary/weekly
   * Summary for last N weeks
   */
  static async getWeeklySummary(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { weeks } = weeklySummaryQuerySchema.parse(req.query);
      const summary = await AdminSummaryService.getWeeklySummary(weeks);

      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /admin/summary/ops
   * Ops summary for last X hours
   */
  static async getOpsSummary(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { window } = opsSummaryQuerySchema.parse(req.query);
      const summary = await AdminSummaryService.getOpsSummary(window);

      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /admin/communications
   * List email communications (log) with filters and pagination
   */
  static async getCommunications(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { templateType, channel, from, to, page, limit } = communicationsQuerySchema.parse(req.query);
      const skip = (page - 1) * limit;
      const where: Record<string, unknown> = {};
      if (templateType) where.templateType = templateType;
      if (channel) where.channel = channel;
      if (from || to) {
        where.sentAt = {};
        if (from) (where.sentAt as Record<string, Date>).gte = new Date(from);
        if (to) (where.sentAt as Record<string, Date>).lte = new Date(to);
      }
      const [items, total] = await Promise.all([
        prisma.emailCommunication.findMany({
          where,
          orderBy: { sentAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.emailCommunication.count({ where }),
      ]);
      res.setHeader('X-Total-Count', String(total));
      res.json({
        success: true,
        data: { items, total, page, limit },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /admin/communications/volume
   * Volumetria: agregado por dia, template ou canal
   */
  static async getCommunicationsVolume(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { range, groupBy } = communicationsVolumeQuerySchema.parse(req.query);
      const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
      const from = new Date();
      from.setDate(from.getDate() - days);
      from.setHours(0, 0, 0, 0);

      if (groupBy === 'day') {
        const raw = await prisma.$queryRaw<
          { date: string; count: bigint }[]
        >`
          SELECT date_trunc('day', sent_at)::date::text AS date, COUNT(*)::bigint
          FROM email_communications
          WHERE sent_at >= ${from}
          GROUP BY date_trunc('day', sent_at)
          ORDER BY date ASC
        `;
        res.json({
          success: true,
          data: {
            groupBy: 'day',
            series: raw.map((r) => ({ date: r.date, count: Number(r.count) })),
          },
        });
        return;
      }
      if (groupBy === 'template') {
        const raw = await prisma.emailCommunication.groupBy({
          by: ['templateType'],
          where: { sentAt: { gte: from } },
          _count: { id: true },
        });
        res.json({
          success: true,
          data: {
            groupBy: 'template',
            series: raw.map((r) => ({ templateType: r.templateType, count: r._count.id })),
          },
        });
        return;
      }
      const raw = await prisma.emailCommunication.groupBy({
        by: ['channel'],
        where: { sentAt: { gte: from } },
        _count: { id: true },
      });
      res.json({
        success: true,
        data: {
          groupBy: 'channel',
          series: raw.map((r) => ({ channel: r.channel, count: r._count.id })),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /admin/communications/stats
   * KPI stats for email communications
   */
  static async getCommunicationsStats(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [total, todayCount, last30Days, byChannel, byTemplate] = await Promise.all([
        prisma.emailCommunication.count(),
        prisma.emailCommunication.count({ where: { sentAt: { gte: today } } }),
        prisma.emailCommunication.count({ where: { sentAt: { gte: thirtyDaysAgo } } }),
        prisma.emailCommunication.groupBy({
          by: ['channel'],
          _count: { id: true },
        }),
        prisma.emailCommunication.groupBy({
          by: ['templateType'],
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
        }),
      ]);

      const channelMap: Record<string, number> = {};
      byChannel.forEach(c => { channelMap[c.channel] = c._count.id; });

      const templateRanking = byTemplate.map(t => ({
        templateType: t.templateType,
        count: t._count.id,
      }));

      res.json({
        success: true,
        data: {
          total,
          todayCount,
          last30Days,
          avgPerDay: last30Days > 0 ? Math.round((last30Days / 30) * 10) / 10 : 0,
          byChannel: channelMap,
          templateRanking,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /admin/email-templates
   * Returns all templates with rendered HTML previews
   */
  static async getEmailTemplates(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const templates = getAllTemplatePreviews();
      res.json({ success: true, data: templates });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /admin/email-templates/:type/preview
   * Returns rendered HTML preview for a specific template
   */
  static async getEmailTemplatePreview(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { type } = req.params;
      const preview = getTemplatePreview(type);
      if (!preview) {
        res.status(404).json({ success: false, message: 'Template não encontrado' });
        return;
      }
      res.json({ success: true, data: preview });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /admin/test-email
   * Send a test email of any template type
   */
  static async testEmail(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { email, type } = testEmailSchema.parse(req.body);
      const sampleToken = 'test-' + Date.now();

      switch (type) {
        case 'welcome':
          await sendWelcomeEmail({ email, userName: 'Usuário de Teste' });
          break;
        case 'alert':
          await sendAlert({
            level: 'info',
            title: 'Teste de Email',
            message: 'Este é um email de teste do sistema OlieCare.',
            component: 'admin-test',
            metadata: { testedBy: req.user?.email, timestamp: new Date().toISOString() },
          });
          break;
        case 'password_reset':
          await sendPasswordResetEmail({ email, resetToken: sampleToken, userName: 'Usuário de Teste' });
          break;
        case 'payment_confirmation':
          await sendPaymentConfirmation({
            email, userName: 'Usuário de Teste', planName: 'Premium',
            amount: 2990, currency: 'R$', nextBillingDate: new Date(Date.now() + 30 * 24 * 3600000),
          });
          break;
        case 'subscription_cancelled':
          await sendSubscriptionCancelled({
            email, userName: 'Usuário de Teste', planName: 'Premium',
            endDate: new Date(Date.now() + 30 * 24 * 3600000),
          });
          break;
        case 'professional_invite':
          await sendProfessionalInvite({
            professionalEmail: email, professionalName: 'Profissional Teste',
            caregiverName: 'Cuidador Teste', babyName: 'Bebê Teste',
            inviteToken: sampleToken, role: 'PEDIATRICIAN',
          });
          break;
        case 'baby_invite':
          await sendBabyInvite({
            emailInvited: email, invitedName: 'Convidado Teste',
            babyName: 'Bebê Teste', inviteToken: sampleToken,
            memberType: 'FAMILY', role: 'FAMILY_EDITOR',
          });
          break;
        case 'patient_invite':
          await sendPatientInviteEmail({
            patientEmail: email, patientName: 'Paciente Teste',
            professionalName: 'Dra. Teste', professionalSpecialty: 'PEDIATRICIAN',
            professionalCRM: 'CRM 12345-SP', babyName: 'Bebê Teste',
            inviteToken: sampleToken, userExists: false,
          });
          break;
      }

      res.json({
        success: true,
        message: `Email de teste (${type}) enviado para ${email}`,
        data: { email, type, sentAt: new Date().toISOString() },
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // Push Notifications (Admin)
  // ==========================================

  /**
   * GET /admin/push/stats
   * Push notification stats (device tokens + push logs)
   */
  static async getPushStats(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const tokenStats = await DeviceTokenService.getStats();
      const capabilities = PushNotificationService.getCapabilities();

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [pushTotal, pushToday, pushLast30, pushByChannel] = await Promise.all([
        prisma.emailCommunication.count({ where: { templateType: { startsWith: 'push_' } } }),
        prisma.emailCommunication.count({ where: { templateType: { startsWith: 'push_' }, sentAt: { gte: today } } }),
        prisma.emailCommunication.count({ where: { templateType: { startsWith: 'push_' }, sentAt: { gte: thirtyDaysAgo } } }),
        prisma.emailCommunication.groupBy({
          by: ['channel'],
          where: { templateType: { startsWith: 'push_' } },
          _count: { id: true },
        }),
      ]);

      const channelMap: Record<string, number> = {};
      pushByChannel.forEach(c => { channelMap[c.channel] = c._count.id; });

      res.json({
        success: true,
        data: {
          devices: tokenStats,
          capabilities,
          pushSends: {
            total: pushTotal,
            today: pushToday,
            last30Days: pushLast30,
            byChannel: channelMap,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /admin/push/triggers
   * Returns all predefined push triggers with their current configuration
   */
  static async getPushTriggers(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const savedConfigs = await prisma.triggerConfig.findMany();
      const configMap = new Map(savedConfigs.map(c => [c.triggerId, c]));

      res.json({
        success: true,
        data: PUSH_TRIGGERS.map(t => {
          const saved = configMap.get(t.id);
          return {
            ...t,
            enabled: saved ? saved.enabled : t.defaultEnabled,
            savedConfig: saved?.config ?? {},
          };
        }),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /admin/push/triggers/:id
   * Update trigger enabled state and config (persist to DB)
   */
  static async updatePushTrigger(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { enabled, config } = pushTriggerUpdateSchema.parse(req.body);

      const trigger = PUSH_TRIGGERS.find(t => t.id === id);
      if (!trigger) {
        res.status(404).json({ success: false, message: 'Trigger não encontrado' });
        return;
      }

      const saved = await prisma.triggerConfig.upsert({
        where: { triggerId: id },
        update: { enabled, config: config as any ?? {} },
        create: { triggerId: id, enabled, config: config as any ?? {} },
      });

      res.json({
        success: true,
        message: `Trigger "${trigger.name}" ${enabled ? 'ativado' : 'desativado'}`,
        data: { ...trigger, enabled: saved.enabled, savedConfig: saved.config },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /admin/push/broadcast
   * Send push notification to a user segment
   */
  static async sendPushBroadcast(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { segment, title, body, clickAction, priority } = pushBroadcastSchema.parse(req.body);

      const result = await PushNotificationService.sendToSegment(segment, {
        title,
        body,
        clickAction: clickAction || '/',
        priority: priority || 'default',
        icon: '/icon-192x192.png',
      });

      res.json({
        success: true,
        message: `Push broadcast enviado para segmento "${segment}"`,
        data: {
          ...result,
          segment,
          sentAt: new Date().toISOString(),
          sentBy: req.user?.email,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /admin/push/test
   * Send a test push to the admin's own devices
   */
  static async sendPushTest(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId;
      const results = await PushNotificationService.sendToUser(userId, {
        title: 'Teste de Push - OlieCare 🌿',
        body: 'Esta é uma notificação de teste enviada pelo painel admin.',
        clickAction: '/admin/communications',
        icon: '/icon-192x192.png',
        priority: 'high',
      });

      await PushNotificationService.logPushCommunication('test', 'INTERNAL', userId, {
        sentBy: req.user?.email,
      });

      res.json({
        success: true,
        message: results.length > 0
          ? `Push de teste enviado para ${results.filter(r => r.success).length} dispositivo(s)`
          : 'Nenhum dispositivo registrado para o seu usuário',
        data: { results, sentAt: new Date().toISOString() },
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // Journeys
  // ==========================================

  static async listJourneys(
    req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction
  ): Promise<void> {
    try {
      const filters = journeyListSchema.parse(req.query);
      const result = await JourneyService.list(filters as any);
      res.json({ success: true, data: result });
    } catch (error) { next(error); }
  }

  static async getJourney(
    req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction
  ): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      const journey = await JourneyService.getById(id);
      if (!journey) { res.status(404).json({ success: false, message: 'Jornada não encontrada' }); return; }
      res.json({ success: true, data: journey });
    } catch (error) { next(error); }
  }

  static async createJourney(
    req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction
  ): Promise<void> {
    try {
      const input = journeyCreateSchema.parse(req.body);
      const journey = await JourneyService.create(input as any);
      res.status(201).json({ success: true, data: journey, message: 'Jornada criada' });
    } catch (error) { next(error); }
  }

  static async updateJourney(
    req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction
  ): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      const input = journeyUpdateSchema.parse(req.body);
      const journey = await JourneyService.update(id, input as any);
      res.json({ success: true, data: journey, message: 'Jornada atualizada' });
    } catch (error) { next(error); }
  }

  static async deleteJourney(
    req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction
  ): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      await JourneyService.delete(id);
      res.json({ success: true, message: 'Jornada excluída' });
    } catch (error) { next(error); }
  }

  static async activateJourney(
    req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction
  ): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      const { active } = z.object({ active: z.boolean() }).parse(req.body);
      const journey = await JourneyService.activate(id, active);
      res.json({ success: true, data: journey, message: active ? 'Jornada ativada' : 'Jornada pausada' });
    } catch (error) { next(error); }
  }

  static async replaceJourneySteps(
    req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction
  ): Promise<void> {
    try {
      const journeyId = parseInt(req.params.id, 10);
      const { steps } = journeyStepsReplaceSchema.parse(req.body);
      const result = await JourneyService.replaceSteps(journeyId, steps as any);
      res.json({ success: true, data: result, message: 'Etapas atualizadas' });
    } catch (error) { next(error); }
  }

  static async getJourneyMetrics(
    req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction
  ): Promise<void> {
    try {
      const metrics = await JourneyService.getMetrics();
      res.json({ success: true, data: metrics });
    } catch (error) { next(error); }
  }

  static async getJourneyTemplates(
    req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction
  ): Promise<void> {
    try {
      const templates = await JourneyService.getTemplateJourneys();
      res.json({ success: true, data: templates });
    } catch (error) { next(error); }
  }

  static async createJourneyFromTemplate(
    req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction
  ): Promise<void> {
    try {
      const { templateId } = z.object({ templateId: z.string() }).parse(req.body);
      const templates = await JourneyService.getTemplateJourneys();
      const tmpl = templates.find(t => t.id === templateId);
      if (!tmpl) { res.status(404).json({ success: false, message: 'Template não encontrado' }); return; }

      const journey = await JourneyService.create({
        name: tmpl.name,
        description: tmpl.description,
        category: tmpl.category,
        audience: tmpl.audience,
        steps: tmpl.steps,
      });

      res.status(201).json({ success: true, data: journey, message: `Jornada "${tmpl.name}" criada a partir do template` });
    } catch (error) { next(error); }
  }
}

