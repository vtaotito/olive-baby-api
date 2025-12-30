// Olive Baby API - Baby Routes
import { Router } from 'express';
import { 
  BabyController, 
  createBabySchema, 
  updateBabySchema,
  addCaregiverSchema 
} from '../controllers/baby.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { validateBody } from '../middlewares/validation.middleware';
import { requirePermission } from '../middlewares/permission.middleware';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// GET /api/v1/babies - Lista bebês do usuário
router.get('/', BabyController.list);

// POST /api/v1/babies - Cadastra bebê
router.post(
  '/', 
  requirePermission('canManageBabies'),
  validateBody(createBabySchema), 
  BabyController.create
);

// GET /api/v1/babies/:id - Detalhes do bebê
router.get('/:id', BabyController.getById);

// PUT /api/v1/babies/:id - Atualiza bebê
router.put(
  '/:id', 
  requirePermission('canManageBabies'),
  validateBody(updateBabySchema), 
  BabyController.update
);

// PATCH /api/v1/babies/:id - Atualiza bebê (alias para PUT)
router.patch(
  '/:id', 
  requirePermission('canManageBabies'),
  validateBody(updateBabySchema), 
  BabyController.update
);

// DELETE /api/v1/babies/:id - Remove bebê
router.delete(
  '/:id', 
  requirePermission('canManageBabies'),
  BabyController.delete
);

// GET /api/v1/babies/:id/caregivers - Lista cuidadores do bebê
router.get('/:id/caregivers', BabyController.listCaregivers);

// POST /api/v1/babies/:id/caregivers - Adiciona cuidador ao bebê
router.post(
  '/:id/caregivers', 
  requirePermission('canManageTeam'),
  validateBody(addCaregiverSchema), 
  BabyController.addCaregiver
);

// DELETE /api/v1/babies/:id/caregivers/:caregiverId - Remove cuidador
router.delete(
  '/:id/caregivers/:caregiverId', 
  requirePermission('canManageTeam'),
  BabyController.removeCaregiver
);

export default router;
