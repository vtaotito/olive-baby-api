import { Router } from 'express';
import { SocialController } from '../controllers/social.controller';
import { authMiddleware, requireAdmin } from '../middlewares/auth.middleware';
import { validateBody } from '../middlewares/validation.middleware';
import {
  createSocialPostSchema,
  updateSocialPostSchema,
  reviewSocialPostSchema,
  scheduleSocialPostSchema,
  createAccountSchema,
  generateSocialTopicsSchema,
  generateCaptionSchema,
  generateSocialImageSchema,
} from '../controllers/social.controller';

const router = Router();

router.use(authMiddleware);
router.use(requireAdmin);

// Posts CRUD
router.get('/posts', SocialController.listPosts);
router.post('/posts', validateBody(createSocialPostSchema), SocialController.createPost);
router.get('/posts/:id', SocialController.getPost);
router.put('/posts/:id', validateBody(updateSocialPostSchema), SocialController.updatePost);
router.delete('/posts/:id', SocialController.deletePost);

// Workflow
router.post('/posts/:id/review', validateBody(reviewSocialPostSchema), SocialController.reviewPost);
router.post('/posts/:id/publish', SocialController.publishPost);
router.post('/posts/:id/schedule', validateBody(scheduleSocialPostSchema), SocialController.schedulePost);
router.post('/posts/:id/archive', SocialController.archivePost);

// Accounts
router.get('/accounts', SocialController.listAccounts);
router.post('/accounts', validateBody(createAccountSchema), SocialController.createAccount);
router.delete('/accounts/:id', SocialController.deleteAccount);
router.post('/accounts/:id/test', SocialController.testAccount);

// AI
router.post('/ai/generate-topics', validateBody(generateSocialTopicsSchema), SocialController.generateTopics);
router.post('/ai/generate-caption', validateBody(generateCaptionSchema), SocialController.generateCaption);
router.post('/ai/generate-image', validateBody(generateSocialImageSchema), SocialController.generateImage);

// Stats
router.get('/stats', SocialController.getStats);

export default router;
