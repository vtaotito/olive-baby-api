// Olive Baby API - AI Chat Orchestration Service
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { AppError } from '../../utils/errors/AppError';
import { requireBabyAccessByCaregiverId } from '../../utils/helpers/baby-permission.helper';
import { openaiService } from './openai.service';
import { ragService } from './rag.service';
import { aiToolsService } from './tools.service';
import { AI_TOOL_DEFINITIONS, AiChatMessage, AiChatSession, AiCitation, AI_SAFETY_DISCLAIMERS } from '../../types';
import { differenceInDays, differenceInMonths } from 'date-fns';

interface SendMessageOptions {
  userId: number;
  caregiverId: number;
  sessionId: number;
  message: string;
}

interface SendMessageResult {
  userMessage: AiChatMessage;
  assistantMessage: AiChatMessage;
  citations: AiCitation[];
  toolsUsed: string[];
}

interface CreateSessionOptions {
  userId: number;
  babyId: number;
  title?: string;
}

const MAX_HISTORY_MESSAGES = 10;
const MAX_TOOL_ITERATIONS = 5;

export class AIChatService {
  /**
   * Cria uma nova sessão de chat
   */
  async createSession(options: CreateSessionOptions): Promise<AiChatSession> {
    const { userId, babyId, title } = options;

    // Verify user has access to baby
    const caregiver = await prisma.caregiver.findFirst({
      where: { userId },
    });

    if (!caregiver) {
      throw AppError.forbidden('Usuário não é um cuidador');
    }

    await requireBabyAccessByCaregiverId(caregiver.id, babyId);

    const session = await prisma.aiChatSession.create({
      data: {
        userId,
        babyId,
        title: title || 'Nova conversa',
      },
    });

    return session as AiChatSession;
  }

