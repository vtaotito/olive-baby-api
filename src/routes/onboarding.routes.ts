// Olive Baby API - Onboarding Routes
import { Router } from 'express';
import { OnboardingController } from '../controllers/onboarding.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// GET /onboarding/status - Get onboarding status
router.get('/status', OnboardingController.getOnboardingStatus);

// POST /onboarding/skip - Skip onboarding
router.post('/skip', OnboardingController.skipOnboarding);

// POST /onboarding/complete - Mark onboarding as completed
router.post('/complete', OnboardingController.completeOnboarding);

export default router;
