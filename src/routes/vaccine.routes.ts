// Olive Baby API - Vaccine Routes
import { Router } from 'express';
import { 
  VaccineController,
  syncVaccinesSchema,
  createManualRecordSchema,
  updateRecordSchema,
  markAsAppliedSchema,
  markAsSkippedSchema,
} from '../controllers/vaccine.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { validateBody } from '../middlewares/validation.middleware';
import { requireFeature } from '../middlewares/entitlements.middleware';
import { requirePermission } from '../middlewares/permission.middleware';

const router = Router();

// ========================================
// Rotas públicas (apenas autenticação, sem Premium)
// Para permitir que usuários Free vejam preview
// ========================================

// GET /api/v1/vaccines/calendars - Lista calendários disponíveis
router.get('/calendars', authMiddleware, VaccineController.getCalendars);

// GET /api/v1/vaccines/definitions - Lista definições de vacinas
router.get('/definitions', authMiddleware, VaccineController.getDefinitions);

// ========================================
// Rotas Premium (requer plano Premium)
// ========================================

// Middleware de autenticação + Premium para todas as rotas abaixo
// Nota: As rotas específicas de baby estão em babyVaccineRouter

export default router;

// ========================================
// Baby-scoped Vaccine Router
// Para rotas como /api/v1/babies/:babyId/vaccines/*
// ========================================

export const babyVaccineRouter = Router({ mergeParams: true });

// Todas as rotas requerem autenticação
babyVaccineRouter.use(authMiddleware);

// Todas as rotas de vacinas do bebê requerem Premium
babyVaccineRouter.use(requireFeature('vaccines'));

// GET /api/v1/babies/:babyId/vaccines/summary - Resumo das vacinas
babyVaccineRouter.get(
  '/summary',
  requirePermission('canViewStats'),
  VaccineController.getSummary
);

// GET /api/v1/babies/:babyId/vaccines/timeline - Timeline completa
babyVaccineRouter.get(
  '/timeline',
  requirePermission('canViewStats'),
  VaccineController.getTimeline
);

// POST /api/v1/babies/:babyId/vaccines/sync - Sincroniza vacinas do calendário
babyVaccineRouter.post(
  '/sync',
  requirePermission('canRegisterRoutines'),
  validateBody(syncVaccinesSchema),
  VaccineController.syncVaccines
);

// POST /api/v1/babies/:babyId/vaccines/record - Cria registro manual
babyVaccineRouter.post(
  '/record',
  requirePermission('canRegisterRoutines'),
  validateBody(createManualRecordSchema),
  VaccineController.createRecord
);

// GET /api/v1/babies/:babyId/vaccines/record/:id - Detalhes de um registro
babyVaccineRouter.get(
  '/record/:id',
  requirePermission('canViewStats'),
  VaccineController.getRecord
);

// PATCH /api/v1/babies/:babyId/vaccines/record/:id - Atualiza registro
babyVaccineRouter.patch(
  '/record/:id',
  requirePermission('canEditRoutines'),
  validateBody(updateRecordSchema),
  VaccineController.updateRecord
);

// POST /api/v1/babies/:babyId/vaccines/record/:id/apply - Marca como aplicada
babyVaccineRouter.post(
  '/record/:id/apply',
  requirePermission('canRegisterRoutines'),
  validateBody(markAsAppliedSchema),
  VaccineController.markAsApplied
);

// POST /api/v1/babies/:babyId/vaccines/record/:id/skip - Marca como pulada
babyVaccineRouter.post(
  '/record/:id/skip',
  requirePermission('canEditRoutines'),
  validateBody(markAsSkippedSchema),
  VaccineController.markAsSkipped
);

// POST /api/v1/babies/:babyId/vaccines/record/:id/reset - Reseta para pendente
babyVaccineRouter.post(
  '/record/:id/reset',
  requirePermission('canEditRoutines'),
  VaccineController.resetToPending
);

// DELETE /api/v1/babies/:babyId/vaccines/record/:id - Remove registro
babyVaccineRouter.delete(
  '/record/:id',
  requirePermission('canDeleteRoutines'),
  VaccineController.deleteRecord
);
