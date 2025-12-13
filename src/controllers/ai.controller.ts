// Olive Baby API - AI Controller
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { aiChatService, aiInsightService, openaiService, ragService } from '../services/ai';
import { prisma } from '../config/database';
import { AppError } from '../utils/errors/AppError';
import { logger } from '../config/logger';

export class AIController {
  // ==========================================
  // Chat Sessions
  // ==========================================

  /**
   * POST /ai/chat/sessions
   * Create a new chat session
   */
  static async createSession(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { babyId, title } = req.body;
      const userId = req.user!.userId;

      if (!babyId) {
        throw AppError.badRequest('babyId é obrigatório');
      }

      const session = await aiChatService.createSession({
        userId,
        babyId: Number(babyId),
        title,
      });

      res.status(201).json({
        success: true,
        data: session,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /ai/chat/sessions
   * List chat sessions for user
   */
  static async listSessions(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const { babyId } = req.query;

      const sessions = await aiChatService.listSessions(
        userId,
        babyId ? Number(babyId) : undefined
      );

      res.json({
        success: true,
        data: sessions,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /ai/chat/sessions/:id
   * Get session with messages
   */
  static async getSession(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const sessionId = Number(req.params.id);

      const session = await aiChatService.getSession(userId, sessionId);

      res.json({
        success: true,
        data: session,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /ai/chat/sessions/:id/messages
   * Send message to assistant
   */
  static async sendMessage(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const sessionId = Number(req.params.id);
      const { message } = req.body;

      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        throw AppError.badRequest('Mensagem é obrigatória');
      }

      // Check if OpenAI is configured
      if (!openaiService.isConfigured()) {
        throw AppError.internal('Serviço de IA não está configurado');
      }

      // Get caregiver ID
      const caregiver = await prisma.caregiver.findFirst({
        where: { userId },
      });

      if (!caregiver) {
        throw AppError.forbidden('Usuário não é um cuidador');
      }

      const result = await aiChatService.sendMessage({
        userId,
        caregiverId: caregiver.id,
        sessionId,
        message: message.trim(),
      });

      res.json({
        success: true,
        data: {
          userMessage: result.userMessage,
          assistantMessage: result.assistantMessage,
          citations: result.citations,
          toolsUsed: result.toolsUsed,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /ai/chat/sessions/:id
   * Delete a chat session
   */
  static async deleteSession(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const sessionId = Number(req.params.id);

      await aiChatService.deleteSession(userId, sessionId);

      res.json({
        success: true,
        message: 'Sessão deletada com sucesso',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /ai/chat/sessions/:id/archive
   * Archive a chat session
   */
  static async archiveSession(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const sessionId = Number(req.params.id);

      await aiChatService.archiveSession(userId, sessionId);

      res.json({
        success: true,
        message: 'Sessão arquivada com sucesso',
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // Insights
  // ==========================================

  /**
   * GET /ai/insights/:babyId
   * Get insights for a baby
   */
  static async getInsights(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const babyId = Number(req.params.babyId);
      const { includeRead, includeDismissed, refresh } = req.query;

      // Get caregiver ID
      const caregiver = await prisma.caregiver.findFirst({
        where: { userId },
      });

      if (!caregiver) {
        throw AppError.forbidden('Usuário não é um cuidador');
      }

      // Generate new insights if refresh=true
      if (refresh === 'true') {
        await aiInsightService.generateInsights(caregiver.id, babyId);
      }

      const insights = await aiInsightService.getInsights(caregiver.id, babyId, {
        includeRead: includeRead === 'true',
        includeDismissed: includeDismissed === 'true',
      });

      res.json({
        success: true,
        data: insights,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /ai/insights/:babyId/generate
   * Force generate insights for a baby
   */
  static async generateInsights(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const babyId = Number(req.params.babyId);

      // Get caregiver ID
      const caregiver = await prisma.caregiver.findFirst({
        where: { userId },
      });

      if (!caregiver) {
        throw AppError.forbidden('Usuário não é um cuidador');
      }

      const insights = await aiInsightService.generateInsights(caregiver.id, babyId);

      res.json({
        success: true,
        data: insights,
        message: `${insights.length} novos insights gerados`,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /ai/insights/:id/read
   * Mark insight as read
   */
  static async markInsightRead(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const insightId = Number(req.params.id);

      await aiInsightService.markAsRead(insightId);

      res.json({
        success: true,
        message: 'Insight marcado como lido',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /ai/insights/:id/dismiss
   * Dismiss an insight
   */
  static async dismissInsight(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const insightId = Number(req.params.id);

      await aiInsightService.dismissInsight(insightId);

      res.json({
        success: true,
        message: 'Insight descartado',
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // RAG / Knowledge Base (Admin)
  // ==========================================

  /**
   * GET /ai/documents
   * List indexed documents
   */
  static async listDocuments(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const documents = await ragService.listDocuments();

      res.json({
        success: true,
        data: documents,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /ai/documents/ingest
   * Ingest a document (manual upload)
   */
  static async ingestDocument(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { sourcePath, title, content, tags, metadata } = req.body;

      if (!sourcePath || !title || !content) {
        throw AppError.badRequest('sourcePath, title e content são obrigatórios');
      }

      if (!openaiService.isConfigured()) {
        throw AppError.internal('Serviço de IA não está configurado');
      }

      const documentId = await ragService.ingestDocument({
        sourcePath,
        title,
        content,
        tags,
        metadata,
      });

      res.status(201).json({
        success: true,
        data: { documentId },
        message: 'Documento indexado com sucesso',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /ai/documents/:id
   * Delete a document and its chunks
   */
  static async deleteDocument(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const documentId = Number(req.params.id);

      await ragService.deleteDocument(documentId);

      res.json({
        success: true,
        message: 'Documento removido com sucesso',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /ai/search
   * Search the knowledge base (for debugging/testing)
   */
  static async searchKnowledge(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { query, topK, tags } = req.body;

      if (!query) {
        throw AppError.badRequest('query é obrigatório');
      }

      if (!openaiService.isConfigured()) {
        throw AppError.internal('Serviço de IA não está configurado');
      }

      const chunks = await ragService.searchChunks(query, topK, tags);

      res.json({
        success: true,
        data: chunks.map(c => ({
          id: c.id,
          content: c.content.substring(0, 200) + '...',
          similarity: c.similarity,
          source: c.documentSource,
          title: c.documentTitle,
        })),
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // Health Check
  // ==========================================

  /**
   * GET /ai/health
   * Check AI service health
   */
  static async healthCheck(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const isConfigured = openaiService.isConfigured();

      const docCount = await prisma.aiDocument.count();
      const chunkCount = await prisma.aiChunk.count();
      const sessionCount = await prisma.aiChatSession.count();

      res.json({
        success: true,
        data: {
          openaiConfigured: isConfigured,
          knowledgeBase: {
            documents: docCount,
            chunks: chunkCount,
          },
          chatSessions: sessionCount,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
