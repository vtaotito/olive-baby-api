// Olive Baby API - Admin AI Controller
import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AdminAiService } from '../services/admin-ai.service';
import { AuthenticatedRequest, ApiResponse } from '../types';

// ==========================================
// Validation Schemas
// ==========================================

export const createConfigSchema = z.object({
  name: z.string().min(1).max(100),
  systemPrompt: z.string().min(1),
  guardrails: z.record(z.unknown()).optional(),
  model: z.string().max(50).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(100).max(8000).optional(),
});

export const updateConfigSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  systemPrompt: z.string().min(1).optional(),
  guardrails: z.record(z.unknown()).optional(),
  model: z.string().max(50).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(100).max(8000).optional(),
});

export const listDocumentsQuerySchema = z.object({
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
  tag: z.string().optional(),
  q: z.string().optional(),
});

export const createDocumentSchema = z.object({
  title: z.string().min(1).max(255),
  sourceType: z.enum(['file', 'url', 'manual']),
  content: z.string().min(1),
  tags: z.array(z.string()).optional(),
});

export const updateDocumentSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  sourceType: z.enum(['file', 'url', 'manual']).optional(),
  content: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
});

// ==========================================
// Controller
// ==========================================

export class AdminAiController {
  // ==========================================
  // AI Configuration Endpoints
  // ==========================================

  /**
   * GET /admin/ai/config
   * Get all configs (published + drafts)
   */
  static async getConfigs(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const configs = await AdminAiService.getConfigs();

      res.json({
        success: true,
        data: configs,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /admin/ai/config/:id
   * Get config by ID
   */
  static async getConfigById(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      const config = await AdminAiService.getConfigById(id);

      res.json({
        success: true,
        data: config,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /admin/ai/config
   * Create new config (draft)
   */
  static async createConfig(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const data = createConfigSchema.parse(req.body);
      const config = await AdminAiService.createConfig(data, req.user?.userId);

      res.status(201).json({
        success: true,
        message: 'Configuração criada com sucesso',
        data: config,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /admin/ai/config/:id
   * Update config
   */
  static async updateConfig(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      const data = updateConfigSchema.parse(req.body);
      const config = await AdminAiService.updateConfig(id, data);

      res.json({
        success: true,
        message: 'Configuração atualizada',
        data: config,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /admin/ai/config/:id/publish
   * Publish config
   */
  static async publishConfig(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      const config = await AdminAiService.publishConfig(id);

      res.json({
        success: true,
        message: `Configuração publicada como versão ${config?.version}`,
        data: config,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /admin/ai/config/:id/duplicate
   * Duplicate config to create new draft
   */
  static async duplicateConfig(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      const config = await AdminAiService.duplicateConfig(id, req.user?.userId);

      res.status(201).json({
        success: true,
        message: 'Configuração duplicada',
        data: config,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /admin/ai/config/:id
   * Delete draft config
   */
  static async deleteConfig(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      await AdminAiService.deleteConfig(id);

      res.json({
        success: true,
        message: 'Configuração excluída',
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // Knowledge Base Endpoints
  // ==========================================

  /**
   * GET /admin/ai/kb
   * List KB documents
   */
  static async listDocuments(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const filters = listDocumentsQuerySchema.parse(req.query);
      const documents = await AdminAiService.listDocuments({
        status: filters.status as any,
        tag: filters.tag,
        search: filters.q,
      });

      res.json({
        success: true,
        data: documents,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /admin/ai/kb/:id
   * Get document by ID
   */
  static async getDocumentById(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      const document = await AdminAiService.getDocumentById(id);

      res.json({
        success: true,
        data: document,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /admin/ai/kb
   * Create KB document
   */
  static async createDocument(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const data = createDocumentSchema.parse(req.body);
      const document = await AdminAiService.createDocument(data, req.user?.userId);

      res.status(201).json({
        success: true,
        message: 'Documento criado',
        data: document,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /admin/ai/kb/:id
   * Update KB document
   */
  static async updateDocument(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      const data = updateDocumentSchema.parse(req.body);
      const document = await AdminAiService.updateDocument(id, data);

      res.json({
        success: true,
        message: 'Documento atualizado',
        data: document,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /admin/ai/kb/:id/publish
   * Publish KB document
   */
  static async publishDocument(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      const document = await AdminAiService.publishDocument(id);

      res.json({
        success: true,
        message: 'Documento publicado',
        data: document,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /admin/ai/kb/:id/archive
   * Archive KB document
   */
  static async archiveDocument(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      const document = await AdminAiService.archiveDocument(id);

      res.json({
        success: true,
        message: 'Documento arquivado',
        data: document,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /admin/ai/kb/:id
   * Delete KB document
   */
  static async deleteDocument(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      await AdminAiService.deleteDocument(id);

      res.json({
        success: true,
        message: 'Documento excluído',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /admin/ai/kb/tags
   * Get all unique tags
   */
  static async getAllTags(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const tags = await AdminAiService.getAllTags();

      res.json({
        success: true,
        data: tags,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /admin/ai/kb/stats
   * Get KB statistics
   */
  static async getKbStats(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const stats = await AdminAiService.getKbStats();

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /admin/ai/preview
   * Preview assembled prompt
   */
  static async previewPrompt(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const preview = await AdminAiService.previewAssembledPrompt();

      res.json({
        success: true,
        data: preview,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default AdminAiController;
