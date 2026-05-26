import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { ImageAgentCopyService } from '../services/image-agent-copy.service';
import { OpenAIImageService } from '../services/openai-image.service';

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
});

export class ImageAgentController {
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
      const { topico, excerpt, customPrompt, format, templateId } = req.body;
      const result = await OpenAIImageService.generate({
        topic: topico,
        excerpt,
        customPrompt,
        format,
        templateId,
      });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}
