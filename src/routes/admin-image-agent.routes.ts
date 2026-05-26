import { Router } from 'express';
import { authMiddleware, requireAdmin } from '../middlewares/auth.middleware';
import { validateBody } from '../middlewares/validation.middleware';
import {
  ImageAgentController,
  imageAgentGenerateCopySchema,
  imageAgentGenerateImageSchema,
} from '../controllers/image-agent.controller';

const router = Router();

router.use(authMiddleware, requireAdmin);

router.post('/generate-copy', validateBody(imageAgentGenerateCopySchema), ImageAgentController.generateCopy);
router.post('/generate-image', validateBody(imageAgentGenerateImageSchema), ImageAgentController.generateImage);

export default router;
