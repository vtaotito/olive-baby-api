import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { SocialService } from '../services/social.service';
import { AISocialContentService } from '../services/ai-social-content.service';
import { SocialPublisherService } from '../services/social-publisher.service';
import { AIImageService } from '../services/ai-image.service';
import { AuthenticatedRequest, ApiResponse } from '../types';

// ==========================================
// Validation Schemas
// ==========================================

const platformEnum = z.enum(['INSTAGRAM', 'LINKEDIN', 'FACEBOOK', 'TWITTER', 'THREADS', 'TIKTOK', 'YOUTUBE', 'BLUESKY']);
const audienceEnum = z.enum(['b2c_parents', 'b2b_pediatricians', 'b2b_lactation', 'b2b_caregivers']).optional();

export const adminSocialPostsQuerySchema = z.object({
  page: z.string().optional().transform(v => v ? parseInt(v) : 1),
  limit: z.string().optional().transform(v => v ? parseInt(v) : 20),
  status: z.enum(['IDEA', 'DRAFT', 'IN_REVIEW', 'APPROVED', 'SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'FAILED', 'ARCHIVED']).optional(),
  audience: z.string().optional(),
  platform: z.string().optional(),
  q: z.string().optional(),
});

export const createSocialPostSchema = z.object({
  caption: z.string().min(1).max(5000),
  mediaUrls: z.array(z.string().url()).optional(),
  audience: audienceEnum,
  hashtags: z.array(z.string()).optional(),
  scheduledAt: z.string().datetime().optional(),
  aiGenerated: z.boolean().optional(),
  aiPromptUsed: z.string().optional(),
  status: z.enum(['IDEA', 'DRAFT', 'IN_REVIEW']).optional(),
  accountIds: z.array(z.number().int().positive()).optional(),
});

export const updateSocialPostSchema = z.object({
  caption: z.string().min(1).max(5000).optional(),
  mediaUrls: z.array(z.string().url()).optional(),
  audience: audienceEnum,
  hashtags: z.array(z.string()).optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
  status: z.enum(['IDEA', 'DRAFT', 'IN_REVIEW']).optional(),
  accountIds: z.array(z.number().int().positive()).optional(),
});

export const reviewSocialPostSchema = z.object({
  approved: z.boolean(),
  reviewNotes: z.string().max(1000).optional(),
});

export const scheduleSocialPostSchema = z.object({
  scheduledAt: z.string().datetime(),
});

export const createAccountSchema = z.object({
  platform: platformEnum,
  accountName: z.string().min(1).max(100),
  accountId: z.string().min(1).max(255),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  externalData: z.record(z.unknown()).optional(),
});

export const generateSocialTopicsSchema = z.object({
  count: z.number().int().min(1).max(10).optional(),
  audience: audienceEnum,
  platforms: z.array(z.string()).optional(),
});

export const generateCaptionSchema = z.object({
  idea: z.string().min(1).max(1000),
  audience: audienceEnum,
  platforms: z.array(z.string()).optional(),
});

export const generateSocialImageSchema = z.object({
  caption: z.string().min(1).max(5000),
  postId: z.number().int().positive().optional(),
});

// ==========================================
// Controller
// ==========================================

export class SocialController {
  // Posts CRUD
  static async listPosts(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const { page, limit, status, audience, platform, q } = req.query as any;
      const result = await SocialService.listPosts({
        page: page ? parseInt(page) : undefined,
        limit: limit ? parseInt(limit) : undefined,
        status, audience, platform, q,
      });
      res.json({ success: true, data: result.data, pagination: result.pagination });
    } catch (error) { next(error); }
  }

  static async getPost(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const post = await SocialService.getPostById(parseInt(req.params.id));
      res.json({ success: true, data: post });
    } catch (error) { next(error); }
  }

  static async createPost(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const post = await SocialService.createPost({ ...req.body, authorId: req.user?.userId });
      res.status(201).json({ success: true, data: post });
    } catch (error) { next(error); }
  }

  static async updatePost(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const post = await SocialService.updatePost(parseInt(req.params.id), req.body);
      res.json({ success: true, data: post });
    } catch (error) { next(error); }
  }

  static async deletePost(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      await SocialService.deletePost(parseInt(req.params.id));
      res.json({ success: true, message: 'Post excluído' });
    } catch (error) { next(error); }
  }

  // Workflow
  static async reviewPost(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const post = await SocialService.reviewPost(parseInt(req.params.id), {
        ...req.body, reviewedBy: req.user!.userId,
      });
      res.json({ success: true, data: post });
    } catch (error) { next(error); }
  }

  static async publishPost(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const post = await SocialService.publishPost(parseInt(req.params.id));
      res.json({ success: true, data: post });
    } catch (error) { next(error); }
  }

  static async schedulePost(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const post = await SocialService.schedulePost(parseInt(req.params.id), req.body.scheduledAt);
      res.json({ success: true, data: post });
    } catch (error) { next(error); }
  }

  static async archivePost(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const post = await SocialService.archivePost(parseInt(req.params.id));
      res.json({ success: true, data: post });
    } catch (error) { next(error); }
  }

  // Accounts
  static async listAccounts(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const accounts = await SocialService.listAccounts();
      res.json({ success: true, data: accounts });
    } catch (error) { next(error); }
  }

  static async createAccount(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const account = await SocialService.createAccount(req.body);
      res.status(201).json({ success: true, data: account });
    } catch (error) { next(error); }
  }

  static async deleteAccount(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      await SocialService.deleteAccount(parseInt(req.params.id));
      res.json({ success: true, message: 'Conta desconectada' });
    } catch (error) { next(error); }
  }

  static async testAccount(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const result = await SocialPublisherService.testConnection(req.params.id);
      res.json({ success: true, data: result });
    } catch (error) { next(error); }
  }

  // AI
  static async generateTopics(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const topics = await AISocialContentService.generateTopics(req.body);
      res.json({ success: true, data: topics });
    } catch (error) { next(error); }
  }

  static async generateCaption(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const caption = await AISocialContentService.generateCaption(req.body);
      res.json({ success: true, data: caption });
    } catch (error) { next(error); }
  }

  static async generateImage(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const { caption, postId } = req.body;
      const result = await AIImageService.generateCoverImage({
        title: caption.substring(0, 100),
        excerpt: caption.substring(0, 200),
        width: 1080,
        height: 1080,
      });

      if (postId) {
        await SocialService.updatePost(postId, { mediaUrls: [result.imageUrl] });
      }

      res.json({ success: true, data: result });
    } catch (error) { next(error); }
  }

  // Stats
  static async getStats(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const stats = await SocialService.getStats();
      res.json({ success: true, data: stats });
    } catch (error) { next(error); }
  }

  // n8n
  static async n8nSubmitDraft(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const post = await SocialService.createPost({ ...req.body, aiGenerated: true, status: 'IN_REVIEW' });
      res.status(201).json({ success: true, data: post });
    } catch (error) { next(error); }
  }
}
