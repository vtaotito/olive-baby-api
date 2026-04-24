import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { BlogService } from '../services/blog.service';
import { AIContentService } from '../services/ai-content.service';
import { AIImageService } from '../services/ai-image.service';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { env } from '../config/env';

// ==========================================
// Validation Schemas
// ==========================================

export const publicPostsQuerySchema = z.object({
  page: z.string().optional().transform(v => v ? parseInt(v) : 1),
  limit: z.string().optional().transform(v => v ? parseInt(v) : 12),
  category: z.string().optional(),
  tag: z.string().optional(),
  q: z.string().optional(),
});

export const adminPostsQuerySchema = z.object({
  page: z.string().optional().transform(v => v ? parseInt(v) : 1),
  limit: z.string().optional().transform(v => v ? parseInt(v) : 20),
  status: z.enum(['IDEA', 'DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED']).optional(),
  categoryId: z.string().optional().transform(v => v ? parseInt(v) : undefined),
  q: z.string().optional(),
});

export const createPostSchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string().min(1),
  excerpt: z.string().max(500).optional(),
  coverImageUrl: z.string().url().optional(),
  categoryId: z.number().int().positive().optional(),
  tagNames: z.array(z.string()).optional(),
  seoTitle: z.string().max(70).optional(),
  seoDescription: z.string().max(160).optional(),
  seoKeywords: z.array(z.string()).optional(),
  ogImageUrl: z.string().url().optional(),
  schemaMarkup: z.record(z.unknown()).optional(),
  aiGenerated: z.boolean().optional(),
  aiPromptUsed: z.string().optional(),
  status: z.enum(['IDEA', 'DRAFT', 'IN_REVIEW']).optional(),
});

export const updatePostSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  content: z.string().min(1).optional(),
  excerpt: z.string().max(500).optional(),
  coverImageUrl: z.string().url().nullable().optional(),
  categoryId: z.number().int().positive().nullable().optional(),
  tagNames: z.array(z.string()).optional(),
  seoTitle: z.string().max(70).optional(),
  seoDescription: z.string().max(160).optional(),
  seoKeywords: z.array(z.string()).optional(),
  ogImageUrl: z.string().url().nullable().optional(),
  schemaMarkup: z.record(z.unknown()).optional(),
  status: z.enum(['IDEA', 'DRAFT', 'IN_REVIEW']).optional(),
});

export const reviewPostSchema = z.object({
  approved: z.boolean(),
  reviewNotes: z.string().max(1000).optional(),
});

export const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
});

export const createTagSchema = z.object({
  name: z.string().min(1).max(50),
});

const audienceEnum = z.enum(['b2c_parents', 'b2b_pediatricians', 'b2b_lactation', 'b2b_caregivers']).optional();

export const generateTopicsSchema = z.object({
  count: z.number().int().min(1).max(10).optional(),
  focus: z.string().max(500).optional(),
  audience: audienceEnum,
});

export const generateContentSchema = z.object({
  title: z.string().min(1).max(500),
  angle: z.string().max(500).optional(),
  targetKeywords: z.array(z.string()).optional(),
  audience: audienceEnum,
});

export const optimizeSeoSchema = z.object({
  postId: z.number().int().positive(),
});

export const generateImageSchema = z.object({
  title: z.string().min(1).max(500),
  excerpt: z.string().max(500).optional(),
  customPrompt: z.string().max(1000).optional(),
  width: z.number().int().min(256).max(1920).optional(),
  height: z.number().int().min(256).max(1920).optional(),
  postId: z.number().int().positive().optional(),
});

// ==========================================
// Controller
// ==========================================

export class BlogController {
  // ==========================================
  // Public Endpoints
  // ==========================================

  static async listPublishedPosts(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const { page, limit, category, tag, q } = req.query as any;
      const result = await BlogService.listPublishedPosts({
        page: page ? parseInt(page) : undefined,
        limit: limit ? parseInt(limit) : undefined,
        categorySlug: category as string,
        tagSlug: tag as string,
        q: q as string,
      });
      res.json({ success: true, data: result.data, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  static async getPublishedPost(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const post = await BlogService.getPublishedPostBySlug(req.params.slug);
      res.json({ success: true, data: post });
    } catch (error) {
      next(error);
    }
  }

  static async listPublicCategories(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const categories = await BlogService.listCategories();
      res.json({ success: true, data: categories });
    } catch (error) {
      next(error);
    }
  }

  static async listPublicTags(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const tags = await BlogService.listTags();
      res.json({ success: true, data: tags });
    } catch (error) {
      next(error);
    }
  }

