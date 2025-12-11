// Olive Baby API - Caregiver Routes
import { Router } from 'express';
import { CaregiverController, updateCaregiverSchema } from '../controllers/caregiver.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { validateBody } from '../middlewares/validation.middleware';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// GET /api/v1/caregivers/me - Dados do cuidador logado
router.get('/me', CaregiverController.getMe);

// PUT /api/v1/caregivers/me - Atualiza dados
router.put('/me', validateBody(updateCaregiverSchema), CaregiverController.updateMe);

// GET /api/v1/caregivers/search - Busca por email
router.get('/search', CaregiverController.searchByEmail);

// GET /api/v1/caregivers/:id - Busca por ID
router.get('/:id', CaregiverController.getById);

export default router;
