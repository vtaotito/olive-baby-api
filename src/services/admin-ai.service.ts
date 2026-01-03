// Olive Baby API - Admin AI Service
// Manages AI Assistant configuration and Knowledge Base

import { PrismaClient, AiConfigStatus, KnowledgeBaseStatus } from '@prisma/client';
import { AppError } from '../utils/errors/AppError';
import { logger } from '../config/logger';

const prisma = new PrismaClient();

export class AdminAiService {
  // ==========================================
  // AI Configuration Management
  // ==========================================

  /**
   * Get all AI configs (published + drafts)
   */
  static async getConfigs() {
    const configs = await prisma.aiAssistantConfig.findMany({
      orderBy: [
        { isPublished: 'desc' },
        { version: 'desc' },
        { updatedAt: 'desc' },
      ],
    });

    return configs.map(config => ({
      ...config,
      temperature: parseFloat(config.temperature.toString()),
    }));
  }

  /**
   * Get published config (active one)
   */
  static async getPublishedConfig() {
    const config = await prisma.aiAssistantConfig.findFirst({
      where: { isPublished: true },
      orderBy: { version: 'desc' },
    });

    if (!config) {
      return null;
    }

    return {
      ...config,
      temperature: parseFloat(config.temperature.toString()),
    };
  }

  /**
   * Get config by ID
   */
  static async getConfigById(id: number) {
    const config = await prisma.aiAssistantConfig.findUnique({
      where: { id },
    });

    if (!config) {
      throw AppError.notFound('Configuração não encontrada');
    }

    return {
      ...config,
      temperature: parseFloat(config.temperature.toString()),
    };
  }

  /**
   * Create new AI config (draft)
   */
  static async createConfig(
    data: {
      name: string;
      systemPrompt: string;
      guardrails?: Record<string, unknown>;
      model?: string;
      temperature?: number;
      maxTokens?: number;
    },
    createdById?: number
  ) {
    const config = await prisma.aiAssistantConfig.create({
      data: {
        name: data.name,
        systemPrompt: data.systemPrompt,
        guardrails: (data.guardrails || {}) as any,
        model: data.model || 'gpt-4o',
        temperature: data.temperature || 0.7,
        maxTokens: data.maxTokens || 2048,
        status: 'DRAFT',
        isPublished: false,
        version: 1,
        createdById,
      },
    });

    logger.info(`AI Config created: ${config.id} by user ${createdById}`);
    return {
      ...config,
      temperature: parseFloat(config.temperature.toString()),
    };
  }

  /**
   * Update AI config
   */
  static async updateConfig(
    id: number,
    data: {
      name?: string;
      systemPrompt?: string;
      guardrails?: Record<string, unknown>;
      model?: string;
      temperature?: number;
      maxTokens?: number;
    }
  ) {
    const existing = await prisma.aiAssistantConfig.findUnique({
      where: { id },
    });

    if (!existing) {
      throw AppError.notFound('Configuração não encontrada');
    }

    // Can only edit drafts
    if (existing.isPublished) {
      throw AppError.conflict('Não é possível editar uma configuração publicada. Crie um novo draft.');
    }

    const config = await prisma.aiAssistantConfig.update({
      where: { id },
      data: {
        name: data.name,
        systemPrompt: data.systemPrompt,
        guardrails: data.guardrails as any,
        model: data.model,
        temperature: data.temperature,
        maxTokens: data.maxTokens,
      },
    });

    logger.info(`AI Config updated: ${config.id}`);
    return {
      ...config,
      temperature: parseFloat(config.temperature.toString()),
    };
  }

  /**
   * Publish AI config (create new version)
   */
  static async publishConfig(id: number) {
    const existing = await prisma.aiAssistantConfig.findUnique({
      where: { id },
    });

    if (!existing) {
      throw AppError.notFound('Configuração não encontrada');
    }

    // Get highest version
    const latestVersion = await prisma.aiAssistantConfig.aggregate({
      _max: { version: true },
    });

    const newVersion = (latestVersion._max.version || 0) + 1;

    // Transaction: unpublish all others, publish this one
    await prisma.$transaction(async (tx) => {
      // Unpublish all
      await tx.aiAssistantConfig.updateMany({
        where: { isPublished: true },
        data: { isPublished: false },
      });

      // Publish this one with new version
      await tx.aiAssistantConfig.update({
        where: { id },
        data: {
          isPublished: true,
          status: 'PUBLISHED',
          version: newVersion,
          publishedAt: new Date(),
        },
      });
    });

    const config = await prisma.aiAssistantConfig.findUnique({
      where: { id },
    });

    logger.info(`AI Config ${id} published as version ${newVersion}`);
    return {
      ...config,
      temperature: config ? parseFloat(config.temperature.toString()) : 0,
    };
  }

  /**
   * Duplicate config to create new draft
   */
  static async duplicateConfig(id: number, createdById?: number) {
    const original = await prisma.aiAssistantConfig.findUnique({
      where: { id },
    });

    if (!original) {
      throw AppError.notFound('Configuração não encontrada');
    }

    const config = await prisma.aiAssistantConfig.create({
      data: {
        name: `${original.name} (cópia)`,
        systemPrompt: original.systemPrompt,
        guardrails: original.guardrails || {},
        model: original.model,
        temperature: original.temperature,
        maxTokens: original.maxTokens,
        status: 'DRAFT',
        isPublished: false,
        version: 1,
        createdById,
      },
    });

    logger.info(`AI Config duplicated from ${id} to ${config.id}`);
    return {
      ...config,
      temperature: parseFloat(config.temperature.toString()),
    };
  }

