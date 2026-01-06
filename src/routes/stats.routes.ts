// Olive Baby API - Stats Routes
import { Router } from 'express';
import { StatsController, statsQuerySchema } from '../controllers/stats.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { validateQuery } from '../middlewares/validation.middleware';
import { requirePermission } from '../middlewares/permission.middleware';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// GET /api/v1/stats/:babyId - Estatísticas do bebê
router.get(
  '/:babyId', 
  requirePermission('canViewStats'),
  validateQuery(statsQuerySchema), 
  StatsController.getStats
);

// GET /api/v1/stats/:babyId/history - Histórico para gráficos
router.get(
  '/:babyId/history', 
  requirePermission('canViewStats'),
  StatsController.getHistory
);

// GET /api/v1/stats/:babyId/volume-by-type - Volumetria por tipo de leite
router.get(
  '/:babyId/volume-by-type', 
  requirePermission('canViewStats'),
  StatsController.getVolumeByType
);

export default router;
