import { Router } from 'express';
import { BlogController } from '../controllers/blog.controller';
import { validateQuery } from '../middlewares/validation.middleware';
import { publicPostsQuerySchema } from '../controllers/blog.controller';

const router = Router();

// GET /blog/posts - List published posts (paginated, filterable)
router.get('/posts', BlogController.listPublishedPosts);

// GET /blog/posts/:slug - Get published post by slug
router.get('/posts/:slug', BlogController.getPublishedPost);

// GET /blog/categories - List categories
router.get('/categories', BlogController.listPublicCategories);

// GET /blog/tags - List tags
router.get('/tags', BlogController.listPublicTags);

// GET /blog/sitemap - Sitemap XML
router.get('/sitemap', BlogController.getSitemap);

export default router;
