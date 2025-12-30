// Olive Baby API - Export Routes
import { Router } from 'express';
import { 
  ExportController, 
  exportRoutinesQuerySchema,
  exportGrowthQuerySchema
} from '../controllers/export.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { validateQuery } from '../middlewares/validation.middleware';
import { requirePermission } from '../middlewares/permission.middleware';
import { requireExportAllowed } from '../middlewares/entitlements.middleware';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// GET /api/v1/export/:babyId/routines - Exportar rotinas em CSV
// Verifica: permissão de role E feature do plano (exportCsv/exportPdf)
router.get(
  '/:babyId/routines',
  requirePermission('canExportData'),
  requireExportAllowed(),
  validateQuery(exportRoutinesQuerySchema),
  ExportController.exportRoutines
);

// GET /api/v1/export/:babyId/growth - Exportar crescimento em CSV
router.get(
  '/:babyId/growth',
  requirePermission('canExportData'),
  requireExportAllowed(),
  validateQuery(exportGrowthQuerySchema),
  ExportController.exportGrowth
);

// GET /api/v1/export/:babyId/milestones - Exportar marcos em CSV
router.get(
  '/:babyId/milestones',
  requirePermission('canExportData'),
  requireExportAllowed(),
  ExportController.exportMilestones
);

// GET /api/v1/export/:babyId/full - Exportar relatório completo em CSV
router.get(
  '/:babyId/full',
  requirePermission('canExportData'),
  requireExportAllowed(),
  validateQuery(exportGrowthQuerySchema),
  ExportController.exportFullReport
);

export default router;
