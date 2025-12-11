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

export default router;