  /**
   * Delete draft config
   */
  static async deleteConfig(id: number) {
    const existing = await prisma.aiAssistantConfig.findUnique({
      where: { id },
    });

    if (!existing) {
      throw AppError.notFound('Configuração não encontrada');
    }

    if (existing.isPublished) {
      throw AppError.conflict('Não é possível excluir a configuração publicada');
    }

    await prisma.aiAssistantConfig.delete({
      where: { id },
    });

    logger.info(`AI Config deleted: ${id}`);
  }

  // ==========================================
  // Knowledge Base Management
  // ==========================================

  /**
   * List KB documents with filters
   */
  static async listDocuments(filters?: {
    status?: KnowledgeBaseStatus;
    tag?: string;
    search?: string;
  }) {
    const where: any = {};

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.tag) {
      where.tags = { has: filters.tag };
    }

    if (filters?.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { content: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const documents = await prisma.knowledgeBaseDocument.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    });

    return documents;
  }

  /**
   * Get document by ID
   */
  static async getDocumentById(id: number) {
    const document = await prisma.knowledgeBaseDocument.findUnique({
      where: { id },
    });

    if (!document) {
      throw AppError.notFound('Documento não encontrado');
    }

    return document;
  }

  /**
   * Create KB document
   */
  static async createDocument(
    data: {
      title: string;
      sourceType: string;
      content: string;
      tags?: string[];
    },
    createdById?: number
  ) {
    const document = await prisma.knowledgeBaseDocument.create({
      data: {
        title: data.title,
        sourceType: data.sourceType,
        content: data.content,
        tags: data.tags || [],
        status: 'DRAFT',
        version: 1,
        createdById,
      },
    });

    logger.info(`KB Document created: ${document.id} by user ${createdById}`);
    return document;
  }

  /**
   * Update KB document
   */
  static async updateDocument(
    id: number,
    data: {
      title?: string;
      sourceType?: string;
      content?: string;
      tags?: string[];
    }
  ) {
    const existing = await prisma.knowledgeBaseDocument.findUnique({
      where: { id },
    });

    if (!existing) {
      throw AppError.notFound('Documento não encontrado');
    }

    // If published, increment version
    const newVersion = existing.status === 'PUBLISHED' ? existing.version + 1 : existing.version;

    const document = await prisma.knowledgeBaseDocument.update({
      where: { id },
      data: {
        title: data.title,
        sourceType: data.sourceType,
        content: data.content,
        tags: data.tags,
        version: newVersion,
        status: existing.status === 'PUBLISHED' ? 'DRAFT' : existing.status,
      },
    });

    logger.info(`KB Document updated: ${document.id}`);
    return document;
  }

  /**
   * Publish KB document
   */
  static async publishDocument(id: number) {
    const existing = await prisma.knowledgeBaseDocument.findUnique({
      where: { id },
    });

    if (!existing) {
      throw AppError.notFound('Documento não encontrado');
    }

    const document = await prisma.knowledgeBaseDocument.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });

    logger.info(`KB Document published: ${document.id}`);
    return document;
  }

  /**
   * Archive KB document
   */
  static async archiveDocument(id: number) {
    const existing = await prisma.knowledgeBaseDocument.findUnique({
      where: { id },
    });

    if (!existing) {
      throw AppError.notFound('Documento não encontrado');
    }

    const document = await prisma.knowledgeBaseDocument.update({
      where: { id },
      data: {
        status: 'ARCHIVED',
        archivedAt: new Date(),
      },
    });

    logger.info(`KB Document archived: ${document.id}`);
    return document;
  }

  /**
   * Delete KB document
   */
  static async deleteDocument(id: number) {
    const existing = await prisma.knowledgeBaseDocument.findUnique({
      where: { id },
    });

    if (!existing) {
      throw AppError.notFound('Documento não encontrado');
    }

    await prisma.knowledgeBaseDocument.delete({
      where: { id },
    });

    logger.info(`KB Document deleted: ${id}`);
  }

  /**
   * Get all unique tags from KB documents
   */
  static async getAllTags() {
    const documents = await prisma.knowledgeBaseDocument.findMany({
      select: { tags: true },
    });

    const allTags = new Set<string>();
    documents.forEach(doc => {
      doc.tags.forEach(tag => allTags.add(tag));
    });

    return Array.from(allTags).sort();
  }

  /**
   * Get KB statistics
   */
  static async getKbStats() {
    const [total, published, draft, archived] = await Promise.all([
      prisma.knowledgeBaseDocument.count(),
      prisma.knowledgeBaseDocument.count({ where: { status: 'PUBLISHED' } }),
      prisma.knowledgeBaseDocument.count({ where: { status: 'DRAFT' } }),
      prisma.knowledgeBaseDocument.count({ where: { status: 'ARCHIVED' } }),
    ]);

    return { total, published, draft, archived };
  }

  /**
   * Preview assembled prompt with published config and KB
   */
  static async previewAssembledPrompt() {
    const config = await this.getPublishedConfig();
    const documents = await prisma.knowledgeBaseDocument.findMany({
      where: { status: 'PUBLISHED' },
    });

    const kbContent = documents
      .map(doc => `## ${doc.title}\n\n${doc.content}`)
      .join('\n\n---\n\n');

    const preview = {
      config: config || { systemPrompt: '(Nenhuma configuração publicada)' },
      knowledgeBase: {
        documentCount: documents.length,
        content: kbContent || '(Nenhum documento publicado)',
      },
      assembledPrompt: config 
        ? `${config.systemPrompt}\n\n---\n\n### Base de Conhecimento\n\n${kbContent}`
        : null,
    };

    return preview;
  }
}

export default AdminAiService;
