// Olive Baby API - Billing Controller
import { Response, NextFunction, Request } from 'express';
import { z } from 'zod';
import { BillingService } from '../services/billing.service';
import { AuthenticatedRequest, ApiResponse } from '../types';

// ==========================================
// Validation Schemas
// ==========================================

export const checkoutSessionSchema = z.object({
  planCode: z.string().min(1),
  interval: z.enum(['monthly', 'yearly']).default('monthly'),
});

export const portalSessionSchema = z.object({
  returnUrl: z.string().url().optional(),
});

export const adminPortalSessionSchema = z.object({
  userId: z.coerce.number().int().positive(),
  returnUrl: z.string().url().optional(),
});

export const updatePlanStripeSchema = z.object({
  stripeProductId: z.string().optional(),
  stripePriceIdMonthly: z.string().optional(),
  stripePriceIdYearly: z.string().optional(),
});

// ==========================================
// Controller
// ==========================================

export class BillingController {
  /**
   * POST /billing/checkout-session
   * Create Stripe checkout session for subscription
   */
  static async createCheckoutSession(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { planCode, interval } = checkoutSessionSchema.parse(req.body);
      
      const result = await BillingService.createCheckoutSession(
        req.user!.userId,
        planCode,
        interval
      );

      res.json({
        success: true,
        message: 'Checkout session criada',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /billing/portal-session
   * Create Stripe customer portal session
   */
  static async createPortalSession(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { returnUrl } = portalSessionSchema.parse(req.body || {});
      
      const result = await BillingService.createPortalSession(
        req.user!.userId,
        returnUrl
      );

      res.json({
        success: true,
        message: 'Portal session criada',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /billing/me
   * Get current user billing status
   */
  static async getBillingStatus(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const status = await BillingService.getBillingStatus(req.user!.userId);

      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /billing/plans
   * Get available plans for subscription
   */
  static async getAvailablePlans(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const plans = await BillingService.getAvailablePlans();

      res.json({
        success: true,
        data: plans,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /billing/webhook
   * Handle Stripe webhook events
   */
  static async handleWebhook(
    req: Request,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const signature = req.headers['stripe-signature'] as string;
      
      if (!signature) {
        res.status(400).json({
          success: false,
          message: 'Missing stripe-signature header',
        });
        return;
      }

      // Verify signature and construct event
      const event = BillingService.verifyWebhookSignature(req.body, signature);

      // Process event
      await BillingService.processWebhookEvent(event);

      res.json({
        success: true,
        message: 'Webhook processed',
      });
    } catch (error) {
      // Always return 200 for webhooks to prevent retries on business logic errors
      // Only return 4xx for signature verification failures
      if (error instanceof Error && error.message.includes('signature')) {
        res.status(400).json({
          success: false,
          message: error.message,
        });
        return;
      }
      
      // Log error but return 200 to prevent webhook retries
      console.error('Webhook processing error:', error);
      res.json({
        success: true,
        message: 'Webhook received (with errors)',
      });
    }
  }

  // ==========================================
  // Admin Endpoints
  // ==========================================

  /**
   * GET /admin/billing/subscriptions
   * Get recent subscriptions (admin only)
   */
  static async getRecentSubscriptions(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const subscriptions = await BillingService.getRecentSubscriptions();

      res.json({
        success: true,
        data: subscriptions,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /admin/billing/events
   * Get recent billing events (admin only)
   */
  static async getRecentEvents(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const events = await BillingService.getRecentBillingEvents();

      res.json({
        success: true,
        data: events,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /admin/billing/portal-session
   * Create portal session for a specific user (admin only)
   */
  static async createAdminPortalSession(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { userId, returnUrl } = adminPortalSessionSchema.parse(req.body);
      
      const result = await BillingService.createPortalSessionForUser(userId, returnUrl);

      res.json({
        success: true,
        message: 'Portal session criada para usuário',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /admin/billing/plans/:id
   * Update plan Stripe configuration (admin only)
   */
  static async updatePlanStripeConfig(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const planId = parseInt(req.params.id, 10);
      const data = updatePlanStripeSchema.parse(req.body);
      
      const plan = await BillingService.updatePlanStripeConfig(planId, data);

      res.json({
        success: true,
        message: 'Configuração do plano atualizada',
        data: plan,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /billing/status
   * Check if Stripe is configured
   */
  static async getStripeStatus(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          configured: BillingService.isStripeConfigured(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export default BillingController;
