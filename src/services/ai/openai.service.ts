// Olive Baby API - OpenAI Service
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { AI_TOOL_DEFINITIONS, AI_SYSTEM_PROMPT } from '../../types';

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: OpenAIToolCall[];
}

interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface ChatCompletionOptions {
  messages: OpenAIMessage[];
  tools?: typeof AI_TOOL_DEFINITIONS;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

interface ChatCompletionResponse {
  id: string;
  content: string | null;
  toolCalls?: OpenAIToolCall[];
  finishReason: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

interface EmbeddingResponse {
  embedding: number[];
  usage: {
    promptTokens: number;
    totalTokens: number;
  };
}

export class OpenAIService {
  private apiKey: string;
  private baseUrl = 'https://api.openai.com/v1';
  private model: string;
  private embeddingModel: string;

  constructor() {
    if (!env.OPENAI_API_KEY) {
      logger.warn('⚠️ OPENAI_API_KEY not configured - AI features will be disabled');
    }
    this.apiKey = env.OPENAI_API_KEY || '';
    this.model = env.OPENAI_MODEL;
    this.embeddingModel = env.OPENAI_EMBEDDING_MODEL;
  }

  /**
   * Verifica se o serviço está configurado
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Gera embedding para um texto
   */
  async createEmbedding(text: string): Promise<EmbeddingResponse> {
    if (!this.isConfigured()) {
      throw new Error('OpenAI API key not configured');
    }

    try {
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.embeddingModel,
          input: text,
        }),
      });

      if (!response.ok) {
        const error = await response.json() as { error?: { message?: string } };
        logger.error('OpenAI embedding error:', error);
        throw new Error(`OpenAI API error: ${error.error?.message || 'Unknown error'}`);
      }

      const data = await response.json() as { data: Array<{ embedding: number[] }>; usage: { prompt_tokens: number; total_tokens: number } };

      return {
        embedding: data.data[0].embedding,
        usage: {
          promptTokens: data.usage.prompt_tokens,
          totalTokens: data.usage.total_tokens,
        },
      };
    } catch (error) {
      logger.error('Failed to create embedding:', error);
      throw error;
    }
  }

  /**
   * Gera embeddings em batch
   */
  async createEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.isConfigured()) {
      throw new Error('OpenAI API key not configured');
    }

    try {
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.embeddingModel,
          input: texts,
        }),
      });

      if (!response.ok) {
        const error = await response.json() as { error?: { message?: string } };
        logger.error('OpenAI embeddings error:', error);
        throw new Error(`OpenAI API error: ${error.error?.message || 'Unknown error'}`);
      }

      const data = await response.json() as { data: Array<{ index: number; embedding: number[] }> };

      // Sort by index to maintain order
      const sorted = data.data.sort((a, b) => a.index - b.index);
      return sorted.map((item) => item.embedding);
    } catch (error) {
      logger.error('Failed to create embeddings:', error);
      throw error;
    }
  }

  /**
   * Executa chat completion
   */
  async chatCompletion(options: ChatCompletionOptions): Promise<ChatCompletionResponse> {
    if (!this.isConfigured()) {
      throw new Error('OpenAI API key not configured');
    }

    const {
      messages,
      tools,
      temperature = env.AI_TEMPERATURE,
      maxTokens = env.AI_MAX_TOKENS,
    } = options;

    try {
      const body: Record<string, unknown> = {
        model: this.model,
        messages,
        temperature,
        max_tokens: maxTokens,
      };

      if (tools && tools.length > 0) {
        body.tools = tools;
        body.tool_choice = 'auto';
      }

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json() as { error?: { message?: string } };
        logger.error('OpenAI chat completion error:', error);
        throw new Error(`OpenAI API error: ${error.error?.message || 'Unknown error'}`);
      }

      const data = await response.json() as {
        id: string;
        choices: Array<{
          message: { content: string | null; tool_calls?: Array<unknown> };
          finish_reason: string;
        }>;
        usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
      };
      const choice = data.choices[0];

      return {
        id: data.id,
        content: choice.message.content,
        toolCalls: choice.message.tool_calls as any,
        finishReason: choice.finish_reason,
        usage: {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        },
      };
    } catch (error) {
      logger.error('Failed to complete chat:', error);
      throw error;
    }
  }

  /**
   * Executa chat completion com streaming
   */
  async *chatCompletionStream(options: ChatCompletionOptions): AsyncGenerator<string> {
    if (!this.isConfigured()) {
      throw new Error('OpenAI API key not configured');
    }

    const {
      messages,
      tools,
      temperature = env.AI_TEMPERATURE,
      maxTokens = env.AI_MAX_TOKENS,
    } = options;

    try {
      const body: Record<string, unknown> = {
        model: this.model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: true,
      };

      if (tools && tools.length > 0) {
        body.tools = tools;
        body.tool_choice = 'auto';
      }

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json() as { error?: { message?: string } };
        throw new Error(`OpenAI API error: ${error.error?.message || 'Unknown error'}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') return;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content;
              if (content) {
                yield content;
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (error) {
      logger.error('Failed to stream chat:', error);
      throw error;
    }
  }

  /**
   * Monta o sistema de mensagens para o chat
   */
  buildMessages(
    contextChunks: string[],
    conversationHistory: { role: 'user' | 'assistant'; content: string }[],
    userMessage: string,
    babyContext?: string
  ): OpenAIMessage[] {
    const messages: OpenAIMessage[] = [];

    // System prompt
    let systemContent = AI_SYSTEM_PROMPT;
    
    // Add baby context if available
    if (babyContext) {
      systemContent += `\n\n## Contexto do Bebê Atual\n${babyContext}`;
    }

    // Add RAG context if available
    if (contextChunks.length > 0) {
      systemContent += `\n\n## Base de Conhecimento Relevante\n${contextChunks.join('\n\n---\n\n')}`;
    }

    messages.push({
      role: 'system',
      content: systemContent,
    });

    // Conversation history (last N messages)
    for (const msg of conversationHistory) {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    }

    // Current user message
    messages.push({
      role: 'user',
      content: userMessage,
    });

    return messages;
  }
}

// Singleton instance
export const openaiService = new OpenAIService();
