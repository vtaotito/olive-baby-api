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
// CRUD Básico
// ==========================================

// GET /api/v1/routines - Lista rotinas
router.get('/', validateQuery(listRoutinesQuerySchema), RoutineController.list);

// POST /api/v1/routines - Cria rotina
router.post(
  '/', 
  requirePermission('canRegisterRoutines'),
  validateBody(createRoutineSchema), 
  RoutineController.create
);

// GET /api/v1/routines/:id - Detalhes da rotina
router.get('/:id', RoutineController.getById);

// PUT /api/v1/routines/:id - Atualiza rotina
router.put(
  '/:id', 
  requirePermission('canEditRoutines'),
  validateBody(updateRoutineSchema), 
  RoutineController.update
);

// DELETE /api/v1/routines/:id - Remove rotina
router.delete(
  '/:id', 
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
// Extração de Leite - Instantâneo
// ==========================================

// POST /api/v1/routines/extraction - Registra extração
router.post(
  '/extraction', 
  requirePermission('canRegisterRoutines'),
  validateBody(instantRoutineSchema), 
  RoutineController.registerExtraction
);

export default router;
