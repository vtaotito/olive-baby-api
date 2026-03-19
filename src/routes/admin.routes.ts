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
  communicationsQuerySchema,
  communicationsVolumeQuerySchema,
  pushBroadcastSchema,
  pushTriggerUpdateSchema,
  journeyCreateSchema,
  journeyUpdateSchema,
  journeyStepsReplaceSchema,
  journeyListSchema,
  alertsListSchema,
  alertUpdateStatusSchema,
  alertBulkUpdateSchema,
  alertConfigUpdateSchema,
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

// DELETE /admin/users/:id - Delete user
router.delete('/users/:id', AdminController.deleteUser);

// GET /admin/users/:id/audit - Audit trail for user
router.get('/users/:id/audit', AdminController.getUserAuditTrail);

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
// Communications (emails tracking / volumetria)
// ==========================================

// GET /admin/communications - List email sends with filters
router.get(
  '/communications',
  validateQuery(communicationsQuerySchema),
  AdminController.getCommunications
);

// GET /admin/communications/volume - Volumetria por dia, template ou canal
router.get(
  '/communications/volume',
  validateQuery(communicationsVolumeQuerySchema),
  AdminController.getCommunicationsVolume
);

// GET /admin/communications/stats - KPI stats
router.get('/communications/stats', AdminController.getCommunicationsStats);

// ==========================================
// Email Templates (preview / test)
// ==========================================

// GET /admin/email-templates - All templates with rendered preview
router.get('/email-templates', AdminController.getEmailTemplates);

// GET /admin/email-templates/:type/preview - Single template preview
router.get('/email-templates/:type/preview', AdminController.getEmailTemplatePreview);

// ==========================================
// Push Notifications (Admin)
// ==========================================

// GET /admin/push/stats - Push stats (devices + sends)
router.get('/push/stats', AdminController.getPushStats);

// GET /admin/push/triggers - List push trigger definitions
router.get('/push/triggers', AdminController.getPushTriggers);

// POST /admin/push/broadcast - Send push to segment
router.post(
  '/push/broadcast',
  validateBody(pushBroadcastSchema),
  AdminController.sendPushBroadcast
);

// POST /admin/push/test - Send test push to admin
router.post('/push/test', AdminController.sendPushTest);

// GET /admin/communications/health - Communications health status
router.get('/communications/health', AdminController.getCommunicationsHealth);

// PATCH /admin/push/triggers/:id - Update trigger config (persist)
router.patch(
  '/push/triggers/:id',
  validateBody(pushTriggerUpdateSchema),
  AdminController.updatePushTrigger
);

// ==========================================
// n8n Integration
// ==========================================

// POST /admin/n8n/execute-journey - Execute a journey via n8n
router.post('/n8n/execute-journey', AdminController.n8nExecuteJourney);

// POST /admin/n8n/execute-step - Execute a specific journey step via n8n
router.post('/n8n/execute-step', AdminController.n8nExecuteStep);

// GET /admin/n8n/execution-summary - Execution metrics for n8n dashboard
router.get('/n8n/execution-summary', AdminController.n8nExecutionSummary);

// GET /admin/n8n/active-journeys - Active journeys for n8n orchestration
router.get('/n8n/active-journeys', AdminController.n8nActiveJourneys);

// POST /admin/n8n/trigger-push - Execute a push trigger via n8n
router.post('/n8n/trigger-push', AdminController.n8nTriggerPush);

// POST /admin/n8n/send-email - Send email via n8n
router.post('/n8n/send-email', AdminController.n8nSendEmail);

// ==========================================
// Journeys (Communication Journeys)
// ==========================================

router.get('/journeys', AdminController.listJourneys);
router.get('/journeys/metrics', AdminController.getJourneyMetrics);
router.get('/journeys/templates', AdminController.getJourneyTemplates);
router.post('/journeys/from-template', AdminController.createJourneyFromTemplate);
router.get('/journeys/:id', AdminController.getJourney);
router.post('/journeys', AdminController.createJourney);
router.patch('/journeys/:id', AdminController.updateJourney);
router.delete('/journeys/:id', AdminController.deleteJourney);
router.post('/journeys/:id/activate', AdminController.activateJourney);
router.put('/journeys/:id/steps', AdminController.replaceJourneySteps);

// ==========================================
// System Alerts
// ==========================================

router.get('/alerts', AdminController.listAlerts);
router.get('/alerts/stats', AdminController.getAlertStats);
router.get('/alerts/configs', AdminController.listAlertConfigs);
router.patch('/alerts/configs/:id', AdminController.updateAlertConfig);
router.patch('/alerts/:id/status', AdminController.updateAlertStatus);
router.post('/alerts/bulk-update', AdminController.bulkUpdateAlerts);
router.post('/alerts/resolve-type', AdminController.resolveAlertsByType);
router.post('/alerts/test', AdminController.createTestAlert);

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

