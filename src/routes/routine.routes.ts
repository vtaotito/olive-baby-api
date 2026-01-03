// Olive Baby API - Routine Routes
import { Router } from 'express';
import { 
  RoutineController, 
  createRoutineSchema, 
  updateRoutineSchema,
  startRoutineSchema,
  closeRoutineSchema,
  instantRoutineSchema,
  listRoutinesQuerySchema 
} from '../controllers/routine.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { validateBody, validateQuery } from '../middlewares/validation.middleware';
import { requirePermission } from '../middlewares/permission.middleware';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// ==========================================
// Verificar Rotina Aberta (Genérico)
// ==========================================

// GET /api/v1/routines/open - Verifica qualquer rotina aberta
// Query params: babyId, routineType (FEEDING, SLEEP, BATH)
router.get('/open', RoutineController.getOpenRoutine);

// ==========================================
// CRUD Básico
// ==========================================

// GET /api/v1/routines - Lista rotinas (com query params)
router.get('/', validateQuery(listRoutinesQuerySchema), RoutineController.list);

// POST /api/v1/routines - Cria rotina
router.post(
  '/', 
  requirePermission('canRegisterRoutines'),
  validateBody(createRoutineSchema), 
  RoutineController.create
);

// GET /api/v1/routines/baby/:babyId - Lista rotinas de um bebê específico
router.get('/baby/:babyId', RoutineController.listByBaby);

// GET /api/v1/routines/log/:id - Detalhes de uma rotina específica
router.get('/log/:id', RoutineController.getById);

// GET /api/v1/routines/:babyId - Alias para listar rotinas (compatibilidade com frontend)
router.get('/:babyId', RoutineController.listByBaby);

// PUT /api/v1/routines/log/:id - Atualiza rotina
router.put(
  '/log/:id', 
  requirePermission('canEditRoutines'),
  validateBody(updateRoutineSchema), 
  RoutineController.update
);

// PATCH /api/v1/routines/log/:id - Atualiza rotina (alias)
router.patch(
  '/log/:id', 
  requirePermission('canEditRoutines'),
  validateBody(updateRoutineSchema), 
  RoutineController.update
);

// DELETE /api/v1/routines/log/:id - Remove rotina
router.delete(
  '/log/:id', 
  requirePermission('canDeleteRoutines'),
  RoutineController.delete
);

// ==========================================
// Sono (Sleep) - Com timer
// ==========================================

// POST /api/v1/routines/sleep/start - Inicia sono
router.post(
  '/sleep/start', 
  requirePermission('canRegisterRoutines'),
  validateBody(startRoutineSchema), 
  RoutineController.startSleep
);

// POST /api/v1/routines/sleep/close - Finaliza sono
router.post(
  '/sleep/close', 
  requirePermission('canRegisterRoutines'),
  validateBody(closeRoutineSchema), 
  RoutineController.closeSleep
);

// GET /api/v1/routines/sleep/open - Verifica sono em aberto
router.get('/sleep/open', RoutineController.getOpenSleep);

// ==========================================
// Alimentação (Feeding) - Com timer
// ==========================================

// POST /api/v1/routines/feeding/start - Inicia alimentação
router.post(
  '/feeding/start', 
  requirePermission('canRegisterRoutines'),
  validateBody(startRoutineSchema), 
  RoutineController.startFeeding
);

// POST /api/v1/routines/feeding/close - Finaliza alimentação
router.post(
  '/feeding/close', 
  requirePermission('canRegisterRoutines'),
  validateBody(closeRoutineSchema), 
  RoutineController.closeFeeding
);

// GET /api/v1/routines/feeding/open - Verifica alimentação em aberto
router.get('/feeding/open', RoutineController.getOpenFeeding);

// ==========================================
// Banho (Bath) - Com timer
// ==========================================

// POST /api/v1/routines/bath/start - Inicia banho
router.post(
  '/bath/start', 
  requirePermission('canRegisterRoutines'),
  validateBody(startRoutineSchema), 
  RoutineController.startBath
);

// POST /api/v1/routines/bath/close - Finaliza banho
router.post(
  '/bath/close', 
  requirePermission('canRegisterRoutines'),
  validateBody(closeRoutineSchema), 
  RoutineController.closeBath
);

// GET /api/v1/routines/bath/open - Verifica banho em aberto
router.get('/bath/open', RoutineController.getOpenBath);

// ==========================================
// Fralda (Diaper) - Instantâneo
// ==========================================

// POST /api/v1/routines/diaper - Registra fralda
router.post(
  '/diaper', 
  requirePermission('canRegisterRoutines'),
  validateBody(instantRoutineSchema), 
  RoutineController.registerDiaper
);

// ==========================================
// Extração de Leite - Com timer
// ==========================================

// POST /api/v1/routines/extraction/start - Inicia extração
router.post(
  '/extraction/start', 
  requirePermission('canRegisterRoutines'),
  validateBody(startRoutineSchema), 
  RoutineController.startExtraction
);

// POST /api/v1/routines/extraction/close - Finaliza extração
router.post(
  '/extraction/close', 
  requirePermission('canRegisterRoutines'),
  validateBody(closeRoutineSchema), 
  RoutineController.closeExtraction
);

// GET /api/v1/routines/extraction/open - Verifica extração em aberto
router.get('/extraction/open', RoutineController.getOpenExtraction);

// POST /api/v1/routines/extraction - Registra extração instantânea (compatibilidade)
router.post(
  '/extraction', 
  requirePermission('canRegisterRoutines'),
  validateBody(instantRoutineSchema), 
  RoutineController.registerExtraction
);

// ==========================================
// Rotas de Compatibilidade (Active/:babyId)
// ==========================================

// GET /api/v1/routines/feeding/active/:babyId - Verifica alimentação ativa (compatibilidade)
router.get('/feeding/active/:babyId', RoutineController.getActiveFeeding);

// GET /api/v1/routines/sleep/active/:babyId - Verifica sono ativo (compatibilidade)
router.get('/sleep/active/:babyId', RoutineController.getActiveSleep);

// GET /api/v1/routines/bath/active/:babyId - Verifica banho ativo (compatibilidade)
router.get('/bath/active/:babyId', RoutineController.getActiveBath);

// GET /api/v1/routines/extraction/active/:babyId - Verifica extração ativa (compatibilidade)
router.get('/extraction/active/:babyId', RoutineController.getActiveExtraction);

export default router;
