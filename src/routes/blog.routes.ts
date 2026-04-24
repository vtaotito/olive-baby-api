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

// GET /blog/images/:filename - Serve generated blog images
router.get('/images/:filename', BlogController.serveBlogImage);

// ==========================================
// SSR for crawlers (Googlebot, Bingbot, Facebook, etc.)
// ==========================================
// nginx faz proxy_pass destes endpoints quando detecta user-agent de bot.
// Retornam HTML completo com canonical correto e Schema.org BlogPosting.

// GET /blog/ssr - HTML renderizado da listagem do blog (para crawlers)
router.get('/ssr', BlogController.ssrList);

// GET /blog/ssr/:slug - HTML renderizado de um post (para crawlers)
router.get('/ssr/:slug', BlogController.ssrPost);

export default router;
