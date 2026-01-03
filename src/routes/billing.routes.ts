// Olive Baby API - Billing Routes
import { Router, raw } from 'express';
import { BillingController } from '../controllers/billing.controller';
import { authMiddleware, requireAdmin } from '../middlewares/auth.middleware';
import { validateBody } from '../middlewares/validation.middleware';
import {
  checkoutSessionSchema,
  portalSessionSchema,
  adminPortalSessionSchema,
  updatePlanStripeSchema,
} from '../controllers/billing.controller';

const router = Router();

// ==========================================
// Public Routes (no auth required)
// ==========================================

// GET /billing/status - Check if Stripe is configured (public for diagnostics)
router.get('/status', BillingController.getStripeStatus);

// POST /billing/webhook - Handle Stripe webhooks (no auth required)
// Note: This route needs raw body, handled in app.ts
router.post(
  '/webhook',
  raw({ type: 'application/json' }),
  BillingController.handleWebhook
);

// ==========================================
// Authenticated User Routes
// ==========================================

// Apply auth middleware to all routes below
router.use(authMiddleware);

// GET /billing/plans - Get available plans
router.get('/plans', BillingController.getAvailablePlans);

// GET /billing/me - Get current user billing status
router.get('/me', BillingController.getBillingStatus);

// POST /billing/checkout-session - Create checkout session
router.post(
  '/checkout-session',
  validateBody(checkoutSessionSchema),
  BillingController.createCheckoutSession
);

// POST /billing/portal-session - Create customer portal session
router.post(
  '/portal-session',
  validateBody(portalSessionSchema),
  BillingController.createPortalSession
);

// ==========================================
// Admin Routes
// ==========================================

// GET /billing/admin/subscriptions - Get recent subscriptions
router.get(
  '/admin/subscriptions',
  requireAdmin,
  BillingController.getRecentSubscriptions
);

// GET /billing/admin/events - Get recent billing events
router.get(
  '/admin/events',
  requireAdmin,
  BillingController.getRecentEvents
);

// POST /billing/admin/portal-session - Create portal for specific user
router.post(
  '/admin/portal-session',
  requireAdmin,
  validateBody(adminPortalSessionSchema),
  BillingController.createAdminPortalSession
);

// PATCH /billing/admin/plans/:id - Update plan Stripe config
router.patch(
  '/admin/plans/:id',
  requireAdmin,
  validateBody(updatePlanStripeSchema),
  BillingController.updatePlanStripeConfig
);

export default router;
