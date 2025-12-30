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
  usageQuerySchema,
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

export default router;

