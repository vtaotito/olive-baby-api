// Olive Baby API - Admin AI Routes
import { Router } from 'express';
import { AdminAiController } from '../controllers/admin-ai.controller';
import { authMiddleware, requireAdmin } from '../middlewares/auth.middleware';
import { validateBody, validateQuery } from '../middlewares/validation.middleware';
import {
  createConfigSchema,
  updateConfigSchema,
  listDocumentsQuerySchema,
  createDocumentSchema,
  updateDocumentSchema,
} from '../controllers/admin-ai.controller';

const router = Router();

// All routes require auth + admin role
router.use(authMiddleware);
router.use(requireAdmin);

// ==========================================
// AI Configuration Routes
// ==========================================

// GET /admin/ai/config - Get all configs
router.get('/config', AdminAiController.getConfigs);

// GET /admin/ai/config/:id - Get config by ID
router.get('/config/:id', AdminAiController.getConfigById);

// POST /admin/ai/config - Create new config (draft)
router.post(
  '/config',
  validateBody(createConfigSchema),
  AdminAiController.createConfig
);

// PATCH /admin/ai/config/:id - Update config
router.patch(
  '/config/:id',
  validateBody(updateConfigSchema),
  AdminAiController.updateConfig
);

// POST /admin/ai/config/:id/publish - Publish config
router.post('/config/:id/publish', AdminAiController.publishConfig);

// POST /admin/ai/config/:id/duplicate - Duplicate config
router.post('/config/:id/duplicate', AdminAiController.duplicateConfig);

// DELETE /admin/ai/config/:id - Delete draft config
router.delete('/config/:id', AdminAiController.deleteConfig);

// ==========================================
// Knowledge Base Routes
// ==========================================

// GET /admin/ai/kb/tags - Get all unique tags (before /:id route)
router.get('/kb/tags', AdminAiController.getAllTags);

// GET /admin/ai/kb/stats - Get KB statistics
router.get('/kb/stats', AdminAiController.getKbStats);

// GET /admin/ai/kb - List KB documents
router.get(
  '/kb',
  validateQuery(listDocumentsQuerySchema),
  AdminAiController.listDocuments
);

// GET /admin/ai/kb/:id - Get document by ID
router.get('/kb/:id', AdminAiController.getDocumentById);

// POST /admin/ai/kb - Create KB document
router.post(
  '/kb',
  validateBody(createDocumentSchema),
  AdminAiController.createDocument
);

// PATCH /admin/ai/kb/:id - Update KB document
router.patch(
  '/kb/:id',
  validateBody(updateDocumentSchema),
  AdminAiController.updateDocument
);

// POST /admin/ai/kb/:id/publish - Publish KB document
router.post('/kb/:id/publish', AdminAiController.publishDocument);

// POST /admin/ai/kb/:id/archive - Archive KB document
router.post('/kb/:id/archive', AdminAiController.archiveDocument);

// DELETE /admin/ai/kb/:id - Delete KB document
router.delete('/kb/:id', AdminAiController.deleteDocument);

// ==========================================
// Preview/Test Routes
// ==========================================

// GET /admin/ai/preview - Preview assembled prompt
router.get('/preview', AdminAiController.previewPrompt);

export default router;
