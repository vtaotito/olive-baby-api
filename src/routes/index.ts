// Olive Baby API - Routes Index
import { Router } from 'express';
import authRoutes from './auth.routes';
import caregiverRoutes from './caregiver.routes';
import babyRoutes from './baby.routes';
import routineRoutes from './routine.routes';
import statsRoutes from './stats.routes';
import growthRoutes from './growth.routes';
import milestoneRoutes from './milestone.routes';
import exportRoutes from './export.routes';
import professionalRoutes, { babyProfessionalRouter } from './professional.routes';
import monitoringRoutes from './monitoring.routes';

const router = Router();

// Health check
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API Routes
router.use('/auth', authRoutes);
router.use('/caregivers', caregiverRoutes);
router.use('/babies', babyRoutes);
router.use('/routines', routineRoutes);
router.use('/stats', statsRoutes);
router.use('/growth', growthRoutes);
router.use('/milestones', milestoneRoutes);
router.use('/export', exportRoutes);
router.use('/professionals', professionalRoutes);
router.use('/monitoring', monitoringRoutes);

// Baby-scoped professional routes
router.use('/babies/:babyId/professionals', babyProfessionalRouter);

export default router;
