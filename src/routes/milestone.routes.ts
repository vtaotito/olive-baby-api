// Olive Baby API - Milestone Routes
import { Router } from 'express';
import { 
  MilestoneController, 
  createMilestoneSchema,
  createMilestoneNestedSchema,
  updateMilestoneSchema,
  markMilestoneSchema,
  unmarkMilestoneSchema
} from '../controllers/milestone.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { validateBody } from '../middlewares/validation.middleware';
import { requirePermission } from '../middlewares/permission.middleware';

const router = Router();

// GET /api/v1/milestones/predefined - Lista marcos pré-definidos (público após auth)
router.get('/predefined', authMiddleware, MilestoneController.getPredefined);

// Todas as outras rotas requerem autenticação
router.use(authMiddleware);

// POST /api/v1/milestones - Adiciona marco
router.post(
  '/', 
  requirePermission('canRegisterRoutines'),
  validateBody(createMilestoneSchema), 
  MilestoneController.create
);

// POST /api/v1/milestones/mark - Marca marco como alcançado
router.post(
  '/mark',
  requirePermission('canRegisterRoutines'),
  validateBody(markMilestoneSchema),
  MilestoneController.mark
);

// POST /api/v1/milestones/unmark - Desmarca marco
router.post(
  '/unmark',
  requirePermission('canDeleteRoutines'),
  validateBody(unmarkMilestoneSchema),
  MilestoneController.unmark
);

// GET /api/v1/milestones/:babyId - Lista marcos do bebê
router.get(
  '/:babyId',
  requirePermission('canViewStats'),
  MilestoneController.list
);

// GET /api/v1/milestones/:babyId/progress - Progresso de marcos
router.get(
  '/:babyId/progress',
  requirePermission('canViewStats'),
  MilestoneController.getProgress
);

// GET /api/v1/milestones/record/:id - Detalhes de um marco
router.get(
  '/record/:id',
  MilestoneController.getById
);

// PUT /api/v1/milestones/:id - Atualiza marco
router.put(
  '/:id', 
  requirePermission('canEditRoutines'),
  validateBody(updateMilestoneSchema), 
  MilestoneController.update
);

// DELETE /api/v1/milestones/:id - Remove marco
router.delete(
  '/:id', 
  requirePermission('canDeleteRoutines'),
  MilestoneController.delete
);

export default router;

// ========================================
// Baby-scoped Milestone Router
// For routes like /api/v1/babies/:babyId/milestones
// ========================================
export const babyMilestoneRouter = Router({ mergeParams: true });

babyMilestoneRouter.use(authMiddleware);

// GET /api/v1/babies/:babyId/milestones - Lista marcos do bebê
babyMilestoneRouter.get(
  '/',
  requirePermission('canViewStats'),
  MilestoneController.list
);

// GET /api/v1/babies/:babyId/milestones/progress - Progresso
babyMilestoneRouter.get(
  '/progress',
  requirePermission('canViewStats'),
  MilestoneController.getProgress
);

// POST /api/v1/babies/:babyId/milestones - Adiciona marco
babyMilestoneRouter.post(
  '/',
  requirePermission('canRegisterRoutines'),
  validateBody(createMilestoneNestedSchema),
  MilestoneController.create
);