  static async getSitemap(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const entries = await BlogService.getSitemapEntries();
      const frontendUrl = env.FRONTEND_URL;

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${frontendUrl}/blog</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
${entries.map(e => `  <url>
    <loc>${frontendUrl}/blog/${e.slug}</loc>
    <lastmod>${(e.updatedAt || e.publishedAt || new Date()).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`).join('\n')}
</urlset>`;

      res.header('Content-Type', 'application/xml');
      res.send(xml);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // Admin Endpoints
  // ==========================================

  static async adminListPosts(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const { page, limit, status, categoryId, q } = req.query as any;
      const result = await BlogService.listAllPosts({
        page: page ? parseInt(page) : undefined,
        limit: limit ? parseInt(limit) : undefined,
        status,
        categoryId: categoryId ? parseInt(categoryId) : undefined,
        q,
      });
      res.json({ success: true, data: result.data, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  static async adminGetPost(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const post = await BlogService.getPostById(parseInt(req.params.id));
      res.json({ success: true, data: post });
    } catch (error) {
      next(error);
    }
  }

  static async adminCreatePost(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const post = await BlogService.createPost({
        ...req.body,
        authorId: req.user?.userId,
      });
      res.status(201).json({ success: true, data: post });
    } catch (error) {
      next(error);
    }
  }

  static async adminUpdatePost(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const post = await BlogService.updatePost(parseInt(req.params.id), req.body);
      res.json({ success: true, data: post });
    } catch (error) {
      next(error);
    }
  }

  static async adminDeletePost(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      await BlogService.deletePost(parseInt(req.params.id));
      res.json({ success: true, message: 'Post excluído' });
    } catch (error) {
      next(error);
    }
  }

  static async adminReviewPost(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const post = await BlogService.reviewPost(parseInt(req.params.id), {
        ...req.body,
        reviewedBy: req.user!.userId,
      });
      res.json({ success: true, data: post });
    } catch (error) {
      next(error);
    }
  }

  static async adminPublishPost(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const post = await BlogService.publishPost(parseInt(req.params.id));
      res.json({ success: true, data: post });
    } catch (error) {
      next(error);
    }
  }

  static async adminArchivePost(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const post = await BlogService.archivePost(parseInt(req.params.id));
      res.json({ success: true, data: post });
    } catch (error) {
      next(error);
    }
  }

  static async adminGetStats(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const stats = await BlogService.getStats();
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // Category Management
  // ==========================================

  static async adminListCategories(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const categories = await BlogService.listCategories();
      res.json({ success: true, data: categories });
    } catch (error) {
      next(error);
    }
  }

  static async adminCreateCategory(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const category = await BlogService.createCategory(req.body);
      res.status(201).json({ success: true, data: category });
    } catch (error) {
      next(error);
    }
  }

  static async adminUpdateCategory(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const category = await BlogService.updateCategory(parseInt(req.params.id), req.body);
      res.json({ success: true, data: category });
    } catch (error) {
      next(error);
    }
  }

  static async adminDeleteCategory(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      await BlogService.deleteCategory(parseInt(req.params.id));
      res.json({ success: true, message: 'Categoria excluída' });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // Tag Management
  // ==========================================

  static async adminListTags(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const tags = await BlogService.listTags();
      res.json({ success: true, data: tags });
    } catch (error) {
      next(error);
    }
  }

  static async adminCreateTag(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const tag = await BlogService.createTag(req.body);
      res.status(201).json({ success: true, data: tag });
    } catch (error) {
      next(error);
    }
  }

  static async adminDeleteTag(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      await BlogService.deleteTag(parseInt(req.params.id));
      res.json({ success: true, message: 'Tag excluída' });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // AI Content Generation
  // ==========================================

  static async generateTopics(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const topics = await AIContentService.generateTopics(req.body);
      res.json({ success: true, data: topics });
    } catch (error) {
      next(error);
    }
  }

  static async generateContent(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const content = await AIContentService.generateContent(req.body);
      res.json({ success: true, data: content });
    } catch (error) {
      next(error);
    }
  }

  static async optimizeSeo(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const { postId } = req.body;
      const post = await BlogService.getPostById(postId);
      const optimization = await AIContentService.optimizeSEO({
        id: post.id,
        title: post.title,
        content: post.content,
        excerpt: post.excerpt,
      });

      const updated = await BlogService.updatePost(postId, {
        seoTitle: optimization.seoTitle,
        seoDescription: optimization.seoDescription,
        seoKeywords: optimization.seoKeywords,
        schemaMarkup: optimization.schemaMarkup,
      });

      res.json({ success: true, data: { optimization, post: updated } });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // AI Image Generation
  // ==========================================

  static async generateImage(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const { title, excerpt, customPrompt, width, height, postId } = req.body;
      const result = await AIImageService.generateCoverImage({ title, excerpt, customPrompt, width, height });

      if (postId) {
        await BlogService.updatePost(postId, {
          coverImageUrl: result.imageUrl,
          ogImageUrl: result.imageUrl,
        });
      }

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async uploadImage(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, message: 'Nenhum arquivo enviado' });
        return;
      }
      const result = AIImageService.saveUploadedImage(req.file);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async serveBlogImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filepath = AIImageService.getImagePath(req.params.filename);
      if (!filepath) {
        res.status(404).json({ success: false, message: 'Imagem não encontrada' });
        return;
      }
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('Content-Type', 'image/jpeg');
      res.sendFile(filepath);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // n8n Integration
  // ==========================================

  static async n8nSubmitDraft(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const post = await BlogService.createPost({
        ...req.body,
        aiGenerated: true,
        status: 'IN_REVIEW',
      });
      res.status(201).json({ success: true, data: post });
    } catch (error) {
      next(error);
    }
  }

  static async n8nPendingTopics(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const result = await BlogService.listAllPosts({ status: 'IDEA', limit: 50 });
      res.json({ success: true, data: result.data });
    } catch (error) {
      next(error);
    }
  }
}
