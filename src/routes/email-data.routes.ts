// OlieCare API - Email Data Routes
// Provides dynamic data endpoints for email templates
import { Router } from 'express';
import * as EmailDataController from '../controllers/email-data.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// GET /api/v1/users/:id/stats - Get user statistics
router.get('/users/:id/stats', EmailDataController.getUserStats);

// GET /api/v1/babies/:id/insights - Get baby insights
router.get('/babies/:id/insights', EmailDataController.getBabyInsights);

// GET /api/v1/users/:id/milestones - Get user milestones
router.get('/users/:id/milestones', EmailDataController.getUserMilestones);

// GET /api/v1/users/:id/weekly-summary - Get weekly summary
router.get('/users/:id/weekly-summary', EmailDataController.getWeeklySummary);

export default router;
