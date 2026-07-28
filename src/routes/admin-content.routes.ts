import { Router } from 'express';
import { authMiddleware, requireAdmin } from '../middlewares/auth.middleware';
import { validateBody, validateQuery } from '../middlewares/validation.middleware';
import {
  ContentStudioController,
  contentGenerateSchema,
  contentRegenerateSchema,
  contentFromBlogSchema,
  contentQueueQuerySchema,
} from '../controllers/content-studio.controller';

const router = Router();

router.use(authMiddleware);
router.use(requireAdmin);

router.post('/generate', validateBody(contentGenerateSchema), ContentStudioController.generate);
router.get('/queue', validateQuery(contentQueueQuerySchema), ContentStudioController.getQueue);
router.post('/regenerate', validateBody(contentRegenerateSchema), ContentStudioController.regenerate);
router.post(
  '/from-blog',
  validateBody(contentFromBlogSchema),
  ContentStudioController.createSocialFromBlog
);

export default router;
