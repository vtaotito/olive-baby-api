// Olive Baby API - Routes Index
import { Router } from 'express';
import authRoutes from './auth.routes';
import caregiverRoutes from './caregiver.routes';
import babyRoutes from './baby.routes';
import routineRoutes from './routine.routes';
import statsRoutes from './stats.routes';
import growthRoutes, { babyGrowthRouter } from './growth.routes';
import milestoneRoutes, { babyMilestoneRouter } from './milestone.routes';
import exportRoutes from './export.routes';
import professionalRoutes, { babyProfessionalRouter } from './professional.routes';
import monitoringRoutes from './monitoring.routes';
import aiRoutes from './ai.routes';
import babyMemberRoutes from './baby-member.routes';
import babyInviteRoutes from './baby-invite.routes';
import settingsRoutes from './settings.routes';

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
router.use('/routines', routineRoutes);
router.use('/stats', statsRoutes);
router.use('/growth', growthRoutes);
router.use('/milestones', milestoneRoutes);
router.use('/export', exportRoutes);
router.use('/professionals', professionalRoutes);
router.use('/monitoring', monitoringRoutes);
router.use('/ai', aiRoutes);
router.use('/settings', settingsRoutes);

// Baby-scoped routes (nested under /babies/:babyId/)
// IMPORTANTE: Registrar rotas específicas ANTES das rotas genéricas de /babies
router.use('/babies/:babyId/professionals', babyProfessionalRouter);
router.use('/babies/:babyId/growth', babyGrowthRouter);
router.use('/babies/:babyId/milestones', babyMilestoneRouter);
router.use('/', babyMemberRoutes); // Rotas: /babies/:babyId/members
router.use('/', babyInviteRoutes); // Rotas: /babies/:babyId/invites

// Rotas genéricas de babies (deve vir por último para não capturar rotas específicas)
router.use('/babies', babyRoutes);

export default router;
