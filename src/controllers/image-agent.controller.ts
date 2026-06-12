import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { ImageAgentCopyService } from '../services/image-agent-copy.service';
import { ImageAgentImageService } from '../services/image-agent-image.service';

export const imageAgentGenerateCopySchema = z.object({
  topico: z.string().min(3).max(500),
  format: z.enum(['blog', 'instagram']),
  templateId: z.enum(['essencial', 'jardim', 'impulso', 'afeto']),
});

export const imageAgentGenerateImageSchema = z.object({
  topico: z.string().min(1).max(500),
  excerpt: z.string().max(500).optional(),
  customPrompt: z.string().max(2000).optional(),
  format: z.enum(['blog', 'instagram']).default('blog'),
  templateId: z.enum(['essencial', 'jardim', 'impulso', 'afeto']).default('essencial'),
  provider: z.enum(['gemini', 'openai', 'pollinations']).optional(),
});

export class ImageAgentController {
  static async getConfig(_req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          providers: ImageAgentImageService.listProviders(),
          defaultProvider: ImageAgentImageService.defaultProvider(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
  static async generateCopy(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const data = await ImageAgentCopyService.generate(req.body);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async generateImage(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const { topico, excerpt, customPrompt, format, templateId, provider } = req.body;
      const result = await ImageAgentImageService.generate({
        topic: topico,
        excerpt,
        customPrompt,
        format,
        templateId,
        provider,
      });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}