  /**
   * Lista sessões de chat do usuário para um bebê
   */
  async listSessions(userId: number, babyId?: number): Promise<AiChatSession[]> {
    const where: any = { userId, isActive: true };
    if (babyId) {
      where.babyId = babyId;
    }

    const sessions = await prisma.aiChatSession.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
        baby: {
          select: { name: true },
        },
      },
    });

    return sessions as any;
  }

  /**
   * Obtém uma sessão com suas mensagens
   */
  async getSession(userId: number, sessionId: number): Promise<AiChatSession> {
    const session = await prisma.aiChatSession.findFirst({
      where: { id: sessionId, userId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
        baby: {
          select: { name: true, birthDate: true },
        },
      },
    });

    if (!session) {
      throw AppError.notFound('Sessão não encontrada');
    }

    return session as any;
  }

  /**
   * Envia uma mensagem e obtém resposta do assistente
   */
  async sendMessage(options: SendMessageOptions): Promise<SendMessageResult> {
    const { userId, caregiverId, sessionId, message } = options;

    // Get session
    const session = await prisma.aiChatSession.findFirst({
      where: { id: sessionId, userId },
      include: {
        baby: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: MAX_HISTORY_MESSAGES,
        },
      },
    });

    if (!session) {
      throw AppError.notFound('Sessão não encontrada');
    }

    // Save user message
    const userMessage = await prisma.aiChatMessage.create({
      data: {
        sessionId,
        role: 'user',
        content: message,
      },
    });

    // Build context
    const babyContext = this.buildBabyContext(session.baby);
    const conversationHistory = session.messages
      .reverse()
      .filter(m => m.role !== 'tool')
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    // RAG: Search relevant chunks
    const ragChunks = await ragService.searchChunks(message);
    const ragContext = ragService.formatChunksForContext(ragChunks);
    const citations = ragService.extractCitations(ragChunks);

    // Build messages for OpenAI
    let messages = openaiService.buildMessages(
      ragContext,
      conversationHistory,
      message,
      babyContext
    );

    // Tool calling loop
    const toolsUsed: string[] = [];
    let iterations = 0;
    let assistantContent = '';

    while (iterations < MAX_TOOL_ITERATIONS) {
      iterations++;

      const response = await openaiService.chatCompletion({
        messages,
        tools: AI_TOOL_DEFINITIONS,
      });

      // If no tool calls, we have our final response
      if (!response.toolCalls || response.toolCalls.length === 0) {
        assistantContent = response.content || '';
        break;
      }

      // Execute tool calls
      const toolMessages: any[] = [];
      
      // Add assistant message with tool calls
      messages.push({
        role: 'assistant',
        content: response.content || '',
        tool_calls: response.toolCalls,
      });

      for (const toolCall of response.toolCalls) {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments);
        
        logger.info(`🔧 Tool call: ${toolName}`, toolArgs);
        toolsUsed.push(toolName);

        // Execute tool with context
        const result = await aiToolsService.executeTool(toolName, toolArgs, {
          userId,
          caregiverId,
          babyId: session.babyId,
        });

        // Add tool result
        toolMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: toolName,
          content: JSON.stringify(result.error || result.result),
        });

        // Save tool message in DB
        await prisma.aiChatMessage.create({
          data: {
            sessionId,
            role: 'tool',
            content: JSON.stringify(result.result),
            toolName,
            toolPayload: result.result as any,
          },
        });
      }

      // Add all tool results to messages
      messages.push(...toolMessages);
    }

    // Add safety disclaimer if needed
    assistantContent = this.addSafetyDisclaimers(assistantContent, message);

    // Update session title if it's the first real message
    if (session.messages.length <= 1 && !session.title?.includes(message.substring(0, 20))) {
      const title = message.length > 50 ? message.substring(0, 47) + '...' : message;
      await prisma.aiChatSession.update({
        where: { id: sessionId },
        data: { title },
      });
    }

    // Save assistant message
    const assistantMessage = await prisma.aiChatMessage.create({
      data: {
        sessionId,
        role: 'assistant',
        content: assistantContent,
        citations: citations as any,
      },
    });

    // Update session timestamp
    await prisma.aiChatSession.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() },
    });

    return {
      userMessage: userMessage as unknown as AiChatMessage,
      assistantMessage: assistantMessage as unknown as AiChatMessage,
      citations,
      toolsUsed,
    };
  }

  /**
   * Arquiva uma sessão de chat
   */
  async archiveSession(userId: number, sessionId: number): Promise<void> {
    const session = await prisma.aiChatSession.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw AppError.notFound('Sessão não encontrada');
    }

    await prisma.aiChatSession.update({
      where: { id: sessionId },
      data: { isActive: false },
    });
  }

  /**
   * Deleta uma sessão de chat
   */
  async deleteSession(userId: number, sessionId: number): Promise<void> {
    const session = await prisma.aiChatSession.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw AppError.notFound('Sessão não encontrada');
    }

    await prisma.aiChatSession.delete({
      where: { id: sessionId },
    });
  }

  // ==========================================
  // Private Helpers
  // ==========================================

  /**
   * Constrói o contexto do bebê para o LLM
   */
  private buildBabyContext(baby: any): string {
    const birthDate = new Date(baby.birthDate);
    const now = new Date();
    const ageInDays = differenceInDays(now, birthDate);
    const ageInMonths = differenceInMonths(now, birthDate);

    let ageDescription: string;
    if (ageInMonths >= 1) {
      ageDescription = `${ageInMonths} ${ageInMonths === 1 ? 'mês' : 'meses'}`;
    } else {
      const weeks = Math.floor(ageInDays / 7);
      if (weeks >= 1) {
        ageDescription = `${weeks} ${weeks === 1 ? 'semana' : 'semanas'}`;
      } else {
        ageDescription = `${ageInDays} ${ageInDays === 1 ? 'dia' : 'dias'}`;
      }
    }

    let context = `**Bebê**: ${baby.name}\n`;
    context += `**Idade**: ${ageDescription}\n`;
    context += `**Data de nascimento**: ${birthDate.toLocaleDateString('pt-BR')}\n`;

    if (baby.birthWeightGrams) {
      context += `**Peso ao nascer**: ${baby.birthWeightGrams}g\n`;
    }

    if (baby.birthLengthCm) {
      context += `**Comprimento ao nascer**: ${baby.birthLengthCm}cm\n`;
    }

    return context;
  }

  /**
   * Adiciona disclaimers de segurança conforme necessário
   */
  private addSafetyDisclaimers(content: string, userMessage: string): string {
    const lowerMessage = userMessage.toLowerCase();
    const lowerContent = content.toLowerCase();

    // Alert conditions that require medical attention
    const alertKeywords = [
      'febre alta', 'febre acima de 38',
      'dificuldade respiratória', 'dificuldade para respirar',
      'não está fazendo xixi', 'pouco xixi', 'sem xixi',
      'letargia', 'sonolência extrema', 'muito sonolento',
      'não quer mamar', 'recusa', 'vômito',
      'sangue', 'engasgou', 'sufocou',
      'convulsão', 'convulsões',
      'não acorda', 'difícil acordar',
    ];

    for (const keyword of alertKeywords) {
      if (lowerMessage.includes(keyword) || lowerContent.includes(keyword)) {
        if (!content.includes('pediatra') && !content.includes('médico')) {
          content += '\n\n' + AI_SAFETY_DISCLAIMERS.alert;
        }
        return content;
      }
    }

    // Add general disclaimer occasionally
    const medicalTopics = ['febre', 'doença', 'machucado', 'alergia', 'remédio', 'medicamento'];
    const hasMedicalTopic = medicalTopics.some(
      topic => lowerMessage.includes(topic) || lowerContent.includes(topic)
    );

    if (hasMedicalTopic && !content.includes('⚠️') && !content.includes('🚨')) {
      content += '\n\n' + AI_SAFETY_DISCLAIMERS.general;
    }

    return content;
  }
}

// Singleton instance
export const aiChatService = new AIChatService();
