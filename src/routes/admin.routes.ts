// Olive Baby API - Admin Routes
import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller';
import { authMiddleware, requireAdmin } from '../middlewares/auth.middleware';
import { validateBody, validateQuery } from '../middlewares/validation.middleware';
import {
  metricsQuerySchema,
  usersQuerySchema,
  babiesQuerySchema,
  changePlanSchema,
  changeStatusSchema,
  changeRoleSchema,
  usageQuerySchema,
  funnelQuerySchema,
  cohortsQuerySchema,
  paywallQuerySchema,
  errorsQuerySchema,
  dailySummaryQuerySchema,
  weeklySummaryQuerySchema,
  opsSummaryQuerySchema,
  testEmailSchema,
} from '../controllers/admin.controller';

const router = Router();

// Todas as rotas admin requerem autenticação e role ADMIN
router.use(authMiddleware);
router.use(requireAdmin);

// ==========================================
// Dashboard & Metrics
// ==========================================

// GET /admin/metrics - Dashboard KPIs
router.get(
  '/metrics',
  validateQuery(metricsQuerySchema),
  AdminController.getMetrics
);

// GET /admin/usage - Usage analytics with charts data
router.get(
  '/usage',
  validateQuery(usageQuerySchema),
  AdminController.getUsageAnalytics
);

// GET /admin/plans - Get available plans
router.get('/plans', AdminController.getPlans);

// ==========================================
// User Management
// ==========================================

// GET /admin/users - List users
router.get(
  '/users',
  validateQuery(usersQuerySchema),
  AdminController.listUsers
);

// GET /admin/users/:id - Get user details
router.get('/users/:id', AdminController.getUserDetails);

// PATCH /admin/users/:id/plan - Change user plan
router.patch(
  '/users/:id/plan',
  validateBody(changePlanSchema),
  AdminController.changeUserPlan
);

// PATCH /admin/users/:id/status - Block/unblock user
router.patch(
  '/users/:id/status',
  validateBody(changeStatusSchema),
  AdminController.changeUserStatus
);

// PATCH /admin/users/:id/role - Change user role
router.patch(
  '/users/:id/role',
  validateBody(changeRoleSchema),
  AdminController.changeUserRole
);

// POST /admin/users/:id/impersonate - Impersonate user (support)
router.post('/users/:id/impersonate', AdminController.impersonateUser);

// ==========================================
// Baby Management
// ==========================================

// GET /admin/babies - List babies
router.get(
  '/babies',
  validateQuery(babiesQuerySchema),
  AdminController.listBabies
);

// GET /admin/babies/:id - Baby details with full permission tree
router.get(
  '/babies/:id',
  AdminController.getBabyDetails
);

// ==========================================
// Analytics & Insights
// ==========================================

// GET /admin/funnel - Activation funnel
router.get(
  '/funnel',
  validateQuery(funnelQuerySchema),
  AdminController.getActivationFunnel
);

// GET /admin/cohorts - Cohort retention
router.get(
  '/cohorts',
  validateQuery(cohortsQuerySchema),
  AdminController.getCohorts
);

// GET /admin/paywall - Paywall analytics
router.get(
  '/paywall',
  validateQuery(paywallQuerySchema),
  AdminController.getPaywallAnalytics
);

// GET /admin/upgrade-candidates - Lead scoring
router.get('/upgrade-candidates', AdminController.getUpgradeCandidates);

// GET /admin/data-quality - Data quality report
router.get('/data-quality', AdminController.getDataQuality);

// GET /admin/errors - Error analytics
router.get(
  '/errors',
  validateQuery(errorsQuerySchema),
  AdminController.getErrorsAnalytics
);

// ==========================================
// Summary for n8n/Slack
// ==========================================

// GET /admin/summary/daily - Last X hours
router.get(
  '/summary/daily',
  validateQuery(dailySummaryQuerySchema),
  AdminController.getDailySummary
);

// GET /admin/summary/weekly - Last N weeks
router.get(
  '/summary/weekly',
  validateQuery(weeklySummaryQuerySchema),
  AdminController.getWeeklySummary
);

// GET /admin/summary/ops - Ops summary for last X hours
router.get(
  '/summary/ops',
  validateQuery(opsSummaryQuerySchema),
  AdminController.getOpsSummary
);

// ==========================================
// Testing & Diagnostics
// ==========================================

// POST /admin/test-email - Send test email
router.post(
  '/test-email',
  validateBody(testEmailSchema),
  AdminController.testEmail
);

export default router;

