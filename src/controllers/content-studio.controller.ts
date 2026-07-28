import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest, ApiResponse } from '../types';
import {
  ContentStudioService,
  type ContentAudience,
  type ContentChannel,
  type RegeneratePart,
} from '../services/content-studio.service';

const audienceEnum = z.enum([
  'b2c_parents',
  'b2b_pediatricians',
  'b2b_lactation',
  'b2b_caregivers',
]);

const templateEnum = z.enum(['essencial', 'jardim', 'impulso', 'afeto']);

export const contentGenerateSchema = z.object({
  brief: z.string().min(3).max(1000),
  angle: z.string().max(500).optional(),
  audience: audienceEnum.default('b2c_parents'),
  channels: z.array(z.enum(['blog', 'social'])).min(1).max(2),
  targetKeywords: z.array(z.string().min(1).max(80)).max(20).optional(),
  templateId: templateEnum.optional(),
  accountIds: z.array(z.number().int().positive()).max(20).optional(),
  generateInlineImages: z.boolean().optional(),
});

export const contentRegenerateSchema = z.object({
  channel: z.enum(['blog', 'social']),
  id: z.number().int().positive(),
  part: z.enum(['content', 'seo', 'cover', 'caption', 'social_image', 'inline']),
  audience: audienceEnum.optional(),
  templateId: templateEnum.optional(),
});

export const contentFromBlogSchema = z.object({
  blogPostId: z.number().int().positive(),
  accountIds: z.array(z.number().int().positive()).max(20).optional(),
});

export const contentQueueQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform(v => {
      if (!v) return 30;
      const n = parseInt(v, 10);
      return Number.isFinite(n) && n > 0 ? Math.min(n, 100) : 30;
    }),
});

export class ContentStudioController {
  static async generate(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const body = req.body as z.infer<typeof contentGenerateSchema>;
      const result = await ContentStudioService.generate({
        ...body,
        audience: body.audience as ContentAudience,
        channels: body.channels as ContentChannel[],
        authorId: req.user?.userId,
      });
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async getQueue(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const { limit } = req.query as unknown as { limit: number };
      const queue = await ContentStudioService.getQueue(limit);
      res.json({ success: true, data: queue });
    } catch (error) {
      next(error);
    }
  }

  static async regenerate(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const body = req.body as z.infer<typeof contentRegenerateSchema>;
      const result = await ContentStudioService.regenerate({
        channel: body.channel as ContentChannel,
        id: body.id,
        part: body.part as RegeneratePart,
        audience: body.audience as ContentAudience | undefined,
        templateId: body.templateId,
      });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async createSocialFromBlog(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const body = req.body as z.infer<typeof contentFromBlogSchema>;
      const post = await ContentStudioService.createSocialFromBlog({
        blogPostId: body.blogPostId,
        accountIds: body.accountIds,
        authorId: req.user?.userId,
      });
      res.status(201).json({ success: true, data: post });
    } catch (error) {
      next(error);
    }
  }
}
