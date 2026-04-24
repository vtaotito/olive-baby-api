import { Router } from 'express';
import multer from 'multer';
import { BlogController } from '../controllers/blog.controller';
import { authMiddleware, requireAdmin } from '../middlewares/auth.middleware';
import { validateBody, validateQuery } from '../middlewares/validation.middleware';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  },
});
import {
  adminPostsQuerySchema,
  createPostSchema,
  updatePostSchema,
  reviewPostSchema,
  createCategorySchema,
  updateCategorySchema,
  createTagSchema,
  generateTopicsSchema,
  generateContentSchema,
  optimizeSeoSchema,
  generateImageSchema,
} from '../controllers/blog.controller';

const router = Router();

router.use(authMiddleware);
router.use(requireAdmin);

// ==========================================
// Posts CRUD
// ==========================================

router.get('/posts', BlogController.adminListPosts);
router.post('/posts', validateBody(createPostSchema), BlogController.adminCreatePost);
router.get('/posts/:id', BlogController.adminGetPost);
router.put('/posts/:id', validateBody(updatePostSchema), BlogController.adminUpdatePost);
router.delete('/posts/:id', BlogController.adminDeletePost);

// ==========================================
// Workflow Actions
// ==========================================

router.post('/posts/:id/review', validateBody(reviewPostSchema), BlogController.adminReviewPost);
router.post('/posts/:id/publish', BlogController.adminPublishPost);
router.post('/posts/:id/archive', BlogController.adminArchivePost);

// ==========================================
// Categories
// ==========================================

router.get('/categories', BlogController.adminListCategories);
router.post('/categories', validateBody(createCategorySchema), BlogController.adminCreateCategory);
router.patch('/categories/:id', validateBody(updateCategorySchema), BlogController.adminUpdateCategory);
router.delete('/categories/:id', BlogController.adminDeleteCategory);

// ==========================================
// Tags
// ==========================================

router.get('/tags', BlogController.adminListTags);
router.post('/tags', validateBody(createTagSchema), BlogController.adminCreateTag);
router.delete('/tags/:id', BlogController.adminDeleteTag);

// ==========================================
// AI Content Generation
// ==========================================

router.post('/ai/generate-topics', validateBody(generateTopicsSchema), BlogController.generateTopics);
router.post('/ai/generate-content', validateBody(generateContentSchema), BlogController.generateContent);
router.post('/ai/optimize-seo', validateBody(optimizeSeoSchema), BlogController.optimizeSeo);
router.post('/ai/generate-image', validateBody(generateImageSchema), BlogController.generateImage);

// Upload image from computer
router.post('/upload-image', upload.single('image'), BlogController.uploadImage);

// ==========================================
// Stats
// ==========================================

router.get('/stats', BlogController.adminGetStats);

export default router;
