// Olive Baby API - Growth Routes
import { Router } from 'express';
import { 
  GrowthController, 
  createGrowthSchema, 
  createGrowthNestedSchema,
  updateGrowthSchema,
  listGrowthQuerySchema 
} from '../controllers/growth.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { validateBody, validateQuery } from '../middlewares/validation.middleware';
import { requirePermission } from '../middlewares/permission.middleware';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// POST /api/v1/growth - Adiciona medição
router.post(
  '/', 
  requirePermission('canRegisterRoutines'),
  validateBody(createGrowthSchema), 
  GrowthController.create
);

// GET /api/v1/growth/:babyId - Lista medições do bebê
router.get(
  '/:babyId',
  requirePermission('canViewStats'),
  validateQuery(listGrowthQuerySchema),
  GrowthController.list
);

// GET /api/v1/growth/:babyId/latest - Última medição do bebê
router.get(
  '/:babyId/latest',
  requirePermission('canViewStats'),
  GrowthController.getLatest
);

// GET /api/v1/growth/:babyId/stats - Estatísticas de crescimento
router.get(
  '/:babyId/stats',
  requirePermission('canViewStats'),
  GrowthController.getStats
);

// GET /api/v1/growth/record/:id - Detalhes de uma medição
router.get(
  '/record/:id',
  GrowthController.getById
);

// PUT /api/v1/growth/:id - Atualiza medição
router.put(
  '/:id', 
  requirePermission('canEditRoutines'),
  validateBody(updateGrowthSchema), 
  GrowthController.update
);

// DELETE /api/v1/growth/:id - Remove medição
router.delete(
  '/:id', 
  requirePermission('canDeleteRoutines'),
  GrowthController.delete
);

export default router;

// ========================================
// Baby-scoped Growth Router
// For routes like /api/v1/babies/:babyId/growth
// ========================================
export const babyGrowthRouter = Router({ mergeParams: true });

babyGrowthRouter.use(authMiddleware);

// GET /api/v1/babies/:babyId/growth - Lista medições do bebê
babyGrowthRouter.get(
  '/',
  requirePermission('canViewStats'),
  validateQuery(listGrowthQuerySchema),
  GrowthController.list
);

// GET /api/v1/babies/:babyId/growth/latest - Última medição
babyGrowthRouter.get(
  '/latest',
  requirePermission('canViewStats'),
  GrowthController.getLatest
);

// GET /api/v1/babies/:babyId/growth/stats - Estatísticas
babyGrowthRouter.get(
  '/stats',
  requirePermission('canViewStats'),
  GrowthController.getStats
);

// POST /api/v1/babies/:babyId/growth - Adiciona medição
babyGrowthRouter.post(
  '/',
  requirePermission('canRegisterRoutines'),
  validateBody(createGrowthNestedSchema),
  GrowthController.create
);
